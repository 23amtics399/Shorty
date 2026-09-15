# Shorty ⚡

> Production-grade, privacy-first URL shortening service built with Next.js 16 App Router, MongoDB Atlas, and Upstash Redis.

Target Domain: **`https://shorty.sji.one`**  
Deployment Pipeline: `GitHub → Vercel → MongoDB Atlas → Upstash Redis → shorty.sji.one`

---

## Architecture & Core Design

```
                     Internet / Client Request
                                │
                                ▼
               ┌─────────────────────────────────┐
               │    Next.js 16 Proxy (proxy.ts)  │
               │    Network Boundary Fast-Path   │
               └────────────────┬────────────────┘
                                │
                 Is Canonical Top-Level Route?
                 (/^[a-zA-Z0-9_-]{1,50}$/)
                                │
               ┌────────────────┴────────────────┐
          NO / Traversal / Reserved          YES (Valid Short Code)
               │                                 │
               ▼                                 ▼
      Pass to App Router /             Check Upstash Redis
      Route Handlers (404/Home)        (REST HTTP with 500ms timeout)
                                                 │
                                     ┌───────────┴───────────┐
                                  HIT & Active            MISS / Outage / Expired
                                     │                       │
                                     ▼                       ▼
                              HTTP 302 Redirect     App Router Route Handler
                              to Original URL       ([shortCode]/route.ts)
                                                             │
                                                             ▼
                                                    MongoDB Atlas
                                                    (Authoritative Store)
                                                             │
                                              ┌──────────────┼──────────────┐
                                           Found & Active  Expired/Disabled  Not Found
                                              │              │               │
                                              ▼              ▼               ▼
                                          HTTP 302        HTTP 410        HTTP 404
                                         (Warms Cache)    (Gone UI/JSON)  (Not Found UI/JSON)
```

### 1. Two-Tier Redirect Flow & Click Analytics
- **Tier 1 — Network Boundary Fast Path (`src/proxy.ts`)**:
  - Evaluates requests at the network boundary before application runtime loads.
  - Queries Upstash Redis over REST with an explicit 500ms abort signal.
  - On a cache HIT for an active link:
    - Atomically increments the Redis-side click counter (`shorty:clicks:{code}`) asynchronously.
    - Issues an immediate `HTTP 302` redirect without loading Mongoose or connecting to MongoDB.
  - On cache MISS, Redis timeout, or cached expired/disabled entries, safely falls through to the authoritative route handler without incrementing the click counter.
- **Tier 2 — Authoritative Fallback (`src/app/[shortCode]/route.ts`)**:
  - Authoritative source of truth: queries MongoDB Atlas using the unique `code` index.
  - If found and active:
    - Atomically retrieves and resets any pending Redis click counters using `GETDEL`.
    - Atomically updates MongoDB: `$inc: { clickCount: 1 + pendingClicks }` (exactly 1 for the current miss + all flushed Redis hits).
    - Populates the Redis link cache and issues `HTTP 302`.
  - If disabled or expired: returns `HTTP 410 Gone` (zero click increments).
  - If nonexistent: returns `HTTP 404 Not Found` (zero click increments).

### 2. Strict Proxy Route & Path Normalization Security
- **Canonical Short-Code Format**: Strictly enforces `/^[a-zA-Z0-9_-]{1,50}$/` as a single top-level route segment.
- **Multi-Slash & Ingress Normalization**:
  - The application Proxy (`src/proxy.ts`) explicitly tests for and rejects multiple consecutive slashes with `HTTP 404 Not Found`.
  - In production behind Cloudflare and Vercel Edge, incoming requests with multiple leading slashes (e.g. `///code`) are automatically normalized at the platform ingress level with an `HTTP 308 Permanent Redirect` to the canonical `/code` before serverless compute or proxy code executes.
  - This is an accepted platform-level behavior. Thorough testing confirmed that no authorization, tenant isolation, or destination bypass occurs through multi-slash requests.
