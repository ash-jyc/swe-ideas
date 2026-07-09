import { createReadStream, existsSync, statSync } from 'node:fs'
import { createServer } from 'node:http'
import { extname, join, normalize } from 'node:path'
import { fileURLToPath } from 'node:url'
import { Server } from 'socket.io'
import { EngineError } from '@midlife/shared'
import { RoomManager } from './rooms'

const PORT = Number(process.env.PORT) || 3001
const PROD = process.env.NODE_ENV === 'production'
const DIST = fileURLToPath(new URL('../../client/dist', import.meta.url))

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.map': 'application/json',
}

const httpServer = createServer((req, res) => {
  if (!PROD) {
    res.writeHead(200, { 'content-type': 'text/plain' })
    res.end('Midlife Crisis server (dev mode). The client runs on the Vite dev server.')
    return
  }
  const url = (req.url ?? '/').split('?')[0]
  const safe = normalize(url).replace(/^(\.\.[/\\])+/, '')
  let file = join(DIST, safe)
  if (!existsSync(file) || statSync(file).isDirectory()) {
    file = join(DIST, 'index.html') // SPA fallback
  }
  const type = MIME[extname(file)] ?? 'application/octet-stream'
  res.writeHead(200, { 'content-type': type })
  createReadStream(file).pipe(res)
})

const io = new Server(httpServer, {
  cors: { origin: true },
})

const manager = new RoomManager(io)

io.on('connection', (socket) => {
  const guard =
    <A extends unknown[]>(fn: (...args: A) => void) =>
    (...args: A) => {
      try {
        fn(...args)
      } catch (err) {
        if (err instanceof EngineError) {
          socket.emit('toast', err.message)
        } else {
          console.error('Unexpected error:', err)
          socket.emit('toast', 'Something broke on the server. Not the fun kind of broke.')
        }
      }
    }

  socket.on('room:create', guard((req, ack) => manager.create(socket, req?.name ?? '', ack)))
  socket.on('room:join', guard((req, ack) => manager.join(socket, req?.code ?? '', req?.name ?? '', ack)))
  socket.on('session:resume', guard((req, ack) => manager.resume(socket, req?.code ?? '', req?.token ?? '', ack)))
  socket.on('lobby:color', guard((color) => manager.setColor(socket, color)))
  socket.on('game:start', guard(() => manager.start(socket)))
  socket.on('game:action', guard((action) => manager.action(socket, action)))
  socket.on('game:tolobby', guard(() => manager.toLobby(socket)))
  socket.on('disconnect', () => manager.disconnect(socket))
})

httpServer.listen(PORT, () => {
  console.log(`Midlife Crisis server listening on :${PORT} (${PROD ? 'production' : 'dev'})`)
})
