<template>
  <div>
    <h2>Stored Passwords</h2>
    <ul>
      <p>passwords.length {{ passwords.length }}</p>
      <li v-for="(entry, index) in passwords" :key="index">
        <strong>{{ entry.service_name }}</strong> - {{ entry.username }}
        <button @click="deletePassword(index)">Delete</button>
      </li>
    </ul>
  </div>
</template>

<script setup>
import { ref, onMounted } from "vue";
import backend from "../api";
import { helloproj01_backend } from 'declarations/helloproj01_backend/index';

const passwords = ref([]);

const fetchPasswords = async () => {
  await helloproj01_backend.get_passwords().then((response) => {
    passwords.value = response;
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
