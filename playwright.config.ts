// This is a workaround for https://github.com/microsoft/playwright/issues/18282#issuecomment-1612266345
import { defineConfig } from '@playwright/test';
import dotenv from 'dotenv';

dotenv.config();

export default defineConfig({
    reporter: [
        ['junit', { outputFile: 'results.xml' }],
        ['json', { outputFile: 'results.json' }]
    ],
    projects: [
        {
            name: "hbauth_testsuite",
            testDir: "./src/__tests__/"
        }
    ],
    // Run your local dev server before starting the tests
    webServer: {
        command: 'npx http-server',
        url: 'http://localhost:8080',
    }
});

