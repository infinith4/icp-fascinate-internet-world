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
        <v-table v-else density="compact">
          <thead>
            <tr>
              <th>ID</th>
              <th>サービス名</th>
              <th>ユーザー名</th>
              <th>削除</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(secret, index) in filteredSecrets" :key="index">
              <td><a href="#" @click="dialog = true">{{ secret.id }}</a></td>
              <td><a href="#" @click.prevent="openNewPasswordForm">{{ secret.serviceName }}</a></td>
              <td><a href="#" @click.prevent="openNewPasswordForm">{{ secret.userName }}</a></td>
              <td>
                <v-btn
                  density="compact"
                  icon="mdi-delete"
                  variant="text"
                  color="error"
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
          <PasswordForm @close="dialog = false" />
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

const dialog = ref(false);

const props = defineProps<{
  searchQuery: string
}>();

const emit = defineEmits<{
  (e: 'openDialog'): void
}>();

const openNewPasswordForm = () => {
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
  if (!authStore.isAuthenticated || !authStore.actor) {
    console.log("Not authenticated or actor not initialized");
    return;
  }
  
  try {
    const response = await refreshSecrets(authStore.actor, authStore.crypto);
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

const deletePassword = async (id: bigint) => {
  if (!authStore.actor) return;
  
  await removeSecret(id, authStore.actor, authStore.crypto);
  console.log("Delete password at id:", id);
};
</script>
