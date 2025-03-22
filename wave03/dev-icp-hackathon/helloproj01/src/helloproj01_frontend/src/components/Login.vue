<script setup >
import { ref, onMounted } from 'vue';
import { AuthClient } from '@dfinity/auth-client';
import { getIdentityProvider } from '../stores/authStore'

//vuetify
import { mdiAccount, mdiDelete, mdiPencil, mdiShareVariant } from '@mdi/js'

const identity = ref(null);
const principal = ref(null);
let authClient;


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
  <div v-if="identity" class="d-flex align-center">
    
    <v-btn append-icon="mdi-account" variant="outlined">
      <v-sheet class="text-truncate text-body-2" style="max-width: 80px;" >{{ principal }}</v-sheet>
    </v-btn>
    <v-sheet class="ma-2 pa-2"><v-btn append-icon="mdi-logout" variant="outlined" @click="logout">ログアウト</v-btn></v-sheet>
  </div>
</template>
