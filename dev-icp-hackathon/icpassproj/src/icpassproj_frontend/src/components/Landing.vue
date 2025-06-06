<script setup lang="ts">

import { ref, onMounted } from 'vue';
import { AuthClient } from '@dfinity/auth-client';
import { getIdentityProvider, useAuthStore } from '../stores/authStore'

const identity = ref<any>(null);
const principal = ref<string | null>(null);

const authStore = useAuthStore();
const login = async () => {
  const authClient = await AuthClient.create();  
  authClient.login({
    identityProvider: getIdentityProvider(), //IIのCanister id を指定
    onSuccess: async () => {
      identity.value = authClient.getIdentity();
      principal.value = identity.value.getPrincipal().toString();
      await authStore.initAuth();  //initAuth してから authenticate を呼ばないとclient がないのでエラーになる
      await authStore.authenticate();
    },
    onError: (err) => {
      console.error("Login failed:", err);
    }
  });
};


onMounted(async () => {
  const authClient = await AuthClient.create();
  if (await authClient.isAuthenticated()) {
    identity.value = authClient.getIdentity();
    principal.value = identity.value.getPrincipal().toString();
  }
});
</script>


<template>
  <v-container class="fill-height">
    <v-row class="fill-height ma-0">
      <!-- 左側1/3: Password Manager -->
      <v-col cols="12" md="4" class="d-flex align-center justify-center" :class="{'py-4': $vuetify.display.mobile}">
        <div class="d-flex align-center">
          <v-avatar size="40">
            <v-img src="../icpass.png" alt="icpass" style="max-width:100%"></v-img>
          </v-avatar>
          <span class="text-h6 ml-4">Password Manager</span>
        </div>
      </v-col>

      <!-- 右側2/3: 説明文とログインボタン -->
      <v-col cols="12" md="8" class="d-flex align-center justify-center" :class="{'align-top': $vuetify.display.mobile}">
        <div class="d-flex flex-column align-center">
          <p class="text-body-1 mb-4 text-center">
            Internet Computer上で安全にパスワードを管理できます。<br>
            Internet Identity でログインしてください。
          </p>
          <v-btn
            append-icon="mdi-login"
            variant="outlined"
            size="large"
            class="px-8"
            @click="login"
          >
            ログイン
          </v-btn>
        </div>
      </v-col>
    </v-row>
  </v-container>
</template>