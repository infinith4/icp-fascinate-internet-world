import { defineStore } from 'pinia';
import { createActor, type BackendActor } from '../libs/actor';
import { AuthClient } from '@dfinity/auth-client';
import { CryptoService } from '../libs/crypto';
import type { JsonnableDelegationChain } from '@dfinity/identity/lib/cjs/identity/delegation';

// import 'dotenv/config'

export type AuthState =
  | 'initializing-auth'
  | 'anonymous'
  | 'initializing-crypto'
  | 'synchronizing'
  | 'initialized'
  | 'error';

export const useAuthStore = defineStore('auth', {
  state: () => ({
    state: 'initializing-auth' as AuthState,
    actor: null as BackendActor | null,
    client: null as AuthClient | null,
    crypto: null as CryptoService | null,
    error: '' as string
  }),

  getters: {
    isAuthenticated: (state) => state.state === 'initialized',
    isAnonymous: (state) => state.state === 'anonymous',
    isInitializing: (state) => state.state === 'initializing-auth' || state.state === 'initializing-crypto'
  },

  actions: {
    async initAuth() {
      const client = await AuthClient.create();
      this.client = client;
      
      if (await client.isAuthenticated()) {
        this.authenticate();
      } else {
        this.state = 'anonymous';
        this.actor = createActor();
      }
    },

    async login() {
      if (this.state !== 'anonymous' || !this.client) return;

      const identityProvider = getIdentityProvider();

      this.client.login({
        maxTimeToLive: BigInt(1800) * BigInt(1_000_000_000),
        identityProvider,
        onSuccess: () => {this.authenticate()},
      });
    },

   

    async logout() {
      if (this.state !== 'initialized' || !this.client) return;
      
      await this.client.logout();
      this.state = 'anonymous';
      this.actor = createActor();
      this.crypto = null;
      // router.push('/') // 必要に応じてルーターを使用
    },

    async authenticate() {
      console.log("authenticate");
      const client = this.client!;
      this.handleSessionTimeout();
      console.log("handleSessionTimeout");

      try {
        const actor = createActor({
          agentOptions: {
            identity: client.getIdentity(),
          },
        });

        console.log("actor");
        this.state = 'initializing-crypto';
        this.actor = actor;
        
        const cryptoService = new CryptoService(actor);
        
        this.state = 'initialized';
        this.crypto = cryptoService;
      } catch (e) {
        this.state = 'error';
        this.error = 'An error occurred';
        console.error("Error", e);

      }
    },

    handleSessionTimeout() {
      // upon login the localstorage items may not be set, wait for next tick
      setTimeout(() => {
        try {
          const delegation = JSON.parse(
            localStorage.getItem('ic-delegation') || '"test"'
          ) as JsonnableDelegationChain;

          const expirationTimeMs =
            Number.parseInt(delegation.delegations[0].delegation.expiration, 16) /
            1000000;

          setTimeout(() => {
            this.logout();
          }, expirationTimeMs - Date.now());
        } catch {
          console.error('Could not handle delegation expiry.');
        }
      });
    }
  }
});

export function getIdentityProvider(): string {
  if(process.env.DFX_NETWORK === "local") {// Safari detection
    const isSafari = /^(?!.*chrome\/\d+)(?!.*chromium\/\d+).*safari\/\d+/i.test(navigator.userAgent);        
    return isSafari ? `http://localhost:4943/?canisterId=${process.env.CANISTER_ID_INTERNET_IDENTITY}` : `http://${process.env.CANISTER_ID_INTERNET_IDENTITY}.localhost:4943`;
  } else if (process.env.DFX_NETWORK === "ic") {
    return `https://identity.ic0.app/#authorize`;  //NOTE: 本番環境は必ずこのURLでなければならない
  } else {
    return `https://${process.env.CANISTER_ID_INTERNET_IDENTITY}.dfinity.network`;
  }
}

// 初期化は通常 main.ts または App.vue の setup で行う
// ここでは参考として示す
// const authStore = useAuthStore();
// authStore.initAuth();