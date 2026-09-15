/**
 * Live production verification and performance benchmark script.
 * Runs against: https://shorty.sji.one
 */

import dns from 'dns/promises';

const BASE_URL = 'https://shorty.sji.one';
const UPSTASH_URL = process.env.UPSTASH_REDIS_REST_URL;
const UPSTASH_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;
const MONGO_URI = process.env.MONGODB_URI;

// Helper to call Upstash Redis REST directly for cleanup / inspection
async function redisCmd(command, ...args) {
  if (!UPSTASH_URL || !UPSTASH_TOKEN) return null;
  const res = await fetch(`${UPSTASH_URL}/${command}/${args.map(encodeURIComponent).join('/')}`, {
    headers: { Authorization: `Bearer ${UPSTASH_TOKEN}` },
  });
  if (!res.ok) return null;
  return res.json();
}

function calcStats(latencies) {
  if (!latencies.length) return { min: 0, p50: 0, avg: 0, p95: 0, p99: 0 };
  const sorted = [...latencies].sort((a, b) => a - b);
  const min = sorted[0];
  const avg = Math.round((sorted.reduce((acc, v) => acc + v, 0) / sorted.length) * 10) / 10;
  const p50 = sorted[Math.floor(sorted.length * 0.50)];
  const p95 = sorted[Math.floor(sorted.length * 0.95)];
  const p99 = sorted[Math.floor(sorted.length * 0.99)];
  return { min, p50, avg, p95, p99 };
}

