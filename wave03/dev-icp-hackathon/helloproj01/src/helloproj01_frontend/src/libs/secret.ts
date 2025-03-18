import type { Secret } from "../../../declarations/secrets_backend/secrets_backend.did.d";

import type { CryptoService } from './crypto';
import type { Principal } from '@dfinity/principal';

export interface SecretModel {
  id: bigint;
  title: string;
  content: string;
  createdAt: number;
  updatedAt: number;
  tags: Array<string>;
  owner: string;
  users: Array<string>;
}

type SerializableSecretModel = Omit<SecretModel, 'id' | 'owner' | 'users'>;

export function secretFromContent(content: string, tags: string[], self_principal: Principal): SecretModel {
  const title = extractTitle(content);
  const creationTime = Date.now();

  return {
    id: BigInt(0),
    title,
    content,
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
    title: secret.title,
    content: secret.content,
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
    title: secret.title,
    password: encryptedSecret,
    owner: secret.owner,
    //users: secret.users,
  };
}

// export async function deserialize(
//   esecret: Secret,
//   cryptoService: CryptoService
// ): Promise<SecretModel> {
//   const serializedSecret = await cryptoService.decryptWithSecretKey(esecret.id, esecret.owner, esecret.encrypted_text);
//   const deserializedSecret: SerializableSecretModel = JSON.parse(serializedSecret);
//   return {
//     id: esecret.id,
//     owner: esecret.owner,
//     users: esecret.users,
//     ...deserializedSecret,
//   };
// }

export function summarize(secret: SecretModel, maxLength = 50) {
  const div = document.createElement('div');
  div.innerHTML = secret.content;

  let text = div.innerText;
  const title = extractTitleFromDomEl(div);
  if (title) {
    text = text.replace(title, '');
  }

  return text.slice(0, maxLength) + (text.length > maxLength ? '...' : '');
}

function extractTitleFromDomEl(el: HTMLElement) {
  const title = el.querySelector('h1');
  if (title) {
    return title.innerText;
  }

  const blockElements = el.querySelectorAll(
    'h1,h2,p,li'
  ) as NodeListOf<HTMLElement>;
  for (const el of blockElements) {
    if (el.innerText?.trim().length > 0) {
      return el.innerText.trim();
    }
  }
  return '';
}

export function extractTitle(html: string) {
  const div = document.createElement('div');
  div.innerHTML = html;
  return extractTitleFromDomEl(div);
}
