import type { Secret } from "../../../declarations/secrets_backend/secrets_backend.did.js";

import type { CryptoService } from './crypto';
import type { Principal } from '@dfinity/principal';

export interface SecretModel {
  id: bigint;
  serviceName: string;
  userName: string;
  password: string;
  createdAt: number;
  updatedAt: number;
  tags: Array<string>;
  owner: string;
  users: Array<string>;
}

type SerializableSecretModel = Omit<SecretModel, 'id' | 'owner' | 'users'>;

//Front 側の入力をSecretModelに変換
export function createSecretModel(serviceName: string, userName: string, password: string, tags: string[], self_principal: Principal): SecretModel {
  const creationTime = Date.now();

  return {
    id: BigInt(0),
    serviceName,
    userName,
    password,
    createdAt: creationTime,
    updatedAt: creationTime,
    tags,
    owner: self_principal.toString(),
    users: [""],
  };
}

export async function serialize(
  secret: SecretModel,
  cryptoService: CryptoService
): Promise<Secret> {
  const serializableSecret: SerializableSecretModel = {
    serviceName: secret.serviceName,
    userName: secret.userName,
    password: secret.password,
    createdAt: secret.createdAt,
    updatedAt: secret.updatedAt,
    tags: secret.tags,
  };
  const encryptedSecret = await cryptoService.encryptWithSecretKey(
    secret.id,
    secret.owner,
    JSON.stringify(serializableSecret)
  );
  return {
    id: secret.id,
    serviceName: secret.serviceName,
    userName: secret.userName,
    password: encryptedSecret,
    created: BigInt(secret.createdAt),
    updated: BigInt(secret.updatedAt),
    owner: secret.owner,
    //users: secret.users,
  };
}

//deserialize secret
export async function deserialize(
  secret: Secret,
  cryptoService: CryptoService
): Promise<SecretModel> {
  const serializedSecret = await cryptoService.decryptWithSecretKey(secret.id, secret.owner, secret.password);
  console.log("serializedSecret");
  console.log(serializedSecret);
  const deserializedSecret: SerializableSecretModel = JSON.parse(serializedSecret);
  return {
    id: secret.id,
    owner: secret.owner,
    users: [],
    ...deserializedSecret,
  };
}

// export function summarize(secret: SecretModel, maxLength = 50) {
//   const div = document.createElement('div');
//   div.innerHTML = secret.content;

//   let text = div.innerText;
//   const title = extractTitleFromDomEl(div);
//   if (title) {
//     text = text.replace(title, '');
//   }

//   return text.slice(0, maxLength) + (text.length > maxLength ? '...' : '');
// }

// function extractTitleFromDomEl(el: HTMLElement) {
//   const title = el.querySelector('h1');
//   if (title) {
//     return title.innerText;
//   }

//   const blockElements = el.querySelectorAll(
//     'h1,h2,p,li'
//   ) as NodeListOf<HTMLElement>;
//   for (const el of blockElements) {
//     if (el.innerText?.trim().length > 0) {
//       return el.innerText.trim();
//     }
//   }
//   return '';
// }

// export function extractTitle(html: string) {
//   const div = document.createElement('div');
//   div.innerHTML = html;
//   return extractTitleFromDomEl(div);
// }
