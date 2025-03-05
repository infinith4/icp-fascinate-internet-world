import { defineStore } from 'pinia';
import { AuthClient } from '@dfinity/auth-client';

export const useAuthStore = defineStore('auth', {
  state: () => ({
    authClient: null as AuthClient | null,
    isAuthenticated: false
  }),
  actions: {
    async initAuthClient() {
      this.authClient = await AuthClient.create();
      this.isAuthenticated = await this.authClient.isAuthenticated();
    },
    async login() {
      if (!this.authClient) return;
      await this.authClient.login({
        identityProvider: "http://br5f7-7uaaa-aaaaa-qaaca-cai.localhost:4943/", //'https://identity.ic0.app',
      });
      this.isAuthenticated = true;
    },
    async logout() {
      if (!this.authClient) return;
      await this.authClient.logout();
      this.isAuthenticated = false;
    }
  }
});
