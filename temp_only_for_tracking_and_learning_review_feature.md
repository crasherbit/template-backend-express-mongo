---

🔴 Critical (5)

1. controller.js:90 — Regex username duplicata dall'entity  
   La regex /^[a-zA-Z0-9._\-]{3,25}$/ è hardcodata nel controller e identica a quella nell'entity. Due fonti di verità. Violazione diretta della nuova
   regola "Reuse before writing".  

2. controller.js:133,360 — Destructuring di registrationInfo senza null guard  
   Se verifyRegistrationResponse torna verified: true ma registrationInfo è assente, const { credential: cred } = verification.registrationInfo  
   esplode con TypeError non gestito.  

3. controller.js:372 — Ultima posizione dell'array assunta come nuova passkey  
   updatedUser.credentials[credentials.length - 1] è fragile: se Mongoose non mantiene l'ordine, si restituisce la credential sbagliata al client. Va
   cercata per credentialId.  

4. controller.js:253 — clearCookie senza le stesse options della creazione  
   res.clearCookie(COOKIE_NAME) senza sameSite: 'strict' e secure. Il browser può ignorare silenziosamente il clear perché gli attributi non  
   corrispondono a quelli del set.  

5. service.js:19-28 — Entropia insufficiente nei recovery codes  
   randomBytes(2) = 2 byte = 16 bit per segmento × 3 = 48 bit totali. Sotto il minimo raccomandato di 128 bit per credenziali di recupero.  


---

🟡 Warning (11)

6. controller.js:33 — COOKIE_NAME ridefinito, già esiste in handler.js:5  
   Stessa stringa "authToken" in due file. Violazione "Reuse before writing".

7. controller.js:90 — Validazione username nel controller invece che nel service/entity  
   La convention dice: nessuna validazione manuale nel controller, delegata a Mongoose. registerBegin fa una regex check inline; registerComplete  
   lascia invece fare a Mongoose. Incoerente all'interno della stessa feature.

8. handler.js:33-41 — Duplica serviceVerifyJwt invece di importarla  
   handler.js implementa la propria verifyJwtFromCookie con jwt.verify direttamente. service.js esporta già serviceVerifyJwt che fa lo stesso. Se si
   aggiunge una blacklist, va aggiornata in due posti.

9. unit.test.js — Manca il test del controller via \_testable  
   I test coprono solo il service. Il pattern del progetto (vedi order/unit.test.js) prevede anche test del controller con DAO mockati per verificare
   la sequenza di orchestrazione. L'export \_testable esiste ma non ha test.

10. integration.test.js:276 — Status code errato nel test login-fail-verify  
    Il controller lancia 401 Unauthorized quando verified: false, ma il test asserisce res.status === 400. Il test passa per la ragione sbagliata (la
    mancanza di response nel credential body fa scattare il 401 prima ancora del mock).

11. integration.test.js — createTestAuthCookie mai usata nel file  
    I test autenticati usano sempre il flusso register→cookie completo. createTestAuthCookie esiste apposta per evitare questo overhead ma non viene
    importata. Violazione "Reuse before writing".

12. controller.js:165 — loginBegin senza guard su username mancante  
    daoFindByUsername(undefined) funziona "per caso" grazie al comportamento di Mongoose con undefined. registerBegin valida esplicitamente, loginBegin
    no. Incoerenza.

13. entity/user/index.js:55 — Ruoli hardcodati invece di Object.values(Roles)  
    Già noto dalla tua review. Violazione confermata.

14. controller.js:399 — \_testable esportato ma senza test  
    Fuorviante per chi legge il codice in futuro: si aspetta test unitari che non esistono.

15. integration.test.js — Mancano negativi per regenComplete e addPasskeyComplete  
    Nessun test per sessionId scaduto/invalido su questi due endpoint. La convention CLAUDE.md richiede copertura scenari negativi.

---

🟢 Minor (6)

16. handler.js — Quote doppie vs singole  
    handler.js usa doppi apici, il resto del codebase singoli. Biome dovrebbe fixare in automatico ma non è stato applicato.

17. controller.js:46-56 — formatUser e formatPasskey sono funzioni pure nel controller  
    Trasformazioni dati senza logica Express: appartengono a service.js per architettura.

18. integration.test.js:109,120 — setupDefaultMocks() chiamato in before E beforeEach  
    before è ridondante, beforeEach basta. Harmless ma rumoroso.

19. cron/index.js:4 — cronManager dichiarata async senza nessun await  
    async superfluo.

20. dao.js:27 — daoUpdateCredentialCounter senza returnDocument: 'after'  
    Tutte le altre mutation lo usano. Inconsistente.

21. service.js:77 — serviceExtractLabel duplicata in due punti del controller  
    registerComplete e addPasskeyComplete la chiamano entrambi inline — minima duplicazione.

---

22 findings totali: 5 critici, 11 warning, 6 minori. Vuoi che inizio a fixare partendo dai critici?
