import {
  type ChromiumBrowser,
  type ConsoleMessage,
  chromium,
  type Page,
  type BrowserContext,
} from "playwright";
import { test, expect } from "@playwright/test";

import { type KeyAuthorityType, OnlineClient } from "../../dist/hb-auth";

declare const AuthOnlineClient: typeof OnlineClient;

let browser!: ChromiumBrowser;

const user = {
  username: process.env.CI_TEST_USER as string,
  authorityUsername: process.env.CI_TEST_AUTHORITY_USER as string,
  password: "banana",
  keys: [
    {
      type: "posting",
      private: process.env.CI_TEST_USER_WIF_POSTING as string,
    },
    {
      type: "active",
      private: process.env.CI_TEST_USER_WIF_ACTIVE as string,
    },
    {
      type: "posting",
      private: process.env.CI_TEST_AUTHORITY_USER_WIF_POSTING as string,
    },
  ],
  txs: [
    // posting
    {
      digest:
        "390f34297cfcb8fa4b37353431ecbab05b8dc0c9c15fb9ca1a3d510c52177542",
      signed:
        "1f60e75daee9ef327977690deb3aa6ad30e54cd813201ccad277d56b1c9e10479d31c3a1d082bdb5ef9402cecca7843ad665a09975ad46af4c80751ff497922eb3",
    },
    // active
    {
      digest:
        "390f34297cfcb8fa4b37353431ecbab05b8dc0c9c15fb9ca1a3d510c52177542",
      signed:
        "20371ef042a702b72274a6929ad3be2ad60816cc4c5dd9514b690384b11deb6d6438d78967f938adc7172879ad02af0660a62b47b13e47d1807457b5ff58e37d3e",
    },
    // other authority
    {
      digest:
        "390f34297cfcb8fa4b37353431ecbab05b8dc0c9c15fb9ca1a3d510c52177542",
      signed:
        "20a11af04841840e5bc3ddc6a451ab9bb2f3e5351615178acb127b176dc254886b353912011da4e612671cc18e9b126ae22bc662938e3f8b218ad65fb89d14e3c9",
    },
  ],
};

