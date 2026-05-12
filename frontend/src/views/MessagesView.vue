<template>
  <div class="messages-view">
    <div class="messages-container">
      <!-- Список разговоров -->
      <div class="conversations-list" :class="{ hidden: currentConversation }">
        <div class="conversations-header">
          <h2>Сообщения</h2>
          <button @click="showNewConversation = true" class="new-conversation-btn">
            <span>+</span>
          </button>
        </div>

        <div v-if="conversations.length === 0" class="empty-state">
          <p>Нет разговоров</p>
          <button @click="showNewConversation = true" class="btn-primary">
            Начать разговор
          </button>
        </div>

        <div
          v-for="conv in conversations"
          :key="conv.id"
          @click="openConversation(conv.id)"
          :class="['conversation-item', { active: currentConversation?.id === conv.id }]"
        >
          <img
            :src="conv.otherAvatarUrl || '/default-avatar.png'"
            :alt="conv.otherUsername"
            class="avatar"
          />
          <div class="conversation-info">
            <div class="conversation-header">
              <span class="username">{{ conv.otherUsername }}</span>
              <span class="time">{{ formatTime(conv.lastMessageAt) }}</span>
            </div>
            <div class="last-message">
              <span class="message-preview">🔒 Зашифрованное сообщение</span>
              <span v-if="conv.unreadCount > 0" class="unread-badge">
                {{ conv.unreadCount }}
              </span>
            </div>
          </div>
        </div>
      </div>

      <!-- Окно чата -->
      <div class="chat-window">
        <div v-if="!currentConversation" class="no-conversation">
          <p>Выберите разговор или начните новый</p>
        </div>

        <template v-else>
          <div class="chat-header">
            <button @click="closeConversation" class="back-btn">←</button>
            <img
              :src="currentConversation.otherAvatarUrl || '/default-avatar.png'"
              :alt="currentConversation.otherUsername"
              class="avatar"
            />
            <div class="chat-info">
              <h3>{{ currentConversation.otherUsername }}</h3>
              <span class="encryption-status">🔒 End-to-end шифрование</span>
            </div>
          </div>

          <div class="messages-list" ref="messagesList">
            <div
              v-for="message in messages"
              :key="message.id"
              :class="['message', { own: message.senderId === authStore.user?.id }]"
            >
              <img
                :src="message.avatarUrl || '/default-avatar.png'"
                :alt="message.username"
                class="message-avatar"
              />
              <div class="message-content">
                <div class="message-header">
                  <span class="message-username">{{ message.username }}</span>
                  <span class="message-time">{{ formatTime(message.createdAt) }}</span>
                </div>
                <div class="message-text">{{ message.decryptedContent }}</div>
                <div v-if="message.fileUrl" class="message-file">
                  <a v-if="isImage(message.fileType)" :href="message.fileUrl" target="_blank">
                    <img :src="message.fileUrl" :alt="message.fileName" class="message-image" />
                  </a>
                  <a v-else :href="message.fileUrl" target="_blank" class="file-link">
                    📎 {{ message.fileName }}
                  </a>
                </div>
                <div v-if="message.senderId === authStore.user?.id && message.readAt" class="message-status">
                  ✓✓ Прочитано
                </div>
              </div>
            </div>

            <div v-if="typingUsers.size > 0" class="typing-indicator">
              <span>Печатает...</span>
            </div>
          </div>

          <div class="message-input">
            <input
              type="file"
              ref="fileInput"
              @change="handleFileSelect"
              style="display: none"
              accept="image/*,.pdf,.doc,.docx,.txt,.zip"
            />
            <button @click="$refs.fileInput.click()" class="attach-btn" title="Прикрепить файл">
              📎
            </button>
            <textarea
              v-model="newMessage"
              @keydown.enter.exact.prevent="sendMessage"
              @input="handleTyping"
              placeholder="Напишите сообщение..."
              rows="1"
            ></textarea>
            <button @click="sendMessage" :disabled="!newMessage.trim() && !selectedFile" class="send-btn">
              Отправить
            </button>
          </div>
        </template>
      </div>
    </div>

    <!-- Модальное окно для нового разговора -->
    <div v-if="showNewConversation" class="modal" @click.self="showNewConversation = false">
      <div class="modal-content">
        <h3>Начать новый разговор</h3>
        <input
          v-model="searchQuery"
          @input="searchUsers"
          placeholder="Поиск пользователей..."
          class="search-input"
        />
        <div class="users-list">
          <div
            v-for="user in searchResults"
            :key="user.id"
            @click="startConversation(user.id)"
            class="user-item"
          >
            <img :src="user.avatarUrl || '/default-avatar.png'" :alt="user.username" class="avatar" />
            <span>{{ user.username }}</span>
          </div>
        </div>
        <button @click="showNewConversation = false" class="btn-secondary">Отмена</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, watch, nextTick } from 'vue'
