<template>
  <div v-if="authStore.isAuthenticated">
    <div class="password-list">
      <h3 class="title">Stored Passwords</h3>
      <p v-if="secretsList.length === 0" class="empty-message">No passwords stored yet.</p>
      <table v-else class="table">
        <thead>
          <tr>
            <th>Service Name</th>
            <th>Username</th>
            <th>Password</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(secret, index) in secretsList" :key="index">
            <td>{{ secret.serviceName }}</td>
            <td>{{ secret.userName }}</td>
            <td>{{ secret.password }}</td>
            <td>
              <button class="delete-btn" @click="deletePassword(index)">
                Delete
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from "vue";
import { useAuthStore } from '../stores/authStore';
import { CryptoService } from '../libs/crypto';
// import { helloproj01_backend } from 'declarations/helloproj01_backend/index';
// import { secrets_backend } from 'declarations/secrets_backend/secrets_backend.did.d.ts';
import { decryptSecrets, refreshSecrets } from "../stores/secrets";
import type { SecretModel } from "../libs/secret";

// import decryptPassword from "../decryptPassword";
// const masterPassword = process.env.MASTERPASSWORD;
const secretsList = ref<SecretModel[]>([]);

const authStore = useAuthStore();

const fetchPasswords = async () => {
  console.log("fetchPasswords")
  if (!authStore.isAuthenticated || !authStore.actor) {
    console.log("Not authenticated or actor not initialized");
    return;
  }
  console.log("authStore.actor");
  console.log(await authStore.actor.whoami());
  await refreshSecrets(authStore.actor, authStore.crypto).then(async (response) => {
    console.log("response");
    console.log(response);
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
  });
};

onMounted(async () => {
  await authStore.initAuth();
  if (authStore.isAuthenticated) {
    await fetchPasswords();
  }
});

const deletePassword = async (index: number) => {
  if (!authStore.actor) return;
  // TODO: Implement delete functionality
  console.log("Delete password at index:", index);
};

// const deletePassword = async (index) => {
//   const success = await helloproj01_backend.delete_password(index);
//   if (success) {
//     await fetchPasswords();
//   } else {
//     alert("Failed to delete password.");
//   }
// };

</script>