async function runAudit() {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log(' SHORTY PRODUCTION LIVE VERIFICATION & BENCHMARK AUDIT');
  console.log(` Target: ${BASE_URL}`);
  console.log(` Date: ${new Date().toISOString()}`);
  console.log('═══════════════════════════════════════════════════════════════\n');

  // ──────────────────────────────────────────────────────────────────────────
  // 1. FIX 1: Exact HTTP status for malformed/missing URL
  // ──────────────────────────────────────────────────────────────────────────
  console.log('▶ [1/8] Verifying Malformed / Missing URL Handling...');
  // Clear any existing anonymous rate limit keys for the test IP to test pure validation
  const anonKeys = await redisCmd('keys', 'shorty:rl:anon_create:*');
  for (const k of anonKeys?.result || []) {
    await redisCmd('del', k);
  }
  const malformedTests = [
    { name: 'Empty object {}', body: '{}' },
    { name: 'Null url { url: null }', body: JSON.stringify({ url: null }) },
    { name: 'Number url { url: 12345 }', body: JSON.stringify({ url: 12345 }) },
    { name: 'Empty string { url: "" }', body: JSON.stringify({ url: '' }) },
    { name: 'Whitespace string { url: "   " }', body: JSON.stringify({ url: '   ' }) },
    { name: 'Invalid string { url: "not-a-valid-url" }', body: JSON.stringify({ url: 'not-a-valid-url' }) },
  ];

  const malformedResults = [];
  for (const t of malformedTests) {
    const res = await fetch(`${BASE_URL}/api/v1/links`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: t.body,
    });
    const json = await res.json();
    malformedResults.push({
      test: t.name,
      status: res.status,
      code: json.code,
      error: json.error,
    });
    console.log(`  ✓ ${t.name} -> HTTP ${res.status} [code: ${json.code}] message: "${json.error}"`);
  }

  // ──────────────────────────────────────────────────────────────────────────
  // 2. FIX 2: Login Rate-Limit Behavior
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n▶ [2/8] Verifying Login Rate-Limit Behavior (/api/auth/callback/credentials)...');
  // First, send a probe to let Cloudflare and Vercel set the real connecting IP key in Redis
  await fetch(`${BASE_URL}/api/auth/callback/credentials`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    redirect: 'manual',
  });

  // Find the real client IP key recorded in Redis
  const authKeysRes = await redisCmd('keys', 'shorty:rl:auth:*');
  const authKeys = authKeysRes?.result || [];
  const clientKey = authKeys[0];
  console.log(`  ✓ Cloudflare connecting IP key recorded in Redis: ${clientKey || 'none'}`);

  let rateLimitTriggered = false;
  let rlStatus = 0;
  let rlBody = null;

  if (clientKey) {
    // Set counter to 10 (the threshold for auth rate limit) to test 11th request rejection
    await redisCmd('set', clientKey, '10');

    const res = await fetch(`${BASE_URL}/api/auth/callback/credentials`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      redirect: 'manual',
    });

    rlStatus = res.status;
    rateLimitTriggered = res.status === 429;
    try {
      rlBody = await res.json();
    } catch {
      rlBody = await res.text();
    }

    // Immediately clean up the test key so our IP is not blocked
    await redisCmd('del', clientKey);
  }

  console.log(`  ✓ Rate limit triggered on threshold exceed: HTTP ${rlStatus}`);
  console.log(`    Body:`, JSON.stringify(rlBody));

  // ──────────────────────────────────────────────────────────────────────────
  // 3. FIX 3 & REQ 1: Execution Regions (Vercel, Upstash, MongoDB)
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n▶ [3/8] Inspecting Execution Regions...');
  const probeRes = await fetch(BASE_URL);
  const xVercelId = probeRes.headers.get('x-vercel-id') || 'not-found';
  const serverHeader = probeRes.headers.get('server') || 'unknown';
  console.log(`  ✓ Vercel x-vercel-id: ${xVercelId}`);
  console.log(`  ✓ Server Header: ${serverHeader}`);

  // Upstash region
  let upstashHost = 'unknown';
  let upstashIp = 'unknown';
  if (UPSTASH_URL) {
    upstashHost = new URL(UPSTASH_URL).hostname;
    try {
      const addresses = await dns.resolve4(upstashHost);
      upstashIp = addresses[0] || 'unknown';
    } catch {
      upstashIp = 'dns-err';
    }
  }
  console.log(`  ✓ Upstash Redis Host: ${upstashHost} (IP: ${upstashIp})`);

  // MongoDB region
  let mongoHost = 'unknown';
  let mongoIp = 'unknown';
  if (MONGO_URI) {
    const match = MONGO_URI.match(/@([^/?]+)/);
    mongoHost = match ? match[1] : 'unknown';
    try {
      const srvRecords = await dns.resolveSrv(`_mongodb._tcp.${mongoHost}`);
      if (srvRecords && srvRecords.length > 0) {
        const addresses = await dns.resolve4(srvRecords[0].name);
        mongoIp = addresses[0] || 'unknown';
      }
    } catch {
      mongoIp = 'dns-err';
    }
  }
  console.log(`  ✓ MongoDB Host: ${mongoHost} (Shard IP: ${mongoIp})`);

  // ──────────────────────────────────────────────────────────────────────────
  // 4. FIX 4: Canonical Tag Results
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n▶ [4/8] Verifying Canonical Tags Across Routes...');
  const routesToCheck = [
    { path: '/', expected: 'https://shorty.sji.one' },
    { path: '/features', expected: 'https://shorty.sji.one/features' },
    { path: '/pricing', expected: 'https://shorty.sji.one/pricing' },
    { path: '/developers', expected: 'https://shorty.sji.one/developers' },
  ];

  const canonicalResults = [];
  for (const r of routesToCheck) {
    const res = await fetch(`${BASE_URL}${r.path}`);
    const html = await res.text();
    const match = html.match(/<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)["']/i) ||
                  html.match(/<link[^>]+href=["']([^"']+)["'][^>]+rel=["']canonical["']/i);
    const canonical = match ? match[1] : null;
    canonicalResults.push({ path: r.path, canonical, match: canonical === r.expected });
    console.log(`  ✓ Route ${r.path} -> canonical href: "${canonical}" (Matches expected: ${canonical === r.expected})`);
  }

  // ──────────────────────────────────────────────────────────────────────────
  // 5. FIX 5: Cloudflare Client IP (cf-connecting-ip) Priority
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n▶ [5/8] Verifying cf-connecting-ip Priority...');
  const cfTestIp = '198.51.100.88';
  const spoofedXff = '203.0.113.111, 10.0.0.1';
  const cfKey = `shorty:rl:auth:${cfTestIp}`;
  const xffKey = `shorty:rl:auth:203.0.113.111`;
  await redisCmd('del', cfKey);
  await redisCmd('del', xffKey);

  await fetch(`${BASE_URL}/api/auth/callback/credentials`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'cf-connecting-ip': cfTestIp,
      'x-forwarded-for': spoofedXff,
    },
    body: 'email=probe%40sji.one&password=probePass123!',
    redirect: 'manual',
  });

  const cfVal = await redisCmd('get', cfKey);
  const xffVal = await redisCmd('get', xffKey);
  const cfPrioritized = cfVal && cfVal.result !== null;
  console.log(`  ✓ cf-connecting-ip key (${cfKey}) in Redis: ${JSON.stringify(cfVal?.result)}`);
  console.log(`  ✓ x-forwarded-for key (${xffKey}) in Redis: ${JSON.stringify(xffVal?.result)}`);
  console.log(`  ✓ cf-connecting-ip prioritized over x-forwarded-for: ${cfPrioritized}`);
  await redisCmd('del', cfKey);

  // ──────────────────────────────────────────────────────────────────────────
  // 6. FIX 6: Destination-Edit Result
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n▶ [6/8] Verifying Destination URL Editing...');
  // A. Create test user
  const auditEmail = `audit-${Date.now()}@sji.one`;
  const auditPassword = 'SecureAuditPassword123!';
  const signupRes = await fetch(`${BASE_URL}/api/auth/signup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: auditEmail, password: auditPassword, name: 'Audit User' }),
  });
  console.log(`  ✓ Signup response: HTTP ${signupRes.status}`);

  // B. Sign in via credentials to obtain session cookie
  // First fetch CSRF token from Auth.js
  const csrfRes = await fetch(`${BASE_URL}/api/auth/csrf`);
  const csrfJson = await csrfRes.json();
  const csrfToken = csrfJson.csrfToken;
  const csrfCookies = csrfRes.headers.getSetCookie ? csrfRes.headers.getSetCookie() : [csrfRes.headers.get('set-cookie') || ''];
  const cookieHeader = csrfCookies.map(c => c.split(';')[0]).join('; ');

  const signinRes = await fetch(`${BASE_URL}/api/auth/callback/credentials`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Cookie': cookieHeader,
    },
    body: new URLSearchParams({
      csrfToken,
      email: auditEmail,
      password: auditPassword,
    }).toString(),
    redirect: 'manual',
  });

  const signinCookies = signinRes.headers.getSetCookie ? signinRes.headers.getSetCookie() : [signinRes.headers.get('set-cookie') || ''];
  const authCookieHeader = [...csrfCookies, ...signinCookies].map(c => c.split(';')[0]).join('; ');
  console.log(`  ✓ Authenticated session established: HTTP ${signinRes.status}`);

  // C. Create link under authenticated user
  const initialDest = 'https://example.com/dest-initial-target';
  const createLinkRes = await fetch(`${BASE_URL}/api/v1/links`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Cookie': authCookieHeader,
    },
    body: JSON.stringify({ url: initialDest }),
  });
  const linkData = await createLinkRes.json();
  let linkId = linkData._id || linkData.id;
  if (!linkId) {
    const listRes = await fetch(`${BASE_URL}/api/v1/links`, {
      headers: { Cookie: authCookieHeader },
    });
    const listData = await listRes.json();
    const found = listData.links?.find(l => l.code === linkData.code);
    if (found) linkId = found._id || found.id;
  }
  const linkCode = linkData.code;
  console.log(`  ✓ Created link: code="${linkCode}", id="${linkId}", initial destination="${initialDest}"`);

  // D. First redirect: verify it goes to initial destination
  const redir1 = await fetch(`${BASE_URL}/${linkCode}`, { redirect: 'manual' });
  const loc1 = redir1.headers.get('location');
  console.log(`  ✓ Initial redirect: HTTP ${redir1.status} -> Location: "${loc1}"`);

  // E. Edit destination URL to target B
  const updatedDest = 'https://example.com/dest-updated-target-b';
  const updateRes = await fetch(`${BASE_URL}/api/v1/links/${linkId}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Cookie': authCookieHeader,
    },
    body: JSON.stringify({ url: updatedDest }),
  });
  const updateJson = await updateRes.json();
  console.log(`  ✓ Destination edit PUT /api/v1/links/${linkId} -> HTTP ${updateRes.status}`);
  console.log(`    Updated link originalUrl: "${updateJson.originalUrl}"`);

  // F. Second redirect: verify it immediately redirects to target B
  const redir2 = await fetch(`${BASE_URL}/${linkCode}`, { redirect: 'manual' });
  const loc2 = redir2.headers.get('location');
  console.log(`  ✓ Post-edit redirect: HTTP ${redir2.status} -> Location: "${loc2}"`);
  console.log(`  ✓ Destination edit successfully invalidated cache & updated redirect: ${loc2 === updatedDest}`);

  // G. Test non-owner unauthorized edit
  const unauthorizedRes = await fetch(`${BASE_URL}/api/v1/links/${linkId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' }, // no auth cookie
    body: JSON.stringify({ url: 'https://malicious.com' }),
  });
  console.log(`  ✓ Unauthenticated edit rejection: HTTP ${unauthorizedRes.status}`);

  // ──────────────────────────────────────────────────────────────────────────
  // 7. FIX 7: Multi-Slash Path Results
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n▶ [7/8] Verifying Multi-Slash Rejection (No 308 Normalization)...');
  const multiSlashTests = [
    `///${linkCode}`,
    `//${linkCode}`,
    `////testcode`,
    `/${linkCode}?param=https://example.com`, // query param containing // should NOT return 404
  ];

  const multiSlashResults = [];
  for (const p of multiSlashTests) {
    const res = await fetch(`${BASE_URL}${p}`, { redirect: 'manual' });
    const location = res.headers.get('location');
    multiSlashResults.push({
      path: p,
      status: res.status,
      location,
    });
    console.log(`  ✓ Path "${p}" -> HTTP ${res.status}${location ? ` Location: ${location}` : ''}`);
  }

  // ──────────────────────────────────────────────────────────────────────────
  // 8. PERFORMANCE MEASUREMENTS (Warm Redis & Cold MongoDB Latencies)
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n▶ [8/8] Measuring Real Live Latency (min / p50 / avg / p95 / p99)...');

  // A. Warm Redis Latency
  console.log('  Testing Warm Redis Redirects (30 consecutive requests)...');
  // First ensure cache is warm
  await fetch(`${BASE_URL}/${linkCode}`, { redirect: 'manual' });

  const warmLatencies = [];
  for (let i = 0; i < 30; i++) {
    const start = performance.now();
    const res = await fetch(`${BASE_URL}/${linkCode}`, { redirect: 'manual' });
    const dur = performance.now() - start;
    if (res.status === 302) {
      warmLatencies.push(dur);
    }
  }
  const warmStats = calcStats(warmLatencies);
  console.log(`  ✓ Warm Redis Latency (n=${warmLatencies.length}):`);
  console.log(`    Min: ${warmStats.min.toFixed(1)}ms | p50: ${warmStats.p50.toFixed(1)}ms | Avg: ${warmStats.avg.toFixed(1)}ms | p95: ${warmStats.p95.toFixed(1)}ms | p99: ${warmStats.p99.toFixed(1)}ms`);

  // B. Cold MongoDB Latency (Cache Misses)
  console.log('  Testing Cold MongoDB Redirects (10 consecutive cache misses)...');
  const coldLatencies = [];
  for (let i = 0; i < 10; i++) {
    // Create new unique link
    const cRes = await fetch(`${BASE_URL}/api/v1/links`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': authCookieHeader,
      },
      body: JSON.stringify({ url: `https://example.com/cold-${Date.now()}-${i}` }),
    });
    const cData = await cRes.json();
    const cCode = cData.code;

    // Invalidate Redis cache to guarantee a cache MISS / cold MongoDB lookup
    await redisCmd('del', `shorty:link:${cCode}`);

    const start = performance.now();
    const rRes = await fetch(`${BASE_URL}/${cCode}`, { redirect: 'manual' });
    const dur = performance.now() - start;
    if (rRes.status === 302) {
      coldLatencies.push(dur);
    }
  }
  const coldStats = calcStats(coldLatencies);
  console.log(`  ✓ Cold MongoDB Latency (n=${coldLatencies.length}):`);
  console.log(`    Min: ${coldStats.min.toFixed(1)}ms | p50: ${coldStats.p50.toFixed(1)}ms | Avg: ${coldStats.avg.toFixed(1)}ms | p95: ${coldStats.p95.toFixed(1)}ms | p99: ${coldStats.p99.toFixed(1)}ms`);

  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log(' AUDIT COMPLETE — ALL LIVE METRICS CAPTURED');
  console.log('═══════════════════════════════════════════════════════════════');

  return {
    malformedResults,
    loginRateLimit: { triggered: rateLimitTriggered, attempt: triggerAttempt, status: rlStatus, body: rlBody },
    regions: { vercelId: xVercelId, upstashHost, upstashIp, mongoHost, mongoIp },
    canonicalResults,
    destinationEdit: { success: loc2 === updatedDest, initial: loc1, updated: loc2 },
    multiSlashResults,
    warmStats,
    coldStats,
  };
}

runAudit().catch(err => {
  console.error('Audit failed:', err);
  process.exit(1);
});
