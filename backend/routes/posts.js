import { Router } from 'express'
import { randomUUID } from 'crypto'
import db from '../db.js'
import { authMiddleware } from '../middleware/auth.js'
import { logActivity } from '../middleware/logger.js'

const router = Router()
router.use(authMiddleware)

function formatPost(post) {
  const likes = db.prepare('SELECT userId FROM likes WHERE postId = ?').all(post.id).map(r => r.userId)
  const comments = db.prepare('SELECT * FROM comments WHERE postId = ? ORDER BY createdAt DESC').all(post.id).map(c => {
    const author = db.prepare('SELECT id, username, avatarUrl FROM users WHERE id = ?').get(c.authorId)
    return { ...c, author }
  })
  const author = db.prepare('SELECT id, username, avatarUrl FROM users WHERE id = ?').get(post.authorId)
  return { ...post, likes, comments, author }
}

router.get('/', (req, res) => {
  const posts = db.prepare('SELECT * FROM posts ORDER BY createdAt DESC LIMIT 50').all()
  res.json(posts.map(formatPost))
})

router.get('/user/:userId', (req, res) => {
  const posts = db.prepare('SELECT * FROM posts WHERE authorId = ? ORDER BY createdAt DESC').all(req.params.userId)
  res.json(posts.map(formatPost))
})

router.post('/', (req, res) => {
  const { text, imageUrl } = req.body
  if (!text && !imageUrl) return res.status(400).json({ message: 'Пост не может быть пустым' })
  
  const id = randomUUID()
  const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress
  const userAgent = req.headers['user-agent']
  
  db.prepare(`
    INSERT INTO posts (id, authorId, text, imageUrl, ip, userAgent) 
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(id, req.user.id, text || null, imageUrl || null, ip, userAgent)

  logActivity(req.user.id, 'create_post', req, { postId: id })

  const post = db.prepare('SELECT * FROM posts WHERE id = ?').get(id)
  res.json(formatPost(post))
})

router.post('/:id/like', (req, res) => {
  const postId = req.params.id
  const userId = req.user.id
  const existing = db.prepare('SELECT 1 FROM likes WHERE postId = ? AND userId = ?').get(postId, userId)
  
  if (existing) {
    db.prepare('DELETE FROM likes WHERE postId = ? AND userId = ?').run(postId, userId)
    logActivity(userId, 'unlike_post', req, { postId })
  } else {
    db.prepare('INSERT INTO likes (postId, userId) VALUES (?, ?)').run(postId, userId)
    logActivity(userId, 'like_post', req, { postId })
  }
  
  const post = db.prepare('SELECT * FROM posts WHERE id = ?').get(postId)
  res.json(formatPost(post))
})

router.post('/:id/comments', (req, res) => {
  const { text } = req.body
  if (!text?.trim()) return res.status(400).json({ message: 'Комментарий не может быть пустым' })
  
  const id = randomUUID()
  db.prepare('INSERT INTO comments (id, postId, authorId, text) VALUES (?, ?, ?, ?)').run(id, req.params.id, req.user.id, text)
  
  logActivity(req.user.id, 'comment_post', req, { postId: req.params.id, commentId: id })
  
  const post = db.prepare('SELECT * FROM posts WHERE id = ?').get(req.params.id)
  res.json(formatPost(post))
})

export default router