import { useMessagesStore } from '../stores/messages'
import { useAuthStore } from '../stores/auth'
import api from '../api'

const messagesStore = useMessagesStore()
const authStore = useAuthStore()

const conversations = computed(() => messagesStore.conversations)
const currentConversation = computed(() => messagesStore.currentConversation)
const messages = computed(() => messagesStore.messages)
const typingUsers = computed(() => messagesStore.typingUsers)

const newMessage = ref('')
const showNewConversation = ref(false)
const searchQuery = ref('')
const searchResults = ref([])
const messagesList = ref(null)
const fileInput = ref(null)
const selectedFile = ref(null)
let typingTimeout = null

onMounted(async () => {
  await messagesStore.initializeKeys()
  messagesStore.connectWebSocket()
  await messagesStore.fetchConversations()
})

onUnmounted(() => {
  messagesStore.disconnectWebSocket()
})

watch(messages, async () => {
  await nextTick()
  scrollToBottom()
})

function scrollToBottom() {
  if (messagesList.value) {
    messagesList.value.scrollTop = messagesList.value.scrollHeight
  }
}

async function openConversation(conversationId) {
  await messagesStore.openConversation(conversationId)
  await nextTick()
  scrollToBottom()
}

function closeConversation() {
  messagesStore.closeConversation()
}

async function sendMessage() {
  if (!newMessage.value.trim() && !selectedFile.value) return
  
  if (selectedFile.value) {
    await uploadAndSendFile()
  } else {
    await messagesStore.sendMessage(newMessage.value)
  }
  
  newMessage.value = ''
  selectedFile.value = null
  messagesStore.sendTyping(false)
  
  await nextTick()
  scrollToBottom()
}

async function handleFileSelect(event) {
  const file = event.target.files[0]
  if (!file) return
  
  // Проверка размера файла (макс 10MB)
  if (file.size > 10 * 1024 * 1024) {
    alert('Файл слишком большой. Максимальный размер: 10MB')
    return
  }
  
  selectedFile.value = file
  newMessage.value = `📎 ${file.name}`
}

async function uploadAndSendFile() {
  if (!selectedFile.value) return
  
  try {
    const formData = new FormData()
    formData.append('file', selectedFile.value)
    
    const uploadResponse = await api.post('/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    })
    
    const fileUrl = uploadResponse.data.url
    const fileName = selectedFile.value.name
    const fileType = selectedFile.value.type
    
    await messagesStore.sendFileMessage(fileUrl, fileName, fileType)
  } catch (error) {
    console.error('File upload error:', error)
    alert('Ошибка загрузки файла')
  }
}

function isImage(fileType) {
  return fileType && fileType.startsWith('image/')
}

function handleTyping() {
  messagesStore.sendTyping(true)
  
  clearTimeout(typingTimeout)
  typingTimeout = setTimeout(() => {
    messagesStore.sendTyping(false)
  }, 1000)
}

async function searchUsers() {
  if (!searchQuery.value.trim()) {
    searchResults.value = []
    return
  }

  try {
    const response = await api.get(`/users/search?q=${searchQuery.value}`)
    searchResults.value = response.data.filter(user => user.id !== authStore.user?.id)
  } catch (error) {
    console.error('Search error:', error)
  }
}

async function startConversation(userId) {
  const conversation = await messagesStore.createConversation(userId)
  showNewConversation.value = false
  searchQuery.value = ''
  searchResults.value = []
  await openConversation(conversation.id)
}

function formatTime(dateString) {
  if (!dateString) return ''
  const date = new Date(dateString)
  const now = new Date()
  const diff = now - date

  if (diff < 60000) return 'только что'
  if (diff < 3600000) return `${Math.floor(diff / 60000)} мин назад`
  if (diff < 86400000) return date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })
  return date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })
}
</script>

