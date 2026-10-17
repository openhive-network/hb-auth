import {
  type ChromiumBrowser,
  type ConsoleMessage,
  chromium,
  type Page,
  type BrowserContext,
} from "playwright";
import { test, expect } from "@playwright/test";

import type { KeyAuthorityType, OfflineClient } from "../../src";
import type { IHiveChainInterface } from "@hiveio/wax";

declare const AuthOfflineClient: typeof OfflineClient;
declare const chain: Promise<IHiveChainInterface>;
declare let lifecycleClient: OfflineClient;

let browser!: ChromiumBrowser;

const user = {
  username: "test.user",
  password: "banana",
  keys: [
    {
      type: "posting",
      private: "5JkFnXrLM2ap9t3AmAxBJvQHF7xSKtnTrCTginQCkhzU5S7ecPT",
      public: "5RqVBAVNp5ufMCetQtvLGLJo7unX9nyCBMMrTXRWQ9i1Zzzizh",
    },
    {
      type: "active",
      private: "5KGKYWMXReJewfj5M29APNMqGEu173DzvHv5TeJAg9SkjUeQV78",
      public: "6oR6ckA4TejTWTjatUdbcS98AKETc3rcnQ9dWxmeNiKDzfhBZa",
    },
  ],
  txs: [
    // posting
    {
      digest:
        "390f34297cfcb8fa4b37353431ecbab05b8dc0c9c15fb9ca1a3d510c52177542",
      signed:
        "1fb4cce36092f0422dfd96b4435a28f2edfb3348940e05fd9958a6304344649ae3097ecb7d4723aba1e6ae00ce76c2cf692898176fd68c93265d1f9c960a09fc28",
    },
    // active
    {
      digest:
        "390f34297cfcb8fa4b37353431ecbab05b8dc0c9c15fb9ca1a3d510c52177542",
      signed:
        "1ff05a765007d6da4de2626e4e15cb79aab2df9ab6077acb12090e24df64310a1f46d6dc4b0a2a7e3c5b43cb6959e2b33fcaf1f416c7bd506d7a8ac305261ec8fd",
    },
  ],
};

