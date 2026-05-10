<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { useAuthStore } from '../stores/auth'
import { usePostsStore } from '../stores/posts'
import PostCard from '../components/PostCard.vue'
import NavBar from '../components/NavBar.vue'
import api from '../api'

const route = useRoute()
const auth = useAuthStore()
const postsStore = usePostsStore()

const profile = ref(null)
const userPosts = ref([])
const loading = ref(true)

onMounted(async () => {
  const userId = route.params.id
  const [profileRes] = await Promise.all([
    api.get(`/users/${userId}`),
  ])
  profile.value = profileRes.data
  userPosts.value = await postsStore.fetchUserPosts(userId)
  loading.value = false
})

const isOwn = computed(() => auth.user?.id === route.params.id)

async function toggleFollow() {
  try {
    const { data } = await api.post(`/users/${route.params.id}/follow`)
    profile.value.isFollowing = data.isFollowing
    profile.value.followers += data.isFollowing ? 1 : -1
  } catch (e) {
    console.error('Follow error:', e)
  }
}
</script>

<template>
  <NavBar />
  <div class="profile-page" v-if="!loading && profile">
    <div class="profile-header">
      <div v-if="profile.avatarUrl" class="avatar">
        <img :src="profile.avatarUrl" alt="avatar" />
      </div>
      <div v-else class="avatar">{{ profile.username[0].toUpperCase() }}</div>
      <div class="profile-info">
        <h2>{{ profile.username }}</h2>
        <p class="email">{{ profile.email }}</p>
        <div class="stats">
          <router-link :to="`/profile/${route.params.id}/followers`" class="stat-link">
            {{ profile.followers || 0 }} подписчиков
          </router-link>
          <router-link :to="`/profile/${route.params.id}/following`" class="stat-link">
            {{ profile.following || 0 }} подписок
          </router-link>
        </div>
        <button v-if="!isOwn" @click="toggleFollow" class="follow-btn" :class="{ following: profile.isFollowing }">
          {{ profile.isFollowing ? 'Отписаться' : 'Подписаться' }}
        </button>
      </div>
    </div>
    <h3>Посты</h3>
    <PostCard v-for="post in userPosts" :key="post.id" :post="post" />
    <p v-if="!userPosts.length" class="empty">Постов нет</p>
  </div>
  <div v-else-if="loading" class="loading">Загрузка...</div>
</template>

<style scoped>
.profile-info {
  flex: 1;
}
.stats {
  display: flex;
  gap: 16px;
  margin-top: 8px;
  font-size: 14px;
  color: #888;
}
.follow-btn {
  margin-top: 12px;
  background: #7c6aff;
  color: #fff;
  border: none;
  padding: 8px 24px;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
}
.follow-btn:hover {
  background: #6a58e0;
}
.follow-btn.following {
  background: #2a2a2a;
  border: 1px solid #7c6aff;
  color: #7c6aff;
}
</style>

<style scoped>
.stat-link {
  color: #888;
  transition: color 0.2s;
}
.stat-link:hover {
  color: #7c6aff;
}
</style>
