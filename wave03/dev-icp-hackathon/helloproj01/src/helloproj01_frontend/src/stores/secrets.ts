// import { writable } from 'svelte/store';
import type { BackendActor } from '../libs/actor';
// import type { Secret } from '../libs/backend';
import type { Secret } from "../../../declarations/secrets_backend/secrets_backend.did.js";
import type { CryptoService } from '../libs/crypto';
import { type SecretModel, serialize, deserialize } from '../libs/secret';
// import { auth } from './auth';
// import { showError } from './notifications';

// export const secretstore = writable<
//   | {
//       state: 'uninitialized';
//     }
//   | {
//       state: 'loading';
//     }
//   | {
//       state: 'loaded';
//       list: SecretModel[];
//     }
//   | {
//       state: 'error';
//     }
// >({ state: 'uninitialized' });

// let notePollerHandle: ReturnType<typeof setInterval> | null;

export async function decryptSecrets(
  secrets: Secret[],
  cryptoService: CryptoService
): Promise<SecretModel[]> {
  // When notes are initially created, they do not have (and cannot have) any
  // (encrypted) content yet because the note ID, which is needed to retrieve
  // the note-specific encryption key, is not known yet before the note is
  // created because the note ID is a return value of the call to create a note.
  // The (encrypted) note content is stored in the backend only by a second call
  // to the backend that updates the note's conent directly after the note is
  // created. This means that there is a short period of time where the note
  // already exists but doesn't have any (encrypted) content yet.
  // To avoid decryption errors for these notes, we skip deserializing (and thus
  // decrypting) these notes here.
  const secrets_with_content = secrets.filter((secret) => secret.password != "");

  return await Promise.all(
    secrets_with_content.map((secret) => deserialize(secret, cryptoService))
  );
}

// function updateSecrets(secrets: SecretModel[]) {
//   secretsStore.set({
//     state: 'loaded',
//     list: secrets,
//   });
// }

export async function refreshSecrets(
  actor: BackendActor,
  cryptoService: CryptoService
) {
  console.log("refreshSecrets");
  const secretsList = await actor.get_secrets();
  console.log("get_secrets");
  console.log(secretsList);
  const secrets = await decryptSecrets(secretsList, cryptoService);
  console.log("decryptSecrets");
  return secrets;
  //updateSecrets(secrets);
}

export async function addSecret(
  secret: SecretModel,
  actor: BackendActor,
  crypto: CryptoService
) {
  const new_id: bigint = await actor.create_secret();
  secret.id = new_id;
  const encryptedSecret = (await serialize(secret, crypto)).password;
  await actor.update_secret(new_id, encryptedSecret);
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
  const encryptedSecret = (await serialize(secret, crypto)).password;
  await actor.update_secret(id, encryptedSecret);
}

export async function removeSecret(
  id: bigint,
  actor: BackendActor,
  crypto: CryptoService
) {
  console.log("await actor.delete_secret()");
  await actor.delete_secret(id);
  console.log("done in delete_secret")
}

// export async function updateSecret(
//   note: SecretModel,
//   actor: BackendActor,
//   crypto: CryptoService
// ) {
//   const encryptedSecret = await serialize(note, crypto);
//   await actor.update_note(note.id, encryptedSecret.encrypted_text);
// }

// export async function addUser(
//   id: bigint,
//   user: string,
//   actor: BackendActor,
// ) {
//   await actor.add_user(id, user);
// }

// export async function removeUser(
//   id: bigint,
//   user: string,
//   actor: BackendActor,
// ) {
//   await actor.remove_user(id, user);
// }

// auth.subscribe(async ($auth) => {
//   if ($auth.state === 'initialized') {
//     if (notePollerHandle !== null) {
//       clearInterval(notePollerHandle);
//       notePollerHandle = null;
//     }

//     notesStore.set({
//       state: 'loading',
//     });
//     try {
//       await refreshSecrets($auth.actor, $auth.crypto).catch((e) =>
//         showError(e, 'Could not poll notes.')
//       );

//       notePollerHandle = setInterval(async () => {
//         await refreshSecrets($auth.actor, $auth.crypto).catch((e) =>
//           showError(e, 'Could not poll notes.')
//         );
//       }, 3000);
//     } catch {
//       notesStore.set({
//         state: 'error',
//       });
//     }
//   } else if ($auth.state === 'anonymous' && notePollerHandle !== null) {
//     clearInterval(notePollerHandle);
//     notePollerHandle = null;
//     notesStore.set({
//       state: 'uninitialized',
//     });
//   }
// });
