<script setup>
import { ref } from 'vue'
import { usePostsStore } from '../stores/posts'

const posts = usePostsStore()
const text = ref('')
const mediaFile = ref(null)
const preview = ref(null)
const previewType = ref(null)
const loading = ref(false)
const error = ref('')

function onFileChange(e) {
  const file = e.target.files[0]
  if (!file) return
  mediaFile.value = file
  previewType.value = file.type.startsWith('video/') ? 'video' : 'image'
  preview.value = URL.createObjectURL(file)
}

async function submit() {
  if (!text.value.trim() && !mediaFile.value) return
  error.value = ''
  loading.value = true
  try {
    await posts.createPost(text.value, mediaFile.value)
    text.value = ''
    mediaFile.value = null
    preview.value = null
    previewType.value = null
  } catch (e) {
    error.value = 'Не удалось опубликовать пост'
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="create-post">
    <textarea v-model="text" placeholder="Что у вас нового?" rows="3"></textarea>
    <div class="post-actions">
      <label class="file-label">
        📷 Фото/Видео
        <input type="file" accept="image/*,video/*" @change="onFileChange" hidden />
      </label>
      <button @click="submit" :disabled="loading || (!text.trim() && !mediaFile)">
        {{ loading ? 'Публикуем...' : 'Опубликовать' }}
      </button>
    </div>
    <img v-if="preview && previewType === 'image'" :src="preview" class="preview-img" alt="preview" />
    <video v-if="preview && previewType === 'video'" :src="preview" class="preview-video" controls></video>
    <p v-if="error" class="error">{{ error }}</p>
  </div>
</template>

<style scoped>
.preview-video {
  margin-top: 12px;
  width: 100%;
  border-radius: 8px;
  max-height: 300px;
}
</style>
