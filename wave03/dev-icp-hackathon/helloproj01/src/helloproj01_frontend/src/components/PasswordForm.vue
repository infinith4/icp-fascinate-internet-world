<template>
  <div v-if="authStore.isAuthenticated">
    <v-form @submit.prevent="addPassword">
      <v-container>
        <v-row>
          <v-col cols="12">
            <v-text-field
              v-model="service_name"
              label="サービス名"
              required
              prepend-icon="mdi-domain"
              variant="outlined"
              density="comfortable"
            ></v-text-field>
          </v-col>

          <v-col cols="12">
            <v-text-field
              v-model="username"
              label="ユーザー名"
              required
              prepend-icon="mdi-account"
              variant="outlined"
              density="comfortable"
            ></v-text-field>
          </v-col>

          <v-col cols="12">
            <v-text-field
              v-model="password"
              label="パスワード"
              type="password"
              required
              prepend-icon="mdi-lock"
              variant="outlined"
              density="comfortable"
            ></v-text-field>
          </v-col>

          <v-col cols="12">
            <v-textarea
              v-model="notes"
              label="メモ"
              prepend-icon="mdi-note-text"
              variant="outlined"
              density="comfortable"
              rows="3"
            ></v-textarea>
          </v-col>
        </v-row>

        <v-row>
          <v-col cols="12" class="d-flex justify-end">
            <v-btn
              color="primary"
              type="submit"
              :loading="loading"
            >
              保存
            </v-btn>
          </v-col>
        </v-row>
      </v-container>
    </v-form>
  </div>
</template>

<script setup lang="ts">
import { ref } from "vue";
import { useAuthStore } from '../stores/authStore';
import { addSecret } from "../stores/secrets";
import { createSecretModel } from "../libs/secret";

const emit = defineEmits<{
  (e: 'close'): void
}>();

const service_name = ref("");
const username = ref("");
const password = ref("");
const notes = ref("");
const loading = ref(false);

const authStore = useAuthStore();

const initializeAuth = async () => {
  try {
    await authStore.initAuth();
    if (!authStore.isAuthenticated) {
      await authStore.login();
    }
  } catch (error) {
    console.error("認証の初期化に失敗:", error);
  }
};

const addPassword = async () => {
  try {
    loading.value = true;

    if (!authStore.isAuthenticated || !authStore.actor || !authStore.client || !authStore.crypto) {
      await initializeAuth();
      
      if (!authStore.isAuthenticated || !authStore.actor) {
        throw new Error("認証に失敗しました。再度ログインしてください。");
      }
    }

    const principal = authStore.client!.getIdentity().getPrincipal();
    const secretModel = createSecretModel(
      service_name.value,
      username.value,
      password.value,
      notes.value ? [notes.value] : [],
      principal
    );
    
    await addSecret(
      secretModel,
      authStore.actor as any,
      authStore.crypto as any
    );
    
    service_name.value = "";
    username.value = "";
    password.value = "";
    notes.value = "";
    
    emit('close');
  } catch (error) {
    console.error("パスワードの追加に失敗:", error);
    alert("パスワードの追加に失敗しました: " + (error as Error).message);
  } finally {
    loading.value = false;
  }
};
</script>
