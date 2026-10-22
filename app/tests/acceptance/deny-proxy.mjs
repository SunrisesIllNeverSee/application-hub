// M09 W9 — a local "deny everything" HTTP(S) proxy for the dev server under
// test. The server is started with NODE_USE_ENV_PROXY=1 and HTTP(S)_PROXY
// pointing here, so any SERVER-side outbound request (for example the
// middleware's auth.getUser() against the placeholder Supabase URL) is
// recorded (method + host only, never bodies) and refused with 403 instead
// of reaching the network.
//
//   node tests/acceptance/deny-proxy.mjs <port> <log.json>

import http from 'node:http'
import fs from 'node:fs'

const port = Number(process.argv[2] ?? 39871)
const logFile = process.argv[3]
const seen = []
const flush = () => { if (logFile) fs.writeFileSync(logFile, JSON.stringify(seen, null, 2)) }

const server = http.createServer((req, res) => {
  let host = ''
  try { host = new URL(req.url).host } catch { host = req.headers.host ?? '' }
  seen.push({ method: req.method, host, at: new Date().toISOString() })
  flush()
  res.writeHead(403, { 'content-type': 'text/plain' }).end('blocked by acceptance deny-proxy')
})
server.on('connect', (req, socket) => {
  seen.push({ method: 'CONNECT', host: req.url, at: new Date().toISOString() })
  flush()
  socket.end('HTTP/1.1 403 Forbidden\r\n\r\n')
})
server.listen(port, '127.0.0.1', () => { flush(); console.log(`deny-proxy listening on ${port}`) })
process.on('SIGTERM', () => { flush(); server.close(); process.exit(0) })
