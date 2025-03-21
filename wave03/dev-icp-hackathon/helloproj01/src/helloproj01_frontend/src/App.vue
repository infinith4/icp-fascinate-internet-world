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
    <main>
      <div class="d-flex justify-space-between ma-2 pa-2">
        <v-btn color="primary">default</v-btn>
      </div>
      <h2>ICP Password Manager</h2>
      <AuthStatus />
      <Login />
        <div>
          <PasswordForm />
          <PasswordList />
        </div>
      <img src="/logo2.svg" alt="DFINITY logo" />
    </main>
  </v-app>
</template>