test.describe("HB Auth Online Client base tests", () => {
  let page: Page;
  let authInstance: OnlineClient;
  let browserContext: BrowserContext;

  async function navigate(page: Page): Promise<void> {
    await page.goto(`http://localhost:8080/src/__tests__/assets/online.html`, {
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

  test("Should have global OnlineClient", async () => {
    const onlineClient = await page.evaluate(async () => {
      return typeof AuthOnlineClient;
    });

    expect(onlineClient).toBe(typeof OnlineClient);
  });

  test.skip("Should throw error if there is no worker file found", async () => {
    const err = await page.evaluate(async () => {
      try {
        const instance = new AuthOnlineClient();
        await instance.initialize();
      } catch (error) {
        return true;
      }
    });

    expect(err).toBeTruthy();
  });

  test("Should be able to create new OnlineClient instance", async () => {
    await page.evaluate(async () => {
      authInstance = new AuthOnlineClient({
        workerUrl: "/dist/worker.js",
        node: "https://api.hive.blog",
      });
      await authInstance.initialize();
    });
  });

  test("Should return null if no user registered with given username", async () => {
    const authUser = await page.evaluate(async ({ username }) => {
      const authUser = await authInstance.getAuthByUser(username);
      return authUser;
    }, user);

    expect(authUser).toBeNull();
  });

  test("Should handle bad user registration", async () => {
    const error = await page.evaluate(async ({ username, password, keys }) => {
      try {
        await authInstance.register(
          "dummy",
          password,
          keys[0].private,
          keys[0].type as KeyAuthorityType,
        );
      } catch (error) {
        return error.message;
      }
    }, user);

    expect(error).toBe("Invalid credentials");
  });

  test("Should register new user", async () => {
    const registered = await page.evaluate(
      async ({ username, password, keys }) => {
        const response = await authInstance.register(
          username,
          password,
          keys[0].private,
          keys[0].type as KeyAuthorityType,
        );
        return response.ok;
      },
      user,
    );

    expect(registered).toBeTruthy();
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
        return error.message;
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
        await authInstance.logout(username);

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
        return error.message;
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
        return error.message;
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
        return error.message;
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
        return error.message;
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
    await newTab.goto(
      `http://localhost:8080/src/__tests__/assets/online.html`,
      { waitUntil: "load" },
    );

    const authorized = await newTab.evaluate(async ({ username }) => {
      // get new instance on new page
      const newAuthInstance = new AuthOnlineClient({
        workerUrl: "/dist/worker.js",
      });
      await newAuthInstance.initialize();
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
        const instance = new AuthOnlineClient({
          workerUrl: "/dist/worker.js",
        });
        await instance.initialize();
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
          return error.message;
        } finally {
          await instance.logout(username);
        }
      },
      user,
    );

    expect(error).toBe("Not authorized, missing authority");
  });

  test("Should user be verifed based on own key_auth in strict mode", async () => {
    const newContext = await browser.newContext();
    const newPage = await newContext.newPage();
    await navigate(newPage);

    // First register with strict mode true
    const error = await newPage.evaluate(
      async ({ username, password, keys }) => {
        try {
          const instance = new AuthOnlineClient({
            workerUrl: "/dist/worker.js",
          });
          await instance.initialize();
          await instance.register(
            username,
            password,
            keys[2].private,
            keys[2].type as KeyAuthorityType,
            true, // strict mode
          );
        } catch (error) {
          return error.message;
        }
      },
      user,
    );

    expect(error).toBe("Invalid credentials");

    // User is authorized only with own private key in strict mode
    const registered = await newPage.evaluate(
      async ({ username, password, keys }) => {
        const instance = new AuthOnlineClient({
          workerUrl: "/dist/worker.js",
        });
        await instance.initialize();
        const response = await instance.register(
          username,
          password,
          keys[0].private,
          keys[0].type as KeyAuthorityType,
          true, // strict mode
        );
        return response.ok;
      },
      user,
    );

    expect(registered).toBeTruthy();
  });

  test("Should user can login and sign with another account from user's authorities", async () => {
    const newContext = await browser.newContext();
    const newPage = await newContext.newPage();
    await navigate(newPage);
    const signed = await newPage.evaluate(
      async ({ username, password, keys, txs }) => {
        try {
          // strict mode is off
          const strictMode = false;
          const instance = new AuthOnlineClient({
            workerUrl: "/dist/worker.js",
          });
          await instance.initialize();
          await instance.register(
            username,
            password,
            keys[2].private,
            keys[2].type as KeyAuthorityType,
            strictMode,
          );
          const signed = await instance.sign(
            username,
            txs[2].digest,
            keys[2].type as KeyAuthorityType,
          );
          return signed;
        } catch (error) {
          return error.message;
        }
      },
      user,
    );

    expect(signed).toBe(user.txs[2].signed);
  });

  test("Should user able to import key after login or unlock", async ({
    page: _page,
  }) => {
    await navigate(_page);
    const singnedWithNewKey = await _page.evaluate(
      async ({ username, password, keys, txs }) => {
        const instance = new AuthOnlineClient({
          workerUrl: "/dist/worker.js",
        });
        await instance.initialize();
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
        return error.message;
      }
    });

    expect(errorWhileLocking).toBe(
      "There is no existing user session or session already expired",
    );
  });

  test("Should allow actions with another authority when strict mode is off", async () => {
    const newContext = await browser.newContext();
    const newPage = await newContext.newPage();
    await navigate(newPage);

    const authorityUsername = await newPage.evaluate(
      async ({ username, password, keys, txs }) => {
        try {
          const instance = new AuthOnlineClient({
            workerUrl: "/dist/worker.js",
          });
          await instance.initialize();
          await instance.register(
            username,
            password,
            keys[2].private,
            keys[2].type as KeyAuthorityType,
            false, // strict mode off
          );
          await instance.sign(
            username,
            txs[2].digest,
            keys[2].type as KeyAuthorityType,
          );
          return (await instance.getUserSettings(username))
            ?.authorizedAccounts?.[keys[2].type as KeyAuthorityType];
        } catch (error) {
          return error.message;
        }
      },
      user,
    );

    expect(authorityUsername).toBe(user.authorityUsername);
  });

  test("Should allow singleSign without any prior registration", async ({
    page: _page,
  }) => {
    await navigate(_page);

    const signed = await _page.evaluate(async ({ username, keys, txs }) => {
      const instance = new AuthOnlineClient({
        workerUrl: "/dist/worker.js",
      });
      await instance.initialize();
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
      const instance = new AuthOnlineClient({
        workerUrl: "/dist/worker.js",
      });
      await instance.initialize();
      await instance.register(
        username,
        password,
        keys[0].private,
        keys[0].type as KeyAuthorityType,
      );
    }, user);

    // Try singleSign with active key (not registered)
    const signed = await page.evaluate(async ({ username, keys, txs }) => {
      const instance = new AuthOnlineClient({
        workerUrl: "/dist/worker.js",
      });
      await instance.initialize();
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

  test("Should allow different users to authenticate simultaneously", async () => {
    const newContext = await browser.newContext();
    const newPage = await newContext.newPage();
    await navigate(newPage);

    // First user authentication
    await newPage.evaluate(async ({ username, password, keys }) => {
      const instance = new AuthOnlineClient({
        workerUrl: "/dist/worker.js",
      });
      await instance.initialize();
      await instance.register(
        username,
        password,
        keys[0].private,
        keys[0].type as KeyAuthorityType,
      );
    }, user);

    // Second user authentication
    const secondUserAuth = await newPage.evaluate(
      async ({ authorityUsername, password, keys }) => {
        const instance = new AuthOnlineClient({
          workerUrl: "/dist/worker.js",
        });
        await instance.initialize();
        try {
          await instance.register(
            authorityUsername,
            password,
            keys[2].private,
            keys[2].type as KeyAuthorityType,
          );
          return true;
        } catch (error) {
          return error.message;
        }
      },
      user,
    );

    expect(secondUserAuth).toBe(true);
  });

  test("Should allow same user to authenticate with different key types", async () => {
    const newContext = await browser.newContext();
    const newPage = await newContext.newPage();
    await navigate(newPage);

    // First register and authenticate with posting key
    await newPage.evaluate(async ({ username, password, keys }) => {
      const instance = new AuthOnlineClient({
        workerUrl: "/dist/worker.js",
      });
      await instance.initialize();
      await instance.register(
        username,
        password,
        keys[0].private,
        keys[0].type as KeyAuthorityType,
      );
      await instance.authenticate(
        username,
        password,
        keys[0].type as KeyAuthorityType,
      );
    }, user);

    // Then register and authenticate with active key
    const activeAuth = await newPage.evaluate(
      async ({ username, password, keys }) => {
        const instance = new AuthOnlineClient({
          workerUrl: "/dist/worker.js",
        });
        await instance.initialize();
        try {
          // First register the active key
          await instance.register(
            username,
            password,
            keys[1].private,
            keys[1].type as KeyAuthorityType,
          );
          // Then authenticate with it
          await instance.authenticate(
            username,
            password,
            keys[1].type as KeyAuthorityType,
          );
          const authUser = await instance.getAuthByUser(username);
          return authUser?.loggedInKeyType;
        } catch (error) {
          return error.message;
        }
      },
      user,
    );

    expect(activeAuth).toBe("active");
  });

  test("Should logout specific user while keeping others authenticated", async () => {
    const newContext = await browser.newContext();
    const newPage = await newContext.newPage();
    await navigate(newPage);

    // Setup two authenticated users with state verification
    const userStates = await newPage.evaluate(
      async ({ authorityUsername, username, password, keys }) => {
        const instance = new AuthOnlineClient({
          workerUrl: "/dist/worker.js",
        });
        await instance.initialize();

        // Register and authenticate first user
        await instance.register(username, password, keys[0].private, "posting");
        await instance.authenticate(username, password, "posting");

        // Register and authenticate second user
        await instance.register(
          authorityUsername,
          password,
          keys[2].private,
          keys[2].type as KeyAuthorityType,
        );
        await instance.authenticate(
          authorityUsername,
          password,
          keys[2].type as KeyAuthorityType,
        );
        const user2State = await instance.getAuthByUser(authorityUsername);

        await instance.logout(username);

        const user1State = await instance.getAuthByUser(username);

        return {
          user1: user1State,
          user2: user2State,
        };
      },
      user,
    );

    expect(userStates.user1).toBeNull();
    expect(userStates.user2?.authorized).toBe(true);
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

  test("Should getRegisteredUsers show multiple registered users", async () => {
    const userStates = await page.evaluate(
      async ({ username, authorityUsername, password, keys }) => {
        // Register second user
        await authInstance.register(
          authorityUsername,
          password,
          keys[2].private,
          keys[2].type as KeyAuthorityType,
        );

        const registeredUsers = await authInstance.getRegisteredUsers();
        return {
          count: registeredUsers.length,
          users: registeredUsers.map((u) => u.username),
        };
      },
      user,
    );

    expect(userStates.count).toBe(2);
    expect(userStates.users).toContain(user.username);
    expect(userStates.users).toContain(user.authorityUsername);
  });

  test.afterAll(async () => {
    await browser.close();
  });
});
