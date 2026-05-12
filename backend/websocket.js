import { WebSocketServer } from 'ws'
import jwt from 'jsonwebtoken'

const clients = new Map() // userId -> WebSocket

export function setupWebSocket(server) {
  const wss = new WebSocketServer({ server, path: '/ws' })

  wss.on('connection', (ws, req) => {
    let userId = null

    ws.on('message', (data) => {
      try {
        const message = JSON.parse(data.toString())

        // Аутентификация
        if (message.type === 'auth') {
          try {
            const decoded = jwt.verify(message.token, process.env.JWT_SECRET)
            userId = decoded.id
            clients.set(userId, ws)
            ws.send(JSON.stringify({ type: 'auth', success: true }))
            console.log(`User ${userId} connected to WebSocket`)
          } catch (error) {
            ws.send(JSON.stringify({ type: 'auth', success: false, error: 'Invalid token' }))
            ws.close()
          }
        }

        // Отправка сообщения
        if (message.type === 'message' && userId) {
          const { recipientId, conversationId, messageData } = message
          const recipientWs = clients.get(recipientId)
          
          if (recipientWs && recipientWs.readyState === 1) {
            recipientWs.send(JSON.stringify({
              type: 'message',
              conversationId,
              message: messageData
            }))
          }
        }

        // Уведомление о печатании
        if (message.type === 'typing' && userId) {
          const { recipientId, conversationId, isTyping } = message
          const recipientWs = clients.get(recipientId)
          
          if (recipientWs && recipientWs.readyState === 1) {
            recipientWs.send(JSON.stringify({
              type: 'typing',
              conversationId,
              userId,
              isTyping
            }))
          }
        }

        // Уведомление о прочтении
        if (message.type === 'read' && userId) {
          const { recipientId, conversationId } = message
          const recipientWs = clients.get(recipientId)
          
          if (recipientWs && recipientWs.readyState === 1) {
            recipientWs.send(JSON.stringify({
              type: 'read',
              conversationId
            }))
          }
        }
      } catch (error) {
        console.error('WebSocket message error:', error)
      }
    })

    ws.on('close', () => {
      if (userId) {
        clients.delete(userId)
        console.log(`User ${userId} disconnected from WebSocket`)
      }
    })

    ws.on('error', (error) => {
      console.error('WebSocket error:', error)
    })
  })

  return wss
}
