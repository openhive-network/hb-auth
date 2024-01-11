import { type ChromiumBrowser, type ConsoleMessage, chromium } from 'playwright';
import { test, expect } from '@playwright/test';

import { OfflineClient } from '../../dist/hb-auth';

declare const AuthOfflineClient: typeof OfflineClient;

let browser!: ChromiumBrowser;

test.describe('HB Auth Offline Client base tests', () => {
    test.beforeAll(async () => {
        browser = await chromium.launch({
            headless: true
        });
    });

    test.beforeEach(async ({ page }) => {
        page.on('console', (msg: ConsoleMessage) => {
            console.log('>>', msg.type(), msg.text())
        });

        await page.goto(`http://localhost:8080/src/__tests__/assets/offline.html`);
        await page.waitForURL('**/offline.html', { waitUntil: 'load' });
    });

    test('Should test on chromium', async () => {
        const browserType = browser.browserType();

        expect(browserType.name()).toBe('chromium');
    });

    test('Should have a valid html test webpage', async ({ page }) => {
        const id = await page.$eval("body", n => n.getAttribute("id"))

        expect(id).toBe('auth-container');
    });

    test('Should have global OfflineClient', async ({ page }) => {
        const offlineClient = await page.evaluate(async () => {
            return typeof AuthOfflineClient;
        });

        expect(offlineClient).toBe(typeof OfflineClient);
    });


    test.skip('Should throw error if there is no worker file found', async ({ page }) => {
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

    test('Should be able to create new OfflineClient instance', async ({ page }) => {
        await page.evaluate(async () => {
            const instance = new AuthOfflineClient({ workerUrl: "/dist/worker.js" });
            await instance.initialize();
        })
    });

    test.afterAll(async () => {
        await browser.close();
    });
});

