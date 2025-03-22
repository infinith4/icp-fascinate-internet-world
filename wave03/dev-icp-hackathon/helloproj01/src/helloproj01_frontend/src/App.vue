<script setup>
import PasswordForm from "./components/PasswordForm.vue";
import PasswordList from "./components/PasswordList.vue";
import Landing from "./components/Landing.vue";
import Login from "./components/Login.vue";
import '@mdi/font/css/materialdesignicons.css'

import { ref, onMounted } from 'vue';
import { AuthClient } from '@dfinity/auth-client';
import { useAuthStore, getIdentityProvider } from './stores/authStore'

//vuetify
import { mdiAccount, mdiDelete, mdiPencil, mdiShareVariant } from '@mdi/js'

const drawer = ref(true);
const searchQuery = ref('');
const dialog = ref(false);
const identity = ref(null);
const principal = ref(null);
let authClient;
const authStore = useAuthStore();

const login = async () => {
  authClient = await AuthClient.create();  
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

const logout = async () => {
  await authClient.logout();
  identity.value = null;
  principal.value = null;
};

onMounted(async () => {
  authClient = await AuthClient.create();
  await authStore.initAuth();
  if (await authClient.isAuthenticated()) {
    identity.value = authClient.getIdentity();
    principal.value = identity.value.getPrincipal().toString();
  }
});
</script>

<template>
  <v-app>
    <Landing/>
    <div v-if="authStore.isAuthenticated">
      <v-app-bar color="white" density="compact">
        <v-container class="d-flex align-center justify-space-between">
          <div class="d-flex align-center">
            <v-app-bar-nav-icon @click="drawer = !drawer"></v-app-bar-nav-icon>
            <v-avatar size="40" class="ml-2">
              <v-img src="../public/icpass.png" alt="Logo"></v-img>
            </v-avatar>
            <v-toolbar-title class="ml-2">ICP Password Manager</v-toolbar-title>
          </div>
          <Login />
        </v-container>
      </v-app-bar>

      <v-navigation-drawer v-model="drawer" permanent>
        <v-list>
          <v-list-item>
            <v-text-field
              v-model="searchQuery"
              prepend-icon="mdi-magnify"
              label="パスワードを検索"
              hide-details
              clearable
              density="compact"
            ></v-text-field>
          </v-list-item>
        </v-list>
      </v-navigation-drawer>

      <v-main>
        <v-container>
          <div class="d-flex justify-end mb-4">
            <v-btn
              color="primary"
              append-icon="mdi-plus"
              variant="elevated"
              @click="dialog = true"
            >
              新規作成
            </v-btn>
          </div>
          <PasswordList :search-query="searchQuery" />
        </v-container>
      </v-main>

      <v-dialog v-model="dialog" persistent max-width="600px">
        <v-card>
          <v-card-title class="text-h6 bg-primary text-white pa-4">
            新規パスワード作成
            <v-btn
              icon="mdi-close"
              variant="text"
              color="white"
              class="float-right"
              @click="dialog = false"
            ></v-btn>
          </v-card-title>
          <v-card-text class="pa-4">
            <PasswordForm @close="dialog = false" />
          </v-card-text>
        </v-card>
      </v-dialog>
      </div>
  </v-app>
</template>
