import express from 'express'
import { v4 as uuidv4 } from 'uuid'
import db from '../db.js'
import { authMiddleware } from '../middleware/auth.js'

const router = express.Router()
router.use(authMiddleware)

// Получить список всех разговоров пользователя
router.get('/conversations', (req, res) => {
  const conversations = db.prepare(`
    SELECT 
      c.id,
      c.user1Id,
      c.user2Id,
      c.createdAt,
      CASE 
        WHEN c.user1Id = ? THEN u2.username
        ELSE u1.username
      END as otherUsername,
      CASE 
        WHEN c.user1Id = ? THEN u2.avatarUrl
        ELSE u1.avatarUrl
      END as otherAvatarUrl,
      CASE 
        WHEN c.user1Id = ? THEN c.user2Id
        ELSE c.user1Id
      END as otherUserId,
      (SELECT encryptedContent FROM messages WHERE conversationId = c.id ORDER BY createdAt DESC LIMIT 1) as lastMessage,
      (SELECT createdAt FROM messages WHERE conversationId = c.id ORDER BY createdAt DESC LIMIT 1) as lastMessageAt,
      (SELECT COUNT(*) FROM messages WHERE conversationId = c.id AND senderId != ? AND readAt IS NULL) as unreadCount
    FROM conversations c
    JOIN users u1 ON c.user1Id = u1.id
    JOIN users u2 ON c.user2Id = u2.id
    WHERE c.user1Id = ? OR c.user2Id = ?
    ORDER BY lastMessageAt DESC
  `).all(req.user.id, req.user.id, req.user.id, req.user.id, req.user.id, req.user.id)

  res.json(conversations)
})

// Создать или получить разговор с пользователем
router.post('/conversations', (req, res) => {
  const { otherUserId } = req.body
  
  if (!otherUserId) {
    return res.status(400).json({ error: 'otherUserId is required' })
  }

  if (otherUserId === req.user.id) {
    return res.status(400).json({ error: 'Cannot create conversation with yourself' })
  }

  // Проверяем существование пользователя
  const otherUser = db.prepare('SELECT id, username, avatarUrl FROM users WHERE id = ?').get(otherUserId)
  if (!otherUser) {
    return res.status(404).json({ error: 'User not found' })
  }

  // Проверяем существующий разговор
  const existing = db.prepare(`
    SELECT * FROM conversations 
    WHERE (user1Id = ? AND user2Id = ?) OR (user1Id = ? AND user2Id = ?)
  `).get(req.user.id, otherUserId, otherUserId, req.user.id)

  if (existing) {
    return res.json({ 
      ...existing, 
      otherUsername: otherUser.username,
      otherAvatarUrl: otherUser.avatarUrl,
      otherUserId: otherUser.id
    })
  }

  // Создаем новый разговор
  const conversationId = uuidv4()
  db.prepare(`
    INSERT INTO conversations (id, user1Id, user2Id)
    VALUES (?, ?, ?)
  `).run(conversationId, req.user.id, otherUserId)

  const conversation = db.prepare('SELECT * FROM conversations WHERE id = ?').get(conversationId)
  
  res.json({ 
    ...conversation, 
    otherUsername: otherUser.username,
    otherAvatarUrl: otherUser.avatarUrl,
    otherUserId: otherUser.id,
    unreadCount: 0
  })
})

// Получить сообщения разговора
router.get('/conversations/:conversationId/messages', (req, res) => {
  const { conversationId } = req.params
  
  // Проверяем доступ к разговору
  const conversation = db.prepare(`
    SELECT * FROM conversations 
    WHERE id = ? AND (user1Id = ? OR user2Id = ?)
  `).get(conversationId, req.user.id, req.user.id)

  if (!conversation) {
    return res.status(404).json({ error: 'Conversation not found' })
  }

  const messages = db.prepare(`
    SELECT m.*, u.username, u.avatarUrl
    FROM messages m
    JOIN users u ON m.senderId = u.id
    WHERE m.conversationId = ?
    ORDER BY m.createdAt ASC
  `).all(conversationId)

  res.json(messages)
})

// Отправить сообщение
router.post('/conversations/:conversationId/messages', (req, res) => {
  const { conversationId } = req.params
  const { encryptedContent, fileUrl, fileName, fileType } = req.body

  if (!encryptedContent) {
    return res.status(400).json({ error: 'encryptedContent is required' })
  }

  // Проверяем доступ к разговору
  const conversation = db.prepare(`
    SELECT * FROM conversations 
    WHERE id = ? AND (user1Id = ? OR user2Id = ?)
  `).get(conversationId, req.user.id, req.user.id)

  if (!conversation) {
    return res.status(404).json({ error: 'Conversation not found' })
  }

  const messageId = uuidv4()
  db.prepare(`
    INSERT INTO messages (id, conversationId, senderId, encryptedContent, fileUrl, fileName, fileType)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(messageId, conversationId, req.user.id, encryptedContent, fileUrl || null, fileName || null, fileType || null)

  const message = db.prepare(`
    SELECT m.*, u.username, u.avatarUrl
    FROM messages m
    JOIN users u ON m.senderId = u.id
    WHERE m.id = ?
  `).get(messageId)

  res.json(message)
})

// Отметить сообщения как прочитанные
router.put('/conversations/:conversationId/read', (req, res) => {
  const { conversationId } = req.params

  db.prepare(`
    UPDATE messages 
    SET readAt = datetime('now')
    WHERE conversationId = ? AND senderId != ? AND readAt IS NULL
  `).run(conversationId, req.user.id)

  res.json({ success: true })
})

// Сохранить публичный ключ пользователя
router.post('/keys', (req, res) => {
  const { publicKey } = req.body

  if (!publicKey) {
    return res.status(400).json({ error: 'publicKey is required' })
  }

  db.prepare(`
    INSERT OR REPLACE INTO user_keys (userId, publicKey)
    VALUES (?, ?)
  `).run(req.user.id, publicKey)

  res.json({ success: true })
})

// Получить свой публичный ключ
router.get('/keys/me', (req, res) => {
  const key = db.prepare('SELECT publicKey FROM user_keys WHERE userId = ?').get(req.user.id)
  
  if (!key) {
    return res.status(404).json({ error: 'Public key not found' })
  }

  res.json({ publicKey: key.publicKey })
})

// Получить публичный ключ пользователя
router.get('/keys/:userId', (req, res) => {
  const { userId } = req.params
  
  const key = db.prepare('SELECT publicKey FROM user_keys WHERE userId = ?').get(userId)
  
  if (!key) {
    return res.status(404).json({ error: 'Public key not found' })
  }

  res.json({ publicKey: key.publicKey })
})

export default router
