<script setup>
import { ref } from 'vue';
import { helloproj01_backend } from 'declarations/helloproj01_backend/index';

async function handleSubmit(e) {
  e.preventDefault();
  const target = e.target;
  const name = target.querySelector('#name').value;
  await helloproj01_backend.greet(name).then((response) => {
    greeting.value = response;
  });
}
import Login from "./components/Login.vue";
import PasswordForm from "./components/PasswordForm.vue";
import PasswordList from "./components/PasswordList.vue";
import AuthStatus from './components/AuthStatus.vue';
import '@mdi/font/css/materialdesignicons.css' // この行を追加
</script>

<template>
  <v-app>
    <v-app-bar color="white" density="compact">
    <v-container class="d-flex align-center justify-space-between">
      <v-avatar size="40">
        <v-img src="../public/icpass.png" alt="Logo"></v-img>
      </v-avatar>

      <!-- 中央のタイトル -->
      <v-toolbar-title>ICP Password Manager</v-toolbar-title>
      <Login />
    </v-container>
  </v-app-bar>
    <v-main>
      <AuthStatus />
        <div>
          <PasswordForm />
          <PasswordList />
        </div>
    </v-main>
  </v-app>
</template>
