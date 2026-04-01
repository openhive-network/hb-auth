/**
 * WebAuthn PRF-based biometric unlock for hb-auth.
 *
 * Encrypts the user's beekeeper password with a key derived from
 * WebAuthn PRF (passkey biometric). On subsequent unlocks, the password
 * is decrypted via biometric instead of manual entry.
 *
 * Runs in the main thread (WebAuthn requires DOM access).
 * Beekeeper and the Worker are completely unaware of this module.
 */

import { openDB, type IDBPDatabase } from "idb";
import { PasskeyError } from "./errors";

// -- Types --

export interface PasskeyRecord {
  username: string;
  credentialId: Uint8Array;
  prfSalt: Uint8Array;
  encryptedPassword: Uint8Array;
  iv: Uint8Array;
  rpId: string;
  createdAt: number;
}

// -- Constants --

const DB_NAME = "/passkeys_v3";
const DB_VERSION = 1;
const STORE_NAME = "credentials";
const DEFAULT_RP_ID = globalThis.location?.hostname ?? "localhost";
const DEFAULT_RP_NAME = "Hive Safe Storage";

// -- IndexedDB --

async function getDb(): Promise<IDBPDatabase> {
  return await openDB(DB_NAME, DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "username" });
      }
    },
  });
}

// -- Feature Detection --

/**
 * Check if the browser supports WebAuthn with PRF extension.
 * Returns true if PRF *may* be available (final confirmation
 * happens during credential creation via prf.enabled).
 */
export async function isPasskeySupported(): Promise<boolean> {
  if (
    typeof globalThis.window === "undefined" ||
    typeof globalThis.navigator === "undefined"
  ) {
    return false;
  }

  if (!globalThis.PublicKeyCredential) {
    return false;
  }

  // Try getClientCapabilities() for explicit PRF check (Chrome 133+, Safari 17.4+)
  try {
    const pk = globalThis.PublicKeyCredential as unknown as {
      getClientCapabilities?: () => Promise<Record<string, boolean>>;
    };
    if (typeof pk.getClientCapabilities === "function") {
      const caps = await pk.getClientCapabilities();
      // Check for 'extension:prf' capability
      const prfSupported = caps["extension:prf"];
      if (prfSupported !== undefined) {
        return prfSupported;
      }
    }
  } catch {
    // getClientCapabilities not available or failed, fall through
  }

  // If getClientCapabilities doesn't exist or didn't return PRF info,
  // we can't rule it out — return true and let registerPasskey() confirm
  // via prf.enabled in the credential creation response.
  return true;
}

// -- IndexedDB CRUD --

export async function getPasskeyRecord(
  username: string,
): Promise<PasskeyRecord | null> {
  const db = await getDb();
  const record = await db.get(STORE_NAME, username);
  return (record as PasskeyRecord) ?? null;
}

export async function removePasskeyRecord(username: string): Promise<void> {
  const db = await getDb();
  await db.delete(STORE_NAME, username);
}

// -- Core: Registration --

/**
 * Register a passkey with PRF extension and encrypt the user's password.
 * Requires two authenticator touches: one for credential creation, one for PRF evaluation.
 */
