import { Router } from 'express'
import bcrypt from 'bcryptjs'
import db from '../db.js'
import { authMiddleware } from '../middleware/auth.js'

const router = Router()
router.use(authMiddleware)

router.get('/:id', (req, res) => {
  const user = db.data.users.find(u => u.id === req.params.id)
  if (!user) return res.status(404).json({ message: 'Пользователь не найден' })
  const { password: _, ...safe } = user
  const followers = (db.data.follows || []).filter(f => f.followingId === req.params.id).length
  const following = (db.data.follows || []).filter(f => f.followerId === req.params.id).length
  const isFollowing = (db.data.follows || []).some(f => f.followerId === req.user.id && f.followingId === req.params.id)
  res.json({ ...safe, followers, following, isFollowing })
})

router.get('/:id/following', (req, res) => {
  const followingIds = (db.data.follows || [])
    .filter(f => f.followerId === req.params.id)
    .map(f => f.followingId)
  res.json(followingIds)
})

router.get('/:id/following-users', (req, res) => {
  const followingIds = (db.data.follows || [])
    .filter(f => f.followerId === req.params.id)
    .map(f => f.followingId)
  const users = followingIds.map(id => {
    const user = db.data.users.find(u => u.id === id)
    if (!user) return null
    const { password: _, ...safe } = user
    return safe
  }).filter(Boolean)
  res.json(users)
})

router.get('/:id/followers', (req, res) => {
  const followerIds = (db.data.follows || [])
    .filter(f => f.followingId === req.params.id)
    .map(f => f.followerId)
  const users = followerIds.map(id => {
    const user = db.data.users.find(u => u.id === id)
    if (!user) return null
    const { password: _, ...safe } = user
    return safe
  }).filter(Boolean)
  res.json(users)
})

router.post('/avatar', async (req, res) => {
  const { avatarUrl } = req.body
  const user = db.data.users.find(u => u.id === req.user.id)
  if (!user) return res.status(404).json({ message: 'Пользователь не найден' })
  user.avatarUrl = avatarUrl
  await db.write()
  res.json({ success: true })
})

router.post('/profile', async (req, res) => {
  const { username, email } = req.body
  const user = db.data.users.find(u => u.id === req.user.id)
  if (!user) return res.status(404).json({ message: 'Пользователь не найден' })
  
  const existing = db.data.users.find(u => u.id !== req.user.id && (u.email === email || u.username === username))
  if (existing) return res.status(409).json({ message: 'Email или имя уже занято' })
  
  user.username = username
  user.email = email
  await db.write()
  res.json({ success: true })
})

router.post('/password', async (req, res) => {
  const { currentPassword, newPassword } = req.body
  const user = db.data.users.find(u => u.id === req.user.id)
  if (!user) return res.status(404).json({ message: 'Пользователь не найден' })
  
  const ok = await bcrypt.compare(currentPassword, user.password)
  if (!ok) return res.status(401).json({ message: 'Неверный текущий пароль' })
  
  user.password = await bcrypt.hash(newPassword, 10)
  await db.write()
  res.json({ success: true })
})

router.post('/:id/follow', async (req, res) => {
  const followingId = req.params.id
  const followerId = req.user.id
  
  if (followingId === followerId) return res.status(400).json({ message: 'Нельзя подписаться на себя' })
  
  if (!db.data.follows) db.data.follows = []
  
  const existing = db.data.follows.find(f => f.followerId === followerId && f.followingId === followingId)
  if (existing) {
    db.data.follows = db.data.follows.filter(f => !(f.followerId === followerId && f.followingId === followingId))
  } else {
    db.data.follows.push({ followerId, followingId, createdAt: new Date().toISOString() })
  }
  await db.write()
  res.json({ success: true, isFollowing: !existing })
})

export default router
