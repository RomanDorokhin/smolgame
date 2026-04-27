/**
 * AES-256-GCM encrypt/decrypt using SHA-256(GITHUB_CLIENT_SECRET) as key material.
 * Token at rest in D1 only encrypted.
 */
async function deriveKey(secret) {
  const raw = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(String(secret || '')));
  return crypto.subtle.importKey('raw', raw, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
}

function packIvCipher(iv, buf) {
  const u8 = new Uint8Array(iv.length + buf.byteLength);
  u8.set(iv, 0);
  u8.set(new Uint8Array(buf), iv.length);
  return btoa(String.fromCharCode(...u8));
}

function unpackIvCipher(b64) {
  const bin = atob(b64);
  const u8 = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
  return { iv: u8.slice(0, 12), data: u8.slice(12) };
}

export async function encryptGithubToken(plain, clientSecret) {
  if (!plain || !clientSecret) return null;
  const key = await deriveKey(clientSecret);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(plain));
  return packIvCipher(iv, ct);
}

export async function decryptGithubToken(encB64, clientSecret) {
  if (!encB64 || !clientSecret) return null;
  try {
    const key = await deriveKey(clientSecret);
    const { iv, data } = unpackIvCipher(encB64);
    const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, data);
    return new TextDecoder().decode(pt);
  } catch (e) {
    return null;
  }
}
