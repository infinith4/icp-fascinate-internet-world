<script setup lang="ts">
import { useAuthStore } from '../stores/authStore';
import { onMounted } from 'vue';

const authStore = useAuthStore();

onMounted(() => {
  authStore.initAuthClient();
});
</script>

<template>
  <div>
    <p>認証状態: {{ authStore.isAuthenticated ? 'ログイン済み' : '未ログイン' }}</p>
    <button v-if="!authStore.isAuthenticated" @click="authStore.login">ログイン</button>
  </div>
</template>
