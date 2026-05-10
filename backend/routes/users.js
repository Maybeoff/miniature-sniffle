import { Router } from 'express'
import bcrypt from 'bcryptjs'
import db from '../db.js'
import { authMiddleware } from '../middleware/auth.js'

const router = Router()
router.use(authMiddleware)

router.get('/:id', (req, res) => {
  try {
    const user = db.prepare('SELECT id, username, email, avatarUrl, createdAt FROM users WHERE id = ?').get(req.params.id)
    if (!user) return res.status(404).json({ message: 'Пользователь не найден' })
    
    const followers = db.prepare('SELECT COUNT(*) as count FROM follows WHERE followingId = ?').get(req.params.id).count
    const following = db.prepare('SELECT COUNT(*) as count FROM follows WHERE followerId = ?').get(req.params.id).count
    const isFollowing = db.prepare('SELECT 1 FROM follows WHERE followerId = ? AND followingId = ?').get(req.user.id, req.params.id) ? true : false
    
    res.json({ ...user, followers, following, isFollowing })
  } catch (error) {
    console.error('[GET USER] Error:', error)
    res.status(500).json({ message: 'Ошибка получения пользователя', error: error.message })
  }
})

router.get('/:id/following', (req, res) => {
  try {
    const followingIds = db.prepare('SELECT followingId FROM follows WHERE followerId = ?').all(req.params.id).map(f => f.followingId)
    res.json(followingIds)
  } catch (error) {
    console.error('[GET FOLLOWING] Error:', error)
    res.status(500).json({ message: 'Ошибка получения подписок', error: error.message })
  }
})

router.get('/:id/following-users', (req, res) => {
  try {
    const users = db.prepare(`
      SELECT u.id, u.username, u.email, u.avatarUrl, u.createdAt 
      FROM follows f 
      JOIN users u ON f.followingId = u.id 
      WHERE f.followerId = ?
    `).all(req.params.id)
    res.json(users)
  } catch (error) {
    console.error('[GET FOLLOWING USERS] Error:', error)
    res.status(500).json({ message: 'Ошибка получения подписок', error: error.message })
  }
})

router.get('/:id/followers', (req, res) => {
  try {
    const users = db.prepare(`
      SELECT u.id, u.username, u.email, u.avatarUrl, u.createdAt 
      FROM follows f 
      JOIN users u ON f.followerId = u.id 
      WHERE f.followingId = ?
    `).all(req.params.id)
    res.json(users)
  } catch (error) {
    console.error('[GET FOLLOWERS] Error:', error)
    res.status(500).json({ message: 'Ошибка получения подписчиков', error: error.message })
  }
})

router.post('/avatar', async (req, res) => {
  try {
    const { avatarUrl } = req.body
    db.prepare('UPDATE users SET avatarUrl = ? WHERE id = ?').run(avatarUrl, req.user.id)
    res.json({ success: true })
  } catch (error) {
    console.error('[UPDATE AVATAR] Error:', error)
    res.status(500).json({ message: 'Ошибка обновления аватара', error: error.message })
  }
})

router.post('/profile', async (req, res) => {
  try {
    const { username, email } = req.body
    
    const existing = db.prepare('SELECT id FROM users WHERE (email = ? OR username = ?) AND id != ?').get(email, username, req.user.id)
    if (existing) return res.status(409).json({ message: 'Email или имя уже занято' })
    
    db.prepare('UPDATE users SET username = ?, email = ? WHERE id = ?').run(username, email, req.user.id)
    res.json({ success: true })
  } catch (error) {
    console.error('[UPDATE PROFILE] Error:', error)
    res.status(500).json({ message: 'Ошибка обновления профиля', error: error.message })
  }
})

router.post('/password', async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body
    const user = db.prepare('SELECT password FROM users WHERE id = ?').get(req.user.id)
    if (!user) return res.status(404).json({ message: 'Пользователь не найден' })
    
    const ok = await bcrypt.compare(currentPassword, user.password)
    if (!ok) return res.status(401).json({ message: 'Неверный текущий пароль' })
    
    const hashed = await bcrypt.hash(newPassword, 10)
    db.prepare('UPDATE users SET password = ? WHERE id = ?').run(hashed, req.user.id)
    res.json({ success: true })
  } catch (error) {
    console.error('[UPDATE PASSWORD] Error:', error)
    res.status(500).json({ message: 'Ошибка обновления пароля', error: error.message })
  }
})

router.post('/:id/follow', async (req, res) => {
  try {
    const followingId = req.params.id
    const followerId = req.user.id
    
    if (followingId === followerId) return res.status(400).json({ message: 'Нельзя подписаться на себя' })
    
    const existing = db.prepare('SELECT 1 FROM follows WHERE followerId = ? AND followingId = ?').get(followerId, followingId)
    
    if (existing) {
      db.prepare('DELETE FROM follows WHERE followerId = ? AND followingId = ?').run(followerId, followingId)
      res.json({ success: true, isFollowing: false })
    } else {
      db.prepare('INSERT INTO follows (followerId, followingId) VALUES (?, ?)').run(followerId, followingId)
      res.json({ success: true, isFollowing: true })
    }
  } catch (error) {
    console.error('[FOLLOW] Error:', error)
    res.status(500).json({ message: 'Ошибка подписки', error: error.message })
  }
})

export default router
