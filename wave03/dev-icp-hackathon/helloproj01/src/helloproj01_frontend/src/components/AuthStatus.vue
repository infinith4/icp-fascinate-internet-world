<script setup lang="ts">
import { useAuthStore } from '../stores/authStore';
import { onMounted } from 'vue';

const authStore = useAuthStore();

onMounted(() => {
  authStore.initAuth();
});
</script>

<template>
  <div>
    <p>Authentication status: {{ authStore.isAuthenticated ? 'logined' : 'no login' }}</p>
    <button v-if="!authStore.isAuthenticated" @click="authStore.login">login</button>
  </div>
</template>
