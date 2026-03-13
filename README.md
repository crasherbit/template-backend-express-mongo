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
│   └── product/               # example feature
│       ├── controller.js
│       ├── service.js
│       ├── dao.js
│       ├── service.unit.test.js        # co-located unit tests
│       └── product.integration.test.js # co-located integration tests
├── entities/
│   └── product/index.js       # Mongoose model
├── utils/
│   ├── handler.js             # handler wrapper (errors, auth)
│   ├── constants.js           # paths, roles
│   ├── dbConnector.js         # MongoDB connection
│   └── logger.js              # Winston logger
└── cron/index.js              # cron jobs
config/
├── utilsManager.js            # app conf
└── testServer.js              # start/stop helper server for integration tests
bruno/                         # Bruno collection (API client)
├── bruno.json
├── collection.bru
├── health/
└── product/
```

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

## Advanced Example (Orchestrator)

Check `src/api/v1/order/controller.js` to see how the architecture supports complex API flows handling the order in explicit steps fully testable via Unit-Test.

## Adding a feature

See `CLAUDE.md` for detailed instructions and conventions.
