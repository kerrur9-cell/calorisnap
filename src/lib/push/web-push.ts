import {
  createCipheriv,
  createHmac,
  createPrivateKey,
  createPublicKey,
  diffieHellman,
  generateKeyPairSync,
  randomBytes,
  sign,
} from "node:crypto";

export type PushKeys = { p256dh: string; auth: string };

function decodeBase64Url(value: string): Buffer {
  return Buffer.from(value.replace(/-/g, "+").replace(/_/g, "/"), "base64");
}

function encodeBase64Url(value: Buffer): string {
  return value.toString("base64url");
}

function hkdfExpand(prk: Buffer, info: Buffer, length: number): Buffer {
  const blocks: Buffer[] = [];
  let previous = Buffer.alloc(0);
  for (let counter = 1; Buffer.concat(blocks).length < length; counter += 1) {
    previous = createHmac("sha256", prk)
      .update(previous)
      .update(info)
      .update(Buffer.from([counter]))
      .digest();
    blocks.push(previous);
  }
  return Buffer.concat(blocks).subarray(0, length);
}

function publicKeyFromSubscription(encodedKey: string) {
  const raw = decodeBase64Url(encodedKey);
  if (raw.length !== 65 || raw[0] !== 4) throw new Error("Invalid push public key");
  return {
    raw,
    key: createPublicKey({
      key: {
        kty: "EC",
        crv: "P-256",
        x: encodeBase64Url(raw.subarray(1, 33)),
        y: encodeBase64Url(raw.subarray(33, 65)),
      },
      format: "jwk",
    }),
  };
}

export function deriveVapidPublicKey(privateKey: string): string {
  const key = createPrivateKey({ key: decodeBase64Url(privateKey), format: "der", type: "pkcs8" });
  const jwk = createPublicKey(key).export({ format: "jwk" });
  if (!jwk.x || !jwk.y) throw new Error("Invalid VAPID key pair");
  return encodeBase64Url(Buffer.concat([Buffer.from([4]), decodeBase64Url(jwk.x), decodeBase64Url(jwk.y)]));
}

function vapidAuthorization(endpoint: URL, privateKey: string, publicKey: string): string {
  const key = createPrivateKey({ key: decodeBase64Url(privateKey), format: "der", type: "pkcs8" });
  const now = Math.floor(Date.now() / 1000);
  const header = encodeBase64Url(Buffer.from(JSON.stringify({ typ: "JWT", alg: "ES256" })));
  const payload = encodeBase64Url(Buffer.from(JSON.stringify({
    aud: endpoint.origin,
    exp: now + 12 * 60 * 60,
    sub: process.env.VAPID_SUBJECT || "https://calorisnap-ai.netlify.app",
  })));
  const content = `${header}.${payload}`;
  const signature = sign("sha256", Buffer.from(content), { key, dsaEncoding: "ieee-p1363" });
  return `vapid t=${content}.${encodeBase64Url(signature)}, k=${publicKey}`;
}

function encryptPayload(payload: Buffer, keys: PushKeys): Buffer {
  const client = publicKeyFromSubscription(keys.p256dh);
  const authSecret = decodeBase64Url(keys.auth);
  if (authSecret.length !== 16) throw new Error("Invalid push auth secret");

  const ephemeral = generateKeyPairSync("ec", { namedCurve: "prime256v1" });
  const ephemeralJwk = ephemeral.publicKey.export({ format: "jwk" });
  if (!ephemeralJwk.x || !ephemeralJwk.y) throw new Error("Could not create push key");
  const serverPublic = Buffer.concat([
    Buffer.from([4]),
    decodeBase64Url(ephemeralJwk.x),
    decodeBase64Url(ephemeralJwk.y),
  ]);
  const sharedSecret = diffieHellman({ privateKey: ephemeral.privateKey, publicKey: client.key });

  const authPrk = createHmac("sha256", authSecret).update(sharedSecret).digest();
  const keyInfo = Buffer.concat([
    Buffer.from("WebPush: info\0", "utf8"),
    client.raw,
    serverPublic,
  ]);
  const inputKeyMaterial = hkdfExpand(authPrk, keyInfo, 32);

  const salt = randomBytes(16);
  const prk = createHmac("sha256", salt).update(inputKeyMaterial).digest();
  const contentKey = hkdfExpand(prk, Buffer.from("Content-Encoding: aes128gcm\0", "utf8"), 16);
  const nonce = hkdfExpand(prk, Buffer.from("Content-Encoding: nonce\0", "utf8"), 12);
  const cipher = createCipheriv("aes-128-gcm", contentKey, nonce);
  const ciphertext = Buffer.concat([cipher.update(Buffer.concat([payload, Buffer.from([2])])), cipher.final(), cipher.getAuthTag()]);
  const recordSize = Buffer.alloc(4);
  recordSize.writeUInt32BE(4096);

  return Buffer.concat([salt, recordSize, Buffer.from([serverPublic.length]), serverPublic, ciphertext]);
}

export function isAllowedPushEndpoint(endpoint: string): boolean {
  try {
    const url = new URL(endpoint);
    const host = url.hostname.toLowerCase();
    return url.protocol === "https:"
      && !url.username
      && !url.password
      && (host === "fcm.googleapis.com"
        || host === "android.googleapis.com"
        || host === "web.push.apple.com"
        || host.endsWith(".push.apple.com")
        || host === "updates.push.services.mozilla.com"
        || host.endsWith(".notify.windows.com"));
  } catch {
    return false;
  }
}

export async function sendWebPush(
  endpoint: string,
  keys: PushKeys,
  payload: { title: string; body: string; url?: string; tag?: string; actions?: { action: string; title: string; url: string }[] },
): Promise<"sent" | "expired"> {
  if (!isAllowedPushEndpoint(endpoint)) throw new Error("Unsupported push service endpoint");
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  if (!privateKey) throw new Error("VAPID_PRIVATE_KEY is not configured");

  const endpointUrl = new URL(endpoint);
  const publicKey = deriveVapidPublicKey(privateKey);
  const encryptedBody = new Uint8Array(encryptPayload(Buffer.from(JSON.stringify(payload)), keys));
  const response = await fetch(endpointUrl, {
    method: "POST",
    headers: {
      Authorization: vapidAuthorization(endpointUrl, privateKey, publicKey),
      TTL: "7200",
      Urgency: "normal",
      "Content-Type": "application/octet-stream",
      "Content-Encoding": "aes128gcm",
    },
    body: encryptedBody,
    signal: AbortSignal.timeout(8_000),
  });

  if (response.status === 404 || response.status === 410) return "expired";
  if (!response.ok) throw new Error(`Push service returned ${response.status}`);
  return "sent";
}
