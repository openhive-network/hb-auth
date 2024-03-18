import { type ChromiumBrowser, type ConsoleMessage, chromium, type Page, type BrowserContext } from 'playwright';
import { test, expect } from '@playwright/test';

import { type KeyAuthorityType, OnlineClient } from '../../dist/hb-auth';

declare const AuthOnlineClient: typeof OnlineClient;

let browser!: ChromiumBrowser;

const user = {
    username: process.env.CI_TEST_USER as string,
    password: 'banana',
    keys: [
        {
            type: 'posting',
            private: process.env.CI_TEST_USER_WIF_POSTING as string
        },
        {
            type: 'active',
            private: process.env.CI_TEST_USER_WIF_ACTIVE as string
        },
        {
            type: 'posting',
            private: process.env.CI_TEST_AUTHORITY_USER_WIF_POSTING as string
        }
    ],
    txs: [
        // posting
        {
            'digest': '390f34297cfcb8fa4b37353431ecbab05b8dc0c9c15fb9ca1a3d510c52177542',
            'signed': '1f748f38d9b312ac28e0644ec2cccafd25549cdedb9f862c6b30fa4ded941e9fdd78fe73daa6f01efdf10de55aab2f41762a8ae40c2c935f6a4589228f033f24cc'
        },
        // active
        {
            'digest': '390f34297cfcb8fa4b37353431ecbab05b8dc0c9c15fb9ca1a3d510c52177542',
            'signed': '1f5adcc54c74bcfd1d7382b4e588082ac8d1480031976627902ba59b6817fcccbc55fc7438cdad6e0e81481e82e08e89c92ff2d57c0723f23d43a5c49356a0fb3f'
        },
        // other authority
        {
            'digest': '390f34297cfcb8fa4b37353431ecbab05b8dc0c9c15fb9ca1a3d510c52177542',
            'signed': '207b3b7d17d1056e759891b50165e8c649b8e8499646a7b52ee78032b2753277b24d55f166871c5aff7607d00cfd64b1d0d9b353eee46f343e351b7bef81eb4d34'
        },
    ]
}

