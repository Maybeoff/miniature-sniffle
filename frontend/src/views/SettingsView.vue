<script setup>
import { ref, onMounted } from 'vue'
import { useAuthStore } from '../stores/auth'
import { useRouter } from 'vue-router'
import NavBar from '../components/NavBar.vue'
import api from '../api'

const auth = useAuthStore()
const router = useRouter()

const avatarFile = ref(null)
const avatarPreview = ref(null)
const uploading = ref(false)
const error = ref('')
const success = ref('')

const username = ref('')
const email = ref('')
const currentPassword = ref('')
const newPassword = ref('')
const confirmPassword = ref('')

onMounted(async () => {
  if (auth.user?.avatarUrl) {
    avatarPreview.value = auth.user.avatarUrl
  }
  username.value = auth.user?.username || ''
  email.value = auth.user?.email || ''
})

function onFileChange(e) {
  const file = e.target.files[0]
  if (!file) return
  avatarFile.value = file
  avatarPreview.value = URL.createObjectURL(file)
}

async function saveAvatar() {
  if (!avatarFile.value) return
  error.value = ''
  uploading.value = true
  try {
    const reader = new FileReader()
    reader.onload = async () => {
      const { data } = await api.post('/upload/image', {
        base64: reader.result,
        filename: avatarFile.value.name,
        contentType: avatarFile.value.type,
      })
      await api.post('/users/avatar', { avatarUrl: data.url })
      auth.user.avatarUrl = data.url
      localStorage.setItem('user', JSON.stringify(auth.user))
      success.value = 'Аватар сохранён'
      setTimeout(() => success.value = '', 3000)
    }
    reader.readAsDataURL(avatarFile.value)
  } catch (e) {
    error.value = 'Не удалось загрузить аватар'
  } finally {
    uploading.value = false
  }
}

async function saveProfile() {
  error.value = ''
  success.value = ''
  try {
    await api.post('/users/profile', { username: username.value, email: email.value })
    auth.user.username = username.value
    auth.user.email = email.value
    localStorage.setItem('user', JSON.stringify(auth.user))
    success.value = 'Профиль обновлён'
    setTimeout(() => success.value = '', 3000)
  } catch (e) {
    error.value = e.response?.data?.message || 'Ошибка обновления'
  }
}

async function changePassword() {
  error.value = ''
  success.value = ''
  if (newPassword.value !== confirmPassword.value) {
    error.value = 'Пароли не совпадают'
    return
  }
  if (newPassword.value.length < 6) {
    error.value = 'Пароль должен быть минимум 6 символов'
    return
  }
  try {
    await api.post('/users/password', { 
      currentPassword: currentPassword.value, 
      newPassword: newPassword.value 
    })
    currentPassword.value = ''
    newPassword.value = ''
    confirmPassword.value = ''
    success.value = 'Пароль изменён'
    setTimeout(() => success.value = '', 3000)
  } catch (e) {
    error.value = e.response?.data?.message || 'Ошибка смены пароля'
  }
}
</script>

<template>
  <NavBar />
  <div class="settings-page">
    <section class="section">
      <h2>Профиль</h2>
      
      <div class="avatar-section">
        <div class="avatar-preview">
          <img v-if="avatarPreview" :src="avatarPreview" alt="avatar" />
          <div v-else class="avatar-placeholder">{{ auth.user?.username?.[0]?.toUpperCase() }}</div>
        </div>
        <label class="file-label">
          Выбрать фото
          <input type="file" accept="image/*" @change="onFileChange" hidden />
        </label>
        <button @click="saveAvatar" :disabled="!avatarFile || uploading" class="save-btn">
          {{ uploading ? 'Сохраняем...' : 'Сохранить аватар' }}
        </button>
      </div>

      <div class="form-section">
        <h3>Основная информация</h3>
        <input v-model="username" type="text" placeholder="Имя пользователя" />
        <input v-model="email" type="email" placeholder="Email" />
        <button @click="saveProfile" class="save-btn">Сохранить</button>
      </div>
    </section>

    <section class="section">
      <h2>Безопасность</h2>
      
      <div class="form-section">
        <h3>Смена пароля</h3>
        <input v-model="currentPassword" type="password" placeholder="Текущий пароль" />
        <input v-model="newPassword" type="password" placeholder="Новый пароль" />
        <input v-model="confirmPassword" type="password" placeholder="Подтвердите пароль" />
        <button @click="changePassword" class="save-btn">Изменить пароль</button>
      </div>
    </section>

    <p v-if="error" class="error">{{ error }}</p>
    <p v-if="success" class="success">{{ success }}</p>
  </div>
</template>

<style scoped>
.settings-page {
  max-width: 600px;
  margin: 24px auto;
  padding: 0 16px;
}
.section {
  margin-bottom: 48px;
}
.section h2 {
  color: #fff;
  margin-bottom: 24px;
  font-size: 24px;
}
.avatar-section {
  background: #1a1a1a;
  border-radius: 12px;
  padding: 24px;
  border: 1px solid #2a2a2a;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
  margin-bottom: 24px;
}
.avatar-preview {
  width: 120px;
  height: 120px;
  border-radius: 50%;
  overflow: hidden;
  background: #7c6aff;
  display: flex;
  align-items: center;
  justify-content: center;
}
.avatar-preview img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.avatar-placeholder {
  font-size: 48px;
  font-weight: 700;
  color: #fff;
}
.file-label {
  cursor: pointer;
  color: #7c6aff;
  font-weight: 500;
  font-size: 14px;
  padding: 8px 16px;
  border: 1px solid #7c6aff;
  border-radius: 8px;
}
.form-section {
  background: #1a1a1a;
  border-radius: 12px;
  padding: 24px;
  border: 1px solid #2a2a2a;
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.form-section h3 {
  color: #fff;
  margin-bottom: 8px;
  font-size: 18px;
}
.form-section input {
  padding: 12px;
  border: 1px solid #333;
  border-radius: 8px;
  background: #111;
  color: #e4e4e4;
  outline: none;
  font-size: 14px;
}
.form-section input:focus { border-color: #7c6aff; }
.save-btn {
  background: #7c6aff;
  color: #fff;
  border: none;
  padding: 10px 24px;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
}
.save-btn:hover { background: #6a58e0; }
.save-btn:disabled { opacity: 0.5; cursor: not-allowed; }
.error {
  color: #e0245e;
  font-size: 14px;
  text-align: center;
  margin-top: 12px;
}
.success {
  color: #4caf50;
  font-size: 14px;
  text-align: center;
  margin-top: 12px;
}
</style>
