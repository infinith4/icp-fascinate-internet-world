<template>
  <form @submit.prevent="addPassword">
    <input v-model="service_name" placeholder="Service Name" required />
    <input v-model="username" placeholder="Username" required />
    <input v-model="password" type="password" placeholder="Password" required />
    <input v-model="notes" placeholder="Notes (Optional)" />
    <button type="submit">Add Password</button>
  </form>
</template>

<script setup>
import { ref } from "vue";
import backend from "../api";

const service_name = ref("");
const username = ref("");
const password = ref("");
const notes = ref("");

const addPassword = async () => {
  const entry = {
    service_name: service_name.value,
    username: username.value,
    password: password.value,
    notes: notes.value ? [notes.value] : [],
  };
  
  const success = await backend.add_password(entry);
  if (success) {
    alert("Password added successfully!");
    service_name.value = "";
    username.value = "";
    password.value = "";
    notes.value = "";
  } else {
    alert("Failed to add password.");
  }
};
</script>
