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
import { helloproj01_backend } from 'declarations/helloproj01_backend/index';
import encryptPassword from "../encryptPassword";
// import decryptPassword from "../decryptPassword";

const service_name = ref("");
const username = ref("");
const password = ref("");
const notes = ref("");

const addPassword = async () => {

  const encryptedData = await encryptPassword(password.value, "test")
  // alert(encryptedData.encrypted);
  alert(encryptedData.iv);
  alert(encryptedData.salt);
  const entry = {
    service_name: service_name.value,
    username: username.value,
    //password: await encryptPassword(password.value,"masterpassword"),
    password: password.value,
    encrypted: encryptedData.encrypted,
    iv: encryptedData.iv,
    salt: encryptedData.salt,
    notes: notes.value ? [notes.value] : [],
  };
  
  const success = await helloproj01_backend.add_password(entry);
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
