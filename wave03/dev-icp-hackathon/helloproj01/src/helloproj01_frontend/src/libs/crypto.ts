import type { BackendActor } from './actor';
import { get, set } from 'idb-keyval';

import * as agent from "@dfinity/agent";

// Usage of the imported bindings only works if the respective .wasm was loaded, which is done in main.ts.
// See also https://github.com/rollup/plugins/tree/master/packages/wasm#using-with-wasm-bindgen-and-wasm-pack
// import * as vetkd from "../../../../../vetkd_user_lib/ic_vetkd_utils.js";

import { TransportSecretKey } from 'vetkeys-client-utils';
export class CryptoService {
  constructor(private actor: BackendActor) {
  }

  // The function encrypts data with the secret-id-specific secretKey.
  public async encryptWithSecretKey(secret_id: bigint, owner: string, data: string) {
    console.log("encryptWithSecretKey");
    await this.fetch_secret_key_if_needed(secret_id, owner);
    const secret_key = await this.getSecretKey(secret_id, owner);

    const data_encoded = Uint8Array.from([...data].map(ch => ch.charCodeAt(0))).buffer
    // The iv must never be reused with a given key.
    const iv = window.crypto.getRandomValues(new Uint8Array(12));
    const ciphertext = await window.crypto.subtle.encrypt(
      {
        name: "AES-GCM",
        iv: iv
      },
      secret_key,
      data_encoded
    );

    const iv_decoded = String.fromCharCode(...new Uint8Array(iv));
    const cipher_decoded = String.fromCharCode(...new Uint8Array(ciphertext));
    return iv_decoded + cipher_decoded;
  }

  // // The function decrypts the given input data with the secret-id-specific secretKey.
  // public async decryptWithsecretKey(secret_id: bigint, owner: string, data: string) {
  //   await this.fetch_secret_key_if_needed(secret_id, owner);
  //   const secret_key: CryptoKey = await get([secret_id.toString(), owner]);

  //   if (data.length < 13) {
  //     throw new Error('wrong encoding, too short to contain iv');
  //   }
  //   const iv_decoded = data.slice(0, 12);
  //   const cipher_decoded = data.slice(12);
  //   const iv_encoded = Uint8Array.from([...iv_decoded].map(ch => ch.charCodeAt(0))).buffer;
  //   const ciphertext_encoded = Uint8Array.from([...cipher_decoded].map(ch => ch.charCodeAt(0))).buffer;

  //   let decrypted_data_encoded = await window.crypto.subtle.decrypt(
  //     {
  //       name: "AES-GCM",
  //       iv: iv_encoded
  //     },
  //     secret_key,
  //     ciphertext_encoded
  //   );
  //   const decrypted_data_decoded = String.fromCharCode(...new Uint8Array(decrypted_data_encoded));
  //   return decrypted_data_decoded;
  // }

  private async fetch_secret_key_if_needed(secret_id: bigint, owner: string) {
    console.log("fetch_secret_key_if_needed");

    if (!await get([secret_id.toString(), owner])) {
      console.log("fetch_secret_key_if_needed");
      const seed = window.crypto.getRandomValues(new Uint8Array(32));
      console.log("fetch_secret_key_if_needed");
      //https://www.npmjs.com/package/ic-vetkd-utils-wasm2js?activeTab=readme に置き換える？
      const tsk = new TransportSecretKey(seed);
      console.log("fetch_secret_key_if_needed");

      const ek_bytes_hex = await this.actor.encrypted_symmetric_key_for_secret(secret_id, tsk.public_key());
      const pk_bytes_hex = await this.actor.symmetric_key_verification_key_for_secret();

      const secret_id_bytes: Uint8Array = bigintTo128BitBigEndianUint8Array(secret_id);
      const owner_utf8: Uint8Array = new TextEncoder().encode(owner);
      let derivation_id = new Uint8Array(secret_id_bytes.length + owner_utf8.length);
      derivation_id.set(secret_id_bytes);
      derivation_id.set(owner_utf8, secret_id_bytes.length);

      const aes_256_gcm_key_raw = tsk.decrypt_and_hash(
        hex_decode(ek_bytes_hex),
        hex_decode(pk_bytes_hex),
        derivation_id,
        32,
        new TextEncoder().encode("aes-256-gcm")
      );
      const secret_key: CryptoKey = await window.crypto.subtle.importKey("raw", aes_256_gcm_key_raw, "AES-GCM", false, ["encrypt", "decrypt"]);
      await set([secret_id.toString(), owner], secret_key)
    }
  }

  private async getSecretKey(secret_id: bigint, owner: string): Promise<CryptoKey> {
    const storedKey = await get([secret_id.toString(), owner]);
    if (!storedKey) {
      throw new Error(`No secret key found for secret_id: ${secret_id} and owner: ${owner}`);
    }
    return storedKey as CryptoKey;
  }
}

const hex_decode = (hexString: string): Uint8Array =>
  Uint8Array.from(hexString.match(/.{1,2}/g)?.map((byte) => parseInt(byte, 16)) || []);

const hex_encode = (bytes: Uint8Array): string =>
  bytes.reduce((str, byte) => str + byte.toString(16).padStart(2, '0'), '');

// Inspired by https://coolaj86.com/articles/convert-js-bigints-to-typedarrays/
function bigintTo128BitBigEndianUint8Array(bn: bigint): Uint8Array {
  var hex = BigInt(bn).toString(16);

  // extend hex to length 32 = 16 bytes = 128 bits
  while (hex.length < 32) {
    hex = '0' + hex;
  }

  var len = hex.length / 2;
  var u8 = new Uint8Array(len);

  var i = 0;
  var j = 0;
  while (i < len) {
    u8[i] = parseInt(hex.slice(j, j + 2), 16);
    i += 1;
    j += 2;
  }

  return u8;
}
