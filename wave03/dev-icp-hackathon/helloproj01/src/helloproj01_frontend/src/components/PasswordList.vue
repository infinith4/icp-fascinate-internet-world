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
            <td>{{ entry.service_name }}</td>
            <td>{{ entry.username }}</td>
            <td>{{ entry.password }}</td>
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

// import decryptPassword from "../decryptPassword";
// const masterPassword = process.env.MASTERPASSWORD;
const passwords = ref([]);

const authStore = useAuthStore();

onMounted(() => {

  authStore.initAuth();
  fetchPasswords();
});

const fetchPasswords = async () => {
  console.log("fetchPasswords")
  const authStore = useAuthStore();
  console.log(authStore.actor);
  await refreshSecrets(authStore.actor!, authStore.crypto).then(async (response) => {
    console.log(response);
    // passwords.value = await Promise.all(
    //   response.map(async (res) => {
    //     console.log("test")
    //     // const responseDecryptPassword = await decryptPassword({
    //     //   encrypted: res.encrypted,
    //     //   iv: res.iv,
    //     //   salt: res.salt,
    //     // }, masterPassword);
    //     // return { service_name: res.service_name, username: res.username, password: responseDecryptPassword };
    //   })
    // );
  });
};

// const deletePassword = async (index) => {
//   const success = await helloproj01_backend.delete_password(index);
//   if (success) {
//     await fetchPasswords();
//   } else {
//     alert("Failed to delete password.");
//   }
// };

onMounted(fetchPasswords);
</script>
