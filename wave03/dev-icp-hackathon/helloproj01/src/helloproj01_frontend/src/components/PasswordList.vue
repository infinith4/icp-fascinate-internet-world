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
import backend from "../api";
import { helloproj01_backend } from 'declarations/helloproj01_backend/index';

import decryptPassword from "../decryptPassword";
const masterPassword = process.env.MASTERPASSWORD;
const passwords = ref([]);

const fetchPasswords = async () => {
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

<style scoped>
.password-list {
  padding: 20px;
}

.title {
  color: #2c3e50;
  margin-bottom: 20px;
}

.empty-message {
  color: #666;
  font-style: italic;
}

.table {
  width: 100%;
  border-collapse: collapse;
  margin-top: 20px;
}

.table th,
.table td {
  padding: 12px;
  text-align: left;
  border-bottom: 1px solid #ddd;
}

.table th {
  background-color: #f8f9fa;
  color: #2c3e50;
  font-weight: 600;
}

.table tr:hover {
  background-color: #f5f5f5;
}

.delete-btn {
  background-color: #dc3545;
  color: white;
  border: none;
  padding: 6px 12px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
}

.delete-btn:hover {
  background-color: #c82333;
}
</style>
