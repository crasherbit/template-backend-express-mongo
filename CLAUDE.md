# Express + Mongoose Backend Template

## Tooling

- **mise** — manages Node.js, pnpm, env vars and tasks (`mise.toml`)
- **Biome** — linting + formatting in one (`biome.json`)
- **Supertest** — integration test (HTTP)
- **Bruno** — interactive API client (collections in `bruno/`)

## Architecture: Controller → Service → DAO

### Controller (`src/api/v1/<feature>/controller.js`)

- Defines Express routes
- **Orchestrator**: It is a true execution recipe. It invokes in order DB read functions (DAO), pure logic and business calculations (Service), business validity checks, and finally Database mutations.
- Testable at "unit" level thanks to the independent export of `_testable` allowing testing by providing mocked DAOs.

### Service (`src/api/v1/<feature>/service.js`)

- Purely mathematical logic or business rules.
- Throws errors (`createHttpError`) if the logic fails.
- **No schema validation or manual null-checks**, RAW input data validation is completely delegated to Mongoose at database level (Caught in handler.js).

### DAO (`src/api/v1/<feature>/dao.js`)

- Only Mongoose queries
- No business logic
- Model import from `src/entities/<feature>/index.js`

### Entities (`src/entities/<feature>/index.js`)

- Mongoose schema and model

### Utils (`src/utils/`)

- `handler.js` - wrapper for route handlers (handles errors, auth)
- `constants.js` - Route paths, Roles
- `dbConnector.js` - MongoDB connection
- `logger.js` - Winston + express-winston

### App (`src/index.js`)

- Express configuration (middlewares, router) and server entry point
- `initDb()` and `app.listen()` are bypassed when `index.js` is imported by integration tests, avoiding polluting the test state.

## Commands

```bash
mise run dev              # start with nodemon (NODE_ENV=dev)
mise run start            # start in production
mise run test             # unit test (node:test, no Docker)
mise run test:integration # integration test (starts mongo, tests API, stops)
mise run test:all         # unit + integration
mise run lint             # Biome check (lint + format)
mise run lint:fix         # Biome fix (lint + format)
mise run docker:up        # start MongoDB in Docker
mise run docker:down      # stop MongoDB
mise run setup            # full setup (Docker + install)
```

## Testing

**TDD is the project standard.** Write tests first, then implement.

### Unit tests

- Use native tools `node:test` and `node:assert` without third-party dependencies.
- Test service functions in absolute isolation **or** Controllers (via full DAO mocks using Node's `mock` method) to verify the sequence, without ever instantiating Mongoose in memory.
- Files have the `.unit.test.js` suffix co-located next to the feature (e.g. `src/api/v1/order/unit.test.js`)
- `mise run test`

### Integration tests

- Test end-to-end HTTP APIs with Supertest + `node:test`
- Start an Express server on a random port + link to a test MongoDB using `config/testServer.js`
- Files have the `.integration.test.js` suffix co-located next to the feature (e.g. `src/api/v1/product/integration.test.js`)
- Always cover negative scenarios: validation errors, missing auth, forbidden roles, business rule violations.
- `mise run test:integration`

### Bruno (`bruno/`)

- API collection to explore/debug manually during development
- Open with Bruno: `File → Open Collection → select bruno/ folder`
- Collections are saved in the repo (git-friendly)

## Adding a new feature

Follow TDD: write tests first, then implement.

1. Create model in `src/entities/<feature>/index.js`
2. Create `src/api/v1/<feature>/dao.js` with CRUD functions
3. Create `src/api/v1/<feature>/service.js` with validations
4. Create `src/api/v1/<feature>/controller.js` with routes and flat handlers
5. Add route to `src/api/v1/router.js`
6. Add path to `src/utils/constants.js`
7. Write unit tests first in `src/api/v1/<feature>/unit.test.js`
8. Write integration tests first in `src/api/v1/<feature>/integration.test.js`
9. Add Bruno requests in `bruno/<feature>/`

## Multi-step flow pattern (`begin/complete`)

For any operation requiring two round-trips (e.g. WebAuthn, any challenge-response flow):

- `POST /<resource>/begin` — server generates a challenge, stores it in-memory keyed by a random `sessionId`, returns `sessionId` + options to the client
- `POST /<resource>/complete` — client sends back `sessionId` + response, server verifies and commits

Challenges expire after 5 minutes and are purged by the cron job in `src/cron/index.js`.

## Authentication

Authentication uses **WebAuthn passkeys** (`@simplewebauthn/server`). No passwords.

- JWT issued as `authToken` cookie: `httpOnly`, `SameSite=Strict`, `Secure` only in production
- JWT payload: `{ userId, username, role }`, 7-day expiry, stateless
- `handler.authenticated({ cb, roles })` verifies the cookie, populates `req.user`, returns `403` for insufficient roles
- WebAuthn config from env: `WEBAUTHN_RP_ID`, `WEBAUTHN_RP_NAME`, `WEBAUTHN_ORIGIN`, `JWT_SECRET`

### Testing WebAuthn flows

`@simplewebauthn/server` cannot run real ceremonies in tests. Mock `verifyRegistrationResponse` and `verifyAuthenticationResponse` using Node's `mock` module. Test all other auth endpoints (me, logout, passkeys list/delete, recover) with real HTTP + real DB.

## Conventions

- ESM (`import/export`), no CommonJS
- Biome with single quotes, trailing comma es5, semicolons always
- `.env.develop` file for local development (automatically loaded by mise)
- All sensitive auth errors use generic messages to prevent user enumeration (e.g. `"Invalid credentials"` regardless of whether the username exists)
