# Auth.js (NextAuth.js v5 Beta) Dependency Audit & Production Strategy

## 1. Context & Architecture

Shorty uses `next-auth@5.0.0-beta.32` (Auth.js v5) for user authentication and session management.

### Why NextAuth v5 Beta?
- **Next.js 16 Compatibility**: NextAuth v4 relied on legacy Pages Router patterns (`getServerSession(req, res, authOptions)`) and had deep coupling to Node.js HTTP primitives that conflict with Next.js 16 App Router route handlers.
- **Universal `auth()` Helper**: Auth.js v5 provides a unified, async `auth()` function callable directly within App Router Route Handlers, Server Components, and API proxies.
- **Native TypeScript & Web Standards**: Built on Fetch API `Request` and `Response` interfaces, perfectly aligned with Next.js 16.

---

## 2. Security Architecture & Implementation

### 2.1 Credential Storage & Verification
- **Password Hashing**: Passwords are never stored in plaintext. They are hashed using `bcryptjs` with a work factor (cost) of 12 before persistence in MongoDB.
- **Timing Safe Verification**: Authentication takes place strictly in Node.js runtime (`export const runtime = 'nodejs'`) using `bcrypt.compare`.
- **Stateless JWT Sessions**: Sessions use encrypted, signed JSON Web Tokens (`strategy: 'jwt'`) signed with `AUTH_SECRET`. No database session queries are required for high-throughput link resolution.

### 2.2 Brute-Force & Credential Stuffing Defense
- **Strict Fail-Closed Rate Limiting**: The auth endpoint is guarded by `rateLimitAuth(ip)`.
- **Policy During Redis Outages**: If Upstash Redis is unreachable, auth requests **strictly fail closed** with HTTP 503 (`SERVICE_UNAVAILABLE`). This prevents attackers from disabling Redis or taking advantage of an outage to execute unrestricted brute-force password guessing.

### 2.3 Authorization Boundaries
- Authentication and authorization are separated:
  - Auth.js provides identity (`session.user.id`, `session.user.email`).
  - `src/lib/auth/authorization.ts` enforces role and ownership checks (`requireAuth`, `requireAdmin`, `requireOwnerOrAdmin`).
  - Admin status is verified server-side against `ADMIN_EMAIL`. Client-supplied roles or headers are never trusted.

---

## 3. Risk Assessment & Known Limitations

| Risk / Consideration | Severity | Mitigation in Shorty |
|---|---|---|
| **Beta Package Status** | Low–Medium | Package version is pinned to `5.0.0-beta.32` in `package.json` with a deterministic lockfile. Full test suite covers auth flows. |
| **API Instability Across Betas** | Medium | Dependency is isolated behind `@/lib/auth/config` and `@/lib/auth/authorization`. Application code only interacts with Shorty's abstraction layer. |
| **Credentials Provider Warnings** | Low | NextAuth issues documentation warnings regarding Credentials Provider because it lacks built-in MFA/OAuth flows. Shorty supplements it with strict rate limiting, payload length checks, and strong password constraints. |
| **Edge Runtime Incompatibility** | Low | Shorty's route handlers explicitly declare `export const runtime = 'nodejs'`. The proxy (`proxy.ts`) does not invoke Auth.js. |

---

## 4. Upgrade Strategy to v5 GA

When Auth.js publishes `5.0.0` General Availability (GA):

1. **Review Release Notes**: Check for changes in `NextAuthConfig` or session callback signatures.
2. **Update Dependency**: Update `next-auth` to `^5.0.0` in `package.json`.
3. **Execute Verification Suites**:
   ```bash
   npx vitest run tests/unit/authorization.test.ts tests/integration/admin-auth.test.ts
   npm run type-check
   npm run build
   ```
4. **Staging Validation**: Perform live login, token refresh, and sign-out tests in a preview deployment before promoting to production.
