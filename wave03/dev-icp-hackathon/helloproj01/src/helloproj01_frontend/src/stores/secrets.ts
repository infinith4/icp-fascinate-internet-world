// import { writable } from 'svelte/store';
import type { BackendActor } from '../libs/actor';
// import type { Secret } from '../libs/backend';
import type { CryptoService } from '../libs/crypto';
import { type SecretModel, serialize } from '../libs/secret';
// import { auth } from './auth';
// import { showError } from './notifications';

// export const notesStore = writable<
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

// async function decryptSecrets(
//   notes: EncryptedSecret[],
//   cryptoService: CryptoService
// ): Promise<SecretModel[]> {
//   // When notes are initially created, they do not have (and cannot have) any
//   // (encrypted) content yet because the note ID, which is needed to retrieve
//   // the note-specific encryption key, is not known yet before the note is
//   // created because the note ID is a return value of the call to create a note.
//   // The (encrypted) note content is stored in the backend only by a second call
//   // to the backend that updates the note's conent directly after the note is
//   // created. This means that there is a short period of time where the note
//   // already exists but doesn't have any (encrypted) content yet.
//   // To avoid decryption errors for these notes, we skip deserializing (and thus
//   // decrypting) these notes here.
//   const notes_with_content = notes.filter((note) => note.encrypted_text != "");

//   return await Promise.all(
//     notes_with_content.map((encryptedSecret) => deserialize(encryptedSecret, cryptoService))
//   );
// }

// function updateSecrets(notes: SecretModel[]) {
//   notesStore.set({
//     state: 'loaded',
//     list: notes,
//   });
// }

// export async function refreshSecrets(
//   actor: BackendActor,
//   cryptoService: CryptoService
// ) {
//   const encryptedSecrets = await actor.get_notes();

//   const notes = await decryptSecrets(encryptedSecrets, cryptoService);
//   updateSecrets(notes);
// }

export async function addSecret(
  secret: SecretModel,
  actor: BackendActor,
  crypto: CryptoService
) {
  console.log("addSecret in secrets.ts");
  const new_id: bigint = await actor.create_secret();

  console.log("new_id");
  console.log(new_id);
  secret.id = new_id;
  const encryptedSecret = (await serialize(secret, crypto)).password;
  
  console.log("encryptedSecret");
  console.log(encryptedSecret);
  await actor.update_secret(new_id, encryptedSecret);
  console.log("encryptedSecret");
  console.log(encryptedSecret);
  console.log("done in secrets.ts")
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
