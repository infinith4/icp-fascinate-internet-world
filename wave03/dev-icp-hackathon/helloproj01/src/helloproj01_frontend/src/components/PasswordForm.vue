<template>
  <div v-if="authStore.isAuthenticated">
    <v-form @submit.prevent="addPassword">
      <v-container>
        <v-row>
          <v-col cols="12" v-if="props.secretId">
            <v-chip
              variant="text"
              prepend-icon="mdi-identifier"
              density="comfortable"
              style="padding-left: 10px;margin-left: 5px;"
              class="mt-3"
            ><v-container style="padding-left: 8px;">{{ props.secretId }}</v-container></v-chip>
          </v-col>
          <v-col cols="12">
            <v-text-field
              v-model="service_name"
              label="サービス名"
              required
              prepend-icon="mdi-domain"
              variant="outlined"
              density="comfortable"
              :rules="[rules.required]"
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
              :type="showPassword ? 'text' : 'password'"
              required
              prepend-icon="mdi-lock"
              :append-inner-icon="showPassword ? 'mdi-eye-off' : 'mdi-eye'"
              @click:append-inner="togglePassword"
              variant="outlined"
              density="comfortable"
              :rules="[rules.required]"
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
import { ref, onMounted } from "vue";
import { useAuthStore } from '../stores/authStore';
import { addSecret, getOneSecret, updateSecret } from "../stores/secrets";
import { createSecretModel } from "../libs/secret";

const props = defineProps<{
  secretId?: bigint
}>();

const emit = defineEmits<{
  (e: 'close'): void
}>();

const rules = {
  required: (value: string | null) => !!value || '入力必須です',
}

const service_name = ref("");
const username = ref("");
const password = ref("");
const notes = ref("");
const loading = ref(false);
const showPassword = ref(false);

const authStore = useAuthStore();

const togglePassword = () => {
  showPassword.value = !showPassword.value;
};

onMounted(async () => {
  if (props.secretId && authStore.actor && authStore.crypto) {
    loading.value = true;
    try {
      const secret = await getOneSecret(props.secretId, authStore.actor as any, authStore.crypto as any);
      if (secret) {
        service_name.value = secret.serviceName;
        username.value = secret.userName;
        password.value = secret.password;
        notes.value = secret.tags[0] || "";
      }
    } catch (error) {
      console.error("パスワード情報の取得に失敗:", error);
      alert("パスワード情報の取得に失敗しました: " + (error as Error).message);
    } finally {
      loading.value = false;
    }
  }
});

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
    
    if (props.secretId) {
      // 更新処理
      secretModel.id = props.secretId;
      await updateSecret(
        props.secretId,
        secretModel,
        authStore.actor as any,
        authStore.crypto as any
      );
    } else {
      // 新規作成処理
      await addSecret(
        secretModel,
        authStore.actor as any,
        authStore.crypto as any
      );
    }
    
    service_name.value = "";
    username.value = "";
    password.value = "";
    notes.value = "";
    
    emit('close');
    
  } catch (error) {
    console.error("パスワードの保存に失敗:", error);
    alert("パスワードの保存に失敗しました: " + (error as Error).message);
  } finally {
    loading.value = false;
  }
};
</script>
