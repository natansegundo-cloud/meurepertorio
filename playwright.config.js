module.exports = {
  testDir: './tests',
  timeout: 30000,
  use: { baseURL: 'http://127.0.0.1:4173', viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, launchOptions: { executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe' } },
  webServer: { command: 'node tests/static-server.js', port: 4173, reuseExistingServer: true }
};
