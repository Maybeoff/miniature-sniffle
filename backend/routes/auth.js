import { Router } from 'express'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { randomUUID } from 'crypto'
import db from '../db.js'
import { logActivity } from '../middleware/logger.js'

const router = Router()

router.post('/register', async (req, res) => {
  const { username, email, password } = req.body
  if (!username || !email || !password) return res.status(400).json({ message: 'Все поля обязательны' })

  const existing = db.prepare('SELECT id FROM users WHERE email = ? OR username = ?').get(email, username)
  if (existing) return res.status(409).json({ message: 'Email или имя уже занято' })

  const hashed = await bcrypt.hash(password, 10)
  const id = randomUUID()
  const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress
  const userAgent = req.headers['user-agent']
  
  db.prepare(`
    INSERT INTO users (id, username, email, password, registrationIp, registrationUserAgent) 
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(id, username, email, hashed, ip, userAgent)

  logActivity(id, 'register', req, { username, email })

  const user = { id, username, email }
  const token = jwt.sign(user, process.env.JWT_SECRET, { expiresIn: '7d' })
  res.json({ token, user })
})

router.post('/login', async (req, res) => {
  const { email, password } = req.body
  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email)
  if (!user) return res.status(401).json({ message: 'Неверный email или пароль' })

  const ok = await bcrypt.compare(password, user.password)
  if (!ok) return res.status(401).json({ message: 'Неверный email или пароль' })

  logActivity(user.id, 'login', req)

  const payload = { id: user.id, username: user.username, email: user.email }
  const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '7d' })
  res.json({ token, user: payload })
})

export default router
