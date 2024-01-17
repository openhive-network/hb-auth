import { type ChromiumBrowser, type ConsoleMessage, chromium, Page, BrowserContext } from 'playwright';
import { test, expect } from '@playwright/test';

import { KeyAuthorityType, OfflineClient } from '../../dist/hb-auth';

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
}

test.describe('HB Auth Offline Client base tests', () => {
    let page: Page;
    let authInstance: OfflineClient;
    let browserContext: BrowserContext;

    test.beforeAll(async () => {
        browser = await chromium.launch({
            headless: true
        });

        browserContext = await browser.newContext();
        page = await browserContext.newPage();
        await page.goto(`http://localhost:8080/src/__tests__/assets/offline.html`);
        await page.waitForURL('**/offline.html', { waitUntil: 'load' });
    });

    test.beforeEach(async ({ page }) => {
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

    // TODO: Fix random fail here Not authorized, missing authority??
    test('Should user login with username and password', async () => {
        const authUser = await page.evaluate(async ({ username, password, keys }) => {
            await authInstance.authenticate(username, password, keys[0].type as KeyAuthorityType);
            return (await authInstance.getAuthByUser(username))?.authorized;
        }, user)

        expect(authUser).toBeTruthy();
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
        await newTab.goto(`http://localhost:8080/src/__tests__/assets/offline.html`);
        await newTab.waitForURL('**/offline.html', { waitUntil: 'load' });
        
        const authorized = await newTab.evaluate(async ({ username }) => {
            // get new instance on new page
            const newAuthInstance = new AuthOfflineClient({ workerUrl: "/dist/worker.js" });
            await newAuthInstance.initialize();
            return (await newAuthInstance.getAuthByUser(username))?.authorized;
        }, user);

        expect(authorized).toBeTruthy();
    });

    test.afterAll(async () => {
        await browser.close();
    });
});
