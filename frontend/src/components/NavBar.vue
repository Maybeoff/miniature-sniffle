<script setup>
import { ref } from 'vue'
import { useAuthStore } from '../stores/auth'
import { useRouter } from 'vue-router'

const auth = useAuthStore()
const router = useRouter()
const menuOpen = ref(false)

function logout() {
  auth.logout()
  router.push('/login')
}

function toggleMenu() {
  menuOpen.value = !menuOpen.value
}
</script>

<template>
  <nav class="navbar">
    <button @click="toggleMenu" class="menu-btn">☰</button>
    <router-link to="/feed" class="brand">Дом</router-link>
    <div class="nav-right">
      <router-link to="/settings" class="nav-link">⚙️</router-link>
      <router-link :to="`/profile/${auth.user?.id}`" class="nav-link">
        {{ auth.user?.username }}
      </router-link>
      <button @click="logout" class="logout-btn">Выйти</button>
    </div>
  </nav>
  
  <div v-if="menuOpen" class="mobile-overlay" @click="toggleMenu"></div>
  <aside :class="['mobile-sidebar', { open: menuOpen }]">
    <slot></slot>
  </aside>
</template>

<style scoped>
.menu-btn {
  display: none;
  background: none;
  border: none;
  color: #e4e4e4;
  font-size: 24px;
  cursor: pointer;
  padding: 8px;
}

.mobile-overlay {
  display: none;
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  z-index: 998;
}

.mobile-sidebar {
  display: none;
}

@media (max-width: 768px) {
  .menu-btn {
    display: block;
  }
  
  .mobile-overlay {
    display: block;
  }
  
  .mobile-sidebar {
    display: block;
    position: fixed;
    left: -240px;
    top: 56px;
    width: 240px;
    height: calc(100vh - 56px);
    background: #1a1a1a;
    transition: left 0.3s;
    z-index: 999;
    overflow-y: auto;
  }
  
  .mobile-sidebar.open {
    left: 0;
  }
}
</style>
