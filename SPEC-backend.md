# Spec — SpecBuild Backend (Kotlin + Spring Boot)

## Goal
Add a small Kotlin/Spring Boot backend that sits between the static frontend (`specbuild-web` on GitHub Pages) and the LLM providers (Deepseek, OpenRouter). The backend does three things the frontend can't safely do alone:
1. Holds the LLM API keys server-side, never exposing them to browsers.
2. Enforces spec-generation and AI-polish quotas per user, so a user can't clear their `localStorage` and bypass limits.
3. Provides a clean REST surface for the frontend to call.

The backend is a standalone project, `specbuild-backend`, deployable to Render as a free Web Service. The frontend (`specbuild-web`) gets updated to call it instead of hitting LLM APIs directly.

## Why a backend, why now
Shipping LLM API keys in a JS bundle means anyone with DevTools can extract them in 5 seconds and run up your bill. A real backend with server-side keys + per-user quota is the only way to actually enforce limits on a paid product. The backend is the single source of truth for "is this user allowed to make this call right now."

## Non-goals (for v1)
- No user accounts with passwords. We identify users by an anonymous ID stored in a cookie + their Stripe email if we have it.
- No DB hosting. Use SQLite for v1 (file-based, zero config). Postgres later if scaling becomes an issue.
- No subscription status sync with Stripe. The backend trusts the frontend's `plan` claim for v1. Real verification is out of scope.
- No file uploads, no streaming responses. Plain JSON in, JSON out.

