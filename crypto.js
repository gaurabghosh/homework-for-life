/* AES-GCM decryption for the encrypted journal payload. */
const HFLCrypto = (() => {
  const b64ToBuf = (b64) => Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));

  async function deriveKey(passphrase, saltBuf, iterations) {
    const enc = new TextEncoder();
    const baseKey = await crypto.subtle.importKey(
      "raw", enc.encode(passphrase), "PBKDF2", false, ["deriveKey"]
    );
    return crypto.subtle.deriveKey(
      { name: "PBKDF2", salt: saltBuf, iterations, hash: "SHA-256" },
      baseKey,
      { name: "AES-GCM", length: 256 },
      false,
      ["decrypt"]
    );
  }

  async function decrypt(payload, passphrase) {
    const salt = b64ToBuf(payload.salt);
    const iv = b64ToBuf(payload.iv);
    const data = b64ToBuf(payload.ciphertext);
    const key = await deriveKey(passphrase, salt, payload.iterations);
    const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, data);
    return JSON.parse(new TextDecoder().decode(plain));
  }

  return { decrypt };
})();
