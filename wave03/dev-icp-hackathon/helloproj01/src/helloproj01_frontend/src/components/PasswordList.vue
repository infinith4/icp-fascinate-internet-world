<template>
  <div>
    <h2>Stored Passwords</h2>
    <ul>
      <p>passwords.length {{ passwords.length }}</p>
      <li v-for="(entry, index) in passwords" :key="index">
        <strong>service_name</strong> - username - password - encryped - iv - salt
        <strong>{{ entry.service_name }}</strong> - {{ entry.username }} - {{ entry.password }} - {{ entry.encrypted }} - {{ entry.iv }} - {{ entry.salt }}
        <button @click="deletePassword(index)">Delete</button>
      </li>
    </ul>
  </div>
</template>

<script setup>
import { ref, onMounted } from "vue";
import backend from "../api";
import { helloproj01_backend } from 'declarations/helloproj01_backend/index';

import decryptPassword from "../decryptPassword";

const passwords = ref([]);

const fetchPasswords = async () => {
  await helloproj01_backend.get_passwords().then((response) => {
    // for(res in response){
    //   console.log(await decryptPassword({res.encryped, res.iv, res.salt}))
    // }
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
