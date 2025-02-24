async function decryptPassword(encryptedData, masterPassword) {
    const decoder = new TextDecoder();
    const encoder = new TextEncoder();

    // Base64 をデコード
    const encryptedBytes = new Uint8Array(atob(encryptedData.encrypted).split("").map(c => c.charCodeAt(0)));
    const iv = new Uint8Array(atob(encryptedData.iv).split("").map(c => c.charCodeAt(0)));
    const salt = new Uint8Array(atob(encryptedData.salt).split("").map(c => c.charCodeAt(0)));

    // PBKDF2 で AESキーを導出
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
            iterations: 100000,
            hash: "SHA-256",
        },
        masterKey,
        { name: "AES-GCM", length: 256 },
        false,
        ["decrypt"]
    );

    // AES-GCM で復号
    const decrypted = await crypto.subtle.decrypt(
        { name: "AES-GCM", iv },
        key,
        encryptedBytes
    );

    return decoder.decode(decrypted);
}

export default decryptPassword;