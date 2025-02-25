<template>
  <form @submit.prevent="addPassword" class="password-form">
    <div class="form-group">
      <label for="service-name">Service Name</label>
      <input 
        id="service-name"
        v-model="service_name" 
        placeholder="Enter service name" 
        required 
      />
    </div>

    <div class="form-group">
      <label for="username">Username</label>
      <input 
        id="username"
        v-model="username" 
        placeholder="Enter username" 
        required 
      />
    </div>

    <div class="form-group">
      <label for="password">Password</label>
      <input 
        id="password"
        v-model="password" 
        type="password" 
        placeholder="Enter password" 
        required 
      />
    </div>

    <div class="form-group">
      <label for="notes">Notes</label>
      <input 
        id="notes"
        v-model="notes" 
        placeholder="Optional notes" 
      />
    </div>

    <button type="submit" class="submit-btn">Add Password</button>
  </form>
</template>

<script setup>
import { ref } from "vue";
import { helloproj01_backend } from 'declarations/helloproj01_backend/index';
import encryptPassword from "../encryptPassword";

const service_name = ref("");
const username = ref("");
const password = ref("");
const notes = ref("");
const masterPassword = process.env.MASTERPASSWORD;

const addPassword = async () => {

  const encryptedData = await encryptPassword(password.value, masterPassword)

  const entry = {
    service_name: service_name.value,
    username: username.value,
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

    location.reload();
  } else {
    alert("Failed to add password.");
  }
};
</script>
