<template>
  <div v-if="authStore.isAuthenticated">
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
  </div>
</template>

<script setup lang="ts">
import { ref } from "vue";
import { helloproj01_backend } from '../../../declarations/helloproj01_backend/index';
import encryptPassword from "../encryptPassword";
import { useAuthStore } from '../stores/authStore';
import { CryptoService } from '../libs/crypto';
import { onMounted } from 'vue';
import { addSecret } from "../stores/secrets";
import { secretFromContent } from "../libs/secret";

const service_name = ref("");
const username = ref("");
const password = ref("");
const notes = ref("");

const authStore = useAuthStore();

// 認証の初期化を行う関数
const initializeAuth = async () => {
  try {
    await authStore.initAuth();
    if (!authStore.isAuthenticated) {
      await authStore.login();
    }
  } catch (error) {
    console.error("Auth initialization failed:", error);
  }
};

onMounted(async () => {
  await initializeAuth();
});

const masterPassword = import.meta.env.MASTERPASSWORD;

const addPassword = async () => {
  try {
    // 認証状態の再確認
    if (!authStore.isAuthenticated || !authStore.actor || !authStore.client || !authStore.crypto) {
      console.log("Trying to reinitialize auth...");
      await initializeAuth();
      
      // 再初期化後も認証できていない場合
      if (!authStore.isAuthenticated || !authStore.actor) {
        throw new Error("Authentication failed. Please try logging in again.");
      }
    }

    // whoamiを呼び出す前に必ずactorが存在することを確認
    if (!authStore.actor) {
      throw new Error("Actor not initialized");
    }

    // console.log("Calling whoami...");
    // const whoami = await authStore.actor.whoami();
    // console.log("whoami result:", whoami);

    const principal = authStore.client!.getIdentity().getPrincipal();
    const secretModel = secretFromContent("test", [], principal);
    
    await addSecret(
      secretModel,
      authStore.actor as any,
      authStore.crypto as any
    );

    const encryptedData = await encryptPassword(password.value, masterPassword);
    const entry = {
      service_name: service_name.value,
      username: username.value,
      encrypted: encryptedData.encrypted,
      iv: encryptedData.iv,
      salt: encryptedData.salt,
      notes: notes.value ? [notes.value] : [],
    };
    
    // 成功メッセージとフォームのリセット
    alert("Password added successfully!");
    service_name.value = "";
    username.value = "";
    password.value = "";
    notes.value = "";
    
  } catch (error) {
    console.error("Error in addPassword:", error);
    alert("Failed to add password: " + (error as Error).message);
  }
};
</script>
