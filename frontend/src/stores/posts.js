import { defineStore } from 'pinia'
import api from '../api'

export const usePostsStore = defineStore('posts', {
  state: () => ({
    posts: [],
    loading: false,
  }),
  actions: {
    async fetchFeed() {
      this.loading = true
      const { data } = await api.get('/posts')
      this.posts = data
      this.loading = false
    },
    async fetchUserPosts(userId) {
      const { data } = await api.get(`/posts/user/${userId}`)
      return data
    },
    async createPost(text, imageFile) {
      let imageUrl = null
      if (imageFile) {
        imageUrl = await this.uploadToS3(imageFile)
      }
      const { data } = await api.post('/posts', { text, imageUrl })
      this.posts.unshift(data)
      return data
    },
    async uploadToS3(file) {
      return new Promise((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = async () => {
          try {
            const { data } = await api.post('/upload/image', {
              base64: reader.result,
              filename: file.name,
              contentType: file.type,
            })
            resolve(data.url)
          } catch (e) {
            reject(e)
          }
        }
        reader.onerror = reject
        reader.readAsDataURL(file)
      })
    },
    async likePost(postId) {
      const { data } = await api.post(`/posts/${postId}/like`)
      const idx = this.posts.findIndex(p => p.id === postId)
      if (idx !== -1) this.posts[idx] = data
    },
    async addComment(postId, text) {
      const { data } = await api.post(`/posts/${postId}/comments`, { text })
      const idx = this.posts.findIndex(p => p.id === postId)
      if (idx !== -1) this.posts[idx] = data
      return data
    },
  },
})