test.describe("HB Auth Offline Client base tests", () => {
  let page: Page;
  let authInstance: OfflineClient;
  let browserContext: BrowserContext;

  async function navigate(page: Page): Promise<void> {
    await page.goto(`http://localhost:8080/src/__tests__/assets/offline.html`, {
      waitUntil: "load",
    });
  }

  test.beforeAll(async () => {
    browser = await chromium.launch({
      headless: true,
    });

    browserContext = await browser.newContext();
    page = await browserContext.newPage();

    await navigate(page);
  });

  test.beforeEach(async () => {
    page.on("console", (msg: ConsoleMessage) => {
      console.log(">>", msg.type(), msg.text());
    });
  });

  test("Should test on chromium", async () => {
    const browserType = browser.browserType();

    expect(browserType.name()).toBe("chromium");
  });

  test("Should have a valid html test webpage", async () => {
    const id = await page.$eval("body", (n) => n.getAttribute("id"));

    expect(id).toBe("auth-container");
  });

  test("Should have global OfflineClient", async () => {
    const offlineClient = await page.evaluate(async () => {
      return typeof AuthOfflineClient;
    });

    expect(offlineClient).toBe("function");
  });

  test.skip("Should throw error if there is no worker file found", async () => {
    const err = await page.evaluate(async () => {
      try {
        const instance = new AuthOfflineClient();
        await instance.initialize(await chain);
      } catch (error) {
        return true;
      }
    });

    expect(err).toBeTruthy();
  });

  test("Should be able to create new OfflineClient instance", async () => {
    await page.evaluate(async () => {
      authInstance = new AuthOfflineClient({ workerUrl: "/dist/worker.js" });
      await authInstance.initialize(await chain);
    });
  });

  test("Should return null if no user registered with given username", async () => {
    const authUser = await page.evaluate(async ({ username }) => {
      const authUser = await authInstance.getAuthByUser(username);
      return authUser;
    }, user);

    expect(authUser).toBeNull();
  });

  test("Should register new user", async () => {
    const username = await page.evaluate(
      async ({ username, password, keys }) => {
        await authInstance.register(
          username,
          password,
          keys[0].private,
          keys[0].type as KeyAuthorityType,
        );
        const authUser = await authInstance.getAuthByUser(username);
        return authUser?.username;
      },
      user,
    );

    expect(username).toBe(user.username);
  });

  test("Should second register with same user give an error", async () => {
    const error = await page.evaluate(async ({ username, password, keys }) => {
      try {
        await authInstance.register(
          username,
          password,
          keys[0].private,
          keys[0].type as KeyAuthorityType,
        );
      } catch (error) {
        return (error as Error).message;
      }
    }, user);

    expect(error).toBe(
      `This user is already registered with 'posting' authority`,
    );
  });

  test("Should logout user on logout() call", async () => {
    const authorized = await page.evaluate(async ({ username }) => {
      await authInstance.logout(username);
      return (await authInstance.getAuthByUser(username))?.authorized;
    }, user);

    expect(authorized).toBeFalsy();
  });

  test("Should user login with username and password", async () => {
    const authorized = await page.evaluate(
      async ({ username, password, keys }) => {
        await authInstance.authenticate(
          username,
          password,
          keys[0].type as KeyAuthorityType,
        );
        return (await authInstance.getAuthByUser(username))?.authorized;
      },
      user,
    );

    expect(authorized).toBeTruthy();
  });

  test("Should return error if user tries to login with bad authority type", async () => {
    const error = await page.evaluate(async ({ username, password }) => {
      await authInstance.logout(username);

      try {
        await authInstance.authenticate(username, password, "active");
      } catch (error) {
        return (error as Error).message;
      }
    }, user);

    expect(error).toBe("Not authorized, missing authority");
  });

  test("Should throw if invalid password given", async () => {
    const error = await page.evaluate(async ({ username, keys }) => {
      try {
        await authInstance.logout(username);
        await authInstance.authenticate(
          username,
          "abc",
          keys[0].type as KeyAuthorityType,
        );
      } catch (error) {
        return (error as Error).message;
      }
    }, user);

    expect(error).toBe("Invalid credentials");

    const error2 = await page.evaluate(async ({ username, password, keys }) => {
      try {
        await authInstance.authenticate(
          username,
          password,
          keys[0].type as KeyAuthorityType,
        );
        await authInstance.lock();
        await authInstance.unlock(username, "abc");
      } catch (error) {
        return (error as Error).message;
      }
    }, user);

    expect(error2).toBe("Invalid credentials");
  });

  test("Should user register/login only with supported authorities active, posting or owner authority", async () => {
    const error = await page.evaluate(async ({ username, password }) => {
      try {
        await authInstance.authenticate(
          username,
          password,
          "anything" as KeyAuthorityType,
        );
      } catch (error) {
        return (error as Error).message;
      }
    }, user);

    expect(error).toBe(
      `Invalid key type. Only 'active', 'posting' or 'owner' key supported`,
    );
  });

  test("Should register existing user with another authority type", async () => {
    const username = await page.evaluate(
      async ({ username, password, keys }) => {
        await authInstance.register(
          username,
          password,
          keys[1].private,
          keys[1].type as KeyAuthorityType,
        );
        const authUser = await authInstance.getAuthByUser(username);
        return authUser?.username;
      },
      user,
    );

    expect(username).toBe(user.username);
  });

  test("Should getAuthByUser return registered key authority types", async () => {
    const types = await page.evaluate(async ({ username }) => {
      const authUser = await authInstance.getAuthByUser(username);
      return authUser?.registeredKeyTypes;
    }, user);

    expect(types?.includes("posting")).toBeTruthy();
    expect(types?.includes("active")).toBeTruthy();
  });

  test("Should user login with different authority types", async () => {
    const authorizedKeyType1 = await page.evaluate(
      async ({ username, password, keys }) => {
        await authInstance.logout(username);
        await authInstance.authenticate(
          username,
          password,
          keys[0].type as KeyAuthorityType,
        );
        return (await authInstance.getAuthByUser(username))?.loggedInKeyType;
      },
      user,
    );

    expect(authorizedKeyType1).toBe(user.keys[0].type);

    const authorizedKeyType2 = await page.evaluate(
      async ({ username, password, keys }) => {
        await authInstance.logout(username);
        await authInstance.authenticate(
          username,
          password,
          keys[1].type as KeyAuthorityType,
        );
        return (await authInstance.getAuthByUser(username))?.loggedInKeyType;
      },
      user,
    );

    expect(authorizedKeyType2).toBe(user.keys[1].type);
  });

  test("Should user session should remain in new tab", async () => {
    const newTab = await browserContext.newPage();
    await navigate(newTab);

    const authorized = await newTab.evaluate(async ({ username }) => {
      // get new instance on new page
      const newAuthInstance = new AuthOfflineClient({
        workerUrl: "/dist/worker.js",
      });
      await newAuthInstance.initialize(await chain);
      return (await newAuthInstance.getAuthByUser(username))?.authorized;
    }, user);

    expect(authorized).toBeTruthy();
  });

  test("Should user sign tx and get signed tx back with selected key type", async () => {
    const signed1 = await page.evaluate(
      async ({ username, password, keys, txs }) => {
        await authInstance.logout(username);
        await authInstance.authenticate(
          username,
          password,
          keys[0].type as KeyAuthorityType,
        );

        const signed = await authInstance.sign(
          username,
          txs[0].digest,
          keys[0].type as KeyAuthorityType,
        );
        return signed;
      },
      user,
    );

    expect(signed1).toBe(user.txs[0].signed);

    const signed2 = await page.evaluate(
      async ({ username, password, keys, txs }) => {
        const signed = await authInstance.sign(
          username,
          txs[1].digest,
          keys[1].type as KeyAuthorityType,
        );
        return signed;
      },
      user,
    );

    expect(signed2).toBe(user.txs[1].signed);
  });

  test("Should user get error when trying to sign with not authorized key", async ({
    page: _page,
  }) => {
    await navigate(_page);
    const error = await _page.evaluate(
      async ({ username, password, keys, txs }) => {
        const instance = new AuthOfflineClient({
          workerUrl: "/dist/worker.js",
        });
        await instance.initialize(await chain);
        await instance.register(
          username,
          password,
          keys[1].private,
          keys[1].type as KeyAuthorityType,
        );

        try {
          await instance.sign(
            username,
            txs[0].digest,
            keys[0].type as KeyAuthorityType,
          );
        } catch (error) {
          return (error as Error).message;
        } finally {
          await instance.logout(username);
        }
      },
      user,
    );

    expect(error).toBe("Not authorized, missing authority");
  });

  test("Should user able to import key after login or unlock", async ({
    page: _page,
  }) => {
    await navigate(_page);
    const singnedWithNewKey = await _page.evaluate(
      async ({ username, password, keys, txs }) => {
        const instance = new AuthOfflineClient({
          workerUrl: "/dist/worker.js",
        });
        await instance.initialize(await chain);
        await instance.register(
          username,
          password,
          keys[0].private,
          keys[0].type as KeyAuthorityType,
        );
        // lock wallet and unlock, then add key
        await instance.lock();
        await instance.unlock(username, password);
        await instance.importKey(
          username,
          keys[1].private,
          keys[1].type as KeyAuthorityType,
        );

        const signed = await instance.sign(
          username,
          txs[1].digest,
          keys[1].type as KeyAuthorityType,
        );
        return signed;
      },
      user,
    );

    expect(singnedWithNewKey).toBe(user.txs[1].signed);
  });

  test("Should user able to lock/unlock wallet during user's session time", async () => {
    const locked = await page.evaluate(async ({ username, password, keys }) => {
      await authInstance.logout(username);
      await authInstance.authenticate(
        username,
        password,
        keys[0].type as KeyAuthorityType,
      );
      await authInstance.lock();
      const authUser = await authInstance.getAuthByUser(username);
      return authUser?.unlocked;
    }, user);

    expect(locked).toBeFalsy();

    const unlocked = await page.evaluate(async ({ username, password }) => {
      await authInstance.unlock(username, password);
      const authUser = await authInstance.getAuthByUser(username);
      return authUser?.unlocked;
    }, user);

    expect(unlocked).toBeTruthy();
  });

  test("Should user get error when trying to lock wallet if not authenticated", async () => {
    const errorWhileLocking = await page.evaluate(async () => {
      await authInstance.logoutAll();
      try {
        await authInstance.lock();
      } catch (error) {
        return (error as Error).message;
      }
    });

    expect(errorWhileLocking).toBe(
      "There is no existing user session or session already expired",
    );
  });

  test.skip("Should user be logged out when session time expires", async ({
    page: _page,
  }) => {
    await navigate(_page);
    const loggedIn = await _page.evaluate(
      async ({ username, password, keys }) => {
        const SESSION_TIME = 10; // 10 seconds
        const instance = new AuthOfflineClient({
          sessionTimeout: SESSION_TIME,
        });
        await instance.initialize(await chain);
        await instance.register(
          username,
          password,
          keys[1].private,
          keys[1].type as KeyAuthorityType,
        );
        await _page.waitForTimeout(SESSION_TIME * 1000);
        const user = await instance.getAuthByUser(username);
        return user?.username;
      },
      user,
    );

    expect(loggedIn).toBeUndefined();
  });

  test("Should allow singleSign without any prior registration", async ({
    page: _page,
  }) => {
    await navigate(_page);

    const signed = await _page.evaluate(async ({ username, keys, txs }) => {
      const instance = new AuthOfflineClient({ workerUrl: "/dist/worker.js" });
      await instance.initialize(await chain);
      const signed = await instance.singleSign(
        username,
        txs[0].digest,
        keys[0].private,
        keys[0].type as KeyAuthorityType,
      );
      return signed;
    }, user);

    expect(signed).toBe(user.txs[0].signed);
  });

  test("Should allow singleSign with unregistered key type", async ({
    page: _page,
  }) => {
    await navigate(_page);

    // First register with posting key
    await _page.evaluate(async ({ username, password, keys }) => {
      const instance = new AuthOfflineClient({ workerUrl: "/dist/worker.js" });
      await instance.initialize(await chain);
      await instance.register(
        username,
        password,
        keys[0].private,
        keys[0].type as KeyAuthorityType,
      );
    }, user);

    // Try singleSign with active key (not registered)
    const signed = await _page.evaluate(async ({ username, keys, txs }) => {
      const instance = new AuthOfflineClient({ workerUrl: "/dist/worker.js" });
      await instance.initialize(await chain);
      const signed = await instance.singleSign(
        username,
        txs[1].digest,
        keys[1].private,
        keys[1].type as KeyAuthorityType,
      );
      return signed;
    }, user);

    expect(signed).toBe(user.txs[1].signed);
  });

  test("Should getRegisteredUsers return all registered users with their states", async () => {
    const users = await page.evaluate(async ({ username, password }) => {
      await authInstance.authenticate(username, password, "posting");
      const registeredUsers = await authInstance.getRegisteredUsers();
      return registeredUsers;
    }, user);

    expect(users.length).toBe(1);
    expect(users[0].username).toBe(user.username);
    expect(users[0].registeredKeyTypes).toContain("posting");
    expect(users[0].registeredKeyTypes).toContain("active");
    expect(users[0].authorized).toBeTruthy();
    expect(users[0].unlocked).toBeTruthy();
    expect(users[0].loggedInKeyType).toBe("posting");
  });

  test("Should getRegisteredUserByUsername return registered user", async () => {
    const regUser = await page.evaluate(async ({ username }) => {
      const registeredUser = await authInstance.getRegisteredUserByUsername(
        username,
      );
      return registeredUser;
    }, user);

    expect(regUser).not.toBeNull();
    expect(regUser?.username).toBe(user.username);
    expect(regUser?.registeredKeyTypes).toContain("posting");
    expect(regUser?.registeredKeyTypes).toContain("active");
    expect(regUser?.authorized).toBeTruthy();
    expect(regUser?.unlocked).toBeTruthy();
    expect(regUser?.loggedInKeyType).toBe("posting");
  });

  test("Should getRegisteredUsers reflect locked/unlocked state", async () => {
    const states = await page.evaluate(async ({ username, password }) => {
      await authInstance.lock();
      const lockedState = (await authInstance.getRegisteredUsers())[0].unlocked;
      await authInstance.unlock(username, password);
      const unlockedState = (await authInstance.getRegisteredUsers())[0]
        .unlocked;
      return { lockedState, unlockedState };
    }, user);

    expect(states.lockedState).toBeFalsy();
    expect(states.unlockedState).toBeTruthy();
  });

  test("Should invalidate existing key and prevent its use, then allow registering a new key", async () => {
    // First, register a new user with a posting key
    const newUser = {
      username: "test.invalid",
      password: "testpassword",
      keys: [
        {
          type: "posting",
          private: "5JkFnXrLM2ap9t3AmAxBJvQHF7xSKtnTrCTginQCkhzU5S7ecPT",
          public: "5RqVBAVNp5ufMCetQtvLGLJo7unX9nyCBMMrTXRWQ9i1Zzzizh",
        },
        {
          type: "posting",
          private: "5KGKYWMXReJewfj5M29APNMqGEu173DzvHv5TeJAg9SkjUeQV78",
          public: "6oR6ckA4TejTWTjatUdbcS98AKETc3rcnQ9dWxmeNiKDzfhBZa",
        },
      ],
    };

    // Register the user with the first key
    await page.evaluate(async ({ username, password, keys }) => {
      const instance = new AuthOfflineClient({ workerUrl: "/dist/worker.js" });
      await instance.initialize(await chain);
      await instance.register(
        username,
        password,
        keys[0].private,
        keys[0].type as KeyAuthorityType,
      );
    }, newUser);

    // Authenticate with the key to verify it works initially
    const authResult = await page.evaluate(
      async ({ username, password, keys }) => {
        const instance = new AuthOfflineClient({
          workerUrl: "/dist/worker.js",
        });
        await instance.initialize(await chain);
        try {
          await instance.authenticate(
            username,
            password,
            keys[0].type as KeyAuthorityType,
          );
          return true;
        } catch (error) {
          return false;
        }
      },
      newUser,
    );

    expect(authResult).toBeTruthy();

    // Invalidate the key
    await page.evaluate(async ({ username, keys }) => {
      const instance = new AuthOfflineClient({ workerUrl: "/dist/worker.js" });
      await instance.initialize(await chain);
      await instance.invalidateExistingKey(
        username,
        keys[0].type as KeyAuthorityType,
      );
    }, newUser);

    // The key should no longer work for signing after invalidation
    const canStillSign = await page.evaluate(
      async ({ username, keys }) => {
        const instance = new AuthOfflineClient({
          workerUrl: "/dist/worker.js",
        });
        await instance.initialize(await chain);
        try {
          // Try to sign something with the key
          const digest = "test digest";
          const signature = await instance.singleSign(
            username,
            digest,
            keys[0].private,
            keys[0].type as KeyAuthorityType,
          );
          return !!signature;
        } catch (error) {
          return false;
        }
      },
      newUser,
    );

    expect(canStillSign).toBeFalsy();

    // Now register a new key with the same type
    const registerNewKey = await page.evaluate(
      async ({ username, password, keys }) => {
        const instance = new AuthOfflineClient({
          workerUrl: "/dist/worker.js",
        });
        await instance.initialize(await chain);
        try {
          await instance.register(
            username,
            password,
            keys[1].private,
            keys[1].type as KeyAuthorityType,
          );
          return true;
        } catch (error) {
          return (error as Error).message;
        }
      },
      newUser,
    );

    expect(registerNewKey).toBeTruthy();

    // Authenticate with the new key first
    const authWithNewKey = await page.evaluate(
      async ({ username, password, keys }) => {
        const instance = new AuthOfflineClient({
          workerUrl: "/dist/worker.js",
        });
        await instance.initialize(await chain);
        try {
          await instance.authenticate(
            username,
            password,
            keys[1].type as KeyAuthorityType,
          );
          return true;
        } catch (error) {
          return (error as Error).message;
        }
      },
      newUser,
    );

    expect(authWithNewKey).toBeTruthy();

    // Verify the new key works for signing
    const newKeyWorks = await page.evaluate(
      async ({ username, keys }) => {
        const instance = new AuthOfflineClient({
          workerUrl: "/dist/worker.js",
        });
        await instance.initialize(await chain);
        try {
          // Try to sign something with the new key
          const digest = "test digest";
          const signature = await instance.sign(
            username,
            digest,
            keys[1].type as KeyAuthorityType,
          );
          return !!signature;
        } catch (error) {
          return (error as Error).message;
        }
      },
      newUser,
    );

    expect(newKeyWorks).toBeTruthy();
  });

  test.afterAll(async () => {
    await browser.close();
  });
});

