async function encryptPassword(password, masterKey) {
    const encoder = new TextEncoder();
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const key = await crypto.subtle.importKey("raw", masterKey, { name: "AES-GCM" }, false, ["encrypt"]);
    
    const encrypted = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, encoder.encode(password));
    
    return { encrypted: new Uint8Array(encrypted), iv };
}

// Canister に送信
async function storePasswordInCanister(userId, password, masterKey) {
    const { encrypted, iv } = await encryptPassword(password, masterKey);

    await window.ic.agent.call("your-canister-id", {
        methodName: "store_password",
        args: [userId, encrypted, iv],
    });
}