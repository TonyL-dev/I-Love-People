import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: 'frontend/e2e',
  fullyParallel: true,
  workers: 2,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: 'list',
  use: {
    baseURL: 'http://127.0.0.1:5173',
    trace: 'retain-on-failure',
    launchOptions: process.env.ILP_BROWSER_EXECUTABLE
      ? { executablePath: process.env.ILP_BROWSER_EXECUTABLE }
      : {},
  },
  webServer: [
    {
      command: 'node node_modules/vite/bin/vite.js --host 127.0.0.1',
      url: 'http://127.0.0.1:5173',
      reuseExistingServer: !process.env.CI,
    },
    {
      command:
        'node node_modules/vite/bin/vite.js build --outDir artifacts/local/worker-build && node node_modules/vite/bin/vite.js preview --outDir artifacts/local/worker-build --host 127.0.0.1 --port 4174 --strictPort',
      url: 'http://127.0.0.1:4174',
      reuseExistingServer: !process.env.CI,
    },
  ],
});
