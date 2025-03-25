import { defineStore } from 'pinia';
import type { BackendActor } from '../libs/actor';
import type { Secret } from "../../../declarations/secrets_backend/secrets_backend.did.js";
import type { CryptoService } from '../libs/crypto';
import { type SecretModel, serialize, deserialize } from '../libs/secret';

export const useSecretsStore = defineStore('secrets', {
  state: () => ({
    secrets: [] as SecretModel[],
    loading: false,
    error: null as string | null,
  }),

  actions: {
    async loadSecrets(actor: BackendActor, cryptoService: CryptoService) {
      this.loading = true;
      this.error = null;
      try {
        const secretsList = await actor.get_secrets();
        this.secrets = await decryptSecrets(secretsList, cryptoService);
      } catch (error) {
        console.error("Failed to load secrets:", error);
        this.error = (error as Error).message;
      } finally {
        this.loading = false;
      }
    },
  },
});

export async function decryptSecrets(
  secrets: Secret[],
  cryptoService: CryptoService
): Promise<SecretModel[]> {
  const secrets_with_content = secrets.filter((secret) => secret.password != "");
  return await Promise.all(
    secrets_with_content.map((secret) => deserialize(secret, cryptoService))
  );
}

export async function addSecret(
  secret: SecretModel,
  actor: BackendActor,
  crypto: CryptoService
) {
  const store = useSecretsStore();
  const new_id: bigint = await actor.create_secret();
  secret.id = new_id;
  const encryptedSecret = (await serialize(secret, crypto)).password;
  await actor.update_secret(new_id, encryptedSecret);
  //console.log("addSecret. loadSecrets");
  await store.loadSecrets(actor, crypto);
}

export async function getOneSecret(
  id: bigint,
  actor: BackendActor,
  crypto: CryptoService
): Promise<SecretModel | null> {
  try {
    const secret = await actor.get_onesecret(id);
    if (secret.password === "") {
      return null;
    }
    return await deserialize(secret, crypto);
  } catch (error) {
    console.error("Failed to get secret:", error);
    return null;
  }
}

export async function updateSecret(
  id: bigint,
  secret: SecretModel,
  actor: BackendActor,
  crypto: CryptoService
) {
  const store = useSecretsStore();
  const encryptedSecret = (await serialize(secret, crypto)).password;
  await actor.update_secret(id, encryptedSecret);
  //console.log("updateSecret. loadSecrets");
  await store.loadSecrets(actor, crypto);
}

export async function removeSecret(
  id: bigint,
  actor: BackendActor,
  crypto: CryptoService
) {
  const store = useSecretsStore();
  await actor.delete_secret(id);
  //console.log("removeSecret. loadSecrets");
  await store.loadSecrets(actor, crypto);
}
