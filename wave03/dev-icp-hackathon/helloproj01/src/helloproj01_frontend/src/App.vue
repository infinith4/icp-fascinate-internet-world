<script setup>
import { ref } from 'vue';
import { helloproj01_backend } from 'declarations/helloproj01_backend/index';
let greeting = ref('');

async function handleSubmit(e) {
  e.preventDefault();
  const target = e.target;
  const name = target.querySelector('#name').value;
  await helloproj01_backend.greet(name).then((response) => {
    greeting.value = response;
  });
}
import PasswordForm from "./components/PasswordForm.vue";
import PasswordList from "./components/PasswordList.vue";
</script>

<template>
  <main>
    <img src="/logo2.svg" alt="DFINITY logo" />
    <br />
    <br />
    <form action="#" @submit="handleSubmit">
      <label for="name">Enter your name: &nbsp;</label>
      <input id="name" alt="Name" type="text" />
      <button type="submit">Click Me!</button>
    </form>
    <section id="greeting">{{ greeting }}</section>
    <div>
      <h1>ICP Password Manager</h1>
      <PasswordForm />
      <h2>Password List</h2>
      <PasswordList />
    </div>
  </main>
</template>