- **Traversal Rejection**: Path traversal and encoded traversal sequences (`..`, `%2e`, `%2f`, `%5c`, `\`) are rejected at the proxy without initiating Redis lookups.
- **Reserved Route Guard**: System routes (`_next`, `api`, `dashboard`, `admin`, `login`, `signup`, `report`, `robots.txt`, etc.) are blocked from triggering Redis lookups.

### 3. Authoritative Storage (MongoDB Atlas)
- **Unique Code Index**: Indexed using `{ code: 1, unique: true }`, providing an efficient indexed lookup for redirect resolution.
- **Dashboard Index**: Compound index `{ ownerId: 1, createdAt: -1 }` for paginated user dashboard queries.
- **Partial TTL Expiration**: Partial TTL index `{ expiresAt: 1 }` with `partialFilterExpression: { expiresAt: { $type: 'date' } }`. Permanent links (`expiresAt: null`) are never deleted by MongoDB background TTL workers.
- **Request-Time Enforcement**: Expired links are blocked in real-time at the route handler even if the background MongoDB TTL task has not yet run.

### 4. Differentiated Rate-Limiting & Outage Policies
Rate limiting protects resources without sacrificing core redirection availability during downstream outages:

| Component / Action | Outage Policy | Behavior During Redis Outage |
|---|---|---|
| **Redirect Cache** (`proxy.ts`) | **Fail Open** | Falls through to MongoDB Atlas to resolve the destination URL. |
| **Authentication** (`login`, `signup`) | **Fail Closed** | Returns `HTTP 503 Service Unavailable`. Prevents unthrottled brute-force credential attacks. |
| **Anonymous Link Creation** (`POST /api/v1/links`) | **Conservative Fallback → Fail Closed** | Activates emergency per-container in-memory limiter (max 2 links per instance), then returns `HTTP 429` / `503`. |
| **User Link Creation** (`POST /api/v1/links`) | **Conservative Fallback → Fail Closed** | When Redis is available, enforces authenticated quota (50/hr). When Redis is offline, degraded behavior applies: emergency container-local quota (max 10 per instance) before failing closed. |

> [!WARNING]
> **Serverless Limitation Note on In-Memory Fallbacks**: In serverless hosting environments such as Vercel, memory is ephemeral and isolated per container instance. In-memory counters are **not** a globally distributed rate limiter. The emergency in-memory limiter serves only as a best-effort local brake per instance during a Redis outage, after which requests fail closed. There is no database-backed rate limiter query.

### 5. Click Tracking & Persistence Architecture
Shorty uses **atomic click counting with failure recovery and eventual persistence** to maintain sub-5ms redirect speeds while keeping analytics reliable and resilient:

1. **Request-Lifecycle Scheduling (`NextFetchEvent.waitUntil`)**:
   On every valid Redis cache hit, the Proxy schedules an asynchronous atomic counter increment (`shorty:clicks:{code}`) using the native Next.js 16 request lifecycle (`event.waitUntil()` from `NextFetchEvent`). The HTTP 302 redirect returns immediately to the client without waiting for the Redis network roundtrip. Post-response MongoDB persistence in Route Handlers uses Next.js 16's native `after()` API.
2. **Failure-Safe Cross-System Persistence Protocol**:
   Redis `GETDEL` is atomic in Redis and MongoDB `$inc` is atomic in MongoDB, but the combined cross-system operation is not a distributed transaction. To ensure pending clicks are not lost if MongoDB updates fail or time out:
   - **Step 1 (Claim)**: Atomically read and remove the pending counter from Redis via `GETDEL`.
   - **Step 2 (Persist)**: Attempt MongoDB atomic persistence using `$inc: { clickCount: pending }`.
   - **Step 3 (Rollback on Failure)**: If MongoDB persistence fails or times out, immediately restore the claimed counter to Redis using atomic `INCRBY`.
   - **Step 4 (Log)**: Log the persistence failure with error details and track that clicks remain unpersisted.
   - **Step 5 (No False Guarantees)**: Do not report clicks as durably persisted until MongoDB confirms write acknowledgment.
3. **Crash Window Disclosure**:
   In the microsecond window between Redis `GETDEL` returning and the completion of the `INCRBY` rollback, an unrecoverable process crash (such as fatal OS OOM killer termination, unhandled SIGKILL, or hypervisor power failure) could cause claimed clicks in that specific execution to be lost. We explicitly provide atomic click counting with failure recovery and eventual persistence, rather than mathematically guaranteed distributed two-phase commit exactly-once semantics across independent data stores.
4. **Click Counting Semantics**:
   - **Valid Redis HIT**: `+1` pending Redis click (scheduled in background).
   - **Valid MongoDB MISS**: `+1` current click `+` all successfully claimed/persisted pending Redis clicks.
   - **Expired / Disabled / Nonexistent**: `+0` (never increments any counter).
   - **Redis Outage**: Redirect availability is preserved via MongoDB fallback; no analytics counts are fabricated.
5. **Real-Time Dashboard & Distinguishable Metrics**:
   When viewing the dashboard, link records distinguish between **persisted MongoDB clicks** and **pending Redis clicks** awaiting background synchronization. The UI displays a combined total while MongoDB catches up, without falsely implying that every displayed click has already been durably written to permanent disk storage. Background flushes are scheduled using `waitUntil()`.
6. **Strictly Non-Double-Counted**:
   Persisted counts are never decremented, pending clicks are not silently lost, and restored clicks remain available for subsequent flushes without double-counting.

### 6. HTTP Semantics & Branded Error Responses
Missing or invalid short links never return ambiguous 200 or 302 responses:
- **Nonexistent Short Code** → `HTTP 404 Not Found`
- **Expired Short Link** → `HTTP 410 Gone`
- **Disabled Short Link** → `HTTP 410 Gone`
- **Content Negotiation**: Browser requests receive a responsive, branded HTML status card. API requests (`Accept: application/json`) receive structured JSON:
  ```json
  {
    "error": "Link not found. We couldn’t find any destination configured for this short code.",
    "code": "NOT_FOUND"
  }
  ```

---

## Directory Overview

```
src/
├── app/
│   ├── layout.tsx                     # Root layout with Header, Footer, SEO metadata
│   ├── page.tsx                       # Landing page with instant shortening form
│   ├── globals.css                    # Design tokens and global styles (Vanilla CSS)
│   ├── [shortCode]/route.ts           # Authoritative MongoDB redirect Route Handler
│   ├── dashboard/                     # Authenticated user dashboard & link analytics
│   ├── admin/                         # Admin moderation console (reports, links)
│   ├── login/ & signup/               # Auth.js credentials authentication
│   ├── about/, features/, pricing/    # Informational public pages
│   ├── developers/, help/, report/    # API docs, FAQ, and abuse report forms
│   ├── not-found.tsx & error.tsx      # Next.js error boundaries
│   └── api/
│       ├── auth/[...nextauth]/        # Auth.js v5 route handlers
│       ├── auth/signup/               # Account registration endpoint
│       ├── v1/links/                  # Link creation and user link listing
│       ├── v1/links/[id]/             # Link update/delete (owner or admin)
│       ├── v1/report/                 # Abuse report submission
│       └── v1/admin/                  # Moderation endpoints (admin only)
├── components/
│   ├── ui/                            # Button, Input, Badge
│   ├── layout/                        # Header, Footer
│   └── dashboard/                     # QRModal (client-side QR rendering)
├── lib/
│   ├── auth/                          # Auth.js v5 config & server authorization
│   ├── db/                            # MongoDB singleton & Mongoose models (Link, User, Report)
│   ├── redis/                         # Upstash client, cache helpers, and rate limiters
│   ├── shortcode/                     # Base62 crypto generator & alias validator
│   ├── url/                           # SSRF and protocol validator
│   └── config/                        # Centralized configuration & reserved routes
├── proxy.ts                           # Next.js 16 Proxy: Redis fast-path redirect
└── types/                             # Shared TypeScript interfaces
```

---

## Environment Variables

Copy `.env.example` to `.env.local`:

```bash
cp .env.example .env.local
```

| Variable | Description | Required in Production |
|---|---|:---:|
| `NEXT_PUBLIC_APP_URL` | Public origin URL (e.g. `https://shorty.sji.one`) | Yes |
| `APP_URL` | Server-side canonical origin URL | Yes |
| `MONGODB_URI` | MongoDB Atlas connection string (`mongodb+srv://...`) | Yes |
| `MONGODB_DATABASE` | MongoDB database name (default: `shorty`) | Yes |
| `UPSTASH_REDIS_REST_URL` | Upstash Redis REST endpoint URL | Yes |
| `UPSTASH_REDIS_REST_TOKEN` | Upstash Redis REST bearer token | Yes |
| `AUTH_SECRET` | NextAuth encryption secret (`openssl rand -base64 32`) | Yes |
| `AUTH_URL` | Canonical Auth URL (`https://shorty.sji.one`) | Yes |
| `ADMIN_EMAIL` | Superadmin email address (`admin@sji.one`) | Yes |
| `ANONYMOUS_MAX_LINK_LIFETIME_HOURS` | Lifetime limit for anonymous links (default: `24`) | No |
| `AUTHENTICATED_MAX_LINK_LIFETIME_DAYS` | Max lifetime for registered users (default: `30`) | No |
| `RATE_LIMIT_ANON_CREATE_PER_HOUR` | Hourly creation limit per anonymous IP (default: `5`) | No |
| `RATE_LIMIT_USER_CREATE_PER_HOUR` | Hourly creation limit per user (default: `50`) | No |

---

## Verification & Testing

The test suite covers unit logic, API route handlers, and integration scenarios (including simulated Redis and MongoDB outages, as well as production click tracking):

```bash
# Run Vitest test suite (15 test files, 150 tests)
npm test

# Run TypeScript type-checker
npm run type-check

# Run ESLint
npm run lint

# Build production bundle
npm run build
```

### Integration Test Scenarios Covered
1. **Click Tracking, Persistence & Failure Recovery (`tests/integration/click-tracking.test.ts`)**:
   - **Scenario 1 to 10**: Cache hits increment Redis; misses increment MongoDB; disabled/expired/nonexistent links increment nothing; Redis outages fallback cleanly.
   - **GETDEL succeeds + MongoDB succeeds**: Clicks atomically claimed from Redis and persisted to MongoDB; Redis key cleared.
   - **GETDEL succeeds + MongoDB fails**: Persistence error caught; clicks never reported as persisted.
   - **MongoDB fails + Redis counter restored**: Claimed clicks automatically restored to Redis using atomic `INCRBY`.
   - **Redis increment scheduled via `waitUntil`**: Cache hit schedules Redis `INCR` in the request lifecycle and returns HTTP 302 immediately without awaiting the write.
   - **Redis increment failure resilience**: Network/REST failures in background Redis writes do not block or crash redirects.
   - **Repeated concurrent Redis hits**: Concurrent requests accumulate accurately in Redis counter without race-condition data loss.
   - **Persistence retry**: Restored clicks remain available and flush successfully on subsequent retry without loss.
   - **No double counting after restoration**: Persisted counts are never decremented, unpersisted clicks are not dropped, and no click is counted twice.
2. **Redirect Lifecycle (`tests/integration/redirect-lifecycle.test.ts`)**:
   - Cache MISS → Fallback to MongoDB → HTTP 302 → Warms Redis cache.
   - Cache HIT → Fast-path 302 redirect directly from Redis.
   - Link edit in MongoDB → Redis invalidation → Route handler updates cache.
   - Link disable → HTTP 410 Gone.
   - Link expiration → HTTP 410 Gone.
   - Link deletion → HTTP 404 Not Found.
3. **Redis Outage Resilience (`tests/integration/redis-outage.test.ts`)**:
   - Redirect fallback: Redirects continue via MongoDB Atlas.
   - Auth fail-closed: Login/Signup return HTTP 503 to block brute-force attacks.
   - Anonymous creation: Emergency conservative fallback, then fails closed.
4. **MongoDB Outage Resilience (`tests/integration/mongodb-outage.test.ts`)**:
   - Cached links continue redirecting with HTTP 302 via Redis fast path.
   - Cache misses return clean error responses without leaking MongoDB connection strings.
5. **Admin Authorization (`tests/integration/admin-auth.test.ts`)**:
   - Unauthenticated: HTTP 401.
   - Non-admin authenticated user: HTTP 403.
   - Verified admin user: HTTP 200.

---

## Performance Measurement Guide

Do not rely on theoretical latency estimates. Measure real performance in your deployed environment using the following methodology:

### 1. Measure Redirect Latency with cURL
Save this format file as `curl-format.txt`:
```
    time_namelookup:  %{time_namelookup}s\n
       time_connect:  %{time_connect}s\n
    time_appconnect:  %{time_appconnect}s\n
   time_pretransfer:  %{time_pretransfer}s\n
      time_redirect:  %{time_redirect}s\n
 time_starttransfer:  %{time_starttransfer}s\n
                    ----------\n
         time_total:  %{time_total}s\n
```

Measure a warm redirect (Redis fast-path HIT):
```bash
curl -w "@curl-format.txt" -o /dev/null -s -I https://shorty.sji.one/your-code
```

### 2. Measure Cold vs Warm Latency
- **Cold miss (First request)**: Resolves through MongoDB Atlas and populates Redis cache.
- **Warm hit (Subsequent requests)**: Resolved directly at network boundary via Upstash Redis REST.

### 3. Verified Live Benchmarks (Mumbai `bom1` Execution)
All measurements represent real client-to-production requests over the public internet through Cloudflare CDN to Vercel compute in `bom1` (Mumbai, India) colocated with MongoDB Atlas and Upstash Redis in AWS `ap-south-1` (Mumbai). They accurately include TCP/TLS handshake, edge transit, and backend execution time (sub-50ms claims do not apply to full end-to-end client roundtrips):

- **Warm Redis Redirects**:
  - `p50`: **~311 ms**
  - `p95`: **~359 ms**
  - `p99`: **~468 ms**
- **Cold MongoDB Fallbacks**:
  - `p50`: **~385 ms**
  - `p95`: **~394 ms**

---

## Deployment Prerequisites & Live Verification

Before promoting Shorty to production:

### 1. Provision Infrastructure
- **MongoDB Atlas**:
  - Minimum M0 Free Tier or M10 cluster.
  - Network Access: Allow Vercel IP ranges (or `0.0.0.0/0` with strong database user credentials).
  - Copy connection string to `MONGODB_URI`.
- **Upstash Redis**:
  - Create a regional Redis database geographically close to your primary Vercel deployment region.
  - Copy REST URL and REST Token to `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`.
- **Auth Secret**:
  - Generate a secure 32+ byte secret:
    ```bash
    openssl rand -base64 32
    ```

### 2. Live Verification Checklist
Once deployed to a staging/preview domain, execute this runbook:
- [ ] **Live Atlas Indexes & TTL**: Run the standalone verification script to inspect real collection indexes and test document expiration:
  ```bash
  MONGODB_URI="your-atlas-connection-string" npx tsx scripts/verify-atlas-ttl.ts
  ```
- [ ] **Database Connection**: Submit a link creation request; verify the record appears in the MongoDB Atlas `links` collection.
- [ ] **Cache Warmup**: Request the short link once; verify the key `shorty:link:{code}` appears in Upstash Redis.
- [ ] **Fast Path & Click Tracking**: Request the short link a second time; verify the response returns `location` immediately and `shorty:clicks:{code}` is incremented in Redis.
- [ ] **Dashboard Enrichment & Sync**: Open `/dashboard`; verify that total clicks include pending Redis clicks, and verify that MongoDB `clickCount` is synchronized.
- [ ] **Invalidation**: Update the link destination in the dashboard; verify the Redis key is evicted and the new destination resolves.
- [ ] **Status Codes**: Request a nonexistent code and verify `HTTP 404`; disable a link and verify `HTTP 410`.
- [ ] **Admin Console**: Sign in with `ADMIN_EMAIL`; verify access to `/admin`. Sign in with another account; verify `/admin` redirects or returns forbidden.

---

## License
MIT
