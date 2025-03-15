<script setup>
import { ref, onMounted } from 'vue';
import { AuthClient } from '@dfinity/auth-client';

const identity = ref(null);
const principal = ref(null);
let authClient;

const login = async () => {
  authClient = await AuthClient.create();
  console.log("----------------------------authclient");
  
  authClient.login({
    identityProvider: "http://bkyz2-fmaaa-aaaaa-qaaaq-cai.localhost:4943/",
    //identityProvider: "http://127.0.0.1:4943/?canisterId=be2us-64aaa-aaaaa-qaabq-cai",
    onSuccess: async () => {
      console.log("authClient.getIdentity()");
      console.log(authClient.getIdentity());
      identity.value = authClient.getIdentity();
      principal.value = identity.value.getPrincipal().toString();
    },
    onError: (err) => {
      console.error("Login failed:", err);
    }
  });
};

const logout = async () => {
  await authClient.logout();
  identity.value = null;
  principal.value = null;
};

onMounted(async () => {
  authClient = await AuthClient.create();
  if (await authClient.isAuthenticated()) {
    identity.value = authClient.getIdentity();
    principal.value = identity.value.getPrincipal().toString();
  }
});
</script>

<template>
  <div>
    <button @click="login" v-if="!identity">Login with Internet Identity</button>
    <div v-if="identity">
      <p>Logged in as: {{ principal }}</p>
      <button @click="logout">Logout</button>
    </div>
  </div>
</template>
