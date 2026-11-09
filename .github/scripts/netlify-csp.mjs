const PROD_SUPABASE = 'https://flqercbgpgmmfaakrwkc.supabase.co';
const QA_SUPABASE = 'https://qjqorixtkilwsndqayyx.supabase.co';

function websocketOrigin(httpOrigin) {
  return httpOrigin.replace(/^https:/, 'wss:');
}

export function supabaseConnectSrc(context) {
  // Only the exact Netlify production context may reach production. Unknown
  // or local contexts fail closed to QA, never to the live database.
  const httpOrigin = context === 'production' ? PROD_SUPABASE : QA_SUPABASE;
  return `'self' ${httpOrigin} ${websocketOrigin(httpOrigin)}`;
}

export function renderHeadersForContext(headers, context) {
  const rendered = headers.replace(
    /connect-src\s+[^;]+;/,
    `connect-src ${supabaseConnectSrc(context)};`,
  );
  if (rendered === headers) {
    throw new Error('CSP_CONNECT_SRC_NOT_FOUND');
  }
  return rendered;
}
