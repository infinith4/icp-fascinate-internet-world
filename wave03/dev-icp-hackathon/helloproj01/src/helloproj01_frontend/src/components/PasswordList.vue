<template>
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
</template>

<script setup>
import { ref, onMounted } from "vue";
import { helloproj01_backend } from 'declarations/helloproj01_backend/index';

import decryptPassword from "../decryptPassword";
const masterPassword = process.env.MASTERPASSWORD;
const passwords = ref([]);

const fetchPasswords = async () => {
  
      // Change identity
      const agent = Actor.agentOf(iitest_backend);
      agent.replaceIdentity(this.authClient.getIdentity());
  await helloproj01_backend.get_passwords().then(async (response) => {
    passwords.value = await Promise.all(
      response.map(async (res) => {
        const responseDecryptPassword = await decryptPassword({
          encrypted: res.encrypted,
          iv: res.iv,
          salt: res.salt,
        }, masterPassword);
        return { service_name: res.service_name, username: res.username, password: responseDecryptPassword };
      })
    );
  });
};

const deletePassword = async (index) => {
  const success = await helloproj01_backend.delete_password(index);
  if (success) {
    await fetchPasswords();
  } else {
    alert("Failed to delete password.");
  }
};

onMounted(fetchPasswords);
</script>
