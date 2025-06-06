<script setup>
import PasswordForm from "./components/PasswordForm.vue";
import PasswordList from "./components/PasswordList.vue";
import Landing from "./components/Landing.vue";
import Login from "./components/Login.vue";
import { ref, onMounted } from 'vue';

import { AuthClient } from '@dfinity/auth-client';
import { useAuthStore, getIdentityProvider } from './stores/authStore'

//vuetify
import { mdiAccount, mdiDelete, mdiPencil, mdiShareVariant } from '@mdi/js'

import { useDisplay } from 'vuetify';
const { mobile } = useDisplay();

const drawer = ref(true);
const searchQuery = ref('');
const dialog = ref(false);
const identity = ref(null);
const principal = ref(null);
const loading = ref(true);
let authClient;
const authStore = useAuthStore();

onMounted(async () => {
  try {
    loading.value = true;
    authClient = await AuthClient.create();
    const isAuthenticated = await authClient.isAuthenticated();
    
    if (isAuthenticated) {
      await authStore.initAuth();
      identity.value = authClient.getIdentity();
      principal.value = identity.value.getPrincipal().toString();
    }
  } catch (error) {
    console.error("認証状態の確認に失敗:", error);
    window.location.href = '/';
  } finally {
    loading.value = false;
  }
});

</script>

<template>
  <v-app class="position-relative">
    <v-overlay
      :model-value="loading"
      class="align-center justify-center"
      persistent
    >
      <v-progress-circular
        indeterminate
        color="primary"
      ></v-progress-circular>
    </v-overlay>
    <Landing v-if="!authStore.isAuthenticated"/>
    <div v-if="authStore.isAuthenticated">
      <v-app-bar color="white" height="48">
        <v-container class="d-flex align-center justify-space-between pa-0 h-100">
          <div class="d-flex align-center">
            <v-app-bar-nav-icon @click="drawer = !drawer"  :temporary="mobile" v-if="!mobile"></v-app-bar-nav-icon>
            <v-avatar size="40" class="ml-2">
              <v-img
                src="../icpass.png"
                alt="Logo"
                cover
                aspect-ratio="1"
              ></v-img>
            </v-avatar>
            <v-toolbar-title class="ml-2" :temporary="mobile" v-if="!mobile">Password Manager</v-toolbar-title>
          </div>
          <Login />
        </v-container>
      </v-app-bar>

      <v-navigation-drawer v-model="drawer" :temporary="mobile" v-if="!mobile">
        <v-list>
          <v-list-item>
            <v-text-field
              v-model="searchQuery"
              prepend-inner-icon="mdi-magnify"
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