<style scoped>
.messages-view {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: #0a0a0a;
  color: #e4e4e4;
}

.messages-container {
  display: grid;
  grid-template-columns: 350px 1fr;
  gap: 0;
  height: 100vh;
  overflow: hidden;
}

.conversations-list {
  background: #1a1a1a;
  border-right: 1px solid #2a2a2a;
  overflow-y: auto;
}

.conversations-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px;
  border-bottom: 1px solid #2a2a2a;
  background: #1a1a1a;
  position: sticky;
  top: 0;
  z-index: 10;
}

.conversations-header h2 {
  margin: 0;
  font-size: 20px;
  color: #e4e4e4;
}

.new-conversation-btn {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: #7c6aff;
  color: white;
  border: none;
  font-size: 24px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.2s;
}

.new-conversation-btn:hover {
  background: #6a58e0;
}

.empty-state {
  padding: 40px 20px;
  text-align: center;
  color: #888;
}

.conversation-item {
  display: flex;
  gap: 12px;
  padding: 16px 20px;
  cursor: pointer;
  transition: background 0.2s;
  border-bottom: 1px solid #2a2a2a;
}

.conversation-item:hover {
  background: #252525;
}

.conversation-item.active {
  background: #2a2a2a;
  border-left: 3px solid #7c6aff;
}

.avatar {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  object-fit: cover;
  background: #2a2a2a;
}

.conversation-info {
  flex: 1;
  min-width: 0;
}

.conversation-header {
  display: flex;
  justify-content: space-between;
  margin-bottom: 4px;
}

.username {
  font-weight: 600;
  font-size: 15px;
  color: #e4e4e4;
}

.time {
  font-size: 12px;
  color: #888;
}