test.describe('HB Auth Online Client base tests', () => {
    let page: Page;
    let authInstance: OnlineClient;
    let browserContext: BrowserContext;

    async function navigate(page: Page): Promise<void> {
        await page.goto(`http://localhost:8080/src/__tests__/assets/online.html`, { waitUntil: 'load' });
    }

    test.beforeAll(async () => {
        browser = await chromium.launch({
            headless: true
        });

        browserContext = await browser.newContext();
        page = await browserContext.newPage();
        await navigate(page);
    });

    test.beforeEach(async () => {
        page.on('console', (msg: ConsoleMessage) => {
            console.log('>>', msg.type(), msg.text())
        });
    });

    test('Should test on chromium', async () => {
        const browserType = browser.browserType();

        expect(browserType.name()).toBe('chromium');
    });

    test('Should have a valid html test webpage', async () => {
        const id = await page.$eval("body", n => n.getAttribute("id"))

        expect(id).toBe('auth-container');
    });

    test('Should have global OnlineClient', async () => {
        const onlineClient = await page.evaluate(async () => {
            return typeof AuthOnlineClient;
        });

        expect(onlineClient).toBe(typeof OnlineClient);
    });


    test.skip('Should throw error if there is no worker file found', async () => {
        const err = await page.evaluate(async () => {
            try {
                const instance = new AuthOnlineClient(false);
                await instance.initialize();
            } catch (error) {
                return true;
            }
        })

        expect(err).toBeTruthy();
    });

    test('Should be able to create new OnlineClient instance', async () => {
        await page.evaluate(async () => {
            authInstance = new AuthOnlineClient(false, { workerUrl: "/dist/worker.js", node: "https://api.hive.blog" });
            await authInstance.initialize();
        })
    });

    test('Should return null if no user registered with given username', async () => {
        const authUser = await page.evaluate(async ({ username }) => {
            const authUser = await authInstance.getAuthByUser(username);
            return authUser;
        }, user)

        expect(authUser).toBeNull();
    });

    test('Should handle bad user registration', async () => {
        const error = await page.evaluate(async ({ username, password, keys }) => {
            try {
                await authInstance.register('dummy', password, keys[0].private, keys[0].type as KeyAuthorityType)
            } catch (error) {
                return error.message;
            }
        }, user)

        expect(error).toBe('Invalid credentials');
    });

    test('Should register new user', async () => {
        const registered = await page.evaluate(async ({ username, password, keys }) => {
            const response = await authInstance.register(username, password, keys[0].private, keys[0].type as KeyAuthorityType)
            return response.ok;
        }, user)

        expect(registered).toBeTruthy();
    });

    test('Should second register with same user give an error', async () => {
        const error = await page.evaluate(async ({ username, password, keys }) => {
            try {
                await authInstance.register(username, password, keys[0].private, keys[0].type as KeyAuthorityType);
            } catch (error) {
                return error.message;
            }
        }, user)

        expect(error).toBe(`This user is already registered with 'posting' authority`);
    });

    test('Should logout user on logout() call', async () => {
        const authUser = await page.evaluate(async ({ username }) => {
            await authInstance.logout();
            return (await authInstance.getAuthByUser(username))?.authorized;
        }, user)

        expect(authUser).toBeFalsy();
    });

    test('Should user login with username and password', async () => {
        const authUser = await page.evaluate(async ({ username, password, keys }) => {
            await authInstance.authenticate(username, password, keys[0].type as KeyAuthorityType);
            return (await authInstance.getAuthByUser(username))?.authorized;
        }, user)

        expect(authUser).toBeTruthy();
    })

    test('Should return error if user tries to login while already logged in', async () => {
        const error = await page.evaluate(async ({ username, password, keys }) => {
            try {
                await authInstance.authenticate(username, password, keys[0].type as KeyAuthorityType);
            } catch (error) {
                return error.message;
            }
        }, user)

        expect(error).toBe('User is already logged in');
    })

    test('Should return error if user tries to login with bad authority type', async () => {
        const error = await page.evaluate(async ({ username, password }) => {
            await authInstance.logout();

            try {
                await authInstance.authenticate(username, password, 'active');
            } catch (error) {
                return error.message;
            }
        }, user)

        expect(error).toBe('Not authorized, missing authority');
    });

    test('Should user register/login only with supported authorities active and posting authority', async () => {
        const error = await page.evaluate(async ({ username, password }) => {
            try {
                await authInstance.authenticate(username, password, 'anything' as KeyAuthorityType);
            } catch (error) {
                return error.message;
            }
        }, user)

        expect(error).toBe(`Invalid key type. Only 'active' or 'posting' key supported`);
    });

    test('Should register existing user with another authority type', async () => {
        const username = await page.evaluate(async ({ username, password, keys }) => {
            await authInstance.register(username, password, keys[1].private, keys[1].type as KeyAuthorityType);
            const authUser = await authInstance.getAuthByUser(username);
            return authUser?.username;
        }, user)

        expect(username).toBe(user.username);
    });

    test('Should getAuthByUser return registered key authority types', async () => {
        const types = await page.evaluate(async ({ username }) => {
            const authUser = await authInstance.getAuthByUser(username);
            return authUser?.registeredKeyTypes;
        }, user);

        expect(types?.includes('posting')).toBeTruthy();
        expect(types?.includes('active')).toBeTruthy();
    });

    test('Should user login with different authority types', async () => {
        const authorizedKeyType1 = await page.evaluate(async ({ username, password, keys }) => {
            await authInstance.logout();
            await authInstance.authenticate(username, password, keys[0].type as KeyAuthorityType);
            return (await authInstance.getAuthByUser(username))?.loggedInKeyType;
        }, user)

        expect(authorizedKeyType1).toBe(user.keys[0].type);

        const authorizedKeyType2 = await page.evaluate(async ({ username, password, keys }) => {
            await authInstance.logout();
            await authInstance.authenticate(username, password, keys[1].type as KeyAuthorityType);
            return (await authInstance.getAuthByUser(username))?.loggedInKeyType;
        }, user)

        expect(authorizedKeyType2).toBe(user.keys[1].type);
    })

    test('Should user session should remain in new tab', async () => {
        const newTab = await browserContext.newPage();
        await newTab.goto(`http://localhost:8080/src/__tests__/assets/online.html`, { waitUntil: 'load' });

        const authorized = await newTab.evaluate(async ({ username }) => {
            // get new instance on new page
            const newAuthInstance = new AuthOnlineClient(false, { workerUrl: "/dist/worker.js" });
            await newAuthInstance.initialize();
            return (await newAuthInstance.getAuthByUser(username))?.authorized;
        }, user);

        expect(authorized).toBeTruthy();
    });

    test('Should user sign tx and get signed tx back with selected key type', async () => {
        const signed1 = await page.evaluate(async ({ username, password, keys, txs }) => {
            await authInstance.logout();
            await authInstance.authenticate(username, password, keys[0].type as KeyAuthorityType);
            const signed = await authInstance.sign(username, txs[0].digest, keys[0].type as KeyAuthorityType)
            return signed
        }, user)

        expect(signed1).toBe(user.txs[0].signed);

        const signed2 = await page.evaluate(async ({ username, password, keys, txs }) => {
            const signed = await authInstance.sign(username, txs[1].digest, keys[1].type as KeyAuthorityType)
            return signed
        }, user)

        expect(signed2).toBe(user.txs[1].signed);
    });

    test('Should user get error when trying to sign with not authorized key', async ({page: _page}) => {
        await navigate(_page);
        const error = await _page.evaluate(async ({ username, password, keys, txs }) => {
            const instance = new AuthOnlineClient(false, { workerUrl: "/dist/worker.js" });
            await instance.initialize();
            await instance.register(username, password, keys[1].private, keys[1].type as KeyAuthorityType);

            try {
                await instance.sign(username, txs[0].digest, keys[0].type as KeyAuthorityType)
            } catch (error) {
                return error.message
            } finally {
                await instance.logout();
            }
        }, user);

        expect(error).toBe('Not authorized, missing authority');
    });

    test('Should user be verifed based on own key_auth in strict mode', async () => {
        const newContext = await browser.newContext();
        const newPage = await newContext.newPage();
        await navigate(newPage);
        const error = await newPage.evaluate(async ({ username, password, keys }) => {
            try {
                // strict mode is on
                const instance = new AuthOnlineClient(true, { workerUrl: "/dist/worker.js" });
                await instance.initialize();
                await instance.register(username, password, keys[2].private, keys[2].type as KeyAuthorityType);
            } catch (error) {
                return error.message;
            }
        }, user)

        expect(error).toBe('Invalid credentials');

        // User is authorizied only with own private key in strict mode
        const registered = await newPage.evaluate(async ({ username, password, keys }) => {
            // strict mode is on
            const instance = new AuthOnlineClient(true, { workerUrl: "/dist/worker.js" });
            await instance.initialize();
            const response = await instance.register(username, password, keys[0].private, keys[0].type as KeyAuthorityType);
            return response.ok;
        }, user)

        expect(registered).toBeTruthy();
    });

    test('Should user can login and sign with another account from user\'s authorities', async () => {
        const newContext = await browser.newContext();
        const newPage = await newContext.newPage();
        await navigate(newPage);
        const signed = await newPage.evaluate(async ({ username, password, keys, txs }) => {
            try {
                // strict mode is off
                const instance = new AuthOnlineClient(false, { workerUrl: "/dist/worker.js" });
                await instance.initialize();
                await instance.register(username, password, keys[2].private, keys[2].type as KeyAuthorityType);
                const signed = await instance.sign(username, txs[2].digest, keys[2].type as KeyAuthorityType)
                return signed;
            } catch (error) {
                return error.message;
            }
        }, user)

        expect(signed).toBe(user.txs[2].signed);
    })

    test('Should user able to lock/unlock wallet during user\'s session time', async () => {
        const authorized = await page.evaluate(async ({ username, password, keys }) => {
            await authInstance.logout();
            await authInstance.authenticate(username, password, keys[0].type as KeyAuthorityType);
            await authInstance.lock();
            const authUser = await authInstance.getAuthByUser(username)
            return authUser?.authorized;
        }, user);

        expect(authorized).toBeFalsy();

        const authorizedAfterUnlock = await page.evaluate(async ({ username, password }) => {
            await authInstance.unlock(username, password);
            const authUser = await authInstance.getAuthByUser(username)
            return authUser?.authorized;
        }, user);

        expect(authorizedAfterUnlock).toBeTruthy();
    });

    test('Should user get error when trying to lock wallet if not authenticated', async () => {
        const errorWhileLocking = await page.evaluate(async () => {
            await authInstance.logout();
            try {
                await authInstance.lock();
            } catch (error) {
                return error.message;
            }
        })

        expect(errorWhileLocking).toBe("There is no existing user session or session already expired");
    });

    test.afterAll(async () => {
        await browser.close();
    });
});

