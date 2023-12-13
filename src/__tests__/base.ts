import { type ChromiumBrowser, type ConsoleMessage, chromium } from 'playwright';
import { test, expect } from '@playwright/test';

import type { OnlineClient } from '../../dist/hb-auth';
declare const auth: typeof OnlineClient;

let browser!: ChromiumBrowser;

test.describe('HB Auth base tests', () => {
    test.beforeAll(async () => {
        browser = await chromium.launch({
            headless: true
        });
    });

    test.beforeEach(async ({ page }) => {
        page.on('console', (msg: ConsoleMessage) => {
            console.log('>>', msg.type(), msg.text())
        });

        await page.goto(`http://localhost:8080/src/__tests__/assets/test.html`);
        await page.waitForURL('**/test.html', { waitUntil: 'load' });
    });

    test('Should test on chromium', async () => {
        const browserType = browser.browserType();

        expect(browserType.name()).toBe('chromium');
    });

    test('Should have a valid html test webpage', async ({ page }) => {
        const id = await page.$eval("body", n => n.getAttribute("id"))

        expect(id).toBe('auth-container');
    });

    test('Should have global module', async ({ page }) => {
        const moduleType = await page.evaluate(() => {
            return typeof auth;
        });

        expect(moduleType).toBe('function');
    });

    test.afterAll(async () => {
        await browser.close();
    });
});