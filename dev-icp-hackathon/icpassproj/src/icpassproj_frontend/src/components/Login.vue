<script setup >
import { ref, onMounted } from 'vue';
import { AuthClient } from '@dfinity/auth-client';
import { getIdentityProvider } from '../stores/authStore'

//vuetify
import { mdiAccount, mdiDelete, mdiPencil, mdiShareVariant } from '@mdi/js'

const identity = ref(null);
const principal = ref(null);
const showDialog = ref(false);
const showCopySuccess = ref(false);
let authClient;

const copyPrincipal = async () => {
  try {
    //setTimeout(async () => await navigator.clipboard.writeText(principal.value), 500);
    await navigator.clipboard.writeText(principal.value);
    showCopySuccess.value = true;
  } catch (error) {
    console.error('クリップボードへのコピーに失敗:', error);
  }
};


const logout = async () => {
  await authClient.logout();
  identity.value = null;
  principal.value = null;
  window.location.reload();
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
    <v-btn append-icon="mdi-account" variant="outlined" @click="showDialog = true">
      <v-sheet class="text-truncate text-body-2" style="max-width: 80px;" >{{ principal }}</v-sheet>
    </v-btn>
    <v-sheet class="ma-2 pa-2"><v-btn append-icon="mdi-logout" variant="outlined" @click="logout">ログアウト</v-btn></v-sheet>

    <v-dialog v-model="showDialog" max-width="500px">
      <v-card>
        <v-card-title class="text-h6">アカウント情報</v-card-title>
        <v-card-text>
          <v-expansion-panels>
            <v-expansion-panel>
              <v-expansion-panel-title>プリンシパルID</v-expansion-panel-title>
              <v-expansion-panel-text>
                <div class="d-flex align-center">
                  <div class="text-body-1 flex-grow-1">{{ principal }}</div>
                  <v-btn
                    append-icon="mdi-content-copy"
                    @click="copyPrincipal"
                    variant="text"
                  >
                    <v-tooltip
                      activator="parent"
                      location="top"
                    >
                      コピー
                    </v-tooltip>
                  </v-btn>
                </div>
                <v-snackbar
                  v-model="showCopySuccess"
                  color="success"
                  :timeout="2000"
                >
                  プリンシパルIDをコピーしました
                </v-snackbar>
              </v-expansion-panel-text>
            </v-expansion-panel>
          </v-expansion-panels>
        </v-card-text>
        <v-card-actions>
          <v-spacer></v-spacer>
          <v-btn
            color="grey-darken-2"
            variant="text"
            @click="showDialog = false"
          >
            閉じる
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </div>
</template>