export async function registerPasskey(
  username: string,
  password: string,
  rpId: string = DEFAULT_RP_ID,
  rpName: string = DEFAULT_RP_NAME,
): Promise<void> {
  // Generate a user handle (opaque ID, not the username itself)
  const userId = new Uint8Array(16);
  crypto.getRandomValues(userId);

  // Step 1: Create credential with PRF extension
  const createOptions: CredentialCreationOptions = {
    publicKey: {
      rp: { name: rpName, id: rpId },
      user: {
        id: userId,
        name: username,
        displayName: username,
      },
      challenge: crypto.getRandomValues(new Uint8Array(32)),
      pubKeyCredParams: [
        { alg: -7, type: "public-key" },   // ES256
        { alg: -257, type: "public-key" },  // RS256 fallback
      ],
      authenticatorSelection: {
        authenticatorAttachment: "platform",
        userVerification: "required",
        residentKey: "preferred",
      },
      timeout: 120_000,
      // PRF extension not yet in standard TS types
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      extensions: { prf: {} } as AuthenticationExtensionsClientInputs,
    },
  };

  let credential: PublicKeyCredential;
  try {
    const result = await navigator.credentials.create(createOptions);
    if (!result) {
      throw new PasskeyError(
        "Credential creation returned null",
        "CREDENTIAL_CREATION_FAILED",
      );
    }
    credential = result as PublicKeyCredential;
  } catch (err) {
    if (err instanceof PasskeyError) throw err;
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("NotAllowedError") || msg.includes("cancelled")) {
      throw new PasskeyError("User cancelled passkey registration", "USER_CANCELLED");
    }
    throw new PasskeyError(
      `Passkey creation failed: ${msg}`,
      "CREDENTIAL_CREATION_FAILED",
    );
  }

  // Check PRF support
  const extensions = credential.getClientExtensionResults() as {
    prf?: { enabled?: boolean };
  };
  if (!extensions.prf?.enabled) {
    throw new PasskeyError(
      "Your browser or authenticator does not support biometric key derivation (PRF). " +
      "Biometric unlock is not available on this device.",
      "PRF_NOT_SUPPORTED",
    );
  }

  const credentialId = new Uint8Array(credential.rawId);

  // Step 2: Evaluate PRF to get the actual derived key
  const prfSalt = crypto.getRandomValues(new Uint8Array(32));

  const getOptions: CredentialRequestOptions = {
    publicKey: {
      challenge: crypto.getRandomValues(new Uint8Array(32)),
      allowCredentials: [{ id: credentialId, type: "public-key" }],
      userVerification: "required",
      timeout: 120_000,
      // PRF extension not yet in standard TS types
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      extensions: {
        prf: { eval: { first: prfSalt } },
      } as AuthenticationExtensionsClientInputs,
    },
  };

  let assertion: PublicKeyCredential;
  try {
    const result = await navigator.credentials.get(getOptions);
    if (!result) {
      throw new PasskeyError(
        "PRF evaluation returned null",
        "CREDENTIAL_CREATION_FAILED",
      );
    }
    assertion = result as PublicKeyCredential;
  } catch (err) {
    if (err instanceof PasskeyError) throw err;
    const msg = err instanceof Error ? err.message : String(err);
    throw new PasskeyError(
      `PRF evaluation failed: ${msg}`,
      "CREDENTIAL_CREATION_FAILED",
    );
  }

  const prfResults = (
    assertion.getClientExtensionResults() as {
      prf?: { results?: { first?: ArrayBuffer } };
    }
  ).prf?.results;

  if (!prfResults?.first) {
    throw new PasskeyError(
      "PRF evaluation did not return key material. " +
      "Your authenticator may not support the PRF extension.",
      "PRF_NOT_SUPPORTED",
    );
  }

  // Step 3: Encrypt password with PRF-derived AES key
  const aesKey = await crypto.subtle.importKey(
    "raw",
    prfResults.first,
    "AES-GCM",
    false,
    ["encrypt"],
  );

  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encodedPassword = new TextEncoder().encode(password);
  const encryptedPassword = new Uint8Array(
    await crypto.subtle.encrypt({ name: "AES-GCM", iv }, aesKey, encodedPassword),
  );

  // Step 4: Store in IndexedDB
  const record: PasskeyRecord = {
    username,
    credentialId,
    prfSalt,
    encryptedPassword,
    iv,
    rpId,
    createdAt: Date.now(),
  };

  const db = await getDb();
  await db.put(STORE_NAME, record);
}

// -- Core: Recovery --

/**
 * Recover the user's password using biometric authentication.
 * Triggers WebAuthn assertion with PRF to derive the decryption key.
 *
 * @param username Username
 * @param userVerification Level of user verification to require.
 *   - "discouraged": minimal friction, just presence check (good for posting key / blog)
 *   - "preferred": biometric if available, presence otherwise (default)
 *   - "required": always biometric/PIN (good for active/owner key / wallet)
 */
export async function recoverPasswordWithPasskey(
  username: string,
  userVerification: UserVerificationRequirement = "preferred",
): Promise<string> {
  const record = await getPasskeyRecord(username);
  if (!record) {
    throw new PasskeyError(
      "No passkey registered for this user",
      "NO_PASSKEY_REGISTERED",
    );
  }

  // Trigger biometric with PRF evaluation
  const getOptions: CredentialRequestOptions = {
    publicKey: {
      challenge: crypto.getRandomValues(new Uint8Array(32)),
      allowCredentials: [
        { id: record.credentialId, type: "public-key" },
      ],
      userVerification,
      timeout: 120_000,
      rpId: record.rpId,
      // PRF extension not yet in standard TS types
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      extensions: {
        prf: { eval: { first: record.prfSalt } },
      } as AuthenticationExtensionsClientInputs,
    },
  };

  let assertion: PublicKeyCredential;
  try {
    const result = await navigator.credentials.get(getOptions);
    if (!result) {
      throw new PasskeyError(
        "Biometric authentication returned null",
        "DECRYPTION_FAILED",
      );
    }
    assertion = result as PublicKeyCredential;
  } catch (err) {
    if (err instanceof PasskeyError) throw err;
    const msg = err instanceof Error ? err.message : String(err);
    if (
      msg.includes("NotAllowedError") ||
      msg.includes("cancelled") ||
      msg.includes("AbortError")
    ) {
      throw new PasskeyError(
        "Biometric authentication was cancelled",
        "USER_CANCELLED",
      );
    }
    throw new PasskeyError(
      `Biometric authentication failed: ${msg}`,
      "DECRYPTION_FAILED",
    );
  }

  const prfResults = (
    assertion.getClientExtensionResults() as {
      prf?: { results?: { first?: ArrayBuffer } };
    }
  ).prf?.results;

  if (!prfResults?.first) {
    throw new PasskeyError(
      "PRF did not return key material. " +
      "The passkey may have been re-created without PRF support.",
      "DECRYPTION_FAILED",
    );
  }

  // Derive AES key and decrypt
  const aesKey = await crypto.subtle.importKey(
    "raw",
    prfResults.first,
    "AES-GCM",
    false,
    ["decrypt"],
  );

  try {
    const decrypted = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: record.iv },
      aesKey,
      record.encryptedPassword,
    );
    return new TextDecoder().decode(decrypted);
  } catch {
    throw new PasskeyError(
      "Failed to decrypt stored password. " +
      "The passkey may have changed or the data is corrupted. " +
      "Please log in with your password to re-register biometric unlock.",
      "DECRYPTION_FAILED",
    );
  }
}
