import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
    testDir: './tests/ui',
    outputDir: './.cache/ui-results',
    fullyParallel: true,
    workers: 2,
    retries: 0,
    timeout: 30_000,
    reporter: [['list'], ['html', { outputFolder: '.cache/ui-report', open: 'never' }]],
    use: {
        baseURL: 'http://127.0.0.1:4321',
        screenshot: 'only-on-failure',
        trace: 'retain-on-failure',
    },
    webServer: {
        command: 'node tests/ui/serve.mjs',
        url: 'http://127.0.0.1:4321',
        reuseExistingServer: false,
    },
    projects: [
        { name: 'desktop-firefox', use: { browserName: 'firefox', viewport: { width: 1440, height: 1000 } } },
        { name: 'desktop-chromium', use: { browserName: 'chromium', viewport: { width: 1440, height: 1000 } } },
        { name: 'small-mobile-chromium', use: { browserName: 'chromium', viewport: { width: 320, height: 568 }, isMobile: true, hasTouch: true } },
        { name: 'android-chromium', use: { ...devices['Pixel 7'] } },
        { name: 'iphone-webkit', use: { ...devices['iPhone 13'] } },
        { name: 'tablet-webkit', use: { browserName: 'webkit', viewport: { width: 768, height: 1024 }, hasTouch: true } },
    ],
});
