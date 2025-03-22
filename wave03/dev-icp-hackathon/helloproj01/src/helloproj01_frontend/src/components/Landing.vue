<script setup lang="ts">

import { ref, onMounted } from 'vue';
import { AuthClient } from '@dfinity/auth-client';
import { getIdentityProvider } from '../stores/authStore'

//vuetify
import { mdiAccount, mdiDelete, mdiPencil, mdiShareVariant } from '@mdi/js'

const identity = ref<any>(null);
const principal = ref<string | null>(null);

const login = async () => {
  const authClient = await AuthClient.create();  
  authClient.login({
    identityProvider: getIdentityProvider(), //IIのCanister id を指定
    onSuccess: async () => {
      identity.value = authClient.getIdentity();
      principal.value = identity.value.getPrincipal().toString();
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
      <v-col cols="12" md="4" class="d-flex align-center justify-center">
        <div class="d-flex align-center">
          <v-avatar size="40">
            <v-img src="../public/icpass.png" alt="Logo"></v-img>
          </v-avatar>
          <span class="text-h6 ml-4">Password Manager</span>
        </div>
      </v-col>

      <!-- 右側2/3: ログインボタン -->
      <v-col cols="12" md="8" class="d-flex align-center justify-center">
        <v-btn
          append-icon="mdi-login"
          variant="outlined"
          size="large"
          class="px-8"
          @click="login"
        >
          ログイン
        </v-btn>
      </v-col>
    </v-row>
  </v-container>
</template>