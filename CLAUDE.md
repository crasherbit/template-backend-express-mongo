# Template Backend Express + Mongoose

## Tooling

- **mise** — gestisce Node.js, pnpm, env vars e tasks (`mise.toml`)
- **Biome** — linting + formatting in uno (`biome.json`)
- **Mocha + Chai** — unit test
- **Supertest** — integration test (HTTP)
- **Bruno** — API client interattivo (collection in `bruno/`)

## Architettura: Controller → Service → DAO

### Controller (`src/api/v1/<feature>/controller.js`)

- Definisce le rotte Express
- Gli handler sono **orchestratori piatti**: chiamano service, dao in sequenza
- ZERO logica di business nel controller
- Usa `handler.public()` o `handler.authenticated({ cb })` dal wrapper

### Service (`src/api/v1/<feature>/service.js`)

- Business logic pura: validazione, normalizzazione, trasformazioni
- Lancia `createHttpError` per errori di validazione
- Non accede mai al database direttamente

### DAO (`src/api/v1/<feature>/dao.js`)

- Solo query Mongoose
- Nessuna logica di business
- Import del model da `src/entities/<feature>/index.js`

### Entities (`src/entities/<feature>/index.js`)

- Schema e model Mongoose

### Utils (`src/utils/`)

- `handler.js` - wrapper per route handler (gestisce errori, auth)
- `constants.js` - Path delle rotte, Roles
- `dbConnector.js` - connessione MongoDB
- `logger.js` - Winston + express-winston

### App (`src/app.js`)

- Configurazione Express (middleware, router)
- Esportata come modulo separato per consentire l'uso con Supertest

## Comandi

```bash
mise run dev              # avvia con nodemon (NODE_ENV=dev)
mise run start            # avvia in produzione
mise run test             # unit test (mocha, no Docker)
mise run test:integration # integration test (avvia mongo, testa API, smonta)
mise run test:all         # unit + integration
mise run lint             # check Biome (lint + format)
mise run lint:fix         # fix Biome (lint + format)
mise run docker:up        # avvia MongoDB in Docker
mise run docker:down      # ferma MongoDB
mise run setup            # setup completo (Docker + install)
```

## Test

### Unit test (`test/unit/`)

- Testano service/logica pura, senza DB né server
- `mise run test`

### Integration test (`test/integration/`)

- Testano le API HTTP end-to-end con Supertest
- Avviano un server Express su porta random + collegamento a MongoDB di test
- `mise run test:integration`

### Bruno (`bruno/`)

- Collection API per esplorare/debuggare a mano durante lo sviluppo
- Aprire con Bruno: `File → Open Collection → seleziona cartella bruno/`
- Le collection sono salvate nel repo (git-friendly)

## Aggiungere una nuova feature

1. Crea model in `src/entities/<feature>/index.js`
2. Crea `src/api/v1/<feature>/dao.js` con funzioni CRUD
3. Crea `src/api/v1/<feature>/service.js` con validazione
4. Crea `src/api/v1/<feature>/controller.js` con rotte e handler piatti
5. Aggiungi rotta in `src/api/v1/router.js`
6. Aggiungi path in `src/utils/constants.js`
7. Aggiungi unit test in `test/unit/api/v1/<feature>.test.js`
8. Aggiungi integration test in `test/integration/api/v1/<feature>.test.js`
9. Aggiungi richieste Bruno in `bruno/<feature>/`

## Convenzioni

- ESM (`import/export`), no CommonJS
- Biome con single quotes, trailing comma es5, semicolons always
- File `.env.develop` per sviluppo locale (caricato automaticamente da mise)
