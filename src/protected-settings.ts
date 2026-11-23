/**
 * The per-wallet "require a check before active-key operations" setting.
 *
 * The record lives in IndexedDB, which any script on the origin can rewrite,
 * so it carries an HMAC under a key derived from the wallet password: without
 * the password it can be deleted or replaced, but not forged. A record that is
 * missing or fails verification reads as on.
 *
 * Wallets from before this setting existed have no record and read as off.
 * They are told apart from a wallet whose record was deleted by a marker key
 * inside the beekeeper wallet, which cannot be removed without the password.
 * The marker's private key is derived from a public constant on purpose: it
 * marks the wallet and guards nothing.
 */

import { openDB, type IDBPDatabase } from "idb";

const DB_NAME = "/protected_settings_v3";
const STORE_NAME = "settings";
const DOMAIN = "hb-auth/protected-settings/v1";
// The record lets anyone who can read it test password guesses offline, so a
// guess costs about as much as one against beekeeper's own wallet file.
const KDF_ITERATIONS = 600_000;

const MARKER_SEED = "hb-auth/protected-settings/marker/v1";
export const MARKER_PUBLIC_KEY =
  "STM6ac8AdceMTyRu4qtHi2gUJ1GtfZEGiN7Tz7b7TBZuibuH4zzcU";

interface ProtectedSettingRecord {
  username: string;
  requireActiveCheck: boolean;
  mac: Uint8Array<ArrayBuffer>;
}

const encoder = new TextEncoder();

async function getDb(): Promise<IDBPDatabase> {
  return await openDB(DB_NAME, 1, {
    upgrade(db) {
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "username" });
      }
    },
  });
}

async function getRecord(
  username: string,
): Promise<ProtectedSettingRecord | undefined> {
  const db = await getDb();
  try {
    return (await db.get(STORE_NAME, username)) as
      | ProtectedSettingRecord
      | undefined;
  } finally {
    db.close();
  }
}

function macInput(
  username: string,
  requireActiveCheck: boolean,
): Uint8Array<ArrayBuffer> {
  return encoder.encode(JSON.stringify([DOMAIN, username, requireActiveCheck]));
}

/**
 * Derives the key that authenticates `username`'s record. Only call it with a
 * password beekeeper has accepted.
 */
export async function deriveSettingKey(
  username: string,
  password: string,
): Promise<CryptoKey> {
  const material = await crypto.subtle.importKey(
    "raw",
    encoder.encode(password),
    "PBKDF2",
    false,
    ["deriveKey"],
  );
  return await crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      hash: "SHA-256",
      salt: encoder.encode(`${DOMAIN}/${username}`),
      iterations: KDF_ITERATIONS,
    },
    material,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

/**
 * The stored value if the record verifies under `key`, otherwise undefined.
 */
export async function readVerifiedSetting(
  key: CryptoKey,
  username: string,
): Promise<boolean | undefined> {
  const record = await getRecord(username);
  if (
    record?.username !== username ||
    typeof record.requireActiveCheck !== "boolean" ||
    !(record.mac instanceof Uint8Array)
  ) {
    return undefined;
  }
  const valid = await crypto.subtle.verify(
    "HMAC",
    key,
    record.mac,
    macInput(username, record.requireActiveCheck),
  );
  return valid ? record.requireActiveCheck : undefined;
}

/**
 * The stored value, unverified, or undefined if there is none.
 */
export async function readStoredSetting(
  username: string,
): Promise<boolean | undefined> {
  const value = (await getRecord(username))?.requireActiveCheck;
  return typeof value === "boolean" ? value : undefined;
}

export async function writeSetting(
  key: CryptoKey,
  username: string,
  requireActiveCheck: boolean,
): Promise<void> {
  const mac = new Uint8Array(
    await crypto.subtle.sign(
      "HMAC",
      key,
      macInput(username, requireActiveCheck),
    ),
  );
  const record: ProtectedSettingRecord = { username, requireActiveCheck, mac };
  const db = await getDb();
  try {
    await db.put(STORE_NAME, record);
  } finally {
    db.close();
  }
}

const BASE58 = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";

function base58(bytes: Uint8Array): string {
  let value = 0n;
  for (const byte of bytes) value = (value << 8n) | BigInt(byte);
  let encoded = "";
  while (value > 0n) {
    encoded = BASE58[Number(value % 58n)] + encoded;
    value /= 58n;
  }
  for (const byte of bytes) {
    if (byte !== 0) break;
    encoded = "1" + encoded;
  }
  return encoded;
}

async function sha256(
  data: Uint8Array<ArrayBuffer>,
): Promise<Uint8Array<ArrayBuffer>> {
  return new Uint8Array(await crypto.subtle.digest("SHA-256", data));
}

let markerWif: Promise<string> | undefined;

/**
 * The WIF of the marker key, whose public key is {@link MARKER_PUBLIC_KEY}.
 */
export async function getMarkerWif(): Promise<string> {
  markerWif ??= (async () => {
    const payload = new Uint8Array([
      0x80,
      ...(await sha256(encoder.encode(MARKER_SEED))),
    ]);
    const checksum = (await sha256(await sha256(payload))).slice(0, 4);
    return base58(new Uint8Array([...payload, ...checksum]));
  })();
  return await markerWif;
}
