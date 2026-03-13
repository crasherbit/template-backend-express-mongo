# Template Backend Express + Mongoose

Template per microservizi Node.js con Express e Mongoose.

## Quick Start

```bash
# Requisiti: mise (https://mise.jdx.dev), Docker

# 1. Installa Node.js + pnpm automaticamente
mise install

# 2. Setup completo (Docker MongoDB + dipendenze)
mise run setup

# 3. Avvia in dev
mise run dev
```

L'app parte su `http://localhost:3000`. Health check: `GET /api/v1/health`.

## Tooling

Gestito interamente da [mise](https://mise.jdx.dev):

- **Node.js 24** + **pnpm** — installati automaticamente
- **Biome** — linting + formatting (sostituisce ESLint + Prettier)
- **Env vars** — caricati automaticamente da `.env.develop`

## Comandi (mise tasks)

| Comando                     | Descrizione                                       |
| --------------------------- | ------------------------------------------------- |
| `mise run dev`              | Avvia in dev con nodemon                          |
| `mise run start`            | Avvia in produzione                               |
| `mise run test`             | Unit test (no Docker, no server)                  |
| `mise run test:integration` | Integration test (avvia mongo, testa API, smonta) |
| `mise run test:all`         | Unit + integration                                |
| `mise run lint`             | Check Biome (lint + format)                       |
| `mise run lint:fix`         | Fix Biome (lint + format)                         |
| `mise run docker:up`        | Avvia MongoDB in Docker                           |
| `mise run docker:down`      | Ferma MongoDB                                     |
| `mise run setup`            | Setup completo (Docker + install)                 |

## Architettura

```
Controller → Service → DAO → Entity (Mongoose Model)
```

- **Controller**: rotte + handler orchestratori piatti (zero logica)
- **Service**: validazione, normalizzazione, business logic
- **DAO**: query Mongoose
- **Entity**: schema e model Mongoose

## Struttura

```
src/
├── app.js                     # configurazione Express (middleware, router)
├── index.js                   # entry point (server + DB)
├── api/v1/
│   ├── router.js              # router principale
│   └── product/               # feature di esempio
│       ├── controller.js
│       ├── service.js
│       └── dao.js
├── entities/
│   └── product/index.js       # Mongoose model
├── utils/
│   ├── handler.js             # wrapper handler (errori, auth)
│   ├── constants.js           # path, roles
│   ├── dbConnector.js         # connessione MongoDB
│   └── logger.js              # Winston logger
└── cron/index.js              # cron jobs
config/
└── utilsManager.js            # configurazione app
test/
├── unit/                      # unit test (service, logica pura)
│   └── api/v1/product.test.js
└── integration/               # integration test (Supertest + MongoDB)
    ├── setup.js               # helper avvio/spegnimento server
    └── api/v1/product.test.js
bruno/                         # collection Bruno (API client)
├── bruno.json
├── collection.bru
├── health/
└── product/
```

## API (Product)

| Metodo | Endpoint            | Auth       | Descrizione       |
| ------ | ------------------- | ---------- | ----------------- |
| GET    | /api/v1/product     | No         | Lista prodotti    |
| GET    | /api/v1/product/:id | No         | Singolo prodotto  |
| POST   | /api/v1/product     | Si         | Crea prodotto     |
| PUT    | /api/v1/product/:id | Si         | Aggiorna prodotto |
| DELETE | /api/v1/product/:id | Si (Admin) | Elimina prodotto  |

## Aggiungere una feature

Vedi `CLAUDE.md` per istruzioni dettagliate e convenzioni.