.last-message {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.message-preview {
  font-size: 14px;
  color: #888;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.unread-badge {
  background: #7c6aff;
  color: white;
  border-radius: 10px;
  padding: 2px 8px;
  font-size: 11px;
  font-weight: 600;
  min-width: 18px;
  text-align: center;
}

.chat-window {
  display: flex;
  flex-direction: column;
  background: #0a0a0a;
  height: 100vh;
  position: relative;
}

.no-conversation {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: #666;
  font-size: 16px;
}

.chat-header {
  display: flex;
  gap: 12px;
  padding: 20px;
  border-bottom: 1px solid #2a2a2a;
  background: #1a1a1a;
  align-items: center;
}

.back-btn {
  display: none;
  background: none;
  border: none;
  color: #7c6aff;
  font-size: 24px;
  cursor: pointer;
  padding: 0;
  width: 36px;
  height: 36px;
  align-items: center;
  justify-content: center;
}

.back-btn:hover {
  color: #6a58e0;
}

@media (max-width: 768px) {
  .back-btn {
    display: flex;
  }
}

.chat-info h3 {
  margin: 0 0 4px 0;
  font-size: 18px;
  color: #e4e4e4;
}

.encryption-status {
  font-size: 13px;
  color: #28a745;
}

.messages-list {
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 16px;
  background: #0a0a0a;
  min-height: 0;
}

.message {
  display: flex;
  gap: 12px;
}

.message.own {
  flex-direction: row-reverse;
}

.message-avatar {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  object-fit: cover;
  background: #2a2a2a;
}

.message-content {
  max-width: 60%;
}

.message.own .message-content {
  background: #7c6aff;
  color: white;
  border-radius: 18px 18px 4px 18px;
  padding: 12px 16px;
}

.message:not(.own) .message-content {
  background: #2a2a2a;
  color: #e4e4e4;
  border-radius: 18px 18px 18px 4px;
  padding: 12px 16px;
}

.message-header {
  display: flex;
  justify-content: space-between;
  margin-bottom: 4px;
  font-size: 12px;
}

.message.own .message-header {
  color: rgba(255, 255, 255, 0.8);
}

.message:not(.own) .message-header {
  color: #888;
}

.message-username {
  font-weight: 600;
}

.message-text {
  word-wrap: break-word;
  line-height: 1.4;
}

.message-file {
  margin-top: 8px;
}

.message-image {
  max-width: 300px;
  max-height: 300px;
  border-radius: 8px;
  cursor: pointer;
  display: block;
}

.file-link {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  background: rgba(0, 0, 0, 0.2);
  border-radius: 8px;
  text-decoration: none;
  color: inherit;
  transition: background 0.2s;
}

.file-link:hover {
  background: rgba(0, 0, 0, 0.3);
}

.message-status {
  font-size: 11px;
  margin-top: 4px;
  opacity: 0.8;
}

.typing-indicator {
  font-size: 14px;
  color: #888;
  font-style: italic;
}

.message-input {
  display: flex;
  gap: 12px;
  padding: 20px;
  border-top: 1px solid #2a2a2a;
  background: #1a1a1a;
  align-items: flex-end;
  flex-shrink: 0;
  position: sticky;
  bottom: 0;
  z-index: 10;
}

.attach-btn {
  padding: 12px;
  background: #2a2a2a;
  color: #e4e4e4;
  border: none;
  border-radius: 50%;
  cursor: pointer;
  font-size: 18px;
  width: 44px;
  height: 44px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.2s;
  flex-shrink: 0;
}

.attach-btn:hover {
  background: #3a3a3a;
}

.message-input textarea {
  flex: 1;
  padding: 12px;
  border: 1px solid #2a2a2a;
  border-radius: 24px;
  resize: none;
  font-family: inherit;
  font-size: 14px;
  background: #0a0a0a;
  color: #e4e4e4;
  max-height: 120px;
  min-height: 44px;
}

.message-input textarea::placeholder {
  color: #666;
}

.message-input textarea:focus {
  outline: none;
  border-color: #7c6aff;
}

.send-btn {
  padding: 12px 24px;
  background: #7c6aff;
  color: white;
  border: none;
  border-radius: 24px;
  cursor: pointer;
  font-weight: 600;
  transition: background 0.2s;
}

.send-btn:hover:not(:disabled) {
  background: #6a58e0;
}

.send-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.modal {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.8);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal-content {
  background: #1a1a1a;
  padding: 24px;
  border-radius: 12px;
  width: 90%;
  max-width: 500px;
  border: 1px solid #2a2a2a;
}

.modal-content h3 {
  margin: 0 0 16px 0;
  color: #e4e4e4;
}

.search-input {
  width: 100%;
  padding: 12px;
  border: 1px solid #2a2a2a;
  border-radius: 8px;
  margin-bottom: 16px;
  font-size: 14px;
  background: #0a0a0a;
  color: #e4e4e4;
}

.search-input::placeholder {
  color: #666;
}

.search-input:focus {
  outline: none;
  border-color: #7c6aff;
}

.users-list {
  max-height: 300px;
  overflow-y: auto;
  margin-bottom: 16px;
}

.user-item {
  display: flex;
  gap: 12px;
  align-items: center;
  padding: 12px;
  cursor: pointer;
  border-radius: 8px;
  transition: background 0.2s;
}

.user-item:hover {
  background: #2a2a2a;
}

.user-item span {
  color: #e4e4e4;
}

.btn-primary,
.btn-secondary {
  padding: 10px 20px;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  font-weight: 600;
  transition: background 0.2s;
}

.btn-primary {
  background: #7c6aff;
  color: white;
}

.btn-primary:hover {
  background: #6a58e0;
}

.btn-secondary {
  background: #2a2a2a;
  color: #e4e4e4;
  width: 100%;
}

.btn-secondary:hover {
  background: #3a3a3a;
}

@media (max-width: 768px) {
  .messages-container {
    grid-template-columns: 1fr;
  }
  
  .conversations-list.hidden {
    display: none;
  }
  
  .chat-window {
    display: flex;
  }
}
</style>
