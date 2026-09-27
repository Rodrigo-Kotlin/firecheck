const expectedRef = 'sgweagncrygneelvebap';
const expectedUrl = `https://${expectedRef}.supabase.co`;

if (process.env.CF_PAGES !== '1') {
  console.log('[build-check] Cloudflare Pages environment not detected; skipped.');
  process.exit(0);
}

const url = process.env.VITE_SUPABASE_URL?.replace(/\/$/, '');
const anonKey = process.env.VITE_SUPABASE_ANON_KEY;

if (url !== expectedUrl || !anonKey) {
  throw new Error('[build-check] Cloudflare Pages requires the professional Supabase configuration.');
}

function decodePayload(token) {
  const payload = token.split('.')[1];
  if (!payload) return null;
  const normalized = payload.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(payload.length / 4) * 4, '=');
  return JSON.parse(Buffer.from(normalized, 'base64').toString('utf8'));
}

let claims;
try {
  claims = decodePayload(anonKey);
} catch {
  claims = null;
}

if (claims?.ref !== expectedRef || claims?.role !== 'anon') {
  throw new Error('[build-check] VITE_SUPABASE_ANON_KEY must be an anon key for the professional project.');
}

console.log('[build-check] Cloudflare Pages Supabase configuration verified.');
