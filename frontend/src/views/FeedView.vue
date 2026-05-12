<script setup>
import { ref, computed, onMounted } from 'vue'
import { usePostsStore } from '../stores/posts'
import { useAuthStore } from '../stores/auth'
import { useMessagesStore } from '../stores/messages'
import PostCard from '../components/PostCard.vue'
import CreatePost from '../components/CreatePost.vue'
import NavBar from '../components/NavBar.vue'
import api from '../api'

const posts = usePostsStore()
const auth = useAuthStore()
const messagesStore = useMessagesStore()
const filter = ref('all')
const error = ref('')
const following = ref([])

onMounted(async () => {
  try {
    await posts.fetchFeed()
    const { data } = await api.get(`/users/${auth.user.id}/following`)
    following.value = data
  } catch (e) {
    error.value = 'Не удалось загрузить посты. Бэкенд запущен?'
    posts.loading = false
  }
})

const filteredPosts = computed(() => {
  if (filter.value === 'liked') {
    return posts.posts.filter(p => p.likes?.includes(auth.user?.id))
  }
  if (filter.value === 'commented') {
    return posts.posts.filter(p => p.comments?.some(c => c.author?.id === auth.user?.id))
  }
  if (filter.value === 'following') {
    return posts.posts.filter(p => following.value.includes(p.author?.id))
  }
  return posts.posts
})
</script>

<template>
  <NavBar>
    <div class="sidebar-content">
      <router-link to="/messages" class="filter-btn">
        💬 Сообщения
        <span v-if="messagesStore.unreadCount > 0" class="badge">
          {{ messagesStore.unreadCount }}
        </span>
      </router-link>
      <button @click="filter = 'all'" :class="{ active: filter === 'all' }" class="filter-btn">
        Все посты
      </button>
      <button @click="filter = 'following'" :class="{ active: filter === 'following' }" class="filter-btn">
        Подписки
      </button>
      <button @click="filter = 'liked'" :class="{ active: filter === 'liked' }" class="filter-btn">
        Лайкнутые
      </button>
      <button @click="filter = 'commented'" :class="{ active: filter === 'commented' }" class="filter-btn">
        Откомментированные
      </button>
    </div>
  </NavBar>
  
  <aside class="sidebar">
    <router-link to="/messages" class="filter-btn">
      💬 Сообщения
      <span v-if="messagesStore.unreadCount > 0" class="badge">
        {{ messagesStore.unreadCount }}
      </span>
    </router-link>
    <button @click="filter = 'all'" :class="{ active: filter === 'all' }" class="filter-btn">
      Все посты
    </button>
    <button @click="filter = 'following'" :class="{ active: filter === 'following' }" class="filter-btn">
      Подписки
    </button>
    <button @click="filter = 'liked'" :class="{ active: filter === 'liked' }" class="filter-btn">
      Лайкнутые
    </button>
    <button @click="filter = 'commented'" :class="{ active: filter === 'commented' }" class="filter-btn">
      Откомментированные
    </button>
  </aside>

  <div class="feed-page">
    <CreatePost />
    <p v-if="error" class="error" style="text-align:center;padding:24px">{{ error }}</p>
    <div v-else-if="posts.loading" class="loading">Загрузка...</div>
    <div v-else>
      <PostCard v-for="post in filteredPosts" :key="post.id" :post="post" />
      <p v-if="!filteredPosts.length" class="empty">Постов нет</p>
    </div>
  </div>
</template>

<style scoped>
.sidebar {
  position: fixed;
  left: 24px;
  top: 80px;
  width: 200px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.sidebar-content {
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.filter-btn {
  background: #1a1a1a;
  border: 1px solid #2a2a2a;
  color: #e4e4e4;
  padding: 12px 16px;
  border-radius: 8px;
  cursor: pointer;
  font-size: 14px;
  text-align: left;
  transition: all 0.2s;
}
.filter-btn:hover {
  background: #2a2a2a;
}
.filter-btn.active {
  background: #7c6aff;
  border-color: #7c6aff;
  color: #fff;
}

.filter-btn {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.badge {
  background: #dc3545;
  color: white;
  border-radius: 10px;
  padding: 2px 8px;
  font-size: 11px;
  font-weight: 600;
  min-width: 18px;
  text-align: center;
}

.feed-page {
  max-width: 600px;
  margin: 24px auto;
  padding: 0 16px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

@media (max-width: 768px) {
  .sidebar {
    display: none;
  }
  
  .feed-page {
    margin-top: 80px;
  }
}
</style>
