import { chromium } from 'playwright';

const url = process.env.PREVIEW_URL || 'http://127.0.0.1:4173/';
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext();
const page = await context.newPage();
const cdp = await context.newCDPSession(page);

await cdp.send('Debugger.enable');
cdp.on('Debugger.scriptFailedToParse', ev => {
  console.log('SCRIPT_FAILED', JSON.stringify({
    url: ev.url,
    startLine: ev.startLine,
    startColumn: ev.startColumn,
    endLine: ev.endLine,
    endColumn: ev.endColumn,
    executionContextId: ev.executionContextId,
    hash: ev.hash,
    isModule: ev.isModule
  }));
});

page.on('pageerror', e => {
  console.log('PAGEERROR_MESSAGE', e.message);
  console.log('PAGEERROR_STACK', e.stack || 'sin stack');
});
page.on('console', msg => {
  if (msg.type() === 'error') console.log('CONSOLE_ERROR', msg.text());
});

await page.addInitScript(() => {
  window.addEventListener('error', e => {
    console.log('WINDOW_ERROR_LOC', JSON.stringify({
      message: e.message,
      filename: e.filename,
      lineno: e.lineno,
      colno: e.colno
    }));
  });
});

await page.goto(url + '?syntax=' + Date.now(), { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(2500);
await browser.close();
