# HB Auth

[![npm version](https://badge.fury.io/js/%40hiveio%2Fhb-auth.svg)](https://badge.fury.io/js/%40hiveio%2Fhb-auth)
[![CI](https://gitlab.syncad.com/hive/hb-auth/badges/main/pipeline.svg)](https://gitlab.syncad.com/hive/hb-auth/-/pipelines)

Auth library for browser applications that use Beekeeper.

---

The biggest goal of **hb-auth** library is making operations that require signing by users easier while keeping their keys secure in browser's IndexedDB in an encrypted format. Most important and underlying system of this library is [`@hiveio/beekeeper`](https://npmjs.org/package/@hiveio/beekeeper). **hb-auth** provides a minimal API that allows you seamless user authorization for your web application that interacts with Hive Blockchain.

## 📥 Installation

This is a [Node.js](https://nodejs.org/en/) module available through the
[npm registry](https://www.npmjs.com/).

Before installing, [download and install Node.js](https://nodejs.org/en/download/).
Node.js 20 or higher is required.

Installation is done using the
[`npm install` command](https://docs.npmjs.com/getting-started/installing-npm-packages-locally):

```bash
npm install @hiveio/hb-auth
```

**hb-auth** is written in TypeScript, so out of the box it gives you clear API spec.

If you want to use development versions of our packages, set `@hiveio` scope to use our GitLab registry:

```bash
echo @hiveio:registry=https://gitlab.syncad.com/api/v4/groups/136/-/packages/npm/ >> .npmrc
npm install @hiveio/hb-auth
```

## 🛠️ Worker file configuration

This is a crucial step for having **hb-auth** work since it is based on WebWorkers. Thanks to WebWorkers, user's keys are never exposed to the main thread of your application. Also, if your browser supports SharedWorkers, multiple tabs of your application can share the same worker instance, meaning after user logs in in one tab, other tabs can use the same session without asking user to log in again.

There is a file called `worker.js` and `assets` directory in `@hiveio/hb-auth` package. They should be copied in your `public` directory where you serve your application.

Path from your `public` directory should be defined in client options while creating new instance as below. Default value is `/auth/worker.js`.

```js
new OnlineClient(false, { workerUrl: "/your/path/to/worker.js" })
// or
new OfflineClient({ workerUrl: "/your/path/to/worker.js" })
```

Files inside the `assets` directory or the `assets` directory itself should **not** be renamed as their relative paths are hardcoded in the `worker.js` file.

Example directory structure of your project:

```text
my-app/
  public/
    vendor/
      auth/
        worker.js
        assets/
          beekeeper_wasm.common-J4dPjPbz.wasm
```

The worker starts one beekeeper (wallet manager) instance and keeps it until the worker exits; `logout` and `logoutAll` only lock wallets. Beekeeper reads the stored wallet files once, when it starts, so keys that a different worker on the same origin writes later are not visible to an already running worker. That worker could be another application using **hb-auth**, or a tab that fell back to a dedicated Worker. Logging out and in again does not reload them, and signing with such a key fails with `Not authorized, missing authority`. The worker sees the new files after it restarts, which happens once every tab using it has closed. If your application must pick up keys written elsewhere without waiting for that, change the worker URL (for example by adding a version query string, `/auth/worker.js?v=2`). The new URL starts a fresh SharedWorker, which reads the current wallet files.

Differance between `OnlineClient` and `OfflineClient` is that `OnlineClient` connects to a given Hive node in order to verify that user actually has an ownership over the requested account (either direct or indirect via account auths).

## 💡 Example usage

As a an example you can check [`example`](https://gitlab.syncad.com/hive/hb-auth/-/tree/develop/example) in this project.
This is an application that demonstrates user flow (register, login and logout).

### Registering user account in safe storage

```typescript
import { OnlineClient } from "@hiveio/hb-auth";
import { createHiveChain } from "@hiveio/wax";

const authInstance = new OnlineClient();

const chain = await createHiveChain({
  apiEndpoint: "api.hive.blog", // Hive node endpoint
  chainId: "beeab0de00000000000000000000000000000000000000000000000000000000" // Default Hive chain ID
});

await authInstance.initialize(chain);

try {
  await authInstance.register(
    "guest4test", // username of an existing account on Hive
    "password", // password of user's choice for wallet encryption
    "5JkFnXrLM2ap9t3AmAxBJvQHF7xSKtnTrCTginQCkhzU5S7ecPT", // private posting key
    "posting", // role
    true, // strict mode - you can disable it if you want to enable account auths login
  );

  console.log("User registered successfully in the service worker");

  await authInstance.logout("guest4test"); // optional, just to demonstrate logout

  await authInstance.logoutAll(); // You can also logout all users
} catch (error) {
  console.error(error.message);
}
```

### Authenticate without registering

This example shows how to login to existing registered user account without providing private keys.

```typescript
import { OnlineClient } from "@hiveio/hb-auth";
import { createHiveChain } from "@hiveio/wax";

const authInstance = new OnlineClient();

await authInstance.initialize(await createHiveChain());

try {
  await authInstance.authenticate(
    "guest4test", // previously registered user account name
    "password", // password used during registration
    "posting" // role
  );

  const userInfo = await authInstance.getAuthByUser("guest4test");

  console.log("guest4test logged in data:", userInfo);
} catch (error) {
  console.error(error.message);
}
```

### Lock and Unlock wallet

```typescript
import { OnlineClient } from "@hiveio/hb-auth";
import { createHiveChain } from "@hiveio/wax";

const authInstance = new OnlineClient();

await authInstance.initialize(await createHiveChain());

try {
  await authInstance.authenticate(
    "guest4test", // previously registered user account name
    "password", // password used during registration
    "posting" // role
  );

  await authInstance.lock();

  console.log("Wallet locked");

  await authInstance.unlock("guest4test", "password"); // Will throw if wrong password

  console.log("Wallet unlocked");
} catch (error) {
  console.error(error.message);
}
```

### Import key for existing account

```typescript
import { OnlineClient } from "@hiveio/hb-auth";
import { createHiveChain } from "@hiveio/wax";

const authInstance = new OnlineClient();

await authInstance.initialize(await createHiveChain());

try {
  await authInstance.authenticate(
    "guest4test",
    "password",
    "posting"
  );

  await authInstance.importKey(
    "guest4test",
    "5KGKYWMXReJewfj5M29APNMqGEu173DzvHv5TeJAg9SkjUeQV78", // Private active key of the account
    "active",
  );
} catch (error) {
  console.error(error.message);
}
```

### Get account authorities and invalidate them

```typescript
import { OnlineClient } from "@hiveio/hb-auth";
import { createHiveChain } from "@hiveio/wax";

const authInstance = new OnlineClient();

await authInstance.initialize(await createHiveChain());

try {
  // First we have to authenticate to a registered account in order to modify it's keys
  await authInstance.authenticate(
    "guest4test",
    "password",
    "posting"
  );

  const auths = await authInstance.getAuthByUser("guest4test");

  if(auths === null)
    throw new Error("Account not found");

  for(const role of auths.registeredKeyTypes) {
    console.log("Invalidating existing key for role:", role);

    await authInstance.invalidateExistingKey("guest4test", role);
  }
} catch (error) {
  console.error(error.message);
}
```

### List registered users

```typescript
import { OnlineClient } from "@hiveio/hb-auth";
import { createHiveChain } from "@hiveio/wax";

const authInstance = new OnlineClient();

await authInstance.initialize(await createHiveChain());

try {
  const specificUser = await authInstance.getRegisteredUserByUsername("guest4test");

  const allUsers = await authInstance.getRegisteredUsers();

  console.log("Specific user:", specificUser);
  console.log("All registered users:", allUsers);
} catch (error) {
  console.error(error.message);
}
```

### Sign transaction using registered account

```typescript
import { OnlineClient } from "@hiveio/hb-auth";
import { createHiveChain } from "@hiveio/wax";

const authInstance = new OnlineClient();

await authInstance.initialize(await createHiveChain());

const sigDigest = "ab03729fec712369237321"; // This value should be retrieved from @hiveio/wax transaction

try {
  await authInstance.authenticate(
    "guest4test",
    "password",
    "posting"
  );

  const signature = await authInstance.sign("guest4test", sigDigest, "posting");

  console.log("Transaction signature:", signature);
} catch (error) {
  console.error(error.message);
}
```

### Ask before active-key operations

Once a wallet is unlocked, `sign` signs with any key it holds, active and owner included. A user who wants more protection can choose, when the wallet is created, to be asked for the password or a passkey before every active-key operation. The setting is off by default.

```typescript
import { OnlineClient, CheckRequiredError } from "@hiveio/hb-auth";
import { createHiveChain } from "@hiveio/wax";

const authInstance = new OnlineClient();

await authInstance.initialize(await createHiveChain());

// The choice is made when register creates the wallet; adding a key to an
// existing wallet keeps the wallet's setting.
await authInstance.register("guest4test", "password", postingWif, "posting", true, {
  requireActiveCheck: true,
});
await authInstance.importKey("guest4test", activeWif, "active");

await authInstance.getRequireActiveCheck("guest4test"); // true

try {
  await authInstance.sign("guest4test", sigDigest, "active");
} catch (error) {
  if (error instanceof CheckRequiredError) {
    // Ask the user, then check and sign this one digest. Posting signatures
    // are not affected.
    const signature = await authInstance.signWithCheck("guest4test", sigDigest, "active", {
      password: "password",
    });
  }
}

// Read a registered passkey ahead of the user's gesture (Safari needs the
// gesture for Face ID and Touch ID), then use it in the gesture's handler.
const passkey = await authInstance.loadPasskey("guest4test");
button.onclick = async () => {
  const signature = await authInstance.signWithCheck("guest4test", sigDigest, "active", { passkey });
};

// Turning the setting off, or on, needs a passing check too.
await authInstance.setRequireActiveCheck("guest4test", false, { password: "password" });
```

- **`CheckRequiredError`** is what `sign` throws for an `active` or `owner` key while the setting is on. With the setting off, `sign` signs as before.
- **`signWithCheck(username, digest, keyType, credential)`** checks the password or passkey and signs one digest with the given key type, whether the user's session is unlocked, locked or expired. Nothing is remembered; the next operation needs its own check.
- **`checkCredential(username, credential)`** only checks. Neither call logs the user out, fires the session-end callback, or unlocks the wallet; they restart the session's idle clock, as every unlock does, but do not revive an expired session.
- **Wrong passwords:** after 5 in a row for a user, through any call that checks a password, that user's wallet is locked (as `lock` locks it), and the user has to `unlock` it.
- **Passkeys:** a credential `{ passkey, userVerification }` defaults to `userVerification: "required"`. An assertion is refused (`PasskeyError` with code `USER_NOT_PRESENT` or `USER_NOT_VERIFIED`) unless the authenticator reports the user present, and verified when verification was required. `biometricUnlock` applies the same rule.
- **Storage:** the setting is kept in IndexedDB with an HMAC under a key derived from the wallet password, and the worker enforces it, so a script on the page cannot switch it off: a setting record that is missing or fails verification counts as on. `getRequireActiveCheck` verifies the record while the user's wallet is unlocked, and otherwise reports it as stored. Wallets created before this setting existed count as off, and get a verified record at their next `authenticate` or `unlock`.

### Sign without registering (one-time signing)

```typescript
import { OnlineClient } from "@hiveio/hb-auth";
import { createHiveChain } from "@hiveio/wax";

const authInstance = new OnlineClient();

await authInstance.initialize(await createHiveChain());

const sigDigest = "ab03729fec712369237321"; // This value should be retrieved from @hiveio/wax transaction

try {
  // Note: We are not authenticating here, just direct signing

  const signature = await authInstance.singleSign(
    "guest4test",
    sigDigest,
    "5JkFnXrLM2ap9t3AmAxBJvQHF7xSKtnTrCTginQCkhzU5S7ecPT", // private posting key
    "posting"
  );

  console.log("Transaction signature:", signature);
} catch (error) {
  console.error(error.message);
}
```

## 📖 API Reference

For a detailed API definition, please see our [Wiki](${GEN_DOC_URL}).

## 🛠️ Development and Testing

### Environment Setup

Clone the repository and install the dependencies:

```bash
git clone https://gitlab.syncad.com/hive/hb-auth.git --recurse-submodules
cd hb-auth

corepack enable
pnpm install
```

### Build

Compile the TypeScript source code:

```bash
pnpm build
```

### Run Tests

Before running tests, review and copy to `.env` file from `.env.example` and set appropriate values.

Execute the test suite:

```bash
pnpm test
```

To run only the offline tests, which need neither the live Hive API nor the `.env` test-account keys:

```bash
pnpm test:offline
```

---

## 📄 License

This project is licensed under the MIT License. See the [LICENSE.md](https://gitlab.syncad.com/hive/hb-auth/-/blob/develop/LICENSE.md) file for details.
