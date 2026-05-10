import { Router } from 'express'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { randomUUID } from 'crypto'
import db from '../db.js'
import { logActivity } from '../middleware/logger.js'

const router = Router()

router.post('/register', async (req, res) => {
  try {
    console.log('[REGISTER] Request body:', req.body)
    const { username, email, password } = req.body
    if (!username || !email || !password) {
      console.log('[REGISTER] Missing fields')
      return res.status(400).json({ message: 'Все поля обязательны' })
    }

    console.log('[REGISTER] Checking existing user...')
    const existing = db.prepare('SELECT id FROM users WHERE email = ? OR username = ?').get(email, username)
    if (existing) {
      console.log('[REGISTER] User already exists')
      return res.status(409).json({ message: 'Email или имя уже занято' })
    }

    console.log('[REGISTER] Hashing password...')
    const hashed = await bcrypt.hash(password, 10)
    const id = randomUUID()
    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress
    const userAgent = req.headers['user-agent']
    
    console.log('[REGISTER] Inserting user into database...')
    db.prepare(`
      INSERT INTO users (id, username, email, password, registrationIp, registrationUserAgent) 
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(id, username, email, hashed, ip, userAgent)

    console.log('[REGISTER] Logging activity...')
    logActivity(id, 'register', req, { username, email })

    console.log('[REGISTER] Creating token...')
    const user = { id, username, email }
    const token = jwt.sign(user, process.env.JWT_SECRET, { expiresIn: '7d' })
    console.log('[REGISTER] Success!')
    res.json({ token, user })
  } catch (error) {
    console.error('[REGISTER] Error:', error)
    res.status(500).json({ message: 'Ошибка регистрации', error: error.message })
  }
})

router.post('/login', async (req, res) => {
  try {
    console.log('[LOGIN] Request body:', req.body)
    const { email, password } = req.body
    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email)
    if (!user) {
      console.log('[LOGIN] User not found')
      return res.status(401).json({ message: 'Неверный email или пароль' })
    }

    console.log('[LOGIN] Comparing password...')
    const ok = await bcrypt.compare(password, user.password)
    if (!ok) {
      console.log('[LOGIN] Wrong password')
      return res.status(401).json({ message: 'Неверный email или пароль' })
    }

    console.log('[LOGIN] Logging activity...')
    logActivity(user.id, 'login', req)

    console.log('[LOGIN] Creating token...')
    const payload = { id: user.id, username: user.username, email: user.email }
    const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '7d' })
    console.log('[LOGIN] Success!')
    res.json({ token, user: payload })
  } catch (error) {
    console.error('[LOGIN] Error:', error)
    res.status(500).json({ message: 'Ошибка входа', error: error.message })
  }
})

export default router
