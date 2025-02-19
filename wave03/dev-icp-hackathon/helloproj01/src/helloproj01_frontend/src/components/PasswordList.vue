<template>
  <div>
    <h2>Stored Passwords</h2>
    <ul>
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

const passwords = ref([]);

const fetchPasswords = async () => {
  passwords.value = await backend.get_passwords();
};

const deletePassword = async (index) => {
  const success = await backend.delete_password(index);
  if (success) {
    fetchPasswords();
  } else {
    alert("Failed to delete password.");
  }
};

onMounted(fetchPasswords);
</script>
