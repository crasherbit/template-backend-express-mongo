# Express + Mongoose Backend Template

Template for Node.js microservices with Express and Mongoose.

## Quick Start

```bash
# Requirements: mise (https://mise.jdx.dev), Docker

# 1. Install Node.js + pnpm automatically
mise install

# 2. Full setup (Docker MongoDB + dependencies)
mise run setup

# 3. Start in dev mode
mise run dev
```

The app starts on `http://localhost:3000`. Health check: `GET /api/v1/health`.

## Tooling

Fully managed by [mise](https://mise.jdx.dev):

- **Node.js 24** + **pnpm** — installed automatically
- **Biome** — linting + formatting
- **Env vars** — loaded automatically from `.env.develop`

## Commands (mise tasks)

| Command                     | Description                                       |
| --------------------------- | ------------------------------------------------- |
| `mise run dev`              | Start in dev with nodemon                         |
| `mise run start`            | Start in production                               |
| `mise run test`             | Unit test (node:test, no Docker)                  |
| `mise run test:integration` | Integration test (starts mongo, tests API, stops) |
| `mise run test:all`         | Unit + integration                                |
| `mise run lint`             | Biome check (lint + format)                       |
| `mise run lint:fix`         | Biome fix (lint + format)                         |
| `mise run docker:up`        | Start MongoDB in Docker                           |
| `mise run docker:down`      | Stop MongoDB                                      |
| `mise run setup`            | Full setup (Docker + install)                     |

## Architecture

```
Controller → Service → DAO → Entity (Mongoose Model)
```

- **Controller**: orchestrator of the flows, acts as an explicit "recipe" for the API linking steps one by one
- **Service**: pure mathematical functions or strict business authorization rules
- **DAO**: Mongoose queries (potentially mocked for Controller unit testing)
- **Entity**: define Mongoose schema, also acting as the single authoritative layer for Payload validation minimizing duplications (e.g. no Zod/Joi)

## Structure

```
src/
├── index.js                   # entry point (server + DB)
├── api/v1/
│   ├── router.js              # main router
│   ├── auth/                  # authentication (WebAuthn passkeys)
│   │   ├── controller.js
│   │   ├── service.js
│   │   ├── dao.js
│   │   ├── unit.test.js
│   │   └── integration.test.js
│   └── product/               # example feature
│       ├── controller.js
│       ├── service.js
│       ├── dao.js
│       ├── unit.test.js                # co-located unit tests
│       └── integration.test.js         # co-located integration tests
├── entities/
│   ├── user/index.js          # Mongoose User model (auth)
│   └── product/index.js       # Mongoose model
├── utils/
│   ├── handler.js             # handler wrapper (errors, JWT auth)
│   ├── constants.js           # paths, roles
│   ├── dbConnector.js         # MongoDB connection
│   └── logger.js              # Winston logger
└── cron/index.js              # cron jobs (e.g. WebAuthn challenge cleanup)
config/
├── utilsManager.js            # app conf
└── testServer.js              # start/stop helper server for integration tests
bruno/                         # Bruno collection (API client)
├── bruno.json
├── collection.bru
├── health/
├── auth/
└── product/
```

## Authentication

WebAuthn passkeys — no passwords. Registration and login use a `begin/complete` two-step flow:

1. Client calls `/begin` → server returns a challenge + `sessionId`
2. Device performs biometric/key verification
3. Client calls `/complete` with `sessionId` + signed response → server issues JWT cookie

JWT is set as `authToken` httpOnly cookie (7 days). Protected routes require the cookie; pass `roles` to restrict to specific roles.

### Required env vars

| Variable | Description |
| -------- | ----------- |
| `JWT_SECRET` | Secret for signing JWT tokens |
| `WEBAUTHN_RP_ID` | Relying party domain (e.g. `example.com`) |
| `WEBAUTHN_RP_NAME` | App name shown during passkey creation |
| `WEBAUTHN_ORIGIN` | Full origin (e.g. `https://example.com`) |
| `WEBAUTHN_ANDROID_ORIGIN` | Android native origin (see local testing below) |

### Local testing on Android (passkeys)

WebAuthn passkeys on a real Android device require three things:

1. **A real domain with HTTPS** — Android's CredentialManager verifies `https://{rpId}/.well-known/assetlinks.json` via the system network, so `localhost` + `adb reverse` is not enough. Use [ngrok](https://ngrok.com) to expose the server:

   ```bash
   ngrok http 3000
   # → https://<subdomain>.ngrok-free.app
   ```

2. **Digital Asset Links** — the file at `/.well-known/assetlinks.json` (served by this Express app) must include the app's SHA256 certificate fingerprint. Get the debug key fingerprint:

   ```bash
   keytool -list -v \
     -keystore ~/.android/debug.keystore \
     -alias androiddebugkey \
     -storepass android -keypass android 2>/dev/null \
     | grep "SHA256:"
   ```

   The fingerprint in `src/app.js` is already set to the standard debug keystore value (`F4:94:DC:AD...`). If you use a different keystore, update it there.

3. **Android APK key hash origin** — Android native passkeys send `android:apk-key-hash:<base64url>` as the WebAuthn origin instead of an HTTPS URL. Set `WEBAUTHN_ANDROID_ORIGIN` to this value so the server accepts it. The hash is the base64url encoding of the binary SHA256 fingerprint above.

**Complete `.env.develop` for local Android testing:**

```dotenv
WEBAUTHN_RP_ID=<subdomain>.ngrok-free.app
WEBAUTHN_RP_NAME="Your App"
WEBAUTHN_ORIGIN=https://<subdomain>.ngrok-free.app
WEBAUTHN_ANDROID_ORIGIN=android:apk-key-hash:<base64url-hash>
```

**Flutter `.env` (in the Flutter project root):**

```dotenv
API_URL=https://<subdomain>.ngrok-free.app
WEBAUTHN_RP_ID=<subdomain>.ngrok-free.app
```

> **Note:** The ngrok free tier URL changes on every restart. Update both `.env.develop` and the Flutter `.env` each time. A [static ngrok domain](https://ngrok.com/blog-post/free-static-domains-ngrok-users) (one per free account) avoids this.

### Auth endpoints

| Method | Endpoint                                      | Auth | Description                              |
| ------ | --------------------------------------------- | ---- | ---------------------------------------- |
| POST   | /api/v1/auth/register/begin                   | No   | Start registration (returns challenge)   |
| POST   | /api/v1/auth/register/complete                | No   | Finish registration, sets cookie, returns recovery codes |
| POST   | /api/v1/auth/login/begin                      | No   | Start login (returns challenge)          |
| POST   | /api/v1/auth/login/complete                   | No   | Finish login, sets cookie                |
| POST   | /api/v1/auth/recover                          | No   | Login with recovery code                 |
| GET    | /api/v1/auth/me                               | Yes  | Current user data                        |
| POST   | /api/v1/auth/logout                           | Yes  | Clear cookie (204)                       |
| POST   | /api/v1/auth/recovery-codes/regenerate/begin  | Yes  | Start recovery code regeneration         |
| POST   | /api/v1/auth/recovery-codes/regenerate/complete | Yes | Verify passkey, regenerate codes        |
| POST   | /api/v1/auth/passkeys/begin                   | Yes  | Start adding new passkey                 |
| POST   | /api/v1/auth/passkeys/complete                | Yes  | Finish adding new passkey                |
| GET    | /api/v1/auth/passkeys                         | Yes  | List registered passkeys                 |
| DELETE | /api/v1/auth/passkeys/:id                     | Yes  | Remove passkey (blocked if last one)     |

## API (Product)

| Method | Endpoint                    | Auth       | Description       |
| ------ | --------------------------- | ---------- | ----------------- |
| GET    | /api/v1/product             | No         | List products     |
| GET    | /api/v1/product/:id         | No         | Single product    |
| POST   | /api/v1/product             | Yes        | Create product    |
| PUT    | /api/v1/product/:id         | Yes        | Update product    |
| DELETE | /api/v1/product/:id         | Yes (Admin)| Delete product    |
| POST   | /api/v1/order               | Yes        | Process order     |
| PATCH  | /api/v1/order/:id/status    | Yes        | Update status     |

## Development approach

**TDD** — tests are written before implementation. Unit tests mock DAOs and external libraries; integration tests hit a real MongoDB on a random port via `config/testServer.js`.

## Advanced Example (Orchestrator)

Check `src/api/v1/order/controller.js` to see how the architecture supports complex API flows handling the order in explicit steps fully testable via Unit-Test.

## Adding a feature

See `CLAUDE.md` for detailed instructions and conventions.