## Tech stack
- **Kotlin 1.9+** (JVM language, runs on Spring Boot)
- **Spring Boot 3.2+** (the framework — handles HTTP, dependency injection, config)
- **Gradle** with the Kotlin DSL (`build.gradle.kts`) — for build
- **Spring Web** — for REST controllers
- **Spring Data JDBC** or **Exposed** — for DB access. I'll use **Spring Data JDBC** because it's simpler than JPA and doesn't have lazy-loading surprises.
- **SQLite** via the `xerial/sqlite-jdbc` driver — file-based, zero config, perfect for v1
- **Java 17+** (Spring Boot 3 requires it; Render's default is Java 17)
- **`java.net.http.HttpClient`** (built into the JDK, no extra dep) — for calling LLM APIs
- **`kotlinx.serialization`** — for JSON parsing (cleaner than Jackson for Kotlin)
- **No external auth library** — we sign cookies with `javax.crypto.Mac` (built in)

## File structure

```
specbuild-backend/
├── build.gradle.kts
├── settings.gradle.kts
├── gradle.properties
├── render.yaml                  # Render Blueprint for one-click deploy
├── .env.example                 # Tells the user what env vars to set
├── .gitignore
├── README.md                    # How to deploy + how to point frontend at it
├── src/
│   └── main/
│       ├── kotlin/
│       │   └── com/specbuild/
│       │       └── backend/
│       │           ├── BackendApplication.kt       # @SpringBootApplication entry
│       │           ├── config/
│       │           │   └── AppConfig.kt            # Reads env vars, validates at boot
│       │           ├── db/
│       │           │   ├── DatabaseInitializer.kt   # Runs CREATE TABLE on startup
│       │           │   └── UserRepository.kt       # Spring Data JDBC repository
│       │           ├── auth/
│       │           │   ├── SessionService.kt       # Cookie sign/verify
│       │           │   └── SessionFilter.kt        # Spring filter, runs on every request
│       │           ├── quota/
│       │           │   ├── QuotaService.kt         # Check + increment logic
│       │           │   └── Quotas.kt               # Hardcoded limits per plan
│       │           ├── llm/
│       │           │   ├── LlmService.kt           # Orchestrates the fallback chain
│       │           │   ├── LlmProvider.kt          # Interface
│       │           │   ├── DeepseekProvider.kt     # Direct Deepseek
│       │           │   ├── OpenRouterDeepseekProvider.kt
│       │           │   └── OpenRouterFreeProvider.kt
│       │           ├── api/
│       │           │   ├── SessionController.kt    # POST/GET /session
│       │           │   ├── PolishController.kt     # POST /polish
│       │           │   ├── HealthController.kt     # GET /health
│       │           │   └── dto/
│       │           │       ├── SessionResponse.kt
│       │           │       ├── PolishRequest.kt
│       │           │       └── PolishResponse.kt
│       │           └── error/
│       │               ├── GlobalExceptionHandler.kt
│       │               └── ApiError.kt
│       └── resources/
│           ├── application.yml   # Spring config
│           └── schema.sql        # CREATE TABLE statements
```

## API surface

All endpoints are POST or GET, all return JSON. All require a valid session cookie except `/session` itself and `/health`.

### `POST /session`
Called by the frontend on first visit if the user has no session cookie. Issues a new anonymous user ID and returns it.

**Request:** `{}` (empty body)

**Response (200):**
```json
{
  "userId": "anon_abc123def456",
  "plan": "free",
  "limits": { "specsPerMonth": 2, "polishPerMonth": 2 },
  "used": { "specs": 0, "polish": 0 },
  "periodStart": "2026-06-04T00:00:00.000Z"
}
```

**Side effects:**
- Sets a signed session cookie on the response (`Set-Cookie: session=...; HttpOnly; SameSite=Lax; Path=/; Max-Age=31536000`)
- Creates a row in the `users` table with the new ID, plan = "free", period_start = now

### `GET /session`
Returns the current session info, refreshing the count from the DB. Used by the frontend on page load to know the user's current quota state.

**Response (200):** same shape as `POST /session`

### `POST /polish`
The main LLM endpoint. Takes the user's spec and returns the polished version.

**Request:**
```json
{
  "spec": "## Goal / Outcome\n- Build a website..."
}
```

**Response (200, success):**
```json
{
  "polished": "## Goal / Outcome\n- Build a complete website...",
  "providerUsed": "deepseek-direct"
}
```

**Response (429, quota exceeded):**
```json
{
  "error": "quota_exceeded",
  "message": "You've used all 2 free specs. Upgrade to keep generating.",
  "resetAt": null
}
```

**Response (503, LLM failure):**
```json
{
  "error": "llm_unavailable",
  "message": "AI polish is temporarily unavailable. Your spec was not modified."
}
```

**Response (401, invalid session):**
```json
{
  "error": "no_session",
  "message": "Session expired. Please refresh the page."
}
```

**Side effects:**
- Verifies session via the `SessionFilter`
- Atomically checks + increments the user's spec counter in a single transaction
- Calls `LlmService.callWithFallback()`
- Returns the result

**Important:** The quota is incremented BEFORE the LLM call, not after. If the LLM call fails, the count is still consumed. This prevents users from spamming retries to use the service as a free oracle. Documented in the README.

### `GET /health`
Returns `{ "ok": true, "version": "0.1.0" }`. Render uses this for the health check.

## Database schema (SQLite)

### Table: `users`
```sql
CREATE TABLE IF NOT EXISTS users (
    id              TEXT PRIMARY KEY,
    plan            TEXT NOT NULL DEFAULT 'free',
    plan_set_at     TEXT NOT NULL,        -- ISO 8601 timestamp
    period_start    TEXT NOT NULL,        -- ISO 8601 timestamp
    specs_used      INTEGER NOT NULL DEFAULT 0,
    polish_used     INTEGER NOT NULL DEFAULT 0,
    created_at      TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_users_period_start ON users(period_start);
```

### Quota constants (in `Quotas.kt`)
```kotlin
object Quotas {
    data class Quota(val specsPerPeriod: Int, val polishPerPeriod: Int)

    val FREE     = Quota(specsPerPeriod = 2,    polishPerPeriod = 2)
    val BASIC    = Quota(specsPerPeriod = 30,   polishPerPeriod = 30)
    val PRO      = Quota(specsPerPeriod = 100,  polishPerPeriod = 100)
    val LIFETIME = Quota(specsPerPeriod = Int.MAX_VALUE, polishPerPeriod = Int.MAX_VALUE)

    fun forPlan(plan: String): Quota = when (plan.lowercase()) {
        "free" -> FREE
        "basic" -> BASIC
        "pro" -> PRO
        "lifetime" -> LIFETIME
        else -> FREE
    }
}
```

## Quota enforcement logic (in `QuotaService.kt`)

`POST /polish` does this atomically inside a `@Transactional` method:

1. Fetch the user row with a write lock (SQLite serializes writes by default, no explicit `FOR UPDATE` needed).
2. Check if `Instant.now() - periodStart >= 30 days`. If yes, reset `specs_used = 0` and `period_start = now`.
3. Get the quota for the user's plan.
4. If `specs_used >= quota.specsPerPeriod`, throw `QuotaExceededException(...)`.
5. Increment `specs_used` and save.
6. Return the updated user.

For lifetime users (quota is `Int.MAX_VALUE`), step 4 never fires. Document this in the code.

## LLM fallback chain (in `LlmService.kt`)

```kotlin
class LlmService(
    private val providers: List<LlmProvider>,
) {
    suspend fun callWithFallback(messages: List<Message>): Result {
        var lastError: Throwable? = null
        for (provider in providers) {
            try {
                val text = provider.complete(messages)
                return Result(text, provider.name)
            } catch (e: LlmException) {
                if (!e.fallbackable) throw e
                logger.warn("Provider ${provider.name} failed, falling back", e)
                lastError = e
            }
        }
        throw LlmException("All LLM providers failed", fallbackable = false)
    }
}
```

Each provider (`DeepseekProvider`, `OpenRouterDeepseekProvider`, `OpenRouterFreeProvider`) implements:

```kotlin
interface LlmProvider {
    val name: String
    suspend fun complete(messages: List<Message>): String
}
```

Fallback rules (in `LlmException.isFallbackable`):
- HTTP 429 (rate limit) → fallback
- HTTP 402 / 403 with `insufficient_quota` → fallback
- HTTP 5xx → fallback
- Network error / timeout → fallback
- HTTP 400 with `context_length_exceeded` → do NOT fallback, surface to user
- HTTP 401 → do NOT fallback, this is a config error
- HTTP 400 other → do NOT fallback

The user never sees which provider actually answered. Only the backend logs know.

## Session / auth (in `SessionService.kt`)

- On `POST /session`, generate `id = "anon_" + generateRandomHex(16)`
- Sign: `hmacSha256(SESSION_SECRET, userId)`, URL-safe base64
- Set cookie: `session=<userId>.<signature>; HttpOnly; SameSite=Lax; Path=/; Max-Age=31536000; Secure` (Secure flag set only in production)
- `SessionFilter` runs on every request, verifies the cookie, attaches the user to the request as a request attribute
- Tampered cookie → 401
- `SESSION_SECRET` is an env var, generated on first deploy

This is intentionally simple. No JWT, no refresh tokens. The cookie IS the session.

## Environment variables

```bash
# Required
SESSION_SECRET=<random 32+ byte hex, e.g. from `openssl rand -hex 32`>
DEEPSEEK_API_KEY=<sk-...>
OPENROUTER_API_KEY=<sk-or-...>

# Optional (with defaults)
PORT=3000                              # Render sets this for you
ALLOWED_ORIGIN=https://specthinker.github.io   # CORS allowlist
DATABASE_PATH=./data/specbuild.db      # SQLite file location
LOG_LEVEL=info
```

Spring Boot reads these via `application.yml`:
```yaml
server:
  port: ${PORT:3000}

app:
  session-secret: ${SESSION_SECRET}
  deepseek-api-key: ${DEEPSEEK_API_KEY}
  openrouter-api-key: ${OPENROUTER_API_KEY}
  allowed-origin: ${ALLOWED_ORIGIN:https://specthinker.github.io}
  database-path: ${DATABASE_PATH:./data/specbuild.db}

logging:
  level:
    com.specbuild: ${LOG_LEVEL:info}
```

The `AppConfig` class validates that required vars are present at boot and fails fast with a clear error if not.

## Render deployment

The repo includes a `render.yaml` Blueprint:

```yaml
services:
  - type: web
    name: specbuild-backend
    runtime: java
    plan: free
    buildCommand: ./gradlew build -x test
    startCommand: java -jar build/libs/specbuild-backend-0.1.0.jar
    healthCheckPath: /health
    envVars:
      - key: SESSION_SECRET
        generateValue: true
      - key: DEEPSEEK_API_KEY
        sync: false   # user must enter manually
      - key: OPENROUTER_API_KEY
        sync: false
      - key: ALLOWED_ORIGIN
        value: https://specthinker.github.io
      - key: DATABASE_PATH
        value: /var/data/specbuild.db
    disk:           # persistent disk for the SQLite file
      name: data
      mountPath: /var/data
      sizeGB: 1
```

The user clicks "Deploy to Render" from the README, fills in their LLM API keys, and gets a URL like `https://specbuild-backend.onrender.com`.

## Frontend changes (in `specbuild-web`)

When you invoke me inside the `specbuild-web` directory, I'll do these changes:

1. **Delete `src/lib/llm.ts`** — no more direct LLM calls from the browser.
2. **Delete the LLM API key constants** from `src/App.tsx` — they move to backend env vars.
3. **Add `src/lib/api.ts`** — a thin client that:
   - Reads `VITE_API_URL` from env
   - Calls `POST {API_URL}/session` to get a session if missing
   - Calls `POST {API_URL}/polish` to polish a spec
   - Stores the session cookie (browser handles this automatically)
4. **Update `App.tsx`** — `polishSpecWithAi()` calls `api.polish()` instead of the local mock.
5. **Update quota logic** — the frontend no longer enforces quotas; it just displays what the backend returns. On 429, show the upgrade message.
6. **Add a "Backend not configured" empty state** — if `VITE_API_URL` is not set, show a friendly "AI polish isn't set up yet" message in the output panel.
7. **Remove all "local AI" / "local model" copy** from the UI and the marketing section.
8. **Update the marketing section** that previously talked about "local AI polishing" to talk about real AI polish (calls a server, real LLM, etc.).

The frontend's localStorage state for `isPremiumUser` stays — the frontend still uses it to decide which UI to show, but the backend is the source of truth for "can this user make a call right now."

## Acceptance criteria (backend)
- `./gradlew build` succeeds
- `./gradlew bootRun` starts the service on port 3000
- `GET /health` returns 200
- `POST /session` returns a new user ID and sets a cookie
- `GET /session` returns the same user ID on subsequent requests
- A user with plan `free` can hit `POST /polish` twice, then gets 429 on the third try
- When a 429 is returned, the response includes a clear message and the quota values
- When Deepseek returns 429, the backend transparently falls back to OpenRouter Deepseek
- When all three providers fail, the backend returns 503
- The LLM API keys are never logged and never appear in any response body
- The session cookie is signed; tampering with the userId part causes a 401
- The service deploys to Render with no manual config beyond the API keys
- All errors are logged with a request ID for debugging

## Acceptance criteria (frontend integration)
- Setting `VITE_API_URL` to a working backend URL makes the "Polish with AI" button work end-to-end
- Hitting the quota on the backend shows the right message in the UI
- A 401 from the backend triggers a fresh `POST /session` and one retry
- A 503 from the backend shows "Polish unavailable" without crashing the page
- The frontend does not contain any LLM API key strings (verified by grep)

## How to invoke me in the backend directory
When you start a new chat with me in `specbuild-backend/`, paste this:

> "Implement the Kotlin/Spring Boot backend per the spec at /Users/salam/specthinker-web/SPEC-backend.md. The spec covers file structure, API surface, DB schema, quota logic, LLM fallback chain, session auth, env vars, and Render deployment. Build the entire backend from scratch — no existing code to integrate with. Use the tech stack specified: Kotlin 1.9+, Spring Boot 3.2+, Gradle Kotlin DSL, Spring Data JDBC, SQLite, kotlinx.serialization, java.net.http.HttpClient. When done, give me step-by-step deploy instructions."

I'll know exactly what to do.

## Open questions (need your answers before I implement)
1. **OpenRouter free model** — which specific free model? Most consistent free option as of late 2025 is `meta-llama/llama-3.1-8b-instruct:free`. Sound right, or do you want me to research current options?
2. **Kotlin version + Spring Boot version** — I'm defaulting to Kotlin 1.9.22 + Spring Boot 3.2.5. If you have a preference (e.g., newer Kotlin 2.0), let me know.
3. **Java version** — Spring Boot 3 requires Java 17+. Render's default is Java 17. If you want Java 21, set it in the `render.yaml` (and Gradle config). Defaulting to Java 17.
4. **Testing** — should I write unit tests for the LLM fallback chain and quota service, or skip tests for v1? Defaulting to a small set of focused tests on those two modules only.
5. **Health check interval** — Render pings `/health` every few seconds. Do you want a deeper check (e.g., DB connectivity + LLM provider reachability), or just a simple "process is up" check? Defaulting to the simple one to avoid false alarms.
