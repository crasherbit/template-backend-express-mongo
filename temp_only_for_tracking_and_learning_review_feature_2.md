Review Agnostica — Auth Feature (seconda passata)

🔴 Critical

controller.js:33-41 — COOKIE_OPTIONS è una factory function module-level. Solo i route handler possono essere definiti a livello di modulo nel  
 controller. Deve andare in service.js o src/utils/.

controller.js:45-67 — formatUser, formatPasskey e issueSession sono helper module-level nel controller. formatUser/formatPasskey (trasformazioni  
 dati) → service.js. issueSession (composita: JWT + cookie + format) → service.js.

controller.js:90-91 — if/throw inline con regex hardcodata in registerBegin. Doppia violazione: guard inline (→ serviceAssertValidUsername) + regex
identica a entities/user/index.js:49 (→ costante USERNAME_REGEX in constants.js).

controller.js:96, 122, 132, 165, 193, 196, 212, 231, 235, 249, 259, 283, 287, 290, 305, 319, 348, 358, 378, 384 — Tutti i if/throw inline nel  
 controller sono violazioni. Pattern ricorrenti identificati:

- if (!session) throw → appare 5 volte identica → serviceAssertSessionValid(session)
- if (!user) throw NotFound → appare 6 volte → serviceAssertUserExists(user)
- if (!verification.verified) throw → appare 2 volte → serviceAssertVerified(verification, errorType)
- if (!storedCred) throw → serviceAssertCredentialExists (già esiste ma non usata qui)

controller.js:140-153 e controller.js:309-314 — codes.map(({ hashed }) => ({ code: hashed, used: false })) ripetuto due volte inline nel  
 controller. Deve essere una funzione nel service, non costruzione inline.

---

🟡 Warning

service.js — serviceGenerateSessionId, serviceGenerateRecoveryCodes, serviceHashRecoveryCode, serviceExtractLabel sono utility pure (nessun
createHttpError, nessuna business logic). Per CLAUDE.md appartengono a src/utils/, non a service.js. Le funzioni che restano corrette in  
 service.js: serviceVerifyJwt, serviceGenerateJwt, serviceAssertCredentialExists, serviceAssertNotLastCredential, serviceVerifyRecoveryCode.

controller.js:33 — COOKIE_NAME = 'authToken' ridefinita qui e in handler.js:5. Stessa stringa in due file → constants.js.

controller.js:372 — updatedUser.credentials[updatedUser.credentials.length - 1] fragile: MongoDB non garantisce l'ordine dopo $push con scritture  
 concorrenti. Cercare per credentialId.

integration.test.js — setupDefaultMocks chiamata sia in before che in beforeEach — before è ridondante.

integration.test.js:290 — Il test login/complete failure asserisce status 400 ma il controller lancia 401 Unauthorized. L'assertion è sbagliata.

integration.test.js — Scenari negativi mancanti: passkeys/complete con sessionId invalido, passkeys/complete con verified: false, regen/complete  
 con sessionId invalido o WebAuthn fallita, recover senza username/code, DELETE /passkeys/:id con id non-ObjectId, login/complete con credentialId
non trovato.

unit.test.js — Nessun test del controller via \_testable + DAO mockati. Solo il service è testato. Pattern mancante rispetto a order/unit.test.js.

challengeStore.js — CHALLENGE*TTL_MS = 5min e il cron */5 \_ \* \* \* sono due hardcoded separati che devono rimanere allineati. Nessuna costante  
 condivisa.

---

🟢 Minor

controller.js:38 — 7 _ 24 _ 60 _ 60 _ 1000 (cookie maxAge) è un magic number inline. Il JWT usa JWT_EXPIRY = '7d' in service.js ma l'equivalente in
ms non è derivato da lì.

service.js:5-6 — RECOVERY_CODE_COUNT = 8 e JWT_EXPIRY = '7d' sono costanti private nel service, non visibili globalmente. Candidati a constants.js.

entities/user/index.js:55 — Ruoli hardcoded ['admin', 'user'] invece di Object.values(Roles).

integration.test.js:373 — c.startsWith('authToken=;') || c.includes('authToken=;') — startsWith è sottoinsieme di includes, il check è ridondante.

handler.js — Double quotes vs single quotes: violazione Biome singleQuote, pre-esistente ma visibile ora.

---

Rispetto alla prima review, questa passata ha trovato in più: tutti gli if/throw sistematici nel controller (primo giro ne aveva catturati solo  
 2-3), il problema issueSession come helper module-level, la distinzione service/utils per le utility pure, e il disallineamento TTL tra  
 challengeStore e cron.
