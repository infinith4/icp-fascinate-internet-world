<script setup >
import { ref, onMounted } from 'vue';
import { AuthClient } from '@dfinity/auth-client';
import { getIdentityProvider } from '../stores/authStore'

//vuetify
import { mdiAccount, mdiDelete, mdiPencil, mdiShareVariant } from '@mdi/js'

const identity = ref(null);
const principal = ref(null);
let authClient;

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
  if (await authClient.isAuthenticated()) {
    identity.value = authClient.getIdentity();
    principal.value = identity.value.getPrincipal().toString();
  }
});
</script>

<template>
  <div class="d-flex justify-space-around">
    <v-icon icon="md:home"></v-icon>
    
    <v-icon icon="md:event"></v-icon>
    <v-icon icon="md:info"></v-icon>
    <v-icon icon="md:folder_open"></v-icon>
    <v-icon icon="md:widgets"></v-icon>
    <v-icon icon="md:gavel"></v-icon>
  </div>
  <v-icon :icon="`mdiSvg:${mdiAccount}`"></v-icon>
  <v-btn ariant="tonal" @click="login" v-if="!identity">ログイン<v-icon
          icon="mdi-checkbox-marked-circle"
          end
        ></v-icon></v-btn>
  <div v-if="identity">
    <p>Debug::Logged in as: {{ principal }}</p>
    <v-btn append-icon="$vuetify" variant="tonal"  @click="logout">Logout</v-btn>
  </div>
</template>
