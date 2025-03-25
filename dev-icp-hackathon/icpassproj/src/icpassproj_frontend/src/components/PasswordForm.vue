<template>
  <div v-if="authStore.isAuthenticated" class="position-relative">
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
    <v-form @submit.prevent="addPassword" style="max-width: fit-content;">
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
              append-inner-icon="mdi-content-copy"
              @click:append-inner="copyServiceName"
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
              append-inner-icon="mdi-content-copy"
              @click:append-inner="copyUserName"
            ></v-text-field>
          </v-col>

          <v-col cols="12">
            <v-text-field
              v-model="password"
              label="パスワード"
              :type="showPassword ? 'text' : 'password'"
              required
              prepend-icon="mdi-lock"
              variant="outlined"
              density="comfortable"
              :rules="[rules.required]"
            >
              <template v-slot:append-inner>
                <v-icon
                  @click="togglePassword"
                  :icon="showPassword ? 'mdi-eye-off' : 'mdi-eye'"
                  class="me-2"
                ></v-icon>
                <v-icon
                  icon="mdi-content-copy"
                  @click="copyPassword"
                  class="me-2"
                ></v-icon>
                <v-icon
                  icon="mdi-refresh"
                  @click="generatePassword"
                  class="me-2"
                ></v-icon>
              </template>
            </v-text-field>
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

        <v-snackbar
          v-model="showCopySuccess"
          color="success"
          :timeout="2000"
        >
          コピーしました
        </v-snackbar>
      </v-container>
    </v-form>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from "vue";
import { useAuthStore } from '../stores/authStore';
import { useSecretsStore } from '../stores/secrets';
import { addSecret, getOneSecret, updateSecret } from "../stores/secrets";
import { createSecretModel } from "../libs/secret";

const showCopySuccess = ref(false);
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
const secretsStore = useSecretsStore();

const togglePassword = () => {
  showPassword.value = !showPassword.value;
};

const generatePassword = () => {
  const length = 16;
  const charset = {
    uppercase: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
    lowercase: 'abcdefghijklmnopqrstuvwxyz',
    numbers: '0123456789',
    symbols: '!@#^&*$'
  };

  let result = '';
  // 各文字種から最低1文字を確保
  result += charset.uppercase.charAt(Math.floor(Math.random() * charset.uppercase.length));
  result += charset.lowercase.charAt(Math.floor(Math.random() * charset.lowercase.length));
  result += charset.numbers.charAt(Math.floor(Math.random() * charset.numbers.length));
  result += charset.symbols.charAt(Math.floor(Math.random() * charset.symbols.length));

  // 残りの文字をランダムに生成
  const allChars = Object.values(charset).join('');
  for (let i = result.length; i < length; i++) {
    result += allChars.charAt(Math.floor(Math.random() * allChars.length));
  }

  // 文字列をシャッフル
  result = result.split('').sort(() => Math.random() - 0.5).join('');
  
  password.value = result;
};

const copyServiceName = async () => {
  try {
    await navigator.clipboard.writeText(service_name.value);
    showCopySuccess.value = true;
  } catch (error) {
    console.error('クリップボードへのコピーに失敗:', error);
  }
};

const copyUserName = async () => {
  try {
    await navigator.clipboard.writeText(username.value);
    showCopySuccess.value = true;
  } catch (error) {
    console.error('クリップボードへのコピーに失敗:', error);
  }
};

const copyPassword = async () => {
  try {
    await navigator.clipboard.writeText(password.value);
    showCopySuccess.value = true;
  } catch (error) {
    console.error('クリップボードへのコピーに失敗:', error);
  }
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
    //必須項目チェック
    if (!service_name.value) {
      return;
    }
    if (!password.value) {
      return;
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
