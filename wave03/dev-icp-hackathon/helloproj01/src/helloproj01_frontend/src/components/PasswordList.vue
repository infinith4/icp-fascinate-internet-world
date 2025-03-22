<template>
  <div v-if="authStore.isAuthenticated">
    <v-card>
      <v-card-title class="text-h6">
        パスワード一覧
      </v-card-title>
      <v-card-text>
        <p v-if="filteredSecrets.length === 0" class="text-subtitle-1 text-medium-emphasis">
          保管されているパスワードはありません
        </p>
        <v-table
          v-else
          density="compact"
          hover
          fixed-header
        >
          <thead>
            <tr>
              <th class="text text-subtitle-2 font-weight-bold">ID</th>
              <th class="text text-subtitle-2 font-weight-bold">サービス名</th>
              <th class="text text-subtitle-2 font-weight-bold">ユーザー名</th>
              <th class="text text-subtitle-2 font-weight-bold">削除</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="(secret, index) in filteredSecrets"
              :key="index"
              :class="index % 2 === 0 ? 'bg-grey-lighten-5' : ''"
            >
              <td>
                <v-btn
                  style="text-transform: none"
                  variant="text"
                  density="compact"
                  class="text-primary"
                  @click="openEditForm(secret.id)"
                >{{ secret.id }}</v-btn>
              </td>
              <td>
                <v-btn
                  style="text-transform: none"
                  variant="text"
                  density="compact"
                  class="text-primary"
                  @click="openEditForm(secret.id)"
                >{{ secret.serviceName }}</v-btn>
              </td>
              <td>
                <v-btn
                  style="text-transform: none"
                  variant="text"
                  density="compact"
                  class="text-primary"
                  @click="openEditForm(secret.id)"
                >{{ secret.userName }}</v-btn>
              </td>
              <td>
                <v-btn
                  style="text-transform: none"
                  density="compact"
                  icon="mdi-delete"
                  variant="text"
                  color="error"
                  size="small"
                  @click="deletePassword(secret.id)"
                ></v-btn>
              </td>
            </tr>
          </tbody>
        </v-table>
      </v-card-text>
    </v-card>
    <v-dialog v-model="dialog" persistent max-width="600px">
      <v-card>
        <v-card-title class="text-h6 bg-primary text-white pa-4">
          パスワード更新
          <v-btn
            icon="mdi-close"
            variant="text"
            color="white"
            class="float-right"
            @click="dialog = false"
          ></v-btn>
        </v-card-title>
        <v-card-text class="pa-4">
          <PasswordForm
            :secretId="selectedSecretId"
            @close="handleClose"
          />
        </v-card-text>
      </v-card>
    </v-dialog>
  </div>
  
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from "vue";
import { useAuthStore } from '../stores/authStore';
import { refreshSecrets, removeSecret } from "../stores/secrets";
import type { SecretModel } from "../libs/secret";
import PasswordForm from "./PasswordForm.vue"
const dialog = ref(false);
const selectedSecretId = ref<bigint | undefined>();

const props = defineProps<{
  searchQuery: string
}>();

const emit = defineEmits<{
  (e: 'openDialog'): void
}>();

const openEditForm = (id: bigint) => {
  selectedSecretId.value = id;
  dialog.value = true;
};

const openNewPasswordForm = () => {
  selectedSecretId.value = undefined;
  emit('openDialog');
};

const secretsList = ref<SecretModel[]>([]);
const authStore = useAuthStore();

const filteredSecrets = computed(() => {
  if (!props.searchQuery) return secretsList.value;
  
  const query = props.searchQuery.toLowerCase();
  return secretsList.value.filter(secret =>
    secret.serviceName.toLowerCase().includes(query) ||
    secret.userName.toLowerCase().includes(query)
  );
});

const fetchPasswords = async () => {
  if (!authStore.isAuthenticated || !authStore.actor || !authStore.crypto) {
    console.log("Not authenticated, actor, or crypto not initialized");
    return;
  }
  
  try {
    const response = await refreshSecrets(authStore.actor as any, authStore.crypto as any);
    secretsList.value = response.map(secret => ({
      id: BigInt(secret.id),
      serviceName: secret.serviceName,
      userName: secret.userName,
      password: secret.password,
      createdAt: secret.createdAt,
      updatedAt: secret.updatedAt,
      owner: secret.owner,
      tags: secret.tags,
      users: []
    }));
  } catch (error) {
    console.error("Failed to fetch passwords:", error);
  }
};

onMounted(async () => {
  await authStore.initAuth();
  if (authStore.isAuthenticated) {
    await fetchPasswords();
  }
});

const handleClose = async () => {
  dialog.value = false;
  selectedSecretId.value = undefined;
  await fetchPasswords();
};

const deletePassword = async (id: bigint) => {
  if (!authStore.actor || !authStore.crypto) return;
  
  await removeSecret(id, authStore.actor as any, authStore.crypto as any);
  await fetchPasswords();
};
</script>
