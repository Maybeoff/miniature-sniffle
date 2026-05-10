<script setup>
import { ref, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import NavBar from '../components/NavBar.vue'
import api from '../api'

const route = useRoute()
const users = ref([])
const loading = ref(true)
const type = route.params.type // 'followers' или 'following'

onMounted(async () => {
  try {
    const endpoint = type === 'followers' 
      ? `/users/${route.params.id}/followers`
      : `/users/${route.params.id}/following-users`
    const { data } = await api.get(endpoint)
    users.value = data
  } catch (e) {
    console.error('Load error:', e)
  } finally {
    loading.value = false
  }
})
</script>

<template>
  <NavBar />
  <div class="follows-page">
    <h2>{{ type === 'followers' ? 'Подписчики' : 'Подписки' }}</h2>
    <div v-if="loading" class="loading">Загрузка...</div>
    <div v-else class="users-list">
      <router-link 
        v-for="user in users" 
        :key="user.id" 
        :to="`/profile/${user.id}`" 
        class="user-card"
      >
        <div v-if="user.avatarUrl" class="avatar-sm">
          <img :src="user.avatarUrl" alt="avatar" />
        </div>
        <div v-else class="avatar-sm">{{ user.username[0].toUpperCase() }}</div>
        <span class="username">{{ user.username }}</span>
      </router-link>
      <p v-if="!users.length" class="empty">Никого нет</p>
    </div>
  </div>
</template>

<style scoped>
.follows-page {
  max-width: 600px;
  margin: 24px auto;
  padding: 0 16px;
}
.follows-page h2 {
  color: #fff;
  margin-bottom: 24px;
}
.users-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.user-card {
  background: #1a1a1a;
  border: 1px solid #2a2a2a;
  border-radius: 12px;
  padding: 16px;
  display: flex;
  align-items: center;
  gap: 12px;
  transition: background 0.2s;
}
.user-card:hover {
  background: #2a2a2a;
}
.username {
  color: #e4e4e4;
  font-weight: 500;
}
</style>
