<script setup>
import { ref } from 'vue'
import { usePostsStore } from '../stores/posts'
import { useAuthStore } from '../stores/auth'

const props = defineProps({ post: Object })
const posts = usePostsStore()
const auth = useAuthStore()

const showComments = ref(false)
const commentText = ref('')
const sending = ref(false)

const isLiked = () => props.post.likes?.includes(auth.user?.id)

function formatDate(d) {
  return new Date(d).toLocaleString('ru-RU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
}

async function addComment() {
  if (!commentText.value.trim()) return
  sending.value = true
  try {
    await posts.addComment(props.post.id, commentText.value)
    commentText.value = ''
  } finally {
    sending.value = false
  }
}
</script>

<template>
  <div class="post-card">
    <div class="post-header">
      <router-link :to="`/profile/${post.author?.id}`" class="author-link">
        <div v-if="post.author?.avatarUrl" class="avatar-sm">
          <img :src="post.author.avatarUrl" alt="avatar" />
        </div>
        <div v-else class="avatar-sm">{{ post.author?.username?.[0]?.toUpperCase() }}</div>
        <span>{{ post.author?.username }}</span>
      </router-link>
      <span class="post-date">{{ formatDate(post.createdAt) }}</span>
    </div>
    <p v-if="post.text" class="post-text">{{ post.text }}</p>
    <img v-if="post.imageUrl && !post.imageUrl.match(/\.(mp4|webm|ogg)$/i)" :src="post.imageUrl" class="post-img" alt="post image" />
    <video v-if="post.imageUrl && post.imageUrl.match(/\.(mp4|webm|ogg)$/i)" :src="post.imageUrl" class="post-video" controls></video>
    <div class="post-footer">
      <button @click="posts.likePost(post.id)" :class="{ liked: isLiked() }" class="like-btn">
        ❤️ {{ post.likes?.length || 0 }}
      </button>
      <button @click="showComments = !showComments" class="comment-btn">
        💬 {{ post.comments?.length || 0 }}
      </button>
    </div>
    <div v-if="showComments" class="comments-section">
      <div v-for="c in post.comments" :key="c.id" class="comment">
        <router-link :to="`/profile/${c.author?.id}`" class="comment-author">
          {{ c.author?.username }}
        </router-link>
        <span class="comment-text">{{ c.text }}</span>
        <span class="comment-date">{{ formatDate(c.createdAt) }}</span>
      </div>
      <div class="comment-input">
        <input v-model="commentText" placeholder="Написать комментарий..." @keyup.enter="addComment" />
        <button @click="addComment" :disabled="!commentText.trim() || sending">Отправить</button>
      </div>
    </div>
  </div>
</template>
