import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createDecipheriv,
  createECDH,
  createHmac,
  createPublicKey,
  generateKeyPairSync,
  verify,
} from "node:crypto";
import { deriveVapidPublicKey, isAllowedPushEndpoint, sendWebPush } from "@/lib/push/web-push";

function hkdfExpand(prk: Buffer, info: Buffer, length: number) {
  const blocks: Buffer[] = [];
  let previous = Buffer.alloc(0);
  for (let counter = 1; Buffer.concat(blocks).length < length; counter += 1) {
    previous = createHmac("sha256", prk).update(previous).update(info).update(Buffer.from([counter])).digest();
    blocks.push(previous);
  }
  return Buffer.concat(blocks).subarray(0, length);
}

function base64url(value: Buffer) {
  return value.toString("base64url");
}

describe("web push protocol", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("derives a valid 65-byte P-256 application server key", () => {
    const pair = generateKeyPairSync("ec", { namedCurve: "prime256v1" });
    const privateKey = pair.privateKey.export({ format: "der", type: "pkcs8" }).toString("base64url");
    const publicKey = Buffer.from(deriveVapidPublicKey(privateKey), "base64url");
    expect(publicKey).toHaveLength(65);
    expect(publicKey[0]).toBe(4);
  });

  it("encrypts a payload the browser subscription can decrypt and signs a VAPID token", async () => {
    const vapid = generateKeyPairSync("ec", { namedCurve: "prime256v1" });
    const privateKey = vapid.privateKey.export({ format: "der", type: "pkcs8" }).toString("base64url");
    vi.stubEnv("VAPID_PRIVATE_KEY", privateKey);

    const client = generateKeyPairSync("ec", { namedCurve: "prime256v1" });
    const clientJwk = client.publicKey.export({ format: "jwk" });
    const clientPublic = Buffer.concat([
      Buffer.from([4]),
      Buffer.from(clientJwk.x!, "base64url"),
      Buffer.from(clientJwk.y!, "base64url"),
    ]);
    const authSecret = Buffer.from("0123456789abcdef", "utf8");
    let requestBody = Buffer.alloc(0);
    let requestHeaders = new Headers();
    vi.stubGlobal("fetch", vi.fn(async (_input: string | URL | Request, init?: RequestInit) => {
      requestBody = Buffer.from(init?.body as Uint8Array);
      requestHeaders = new Headers(init?.headers);
      return new Response(null, { status: 201 });
    }));

    const payload = { title: "CaloriSnap", body: "Даша, пора заглянуть в дневник 🌿", url: "/day" };
    const result = await sendWebPush(
      "https://fcm.googleapis.com/fcm/send/test-subscription",
      { p256dh: base64url(clientPublic), auth: base64url(authSecret) },
      payload,
    );

    expect(result).toBe("sent");
    expect(requestHeaders.get("Content-Encoding")).toBe("aes128gcm");
    expect(requestHeaders.get("TTL")).toBe("7200");

    const authorization = requestHeaders.get("Authorization");
    expect(authorization).toMatch(/^vapid t=/);
    const token = authorization!.match(/^vapid t=([^,]+), k=/)![1];
    const [headerPart, payloadPart, signaturePart] = token.split(".");
    const signingInput = Buffer.from(`${headerPart}.${payloadPart}`);
    const publicKey = createPublicKey(vapid.privateKey);
    expect(verify("sha256", signingInput, { key: publicKey, dsaEncoding: "ieee-p1363" }, Buffer.from(signaturePart, "base64url"))).toBe(true);

    const salt = requestBody.subarray(0, 16);
    expect(requestBody.readUInt32BE(16)).toBe(4096);
    const keyIdLength = requestBody[20];
    const serverPublic = requestBody.subarray(21, 21 + keyIdLength);
    const ciphertext = requestBody.subarray(21 + keyIdLength);
    expect(keyIdLength).toBe(65);

    const clientEcdh = createECDH("prime256v1");
    const clientPrivateJwk = client.privateKey.export({ format: "jwk" });
    clientEcdh.setPrivateKey(Buffer.from(clientPrivateJwk.d!, "base64url"));
    const sharedSecret = clientEcdh.computeSecret(serverPublic);
    const authPrk = createHmac("sha256", authSecret).update(sharedSecret).digest();
    const inputKeyMaterial = hkdfExpand(authPrk, Buffer.concat([
      Buffer.from("WebPush: info\0", "utf8"), clientPublic, serverPublic,
    ]), 32);
    const prk = createHmac("sha256", salt).update(inputKeyMaterial).digest();
    const contentKey = hkdfExpand(prk, Buffer.from("Content-Encoding: aes128gcm\0", "utf8"), 16);
    const nonce = hkdfExpand(prk, Buffer.from("Content-Encoding: nonce\0", "utf8"), 12);
    const decipher = createDecipheriv("aes-128-gcm", contentKey, nonce);
    decipher.setAuthTag(ciphertext.subarray(-16));
    const plaintext = Buffer.concat([decipher.update(ciphertext.subarray(0, -16)), decipher.final()]);
    expect(plaintext.at(-1)).toBe(2);
    expect(JSON.parse(plaintext.subarray(0, -1).toString("utf8"))).toEqual(payload);
  });

  it("accepts only known HTTPS push providers and handles expired subscriptions", async () => {
    expect(isAllowedPushEndpoint("https://fcm.googleapis.com/fcm/send/abc")).toBe(true);
    expect(isAllowedPushEndpoint("http://fcm.googleapis.com/fcm/send/abc")).toBe(false);
    expect(isAllowedPushEndpoint("https://127.0.0.1/push")).toBe(false);

    const pair = generateKeyPairSync("ec", { namedCurve: "prime256v1" });
    vi.stubEnv("VAPID_PRIVATE_KEY", pair.privateKey.export({ format: "der", type: "pkcs8" }).toString("base64url"));
    vi.stubGlobal("fetch", vi.fn(async () => new Response(null, { status: 410 })));
    const client = generateKeyPairSync("ec", { namedCurve: "prime256v1" });
    const jwk = client.publicKey.export({ format: "jwk" });
    const p256dh = base64url(Buffer.concat([Buffer.from([4]), Buffer.from(jwk.x!, "base64url"), Buffer.from(jwk.y!, "base64url")]));
    await expect(sendWebPush("https://fcm.googleapis.com/fcm/send/expired", {
      p256dh,
      auth: base64url(Buffer.from("0123456789abcdef")),
    }, { title: "CaloriSnap", body: "Тест" })).resolves.toBe("expired");
  });
});
