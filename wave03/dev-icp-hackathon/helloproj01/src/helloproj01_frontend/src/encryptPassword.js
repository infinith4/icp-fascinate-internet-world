// async function encryptPassword(password, masterKey) {
//     const encoder = new TextEncoder();
//     const iv = crypto.getRandomValues(new Uint8Array(12));
//     const key = await crypto.subtle.importKey("raw", masterKey, { name: "AES-GCM" }, false, ["encrypt"]);
    
//     const encrypted = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, encoder.encode(password));
    
//     return { encrypted: new Uint8Array(encrypted), iv };
// }

// // Canister に送信
// async function storePasswordInCanister(userId, password, masterKey) {
//     const { encrypted, iv } = await encryptPassword(password, masterKey);

//     await window.ic.agent.call("your-canister-id", {
//         methodName: "store_password",
//         args: [userId, encrypted, iv],
//     });
// }


async function encryptPassword(password, masterPassword) {
    const encoder = new TextEncoder();

    // 1. 128-bit Salt を生成（鍵導出用）
    const salt = crypto.getRandomValues(new Uint8Array(16));

    // 2. PBKDF2 で masterPassword から AESキーを導出
    const masterKey = await crypto.subtle.importKey(
        "raw",
        encoder.encode(masterPassword),
        { name: "PBKDF2" },
        false,
        ["deriveKey"]
    );
    
    const key = await crypto.subtle.deriveKey(
        {
            name: "PBKDF2",
            salt: salt,
            iterations: 100000, // 高いほど安全（ただし処理時間増）
            hash: "SHA-256",
        },
        masterKey,
        { name: "AES-GCM", length: 256 },
        false,
        ["encrypt"]
    );

    // 3. 96-bit IV を生成
    const iv = crypto.getRandomValues(new Uint8Array(12));

    // 4. AES-GCM で暗号化
    const encrypted = await crypto.subtle.encrypt(
        { name: "AES-GCM", iv },
        key,
        encoder.encode(password)
    );

    // 5. 暗号文と Salt, IV をBase64エンコードして返す
    return {
        encrypted: btoa(String.fromCharCode(...new Uint8Array(encrypted))),
        iv: btoa(String.fromCharCode(...iv)),
        salt: btoa(String.fromCharCode(...salt)),
    };
}

export default encryptPassword;