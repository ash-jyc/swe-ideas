import { createApp } from './app.js';
import { config } from './config.js';
import { migrate } from './db/migrate.js';
import { registerAnalyzer } from './security/analyzer.js';
import { stubAnalyzer } from './security/stubAnalyzer.js';
import { resumeDeployments } from './deploy/snapshots.js';
import { appManager } from './runner/manager.js';
import { handleUpgrade } from './runner/proxy.js';

async function main(): Promise<void> {
  migrate();

  // Register the placeholder security analyzer. A real AI analyzer is added
  // later by calling registerAnalyzer(myAnalyzer, true).
  registerAnalyzer(stubAnalyzer, true);

  const app = createApp();
  const server = app.listen(config.port, config.host, () => {
    console.log(`[vibe] platform listening on http://${config.host}:${config.port}`);
    console.log(`[vibe] data dir: ${config.dataDir}`);
  });

  // WebSocket pass-through to generated apps.
  server.on('upgrade', (req, socket, head) => {
    void handleUpgrade(req, socket as never, head);
  });

  // Bring previously-live deployments back up.
  await resumeDeployments().catch((e) => console.error('[vibe] resume error', e));

  const shutdown = async () => {
    console.log('[vibe] shutting down…');
    await appManager.stopAll();
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(0), 3000);
  };
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

main().catch((e) => {
  console.error('[vibe] fatal', e);
  process.exit(1);
});
