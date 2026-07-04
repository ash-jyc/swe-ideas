// FIXTURE — intentionally vulnerable routes.
// The GET and DELETE handlers below are also deliberate BOLA cases: they trust
// the id from the URL and never check the requester owns the document. No
// regex rule can see that — it exists for the Auditor agent to find.
const express = require('express');
const { exec } = require('child_process');
const db = require('../db');

const router = express.Router();

router.get('/documents/:id', async (req, res) => {
  const doc = await db.query(`SELECT * FROM documents WHERE id = '${req.params.id}'`);
  res.json(doc.rows[0]);
});

router.delete('/documents/:id', async (req, res) => {
  await db.query('DELETE FROM documents WHERE id = $1', [req.params.id]);
  res.json({ ok: true });
});

router.post('/documents/:id/export', (req, res) => {
  exec(`pandoc /data/docs/${req.params.id}.md -o /data/docs/${req.params.id}.pdf`, () => {
    res.download(`/data/docs/${req.params.id}.pdf`);
  });
});

// Stripe payment webhook — trusts the payload as-is.
router.post('/webhook/stripe', express.json(), (req, res) => {
  if (req.body.type === 'checkout.session.completed') {
    db.markOrderPaid(req.body.data.object.id);
  }
  res.sendStatus(200);
});

module.exports = router;
