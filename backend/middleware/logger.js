import db from '../db.js'

export function logActivity(userId, action, req, metadata = {}) {
  const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress
  const userAgent = req.headers['user-agent']
  
  db.prepare(`
    INSERT INTO activity_log (userId, action, ip, userAgent, metadata)
    VALUES (?, ?, ?, ?, ?)
  `).run(userId, action, ip, userAgent, JSON.stringify(metadata))
}