test.describe("HB Auth Offline Client under a strict worker CSP", () => {
  // No 'unsafe-eval': code that compiles strings (eval, new Function) is
  // refused, while WebAssembly compilation stays allowed.
  const workerCsp =
    "script-src 'self' 'wasm-unsafe-eval'; report-uri /__csp-violation";

  let cspBrowser: ChromiumBrowser;
  let context: BrowserContext;
  let page: Page;
  const servedWorkers: string[] = [];
  const violations: string[] = [];

  test.beforeAll(async () => {
    cspBrowser = await chromium.launch({ headless: true });
    context = await cspBrowser.newContext();

    await context.route("**/dist/worker.js", async (route) => {
      const response = await route.fetch();
      servedWorkers.push(route.request().url());
      await route.fulfill({
        response,
        headers: {
          ...response.headers(),
          "content-security-policy": workerCsp,
        },
      });
    });
    await context.route("**/__csp-violation", async (route) => {
      violations.push(route.request().postData() ?? "");
      await route.fulfill({ status: 204 });
    });

    page = await context.newPage();
    page.on("console", (msg: ConsoleMessage) => {
      if (msg.text().includes("Content Security Policy"))
        violations.push(msg.text());
    });
    await page.goto(`http://localhost:8080/src/__tests__/assets/offline.html`, {
      waitUntil: "load",
    });
  });

  test("Should register, unlock and sign with no CSP violation", async () => {
    const signed = await page.evaluate(
      async ({ username, password, keys, txs }) => {
        const instance = new AuthOfflineClient({
          workerUrl: "/dist/worker.js",
        });
        await instance.initialize(await chain);
        await instance.register(
          username,
          password,
          keys[0].private,
          keys[0].type as KeyAuthorityType,
        );
        await instance.lock();
        await instance.unlock(username, password);
        return await instance.sign(
          username,
          txs[0].digest,
          keys[0].type as KeyAuthorityType,
        );
      },
      user,
    );

    expect(servedWorkers).toHaveLength(1);
    expect(signed).toBe(user.txs[0].signed);
    expect(violations).toEqual([]);
  });

  test.afterAll(async () => {
    await cspBrowser.close();
  });
});

