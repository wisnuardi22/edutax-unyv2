const { defineConfig } = require('@playwright/test');
module.exports = defineConfig({ testDir: './tests/browser', timeout: 90000, workers: 1, use: { baseURL: process.env.TEST_BASE_URL || 'http://localhost:3005', browserName:'chromium', channel:'chrome', headless:true, viewport:{width:1440,height:1000}, screenshot:'only-on-failure' } });
