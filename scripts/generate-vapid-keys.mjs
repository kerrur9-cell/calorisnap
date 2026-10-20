import { createPublicKey, generateKeyPairSync } from "node:crypto";

const { privateKey } = generateKeyPairSync("ec", {
  namedCurve: "prime256v1",
  privateKeyEncoding: { type: "pkcs8", format: "der" },
  publicKeyEncoding: { type: "spki", format: "der" },
});
const key = createPublicKey({ key: privateKey, type: "pkcs8", format: "der" }).export({ format: "jwk" });
const publicKey = Buffer.concat([
  Buffer.from([4]),
  Buffer.from(key.x, "base64url"),
  Buffer.from(key.y, "base64url"),
]).toString("base64url");

console.log("VAPID_PUBLIC_KEY=" + publicKey);
console.log("VAPID_PRIVATE_KEY=" + Buffer.from(privateKey).toString("base64url"));
console.log("Keep VAPID_PRIVATE_KEY secret. Use the same pair in local .env.local and Netlify.");