test.describe("HB Auth Offline Client beekeeper lifecycle", () => {
  // Served from a route rather than a file so the worker still resolves its
  // WASM asset relative to /dist/.
  const countedWorkerUrl = "/dist/counted-worker.js";
  const countedWorker = [
    'import "/src/__tests__/assets/count-wasm-instantiations.js";',
    'import "./worker.js";',
  ].join("\n");

  let lifecycleBrowser: ChromiumBrowser;
  let context: BrowserContext;
  let page: Page;

  interface WasmCounts {
    starts: number;
    instantiations: number;
    storageCloses: number;
  }

  // Talks to count-wasm-instantiations.js inside the worker.
  async function queryWasm(
    message: {
      failInstantiation?: boolean;
      hangInstantiation?: boolean;
      failStorageWrites?: boolean;
      timings?: { sessionHealthCheck?: number; beekeeperStartTimeout?: number };
    } = {},
  ): Promise<WasmCounts> {
    return await page.evaluate(
      async (message) =>
        await new Promise<WasmCounts>((resolve) => {
          const channel = new BroadcastChannel("hb-auth-wasm-instantiations");
          channel.onmessage = (event: MessageEvent<WasmCounts>) => {
            channel.close();
            resolve(event.data);
          };
          channel.postMessage(message);
        }),
      message,
    );
  }

  async function countWasmInstantiations(): Promise<number> {
    return (await queryWasm()).instantiations;
  }

  async function createLifecycleClient(sessionTimeout?: number): Promise<void> {
    await page.evaluate(
      async ({ workerUrl, sessionTimeout }) => {
        lifecycleClient = new AuthOfflineClient({ workerUrl, sessionTimeout });
        await lifecycleClient.initialize(await chain);
      },
      { workerUrl: countedWorkerUrl, sessionTimeout },
    );
  }

  async function fireConcurrentCalls(): Promise<void> {
    await page.evaluate(async ({ username }) => {
      await Promise.all([
        lifecycleClient.getRegisteredUsers(),
        lifecycleClient.getAuthByUser(username),
        lifecycleClient.getRegisteredUserByUsername(username),
        lifecycleClient.getUserSettings(username),
      ]);
    }, user);
  }

  test.beforeAll(async () => {
    lifecycleBrowser = await chromium.launch({ headless: true });
  });

  test.beforeEach(async () => {
    context = await lifecycleBrowser.newContext();
    await context.route(`**${countedWorkerUrl}`, async (route) => {
      await route.fulfill({
        contentType: "application/javascript",
        body: countedWorker,
      });
    });

    page = await context.newPage();
    await page.goto(`http://localhost:8080/src/__tests__/assets/offline.html`, {
      waitUntil: "load",
    });
  });

  test("Should start one beekeeper for concurrent first calls and keep it across logout", async () => {
    await createLifecycleClient();
    await fireConcurrentCalls();
    expect(await countWasmInstantiations()).toBe(1);

    await page.evaluate(async ({ username, password, keys }) => {
      await lifecycleClient.register(
        username,
        password,
        keys[0].private,
        keys[0].type as KeyAuthorityType,
      );
      await lifecycleClient.logout(username);
    }, user);
    await fireConcurrentCalls();
    expect(await countWasmInstantiations()).toBe(1);

    const signed = await page.evaluate(
      async ({ username, password, keys, txs }) => {
        await lifecycleClient.authenticate(
          username,
          password,
          keys[0].type as KeyAuthorityType,
        );
        const signed = await lifecycleClient.sign(
          username,
          txs[0].digest,
          keys[0].type as KeyAuthorityType,
        );
        await lifecycleClient.logoutAll();
        return signed;
      },
      user,
    );
    expect(signed).toBe(user.txs[0].signed);

    await fireConcurrentCalls();
    expect(await countWasmInstantiations()).toBe(1);
  });

  test("Should start beekeeper again after a failed start", async () => {
    await createLifecycleClient();
    await queryWasm({ failInstantiation: true });
    const failures = await page.evaluate(async ({ username }) => {
      const results = await Promise.allSettled([
        lifecycleClient.getRegisteredUsers(),
        lifecycleClient.getAuthByUser(username),
      ]);
      return results.filter((result) => result.status === "rejected").length;
    }, user);
    expect(failures).toBe(2);
    expect(await queryWasm()).toEqual({
      starts: 1,
      instantiations: 0,
      storageCloses: 0,
    });

    await queryWasm({ failInstantiation: false });
    await fireConcurrentCalls();
    expect(await queryWasm()).toEqual({
      starts: 2,
      instantiations: 1,
      storageCloses: 0,
    });
  });

  test("Should give up on a hanging beekeeper start, start again and delete the abandoned one once it finishes", async () => {
    await createLifecycleClient();
    await queryWasm({
      hangInstantiation: true,
      timings: { beekeeperStartTimeout: 1000 },
    });
    const errors = await page.evaluate(async ({ username }) => {
      const results = await Promise.allSettled([
        lifecycleClient.getRegisteredUsers(),
        lifecycleClient.getAuthByUser(username),
      ]);
      return results.map((result) =>
        result.status === "rejected" ? String(result.reason) : "fulfilled",
      );
    }, user);
    expect(errors).toHaveLength(2);
    for (const error of errors) expect(error).toContain("timed out");
    expect(await queryWasm()).toEqual({
      starts: 1,
      instantiations: 0,
      storageCloses: 0,
    });

    // Releases the abandoned start too, which then finishes late.
    await queryWasm({ hangInstantiation: false });
    await fireConcurrentCalls();
    await expect.poll(async () => await queryWasm()).toEqual({
      starts: 2,
      instantiations: 2,
      storageCloses: 1,
    });

    const signed = await page.evaluate(
      async ({ username, password, keys, txs }) => {
        const keyType = keys[0].type as KeyAuthorityType;
        await lifecycleClient.register(
          username,
          password,
          keys[0].private,
          keyType,
        );
        return await lifecycleClient.sign(username, txs[0].digest, keyType);
      },
      user,
    );
    expect(signed).toBe(user.txs[0].signed);
    expect((await queryWasm()).storageCloses).toBe(1);
  });

  test("Should reject a non-strict sign after logout on the kept beekeeper", async () => {
    await createLifecycleClient();
    const error = await page.evaluate(
      async ({ username, password, keys, txs }) => {
        await lifecycleClient.register(
          username,
          password,
          keys[0].private,
          keys[0].type as KeyAuthorityType,
          false,
        );
        await lifecycleClient.logout(username);
        try {
          await lifecycleClient.sign(
            username,
            txs[0].digest,
            keys[0].type as KeyAuthorityType,
          );
          return "signed";
        } catch (error) {
          return (error as Error).message;
        }
      },
      user,
    );
    expect(error).toBe("Not authorized");
    expect(await countWasmInstantiations()).toBe(1);
  });

  test("Should register and singleSign after the kept beekeeper sat idle past the session timeout", async () => {
    // Shorter than the worker's 2 s session health check, so the other user's
    // expired wallet is still unlocked when singleSign refreshes the clock.
    const sessionTimeout = 1;
    const idle = sessionTimeout * 1000 + 500;
    await createLifecycleClient(sessionTimeout);
    const otherUser = `${user.username}.idle`;

    await page.evaluate(async ({ username, password, keys }) => {
      await lifecycleClient.register(
        username,
        password,
        keys[0].private,
        keys[0].type as KeyAuthorityType,
      );
      await lifecycleClient.logout(username);
    }, user);
    await page.waitForTimeout(idle);

    const registered = await page.evaluate(
      async ({ otherUser, user: { password, keys } }) => {
        await lifecycleClient.register(
          otherUser,
          password,
          keys[1].private,
          keys[1].type as KeyAuthorityType,
        );
        return await lifecycleClient.getAuthByUser(otherUser);
      },
      { otherUser, user },
    );
    expect(registered?.authorized).toBe(true);
    await page.waitForTimeout(idle);

    const result = await page.evaluate(
      async ({ otherUser, user: { username, keys, txs } }) => {
        const signed = await lifecycleClient.singleSign(
          username,
          txs[1].digest,
          keys[1].private,
          keys[1].type as KeyAuthorityType,
        );
        let expiredSign = "signed";
        try {
          await lifecycleClient.sign(
            otherUser,
            txs[1].digest,
            keys[1].type as KeyAuthorityType,
          );
        } catch (error) {
          expiredSign = (error as Error).message;
        }
        return { signed, expiredSign };
      },
      { otherUser, user },
    );
    expect(result.signed).toBe(user.txs[1].signed);
    // The idle time expired the other user's session; signing on the
    // refreshed beekeeper must not revive it.
    expect(result.expiredSign).toBe("Not authorized");
    expect(await countWasmInstantiations()).toBe(1);
  });

  test("Should not let another user's login revive an expired user's wallet", async () => {
    const sessionTimeout = 1;
    await createLifecycleClient(sessionTimeout);
    // Keeps the session interval from locking the expired wallet first, so
    // only the login can be what stops it from signing.
    await queryWasm({ timings: { sessionHealthCheck: 3_600_000 } });
    const otherUser = `${user.username}.other`;

    await page.evaluate(
      async ({ otherUser, user: { username, password, keys } }) => {
        await lifecycleClient.register(
          otherUser,
          password,
          keys[1].private,
          keys[1].type as KeyAuthorityType,
        );
        await lifecycleClient.logout(otherUser);
        await lifecycleClient.register(
          username,
          password,
          keys[0].private,
          keys[0].type as KeyAuthorityType,
        );
      },
      { otherUser, user },
    );
    await page.waitForTimeout(sessionTimeout * 1000 + 500);

    const result = await page.evaluate(
      async ({ otherUser, user: { username, password, keys, txs } }) => {
        await lifecycleClient.authenticate(
          otherUser,
          password,
          keys[1].type as KeyAuthorityType,
        );
        let expiredSign = "signed";
        try {
          await lifecycleClient.sign(
            username,
            txs[0].digest,
            keys[0].type as KeyAuthorityType,
          );
        } catch (error) {
          expiredSign = (error as Error).message;
        }
        const otherSigned = await lifecycleClient.sign(
          otherUser,
          txs[1].digest,
          keys[1].type as KeyAuthorityType,
        );
        return { expiredSign, otherSigned };
      },
      { otherUser, user },
    );
    expect(result.expiredSign).toBe("Not authorized");
    expect(result.otherSigned).toBe(user.txs[1].signed);
  });

  test("Should serve a call made during unregister from a new beekeeper and end the session", async () => {
    await createLifecycleClient();
    const result = await page.evaluate(
      async ({ username, password, keys, txs }) => {
        const keyType = keys[0].type as KeyAuthorityType;
        let sessionEnds = 0;
        await lifecycleClient.setSessionEndCallback(async () => {
          sessionEnds += 1;
        });
        await lifecycleClient.register(
          username,
          password,
          keys[0].private,
          keyType,
        );
        const auth = (
          lifecycleClient as unknown as {
            getAuthInstance: () => {
              unregister: (
                username: string,
                keyType: KeyAuthorityType,
              ) => Promise<void>;
            };
          }
        ).getAuthInstance();
        const [, signed] = await Promise.all([
          auth.unregister(username, keyType),
          lifecycleClient.singleSign(
            username,
            txs[1].digest,
            keys[1].private,
            keys[1].type as KeyAuthorityType,
          ),
        ]);
        return { signed, sessionEnds };
      },
      user,
    );
    expect(result.signed).toBe(user.txs[1].signed);
    expect(result.sessionEnds).toBe(1);
    expect(await queryWasm()).toEqual({
      starts: 2,
      instantiations: 2,
      storageCloses: 1,
    });
  });

  test("Should not let a session-end callback that calls back in or never settles hold up later calls", async () => {
    await createLifecycleClient();
    const result = await page.evaluate(
      async ({ username, password, keys, txs }) => {
        const keyType = keys[0].type as KeyAuthorityType;
        const auth = (
          lifecycleClient as unknown as {
            getAuthInstance: () => {
              unregister: (
                username: string,
                keyType: KeyAuthorityType,
              ) => Promise<void>;
            };
          }
        ).getAuthInstance();

        let usersAtSessionEnd: unknown[] | undefined;
        await lifecycleClient.setSessionEndCallback(async () => {
          usersAtSessionEnd = await lifecycleClient.getRegisteredUsers();
        });
        await lifecycleClient.register(
          username,
          password,
          keys[0].private,
          keyType,
        );
        await auth.unregister(username, keyType);

        await lifecycleClient.setSessionEndCallback(
          async () => await new Promise<void>(() => {}),
        );
        await lifecycleClient.register(
          username,
          password,
          keys[0].private,
          keyType,
        );
        void auth.unregister(username, keyType);
        await lifecycleClient.register(
          username,
          password,
          keys[0].private,
          keyType,
        );
        const signed = await lifecycleClient.sign(
          username,
          txs[0].digest,
          keyType,
        );
        return { usersAtSessionEnd, signed };
      },
      user,
    );
    expect(Array.isArray(result.usersAtSessionEnd)).toBe(true);
    expect(result.signed).toBe(user.txs[0].signed);
    expect(await queryWasm()).toEqual({
      starts: 3,
      instantiations: 3,
      storageCloses: 2,
    });
  });

  test("Should delete the beekeeper once for concurrent unregisters and serve a sign made meanwhile", async () => {
    await createLifecycleClient();
    const result = await page.evaluate(
      async ({ username, password, keys, txs }) => {
        let sessionEnds = 0;
        await lifecycleClient.setSessionEndCallback(async () => {
          sessionEnds += 1;
        });
        for (const key of keys.slice(0, 2)) {
          await lifecycleClient.register(
            username,
            password,
            key.private,
            key.type as KeyAuthorityType,
          );
        }
        const auth = (
          lifecycleClient as unknown as {
            getAuthInstance: () => {
              unregister: (
                username: string,
                keyType: KeyAuthorityType,
              ) => Promise<void>;
            };
          }
        ).getAuthInstance();
        const [, , signed] = await Promise.all([
          auth.unregister(username, keys[0].type as KeyAuthorityType),
          auth.unregister(username, keys[1].type as KeyAuthorityType),
          lifecycleClient.singleSign(
            username,
            txs[1].digest,
            keys[1].private,
            keys[1].type as KeyAuthorityType,
          ),
        ]);
        return { signed, sessionEnds };
      },
      user,
    );
    expect(result.signed).toBe(user.txs[1].signed);
    expect(result.sessionEnds).toBe(1);
    expect(await queryWasm()).toEqual({
      starts: 2,
      instantiations: 2,
      storageCloses: 1,
    });
  });

  test("Should end the session and start a new beekeeper when deleting the old one fails", async () => {
    await createLifecycleClient();
    await queryWasm({ failStorageWrites: true });
    const result = await page.evaluate(
      async ({ username, password, keys, txs }) => {
        const keyType = keys[0].type as KeyAuthorityType;
        let sessionEnds = 0;
        await lifecycleClient.setSessionEndCallback(async () => {
          sessionEnds += 1;
        });
        await lifecycleClient.register(
          username,
          password,
          keys[0].private,
          keyType,
        );
        const auth = (
          lifecycleClient as unknown as {
            getAuthInstance: () => {
              unregister: (
                username: string,
                keyType: KeyAuthorityType,
              ) => Promise<void>;
            };
          }
        ).getAuthInstance();
        let unregisterError = "unregistered";
        try {
          await auth.unregister(username, keyType);
        } catch (error) {
          unregisterError = (error as Error).message;
        }
        const signed = await lifecycleClient.singleSign(
          username,
          txs[1].digest,
          keys[1].private,
          keys[1].type as KeyAuthorityType,
        );
        return { unregisterError, sessionEnds, signed };
      },
      user,
    );
    expect(result.unregisterError).not.toBe("unregistered");
    expect(result.sessionEnds).toBe(1);
    expect(result.signed).toBe(user.txs[1].signed);
    expect((await queryWasm()).starts).toBe(2);
  });

  test("Should start a new beekeeper after unregister so the user can register again", async () => {
    await createLifecycleClient();
    const signed = await page.evaluate(
      async ({ username, password, keys, txs }) => {
        const keyType = keys[0].type as KeyAuthorityType;
        await lifecycleClient.register(
          username,
          password,
          keys[0].private,
          keyType,
        );
        // unregister is not on the client API, only on the worker's Auth.
        const auth = (
          lifecycleClient as unknown as {
            getAuthInstance: () => {
              unregister: (
                username: string,
                keyType: KeyAuthorityType,
              ) => Promise<void>;
            };
          }
        ).getAuthInstance();
        await auth.unregister(username, keyType);

        await lifecycleClient.register(
          username,
          password,
          keys[0].private,
          keyType,
        );
        return await lifecycleClient.sign(username, txs[0].digest, keyType);
      },
      user,
    );
    expect(signed).toBe(user.txs[0].signed);
    expect(await countWasmInstantiations()).toBe(2);
  });

  test.afterEach(async () => {
    await context.close();
  });

  test.afterAll(async () => {
    await lifecycleBrowser.close();
  });
});
