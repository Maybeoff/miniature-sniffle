import { defineStore } from 'pinia'
import api from '../api'
import {
  generateKeyPair,
  exportPublicKey,
  exportPrivateKey,
  importPublicKey,
  importPrivateKey,
  encryptMessage,
  decryptMessage,
  saveKeys,
  loadKeys,
  hasKeys,
} from '../utils/crypto'

export const useMessagesStore = defineStore('messages', {
  state: () => ({
    conversations: [],
    currentConversation: null,
    messages: [],
    ws: null,
    publicKey: null,
    privateKey: null,
    recipientPublicKeys: new Map(),
    typingUsers: new Set(),
  }),

  getters: {
    unreadCount: (state) => {
      return state.conversations.reduce((sum, conv) => sum + (conv.unreadCount || 0), 0)
    },
  },

  actions: {
    async initializeKeys() {
      if (hasKeys()) {
        const keys = loadKeys()
        try {
          this.publicKey = await importPublicKey(keys.publicKey)
          this.privateKey = await importPrivateKey(keys.privateKey)
          
          // Проверяем, что ключ на сервере совпадает с локальным
          try {
            const response = await api.get('/messages/keys/me')
            if (response.data.publicKey !== keys.publicKey) {
              // Ключ на сервере отличается, обновляем
              await api.post('/messages/keys', { publicKey: keys.publicKey })
            }
          } catch (error) {
            // Ключа нет на сервере, отправляем
            await api.post('/messages/keys', { publicKey: keys.publicKey })
          }
        } catch (error) {
          console.error('Failed to load keys, generating new ones:', error)
          // Если не удалось загрузить ключи, генерируем новые
          localStorage.removeItem('publicKey')
          localStorage.removeItem('privateKey')
          await this.initializeKeys()
          return
        }
      } else {
        const keyPair = await generateKeyPair()
        this.publicKey = keyPair.publicKey
        this.privateKey = keyPair.privateKey

        const publicKeyString = await exportPublicKey(this.publicKey)
        const privateKeyString = await exportPrivateKey(this.privateKey)
        saveKeys(publicKeyString, privateKeyString)

        // Отправляем публичный ключ на сервер
        await api.post('/messages/keys', { publicKey: publicKeyString })
      }
    },

    async getRecipientPublicKey(userId) {
      if (this.recipientPublicKeys.has(userId)) {
        return this.recipientPublicKeys.get(userId)
      }

      const response = await api.get(`/messages/keys/${userId}`)
      const publicKey = await importPublicKey(response.data.publicKey)
      this.recipientPublicKeys.set(userId, publicKey)
      return publicKey
    },

    connectWebSocket() {
      const token = localStorage.getItem('token')
      if (!token || this.ws) return

      const wsUrl = import.meta.env.VITE_WS_URL || 'ws://localhost:3000/ws'
      this.ws = new WebSocket(wsUrl)

      this.ws.onopen = () => {
        this.ws.send(JSON.stringify({ type: 'auth', token }))
      }

      this.ws.onmessage = async (event) => {
        const data = JSON.parse(event.data)

        if (data.type === 'message') {
          const decryptedContent = await decryptMessage(
            data.message.encryptedContent,
            this.privateKey
          )
          const message = { ...data.message, decryptedContent }

          if (this.currentConversation?.id === data.conversationId) {
            this.messages.push(message)
            // Отмечаем как прочитанное
            await this.markAsRead(data.conversationId)
          } else {
            // Увеличиваем счетчик непрочитанных
            const conv = this.conversations.find((c) => c.id === data.conversationId)
            if (conv) {
              conv.unreadCount = (conv.unreadCount || 0) + 1
              conv.lastMessage = data.message.encryptedContent
              conv.lastMessageAt = data.message.createdAt
            }
          }
        }

        if (data.type === 'typing') {
          if (this.currentConversation?.id === data.conversationId) {
            if (data.isTyping) {
              this.typingUsers.add(data.userId)
            } else {
              this.typingUsers.delete(data.userId)
            }
          }
        }

        if (data.type === 'read') {
          if (this.currentConversation?.id === data.conversationId) {
            this.messages.forEach((msg) => {
              if (!msg.readAt) {
                msg.readAt = new Date().toISOString()
              }
            })
          }
        }
      }

      this.ws.onerror = (error) => {
        console.error('WebSocket error:', error)
      }

      this.ws.onclose = () => {
        this.ws = null
        // Переподключение через 3 секунды
        setTimeout(() => this.connectWebSocket(), 3000)
      }
    },

    disconnectWebSocket() {
      if (this.ws) {
        this.ws.close()
        this.ws = null
      }
    },

    async fetchConversations() {
      const response = await api.get('/messages/conversations')
      this.conversations = response.data
    },

    async createConversation(otherUserId) {
      const response = await api.post('/messages/conversations', { otherUserId })
      const conversation = response.data

      const existing = this.conversations.find((c) => c.id === conversation.id)
      if (!existing) {
        this.conversations.unshift(conversation)
      }

      // Предзагружаем публичный ключ получателя
      try {
        await this.getRecipientPublicKey(otherUserId)
      } catch (error) {
        console.error('Failed to load recipient public key:', error)
      }

      return conversation
    },

    async openConversation(conversationId) {
      const conversation = this.conversations.find((c) => c.id === conversationId)
      if (!conversation) return

      this.currentConversation = conversation
      
      // Предзагружаем публичный ключ получателя
      try {
        await this.getRecipientPublicKey(conversation.otherUserId)
      } catch (error) {
        console.error('Failed to load recipient public key:', error)
      }
      
      const response = await api.get(`/messages/conversations/${conversationId}/messages`)

      // Расшифровываем все сообщения
      this.messages = await Promise.all(
        response.data.map(async (msg) => {
          try {
            const decryptedContent = await decryptMessage(msg.encryptedContent, this.privateKey)
            return { ...msg, decryptedContent }
          } catch (error) {
            console.error('Failed to decrypt message:', error)
            return { ...msg, decryptedContent: '[Не удалось расшифровать]' }
          }
        })
      )

      // Отмечаем как прочитанное
      await this.markAsRead(conversationId)
    },

    async sendMessage(text) {
      if (!this.currentConversation || !text.trim()) return

      // Получаем публичный ключ получателя
      const recipientPublicKey = await this.getRecipientPublicKey(
        this.currentConversation.otherUserId
      )

      // Шифруем сообщение
      const encryptedContent = await encryptMessage(text, recipientPublicKey)

      // Отправляем на сервер
      const response = await api.post(
        `/messages/conversations/${this.currentConversation.id}/messages`,
        { encryptedContent }
      )

      const message = { ...response.data, decryptedContent: text }
      this.messages.push(message)

      // Отправляем через WebSocket для real-time доставки
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.send(
          JSON.stringify({
            type: 'message',
            recipientId: this.currentConversation.otherUserId,
            conversationId: this.currentConversation.id,
            messageData: message,
          })
        )
      }

      // Обновляем последнее сообщение в списке разговоров
      const conv = this.conversations.find((c) => c.id === this.currentConversation.id)
      if (conv) {
        conv.lastMessage = encryptedContent
        conv.lastMessageAt = message.createdAt
      }
    },

    async sendFileMessage(fileUrl, fileName, fileType) {
      if (!this.currentConversation) return

      // Получаем публичный ключ получателя
      const recipientPublicKey = await this.getRecipientPublicKey(
        this.currentConversation.otherUserId
      )

      // Шифруем имя файла
      const encryptedContent = await encryptMessage(fileName, recipientPublicKey)

      // Отправляем на сервер
      const response = await api.post(
        `/messages/conversations/${this.currentConversation.id}/messages`,
        { encryptedContent, fileUrl, fileName, fileType }
      )

      const message = { ...response.data, decryptedContent: fileName }
      this.messages.push(message)

      // Отправляем через WebSocket для real-time доставки
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.send(
          JSON.stringify({
            type: 'message',
            recipientId: this.currentConversation.otherUserId,
            conversationId: this.currentConversation.id,
            messageData: message,
          })
        )
      }

      // Обновляем последнее сообщение в списке разговоров
      const conv = this.conversations.find((c) => c.id === this.currentConversation.id)
      if (conv) {
        conv.lastMessage = encryptedContent
        conv.lastMessageAt = message.createdAt
      }
    },

    async markAsRead(conversationId) {
      await api.put(`/messages/conversations/${conversationId}/read`)

      const conv = this.conversations.find((c) => c.id === conversationId)
      if (conv) {
        conv.unreadCount = 0
      }

      // Уведомляем отправителя через WebSocket
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.send(
          JSON.stringify({
            type: 'read',
            recipientId: this.currentConversation?.otherUserId,
            conversationId,
          })
        )
      }
    },

    sendTyping(isTyping) {
      if (this.ws && this.ws.readyState === WebSocket.OPEN && this.currentConversation) {
        this.ws.send(
          JSON.stringify({
            type: 'typing',
            recipientId: this.currentConversation.otherUserId,
            conversationId: this.currentConversation.id,
            isTyping,
          })
        )
      }
    },

    closeConversation() {
      this.currentConversation = null
      this.messages = []
      this.typingUsers.clear()
    },
  },
})
