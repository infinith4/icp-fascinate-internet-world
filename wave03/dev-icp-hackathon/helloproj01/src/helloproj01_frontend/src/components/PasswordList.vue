<template>
  <div v-if="authStore.isAuthenticated">
    <div class="password-list">
      <h3 class="title">Stored Passwords</h3>
      <p v-if="passwords.length === 0" class="empty-message">No passwords stored yet.</p>
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
          <tr v-for="(entry, index) in passwords" :key="index">
            <td>{{ entry.title }}</td>
            <!-- <td>{{ entry.username }}</td>
            <td>{{ entry.password }}</td> -->
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
const passwords = ref<SecretModel[]>([]);

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
    console.log(response);
    passwords.value = response;
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
