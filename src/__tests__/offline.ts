import { type ChromiumBrowser, type ConsoleMessage, chromium, type Page, type BrowserContext } from 'playwright';
import { test, expect } from '@playwright/test';

import { type KeyAuthorityType, OfflineClient } from '../../dist/hb-auth';

declare const AuthOfflineClient: typeof OfflineClient;

let browser!: ChromiumBrowser;

const user = {
    username: 'test',
    password: 'banana',
    keys: [
        {
            type: 'posting',
            private: '5JkFnXrLM2ap9t3AmAxBJvQHF7xSKtnTrCTginQCkhzU5S7ecPT',
            public: '5RqVBAVNp5ufMCetQtvLGLJo7unX9nyCBMMrTXRWQ9i1Zzzizh'
        },
        {
            type: 'active',
            private: '5KGKYWMXReJewfj5M29APNMqGEu173DzvHv5TeJAg9SkjUeQV78',
            public: '6oR6ckA4TejTWTjatUdbcS98AKETc3rcnQ9dWxmeNiKDzfhBZa'
        },
    ],
    txs: [
        // posting
        {
            'digest': '390f34297cfcb8fa4b37353431ecbab05b8dc0c9c15fb9ca1a3d510c52177542',
            'signed': '206fef91d06a7fbf0c987b68c6793820c8262232c8b76ab1469c042a1edd07c02761818a108d8faf94d886dd37f351e49b4cb96646eb3665ffd61e881805571d44'
        },
        // active
        {
            'digest': '390f34297cfcb8fa4b37353431ecbab05b8dc0c9c15fb9ca1a3d510c52177542',
            'signed': '1f3345fb4b04cb1b8729ad2f1eca1d707463a0b57cb73000366290a37f3f53311d05394a2ddbf82f854d013b24e20f6e8aa46a8c7d12c1208630654836e7faf504'
        },

    ]
}

test.describe('HB Auth Offline Client base tests', () => {
    let page: Page;
    let authInstance: OfflineClient;
    let browserContext: BrowserContext;

    async function navigate(page: Page): Promise<void> {
        await page.goto(`http://localhost:8080/src/__tests__/assets/offline.html`, { waitUntil: 'load' });
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

    test('Should have global OfflineClient', async () => {
        const offlineClient = await page.evaluate(async () => {
            return typeof AuthOfflineClient;
        });

        expect(offlineClient).toBe(typeof OfflineClient);
    });


    test.skip('Should throw error if there is no worker file found', async () => {
        const err = await page.evaluate(async () => {
            try {
                const instance = new AuthOfflineClient();
                await instance.initialize();
            } catch (error) {
                return true;
            }
        })

        expect(err).toBeTruthy();
    });

    test('Should be able to create new OfflineClient instance', async () => {
        await page.evaluate(async () => {
            authInstance = new AuthOfflineClient({ workerUrl: "/dist/worker.js" });
            await authInstance.initialize();
        })
    });

    test('Should return null if no user registered with given username', async () => {
        const authUser = await page.evaluate(async ({ username }) => {
            return (await authInstance.getAuthByUser(username));
        }, user)

        expect(authUser).toBeFalsy();
    });

    test('Should register new user', async () => {
        const username = await page.evaluate(async ({ username, password, keys }) => {
            await authInstance.register(username, password, keys[0].private, keys[0].type as KeyAuthorityType);
            const authUser = await authInstance.getAuthByUser(username);
            return authUser?.username;
        }, user)

        expect(username).toBe(user.username);
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

    test('Should user login with different authority types', async () => {
        const authorizedKeyType1 = await page.evaluate(async ({ username, password, keys }) => {
            await authInstance.logout();
            await authInstance.authenticate(username, password, keys[0].type as KeyAuthorityType);
            return (await authInstance.getAuthByUser(username))?.keyType;
        }, user)

        expect(authorizedKeyType1).toBe(user.keys[0].type);

        const authorizedKeyType2 = await page.evaluate(async ({ username, password, keys }) => {
            await authInstance.logout();
            await authInstance.authenticate(username, password, keys[1].type as KeyAuthorityType);
            return (await authInstance.getAuthByUser(username))?.keyType;
        }, user)

        expect(authorizedKeyType2).toBe(user.keys[1].type);
    })

    test('Should user session should remain in new tab', async () => {
        const newTab = await browserContext.newPage();
        await navigate(newTab);

        const authorized = await newTab.evaluate(async ({ username }) => {
            // get new instance on new page
            const newAuthInstance = new AuthOfflineClient({ workerUrl: "/dist/worker.js" });
            await newAuthInstance.initialize();
            return (await newAuthInstance.getAuthByUser(username))?.authorized;
        }, user);

        expect(authorized).toBeTruthy();
    });

    test('Should user sign tx and get signed tx back with given key type', async () => {
        const signed1 = await page.evaluate(async ({ username, password, keys, txs }) => {
            await authInstance.logout();
            await authInstance.authenticate(username, password, keys[0].type as KeyAuthorityType);
            const signed = await authInstance.sign(username, txs[0].digest, keys[0].type as KeyAuthorityType)
            return signed
        }, user)

        expect(signed1).toBe(user.txs[0].signed);

        const signed2 = await page.evaluate(async ({ username, password, keys, txs }) => {
            await authInstance.logout();
            await authInstance.authenticate(username, password, keys[1].type as KeyAuthorityType);
            const signed = await authInstance.sign(username, txs[1].digest, keys[1].type as KeyAuthorityType)
            return signed
        }, user)

        expect(signed2).toBe(user.txs[1].signed);
    });

    test('Should user get error when trying to sign with not authorized key', async () => {
        const error = await page.evaluate(async ({ username, password, keys, txs }) => {
            await authInstance.logout();
            await authInstance.authenticate(username, password, keys[1].type as KeyAuthorityType);

            try {
                await authInstance.sign(username, txs[0].digest, keys[0].type as KeyAuthorityType)

            } catch (error) {
                return error.message
            }
        }, user)

        expect(error).toBe('Not authorized, missing authority');
    });

    test.skip('Should user be logged out when session time expires', async ({ page: _page }) => {
        await navigate(_page);
        const loggedIn = await _page.evaluate(async ({ username, password, keys }) => {
            const SESSION_TIME = 10; // 10 seconds
            const instance = new AuthOfflineClient({ sessionTimeout: SESSION_TIME });
            await instance.initialize();
            await instance.register(username, password, keys[1].private, keys[1].type as KeyAuthorityType);
            await _page.waitForTimeout(SESSION_TIME * 1000);
            const user = await instance.getAuthByUser(username);
            return user?.username;
        }, user);

        expect(loggedIn).toBeUndefined();
    });

    test.afterAll(async () => {
        await browser.close();
    });
});

