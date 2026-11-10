import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { renderHeadersForContext, supabaseConnectSrc } from '../../.github/scripts/netlify-csp.mjs';

const template = await readFile('_headers', 'utf8');
const prod = renderHeadersForContext(template, 'production');
const preview = renderHeadersForContext(template, 'deploy-preview');
const unknown = renderHeadersForContext(template, 'unexpected-context');

const prodHttp = 'https://flqercbgpgmmfaakrwkc.supabase.co';
const prodWs = 'wss://flqercbgpgmmfaakrwkc.supabase.co';
const qaHttp = 'https://qjqorixtkilwsndqayyx.supabase.co';
const qaWs = 'wss://qjqorixtkilwsndqayyx.supabase.co';

assert.equal(supabaseConnectSrc('production'), `'self' ${prodHttp} ${prodWs}`);
assert.match(prod, new RegExp(`connect-src 'self' ${prodHttp} ${prodWs};`));
assert.doesNotMatch(prod, new RegExp(`${qaHttp}|${qaWs}`));

assert.match(preview, new RegExp(`connect-src 'self' ${qaHttp} ${qaWs};`));
assert.doesNotMatch(preview, new RegExp(`${prodHttp}|${prodWs}`));
assert.equal(unknown, preview, 'unknown contexts must fail closed to QA');

for (const headers of [prod, preview]) {
  assert.match(headers, /script-src 'self'/);
  assert.match(headers, /frame-ancestors 'none'/);
  assert.match(headers, /X-Content-Type-Options: nosniff/);
  assert.match(headers, /Referrer-Policy: strict-origin-when-cross-origin/);
}

console.log('m02-csp-environment-contract: OK');
