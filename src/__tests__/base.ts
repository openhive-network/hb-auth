import { type ChromiumBrowser, type ConsoleMessage, chromium, Page } from 'playwright';
import { test, expect } from '@playwright/test';

import { KeyAuthorityType, OfflineClient } from '../../dist/hb-auth';

declare const AuthOfflineClient: typeof OfflineClient;

let browser!: ChromiumBrowser;

const user = {
    username: 'test',
    password: 'banana',
    keyPair: [
        '5JkFnXrLM2ap9t3AmAxBJvQHF7xSKtnTrCTginQCkhzU5S7ecPT',
        '5RqVBAVNp5ufMCetQtvLGLJo7unX9nyCBMMrTXRWQ9i1Zzzizh'
    ],
    keyType: 'posting'
}

test.describe('HB Auth Offline Client base tests', () => {
    let page: Page;
    let authInstance: OfflineClient;

    test.beforeAll(async () => {
        browser = await chromium.launch({
            headless: true
        });

        const context = await browser.newContext();
        page = await context.newPage();
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
        const username = await page.evaluate(async ({ username, password, keyPair, keyType }) => {
            await authInstance.register(username, password, keyPair[0], keyType as KeyAuthorityType);
            const authUser = await authInstance.getAuthByUser(username);
            return authUser?.username;
        }, user)

        expect(username).toBe(user.username);
    });

    test('Should second register with same user give an error', async () => {
        const error = await page.evaluate(async ({ username, password, keyPair, keyType }) => {
            try {
                await authInstance.register(username, password, keyPair[0], keyType as KeyAuthorityType);
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

    test.afterAll(async () => {
        await browser.close();
    });
});

