// Blog posts (the website's "Insights"). The first six are the articles on the OrgTik website
// (landing-directions/src/reference/Insights.jsx); the rest are written in the same voice.
// English carries the full article; de/fr/it carry the takeaways and the first paragraph of each section.
const { LANGS, LOCALE_TAG, mapLoc, slugify, stripHtml } = require("../lib");

const TAKEAWAYS = { en: "Key takeaways", de: "Das Wichtigste in Kürze", fr: "À retenir", it: "In sintesi" };
const html = (lang, a) =>
  `<p><strong>${TAKEAWAYS[lang]}</strong></p><ul>${a.t.map((x) => `<li>${x}</li>`).join("")}</ul>` +
  a.b.map(([h, ps]) => `<h2>${h}</h2>${ps.map((p) => `<p>${p}</p>`).join("")}`).join("");

const POSTS = [
  {
    key: "connected-digital-system", serviceKey: "development", imageId: 7, date: "2026-09-18T08:30:00Z", updated: "2026-09-20T13:10:00Z",
    authorKey: "admin", editorKey: "u14", views: 2840, visibility: true, readingTime: 7,
    slug: { en: "connected-digital-system" },
    title: { en: "When a website becomes part of the operating system", de: "Wenn die Website Teil des Betriebssystems wird", fr: "Quand le site web fait partie du système d’exploitation", it: "Quando il sito web diventa parte del sistema operativo" },
    description: {
      en: "A practical way to connect customer experience, team workflow, and the tools behind both.",
      de: "Ein praktischer Weg, Kundenerlebnis, Teamabläufe und die Werkzeuge dahinter zu verbinden.",
      fr: "Une manière concrète de relier l’expérience client, le travail des équipes et les outils qui les soutiennent.",
      it: "Un modo pratico per collegare esperienza del cliente, flussi di lavoro del team e gli strumenti dietro a entrambi.",
    },
    keywords: {
      en: ["connected website", "digital workflow", "business systems", "CRM integration"],
      de: ["vernetzte Website", "digitale Abläufe", "Geschäftssysteme", "CRM-Integration"],
      fr: ["site web connecté", "flux de travail numérique", "systèmes d’entreprise", "intégration CRM"],
      it: ["sito web connesso", "flusso di lavoro digitale", "sistemi aziendali", "integrazione CRM"],
    },
    body: {
      en: {
        t: ["Treat the website as part of how the business runs, not a separate brochure.", "Map the hand-offs between customer actions and team workflows before choosing tools.", "Start with one connected journey and extend from there."],
        b: [
          ["The website is already an operating tool", ["Every enquiry form, booking request and product page starts work somewhere inside the business. When the website is treated as a standalone brochure, that work arrives without context and someone has to re-type, forward or chase it.", "Seeing the website as part of the operating system changes the brief: the question is no longer only how a page looks, but what happens after someone uses it."]],
          ["Map the hand-offs first", ["Before choosing tools, list the moments where a customer action becomes internal work: a request becomes a lead, a lead becomes a project, a project creates documents and follow-ups.", "For each hand-off, note who picks it up, what information they need and where it currently gets lost. That map is more valuable than any feature list."]],
          ["Connect one journey at a time", ["Trying to connect everything at once usually stalls. Pick the journey that costs the most time today — often enquiry to first reply — and connect it end to end.", "Once that journey works, the next one is easier, because the shared records and habits already exist."]],
        ],
      },
      de: {
        t: ["Behandeln Sie die Website als Teil der Geschäftsabläufe, nicht als separate Broschüre.", "Skizzieren Sie die Übergaben zwischen Kundenaktionen und Teamabläufen, bevor Sie Werkzeuge wählen.", "Beginnen Sie mit einem verbundenen Ablauf und bauen Sie von dort aus weiter."],
        b: [
          ["Die Website ist bereits ein Arbeitswerkzeug", ["Jedes Kontaktformular, jede Buchungsanfrage und jede Produktseite löst irgendwo im Unternehmen Arbeit aus. Wird die Website als eigenständige Broschüre behandelt, kommt diese Arbeit ohne Kontext an – und jemand muss abtippen, weiterleiten oder nachfassen."]],
          ["Zuerst die Übergaben skizzieren", ["Listen Sie vor der Werkzeugwahl die Momente auf, in denen eine Kundenaktion zu interner Arbeit wird: Eine Anfrage wird zum Lead, ein Lead zum Projekt, ein Projekt erzeugt Dokumente und Nachfassaktionen."]],
          ["Einen Ablauf nach dem anderen verbinden", ["Alles auf einmal zu verbinden, bleibt meist stecken. Wählen Sie den Ablauf, der heute am meisten Zeit kostet – oft von der Anfrage bis zur ersten Antwort – und verbinden Sie ihn durchgängig."]],
        ],
      },
      fr: {
        t: ["Considérez le site web comme une partie du fonctionnement de l’entreprise, pas comme une brochure à part.", "Cartographiez les passages de relais entre les actions des clients et le travail des équipes avant de choisir des outils.", "Commencez par un parcours connecté, puis étendez à partir de là."],
        b: [
          ["Le site web est déjà un outil de travail", ["Chaque formulaire de contact, demande de réservation ou page produit déclenche du travail quelque part dans l’entreprise. Lorsque le site est traité comme une brochure isolée, ce travail arrive sans contexte et quelqu’un doit ressaisir, transférer ou relancer."]],
          ["Cartographier d’abord les passages de relais", ["Avant de choisir des outils, listez les moments où une action client devient du travail interne : une demande devient un prospect, un prospect devient un projet, un projet génère des documents et des relances."]],
          ["Connecter un parcours à la fois", ["Vouloir tout connecter d’un coup finit souvent par bloquer. Choisissez le parcours qui coûte le plus de temps aujourd’hui – souvent de la demande à la première réponse – et connectez-le de bout en bout."]],
        ],
      },
      it: {
        t: ["Tratta il sito web come parte del funzionamento dell’azienda, non come una brochure separata.", "Mappa i passaggi tra le azioni dei clienti e i flussi del team prima di scegliere gli strumenti.", "Parti da un percorso collegato ed estendi da lì."],
        b: [
          ["Il sito web è già uno strumento operativo", ["Ogni modulo di contatto, richiesta di prenotazione o pagina prodotto avvia del lavoro da qualche parte in azienda. Quando il sito è trattato come una brochure a sé, quel lavoro arriva senza contesto e qualcuno deve ricopiare, inoltrare o sollecitare."]],
          ["Mappa prima i passaggi", ["Prima di scegliere gli strumenti, elenca i momenti in cui un’azione del cliente diventa lavoro interno: una richiesta diventa un contatto, un contatto diventa un progetto, un progetto genera documenti e follow-up."]],
          ["Collega un percorso alla volta", ["Collegare tutto insieme di solito si blocca. Scegli il percorso che oggi costa più tempo – spesso dalla richiesta alla prima risposta – e collegalo da capo a fondo."]],
        ],
      },
    },
  },
  {
    key: "brand-system-that-scales", serviceKey: "design", imageId: 4, date: "2026-09-10T07:45:00Z", updated: "2026-09-10T07:45:00Z",
    authorKey: "u14", editorKey: "u14", views: 1960, visibility: true, readingTime: 5,
    slug: { en: "brand-system-that-scales" },
    title: { en: "A brand system should make the next decision easier", de: "Ein Markensystem sollte die nächste Entscheidung erleichtern", fr: "Un système de marque doit faciliter la prochaine décision", it: "Un sistema di brand dovrebbe rendere più facile la prossima decisione" },
    description: {
      en: "How a useful identity creates consistency without making every touchpoint feel the same.",
      de: "Wie eine nützliche Identität Konsistenz schafft, ohne jeden Berührungspunkt gleich wirken zu lassen.",
      fr: "Comment une identité utile crée de la cohérence sans rendre chaque point de contact identique.",
      it: "Come un’identità utile crea coerenza senza rendere uguale ogni punto di contatto.",
    },
    keywords: {
      en: ["brand system", "brand guidelines", "visual identity", "design consistency"],
      de: ["Markensystem", "Markenrichtlinien", "visuelle Identität", "Designkonsistenz"],
      fr: ["système de marque", "charte graphique", "identité visuelle", "cohérence de marque"],
      it: ["sistema di brand", "linee guida del brand", "identità visiva", "coerenza del design"],
    },
    body: {
      en: {
        t: ["A brand system is a set of decisions, not a collection of files.", "Define the few rules that matter most and make them easy to apply.", "Give room for variation so touchpoints do not all look the same."],
        b: [
          ["Consistency is a side effect, not the goal", ["Teams often ask for consistency when what they really want is fewer debates. A useful brand system answers the recurring questions — which colour, which type size, which tone — before they are asked.", "When those answers are clear, consistency follows without every piece looking identical."]],
          ["Decide the few rules that matter", ["Most brands need a small core: how the logo behaves, the palette and its ratios, one or two typefaces with clear roles, and a voice that can be described in a sentence.", "Everything else can be guidance rather than law. Fewer hard rules make the system easier to adopt."]],
          ["Design for the next decision", ["A good test for any guideline is whether it makes the next decision easier for someone who was not in the room. If it needs a meeting to interpret, it is not finished yet.", "Review the system after real use: which rules were followed naturally, and which were quietly ignored? The ignored ones usually need to be simpler."]],
        ],
      },
      de: {
        t: ["Ein Markensystem ist eine Sammlung von Entscheidungen, keine Sammlung von Dateien.", "Definieren Sie die wenigen Regeln, die am meisten zählen, und machen Sie sie leicht anwendbar.", "Lassen Sie Raum für Variation, damit nicht alle Berührungspunkte gleich aussehen."],
        b: [
          ["Konsistenz ist ein Nebeneffekt, nicht das Ziel", ["Teams wünschen sich oft Konsistenz, meinen aber weniger Diskussionen. Ein nützliches Markensystem beantwortet die wiederkehrenden Fragen – welche Farbe, welche Schriftgrösse, welcher Ton –, bevor sie gestellt werden."]],
          ["Die wenigen wichtigen Regeln festlegen", ["Die meisten Marken brauchen einen kleinen Kern: wie sich das Logo verhält, die Palette und ihre Anteile, ein bis zwei Schriften mit klaren Rollen und eine Tonalität, die sich in einem Satz beschreiben lässt."]],
          ["Für die nächste Entscheidung gestalten", ["Ein guter Test für jede Richtlinie: Erleichtert sie die nächste Entscheidung für jemanden, der nicht im Raum war? Braucht sie ein Meeting zur Auslegung, ist sie noch nicht fertig."]],
        ],
      },
      fr: {
        t: ["Un système de marque est un ensemble de décisions, pas une collection de fichiers.", "Définissez les quelques règles essentielles et rendez-les faciles à appliquer.", "Laissez de la place à la variation pour que tous les points de contact ne se ressemblent pas."],
        b: [
          ["La cohérence est un effet secondaire, pas un objectif", ["Les équipes demandent souvent de la cohérence alors qu’elles veulent surtout moins de débats. Un système de marque utile répond aux questions récurrentes – quelle couleur, quelle taille de texte, quel ton – avant même qu’elles ne soient posées."]],
          ["Fixer les quelques règles qui comptent", ["La plupart des marques ont besoin d’un petit noyau : le comportement du logo, la palette et ses proportions, une ou deux typographies aux rôles clairs et un ton que l’on peut décrire en une phrase."]],
          ["Concevoir pour la prochaine décision", ["Un bon test pour chaque règle : facilite-t-elle la prochaine décision de quelqu’un qui n’était pas dans la salle ? Si elle nécessite une réunion pour être interprétée, elle n’est pas terminée."]],
        ],
      },
      it: {
        t: ["Un sistema di brand è un insieme di decisioni, non una raccolta di file.", "Definisci le poche regole che contano di più e rendile facili da applicare.", "Lascia spazio alla variazione, così i punti di contatto non sembrano tutti uguali."],
        b: [
          ["La coerenza è un effetto, non l’obiettivo", ["I team chiedono spesso coerenza quando in realtà vogliono meno discussioni. Un sistema di brand utile risponde alle domande ricorrenti – quale colore, quale dimensione del testo, quale tono – prima che vengano poste."]],
          ["Decidi le poche regole che contano", ["La maggior parte dei brand ha bisogno di un piccolo nucleo: come si comporta il logo, la palette e le sue proporzioni, uno o due caratteri con ruoli chiari e un tono descrivibile in una frase."]],
          ["Progetta per la prossima decisione", ["Un buon test per ogni linea guida: rende più facile la prossima decisione a chi non era nella stanza? Se serve una riunione per interpretarla, non è ancora finita."]],
        ],
      },
    },
  },
  {
    key: "managed-hosting-questions", serviceKey: "hosting", imageId: 5, date: "2026-09-02T09:00:00Z", updated: "2026-09-04T16:20:00Z",
    authorKey: "u14", editorKey: "admin", views: 3420, visibility: true, readingTime: 6,
    slug: { en: "managed-hosting-questions" },
    title: { en: "Five questions to ask before choosing managed hosting", de: "Fünf Fragen vor der Wahl eines Managed Hostings", fr: "Cinq questions à poser avant de choisir un hébergement géré", it: "Cinque domande da porsi prima di scegliere un hosting gestito" },
    description: {
      en: "Look beyond storage and compare the care, recovery, monitoring, and support around the service.",
      de: "Schauen Sie über den Speicherplatz hinaus und vergleichen Sie Betreuung, Wiederherstellung, Monitoring und Support.",
      fr: "Regardez au-delà de l’espace disque et comparez le suivi, la restauration, la surveillance et le support.",
      it: "Guarda oltre lo spazio di archiviazione e confronta assistenza, ripristino, monitoraggio e supporto.",
    },
    keywords: {
      en: ["managed hosting", "website backups", "hosting support", "website monitoring"],
      de: ["Managed Hosting", "Website-Backups", "Hosting-Support", "Website-Monitoring"],
      fr: ["hébergement géré", "sauvegardes de site", "support d’hébergement", "surveillance de site"],
      it: ["hosting gestito", "backup del sito", "supporto hosting", "monitoraggio del sito"],
    },
    body: {
      en: {
        t: ["Compare the care around hosting, not only the server specification.", "Ask how recovery works before you ever need it.", "Make sure support knows the website, not just the infrastructure."],
        b: [
          ["1. What happens when something breaks?", ["Ask who notices first, how you are told and what the typical steps to recovery look like. A clear, honest answer is worth more than a headline availability figure."]],
          ["2. How are backups taken and tested?", ["Backups only matter if they can be restored. Ask how often they run, where they are stored, and when a restore was last tested end to end."]],
          ["3. Who looks after updates?", ["Platforms, plugins and dependencies need regular care. Clarify what is updated automatically, what is reviewed first and who checks the website afterwards."]],
          ["4. How is performance watched?", ["Monitoring should cover what visitors experience, not only whether the server is up. Ask which signals are tracked and what happens when they drift."]],
          ["5. Does support understand your website?", ["The most useful support comes from people who know how the website was built and why. Hosting that sits close to the team that designed and maintains the site shortens every conversation."]],
        ],
      },
      de: {
        t: ["Vergleichen Sie die Betreuung rund um das Hosting, nicht nur die Serverdaten.", "Fragen Sie, wie die Wiederherstellung funktioniert, bevor Sie sie brauchen.", "Achten Sie darauf, dass der Support die Website kennt, nicht nur die Infrastruktur."],
        b: [
          ["1. Was passiert, wenn etwas ausfällt?", ["Fragen Sie, wer es zuerst bemerkt, wie Sie informiert werden und wie die typischen Schritte zur Wiederherstellung aussehen."]],
          ["2. Wie werden Backups erstellt und getestet?", ["Backups zählen nur, wenn sie sich wiederherstellen lassen. Fragen Sie, wie oft sie laufen, wo sie liegen und wann zuletzt eine vollständige Wiederherstellung getestet wurde."]],
          ["3. Wer kümmert sich um Updates?", ["Plattformen, Plugins und Abhängigkeiten brauchen regelmässige Pflege. Klären Sie, was automatisch aktualisiert wird, was vorher geprüft wird und wer die Website danach kontrolliert."]],
          ["4. Wie wird die Performance überwacht?", ["Monitoring sollte abbilden, was Besucher erleben – nicht nur, ob der Server läuft."]],
          ["5. Kennt der Support Ihre Website?", ["Der hilfreichste Support kommt von Menschen, die wissen, wie und warum die Website gebaut wurde."]],
        ],
      },
      fr: {
        t: ["Comparez le suivi autour de l’hébergement, pas seulement la fiche technique du serveur.", "Demandez comment fonctionne la restauration avant d’en avoir besoin.", "Assurez-vous que le support connaît votre site, pas seulement l’infrastructure."],
        b: [
          ["1. Que se passe-t-il en cas de panne ?", ["Demandez qui s’en aperçoit en premier, comment vous êtes informé et à quoi ressemblent les étapes habituelles de rétablissement."]],
          ["2. Comment les sauvegardes sont-elles faites et testées ?", ["Une sauvegarde ne vaut que si elle peut être restaurée. Demandez leur fréquence, leur lieu de stockage et la date du dernier test de restauration complet."]],
          ["3. Qui s’occupe des mises à jour ?", ["Plateformes, extensions et dépendances demandent un entretien régulier. Clarifiez ce qui est mis à jour automatiquement, ce qui est vérifié avant et qui contrôle le site ensuite."]],
          ["4. Comment les performances sont-elles surveillées ?", ["La surveillance doit refléter l’expérience des visiteurs, pas seulement la disponibilité du serveur."]],
          ["5. Le support connaît-il votre site ?", ["Le support le plus utile vient de personnes qui savent comment et pourquoi le site a été construit."]],
        ],
      },
      it: {
        t: ["Confronta l’assistenza attorno all’hosting, non solo le specifiche del server.", "Chiedi come funziona il ripristino prima che ti serva.", "Assicurati che il supporto conosca il tuo sito, non solo l’infrastruttura."],
        b: [
          ["1. Cosa succede quando qualcosa si guasta?", ["Chiedi chi se ne accorge per primo, come vieni informato e quali sono i passaggi tipici per il ripristino."]],
          ["2. Come vengono eseguiti e testati i backup?", ["I backup contano solo se si possono ripristinare. Chiedi con che frequenza vengono eseguiti, dove sono conservati e quando è stato testato l’ultimo ripristino completo."]],
          ["3. Chi si occupa degli aggiornamenti?", ["Piattaforme, plugin e dipendenze richiedono cura costante. Chiarisci cosa viene aggiornato automaticamente, cosa viene verificato prima e chi controlla il sito dopo."]],
          ["4. Come vengono monitorate le prestazioni?", ["Il monitoraggio dovrebbe misurare ciò che vivono i visitatori, non solo se il server è acceso."]],
          ["5. Il supporto conosce il tuo sito?", ["Il supporto più utile arriva da persone che sanno come e perché il sito è stato costruito."]],
        ],
      },
    },
  },
  {
    key: "campaigns-with-a-system", serviceKey: "marketing", imageId: 6, date: "2026-08-26T08:10:00Z", updated: "2026-08-27T10:00:00Z",
    authorKey: "u12", editorKey: "u12", views: 1510, visibility: true, readingTime: 8,
    slug: { en: "campaigns-with-a-system" },
    title: { en: "Campaigns work better when the system is visible", de: "Kampagnen wirken besser, wenn das System sichtbar ist", fr: "Les campagnes fonctionnent mieux quand le système est visible", it: "Le campagne funzionano meglio quando il sistema è visibile" },
    description: {
      en: "Connect the brief, audience, content, decisions, and learning loop before activity accelerates.",
      de: "Verbinden Sie Briefing, Zielgruppe, Inhalte, Entscheidungen und Lernschleife, bevor die Aktivität Fahrt aufnimmt.",
      fr: "Reliez le brief, le public, les contenus, les décisions et la boucle d’apprentissage avant que l’activité ne s’accélère.",
      it: "Collega brief, pubblico, contenuti, decisioni e ciclo di apprendimento prima che l’attività acceleri.",
    },
    keywords: {
      en: ["campaign planning", "marketing brief", "content strategy", "marketing analytics"],
      de: ["Kampagnenplanung", "Marketing-Briefing", "Content-Strategie", "Marketing-Analyse"],
      fr: ["planification de campagne", "brief marketing", "stratégie de contenu", "analyse marketing"],
      it: ["pianificazione delle campagne", "brief di marketing", "strategia dei contenuti", "analisi di marketing"],
    },
    body: {
      en: {
        t: ["Write the brief before production starts, not after.", "Keep audience, message, channel and owner visible in one place.", "Close every campaign with a learning that informs the next one."],
        b: [
          ["Activity is not a strategy", ["Busy campaign calendars can hide a lack of direction. When each post, ad and email is planned in isolation, it becomes hard to say what worked and why.", "A visible system connects every piece of activity to the decision it is meant to support."]],
          ["One brief, shared early", ["A short brief — the goal, the audience, the core message, the channels and the owner — gives everyone the same starting point. It also makes it easier to say no to work that does not fit.", "Keep the brief where the team already works, so it is referenced rather than forgotten."]],
          ["Build the learning loop in", ["Decide up front which signal will tell you whether the campaign is working, and when you will look at it. Then record what you learned, even when the answer is inconclusive.", "Over time, those small notes become the most valuable marketing asset a team has."]],
        ],
      },
      de: {
        t: ["Schreiben Sie das Briefing vor dem Produktionsstart, nicht danach.", "Halten Sie Zielgruppe, Botschaft, Kanal und Verantwortung an einem Ort sichtbar.", "Schliessen Sie jede Kampagne mit einer Erkenntnis ab, die in die nächste einfliesst."],
        b: [
          ["Aktivität ist keine Strategie", ["Volle Kampagnenkalender können fehlende Richtung verbergen. Wird jeder Post, jede Anzeige und jede E-Mail isoliert geplant, lässt sich kaum sagen, was funktioniert hat und warum."]],
          ["Ein Briefing, früh geteilt", ["Ein kurzes Briefing – Ziel, Zielgruppe, Kernbotschaft, Kanäle und Verantwortung – gibt allen denselben Ausgangspunkt."]],
          ["Die Lernschleife einbauen", ["Legen Sie vorab fest, welches Signal zeigt, ob die Kampagne funktioniert, und wann Sie es anschauen. Halten Sie danach fest, was Sie gelernt haben."]],
        ],
      },
      fr: {
        t: ["Rédigez le brief avant le lancement de la production, pas après.", "Gardez public, message, canal et responsable visibles au même endroit.", "Terminez chaque campagne par un enseignement qui nourrit la suivante."],
        b: [
          ["L’activité n’est pas une stratégie", ["Des calendriers de campagne chargés peuvent masquer un manque de direction. Quand chaque post, annonce et e-mail est planifié isolément, il devient difficile de dire ce qui a fonctionné et pourquoi."]],
          ["Un seul brief, partagé tôt", ["Un brief court – l’objectif, le public, le message clé, les canaux et le responsable – donne à tous le même point de départ."]],
          ["Intégrer la boucle d’apprentissage", ["Décidez à l’avance quel signal indiquera si la campagne fonctionne et quand vous le regarderez. Notez ensuite ce que vous avez appris, même si la réponse n’est pas concluante."]],
        ],
      },
      it: {
        t: ["Scrivi il brief prima che inizi la produzione, non dopo.", "Tieni pubblico, messaggio, canale e responsabile visibili in un unico posto.", "Chiudi ogni campagna con un apprendimento che alimenta la successiva."],
        b: [
          ["L’attività non è una strategia", ["Calendari di campagna pieni possono nascondere una mancanza di direzione. Quando ogni post, annuncio ed e-mail è pianificato da solo, diventa difficile dire cosa ha funzionato e perché."]],
          ["Un brief, condiviso presto", ["Un brief breve – obiettivo, pubblico, messaggio chiave, canali e responsabile – dà a tutti lo stesso punto di partenza."]],
          ["Costruisci il ciclo di apprendimento", ["Decidi in anticipo quale segnale dirà se la campagna funziona e quando lo guarderai. Poi annota cosa hai imparato, anche quando la risposta non è definitiva."]],
        ],
      },
    },
  },
  {
    key: "designing-for-change", serviceKey: "design", imageId: 11, date: "2026-08-14T07:30:00Z", updated: "2026-08-18T09:40:00Z",
    authorKey: "u14", editorKey: "admin", views: 1275, visibility: true, readingTime: 6,
    slug: { en: "designing-for-change" },
    title: { en: "Designing a website that can change without losing itself", de: "Eine Website gestalten, die sich verändern kann, ohne sich zu verlieren", fr: "Concevoir un site qui peut évoluer sans perdre son identité", it: "Progettare un sito che può cambiare senza perdere se stesso" },
    description: {
      en: "A clear hierarchy and reusable patterns help a website evolve without accumulating visual debt.",
      de: "Eine klare Hierarchie und wiederverwendbare Muster lassen eine Website wachsen, ohne visuelle Altlasten anzuhäufen.",
      fr: "Une hiérarchie claire et des modèles réutilisables permettent au site d’évoluer sans accumuler de dette visuelle.",
      it: "Una gerarchia chiara e pattern riutilizzabili aiutano il sito a evolvere senza accumulare debito visivo.",
    },
    keywords: {
      en: ["website design system", "content modelling", "web design patterns", "CMS guardrails"],
      de: ["Website-Designsystem", "Content-Modellierung", "Webdesign-Muster", "CMS-Leitplanken"],
      fr: ["système de design web", "modélisation de contenu", "modèles de conception web", "garde-fous CMS"],
      it: ["design system del sito", "modellazione dei contenuti", "pattern di web design", "regole per il CMS"],
    },
    body: {
      en: {
        t: ["Plan for the website to change from the first day.", "A clear hierarchy and reusable patterns prevent visual debt.", "Give content owners guardrails instead of blank canvases."],
        b: [
          ["Every website changes", ["New services, new team members and new priorities all end up on the website. Designs that only work for launch-day content start to fray within months.", "Designing for change means assuming the content will grow, shrink and move — and making that easy."]],
          ["Patterns over pages", ["Instead of designing every page from scratch, define a small set of sections that can be combined: an introduction, a feature list, a story, a call to action. Each should work with more or less content than planned.", "New pages then become new combinations, not new designs, and the visual language stays coherent."]],
          ["Guardrails for the people who edit", ["Content owners need freedom within limits. Sensible defaults, clear field labels and a preview that matches the live site prevent most layout problems before they happen.", "The best measure of success is simple: the site still looks considered a year after launch."]],
        ],
      },
      de: {
        t: ["Planen Sie vom ersten Tag an, dass sich die Website verändert.", "Eine klare Hierarchie und wiederverwendbare Muster verhindern visuelle Altlasten.", "Geben Sie Redaktionsteams Leitplanken statt leerer Leinwände."],
        b: [
          ["Jede Website verändert sich", ["Neue Services, neue Teammitglieder und neue Prioritäten landen alle auf der Website. Designs, die nur mit den Inhalten zum Launch funktionieren, zerfasern innerhalb weniger Monate."]],
          ["Muster statt Seiten", ["Statt jede Seite neu zu gestalten, definieren Sie wenige kombinierbare Abschnitte: eine Einleitung, eine Liste von Vorteilen, eine Geschichte, einen Handlungsaufruf."]],
          ["Leitplanken für alle, die Inhalte pflegen", ["Redaktionsteams brauchen Freiheit mit Grenzen. Sinnvolle Standards, klare Feldbezeichnungen und eine Vorschau, die der Live-Seite entspricht, verhindern die meisten Layoutprobleme."]],
        ],
      },
      fr: {
        t: ["Prévoyez dès le premier jour que le site va évoluer.", "Une hiérarchie claire et des modèles réutilisables évitent la dette visuelle.", "Donnez aux rédacteurs des garde-fous plutôt qu’une page blanche."],
        b: [
          ["Chaque site change", ["Nouveaux services, nouveaux collaborateurs, nouvelles priorités : tout finit sur le site. Un design qui ne fonctionne qu’avec les contenus du lancement s’effiloche en quelques mois."]],
          ["Des modèles plutôt que des pages", ["Plutôt que de concevoir chaque page de zéro, définissez quelques sections combinables : une introduction, une liste d’avantages, un récit, un appel à l’action."]],
          ["Des garde-fous pour ceux qui éditent", ["Les rédacteurs ont besoin de liberté dans un cadre. Des valeurs par défaut sensées, des libellés clairs et un aperçu fidèle au site en ligne évitent la plupart des problèmes de mise en page."]],
        ],
      },
      it: {
        t: ["Pianifica fin dal primo giorno che il sito cambierà.", "Una gerarchia chiara e pattern riutilizzabili evitano il debito visivo.", "Dai a chi gestisce i contenuti delle guide, non una tela bianca."],
        b: [
          ["Ogni sito cambia", ["Nuovi servizi, nuove persone e nuove priorità finiscono tutti sul sito. Un design che funziona solo con i contenuti del lancio si sfilaccia in pochi mesi."]],
          ["Pattern al posto delle pagine", ["Invece di progettare ogni pagina da zero, definisci poche sezioni combinabili: un’introduzione, un elenco di vantaggi, una storia, un invito all’azione."]],
          ["Guide per chi modifica i contenuti", ["Chi gestisce i contenuti ha bisogno di libertà entro dei limiti. Impostazioni predefinite sensate, etichette chiare e un’anteprima fedele al sito pubblicato prevengono la maggior parte dei problemi di layout."]],
        ],
      },
    },
  },
  {
    key: "frontend-performance-budget", serviceKey: "development", imageId: 16, date: "2026-08-04T08:00:00Z", updated: "2026-08-06T12:15:00Z",
    authorKey: "admin", editorKey: "u14", views: 2190, visibility: true, readingTime: 9,
    slug: { en: "frontend-performance-budget" },
    title: { en: "Performance budgets belong in the design conversation", de: "Performance-Budgets gehören ins Designgespräch", fr: "Les budgets de performance ont leur place dans la conversation design", it: "I budget di performance fanno parte della conversazione sul design" },
    description: {
      en: "Media, motion, type, and interaction decisions shape perceived speed long before deployment.",
      de: "Entscheidungen zu Medien, Animation, Schrift und Interaktion prägen die gefühlte Geschwindigkeit lange vor dem Deployment.",
      fr: "Les choix de médias, d’animation, de typographie et d’interaction façonnent la vitesse perçue bien avant la mise en ligne.",
      it: "Le scelte su media, animazioni, caratteri e interazioni determinano la velocità percepita molto prima del rilascio.",
    },
    keywords: {
      en: ["performance budget", "web performance", "Core Web Vitals", "frontend optimisation"],
      de: ["Performance-Budget", "Web-Performance", "Core Web Vitals", "Frontend-Optimierung"],
      fr: ["budget de performance", "performance web", "Core Web Vitals", "optimisation front-end"],
      it: ["budget di performance", "prestazioni web", "Core Web Vitals", "ottimizzazione front-end"],
    },
    body: {
      en: {
        t: ["Performance is shaped by design decisions long before development.", "Agree a budget for media, motion and fonts early.", "Measure what visitors feel, not only what tools score."],
        b: [
          ["Speed is a design outcome", ["Large hero media, many font weights and heavy animation all have a cost. By the time a design reaches development, most of the performance picture has already been decided.", "Bringing performance into the design conversation early avoids painful trade-offs later."]],
          ["Set a budget together", ["A simple budget — how much media per page, how many font files, which interactions may animate — gives designers and developers a shared constraint to work within.", "The budget is not a limit on ambition; it is a way to spend weight where it matters most."]],
          ["Measure perceived speed", ["Visitors judge speed by how quickly they can read and act, not by a single score. Watch how soon the main content appears, whether the layout jumps and how responsive the first interactions feel.", "Review these signals after every significant change, so the website stays fast as it evolves."]],
        ],
      },
      de: {
        t: ["Performance wird durch Designentscheidungen geprägt, lange vor der Entwicklung.", "Vereinbaren Sie früh ein Budget für Medien, Animation und Schriften.", "Messen Sie, was Besucher spüren, nicht nur, was Tools bewerten."],
        b: [
          ["Geschwindigkeit ist ein Designergebnis", ["Grosse Hero-Medien, viele Schriftschnitte und aufwendige Animationen haben ihren Preis. Wenn ein Design die Entwicklung erreicht, ist das Performance-Bild meist schon entschieden."]],
          ["Gemeinsam ein Budget festlegen", ["Ein einfaches Budget – wie viele Medien pro Seite, wie viele Schriftdateien, welche Interaktionen animiert werden dürfen – gibt Design und Entwicklung einen gemeinsamen Rahmen."]],
          ["Die gefühlte Geschwindigkeit messen", ["Besucher beurteilen Tempo danach, wie schnell sie lesen und handeln können. Beobachten Sie, wann der Hauptinhalt erscheint, ob das Layout springt und wie schnell erste Interaktionen reagieren."]],
        ],
      },
      fr: {
        t: ["La performance se joue dans les choix de design, bien avant le développement.", "Convenez tôt d’un budget pour les médias, les animations et les polices.", "Mesurez ce que ressentent les visiteurs, pas seulement ce que notent les outils."],
        b: [
          ["La vitesse est un résultat du design", ["Grands médias en en-tête, nombreuses graisses de police et animations lourdes ont un coût. Quand un design arrive au développement, l’essentiel de la performance est déjà décidé."]],
          ["Fixer un budget ensemble", ["Un budget simple – combien de médias par page, combien de fichiers de police, quelles interactions peuvent être animées – donne au design et au développement une contrainte commune."]],
          ["Mesurer la vitesse perçue", ["Les visiteurs jugent la vitesse à la rapidité avec laquelle ils peuvent lire et agir. Observez quand le contenu principal apparaît, si la mise en page saute et la réactivité des premières interactions."]],
        ],
      },
      it: {
        t: ["Le prestazioni si decidono con le scelte di design, molto prima dello sviluppo.", "Concorda presto un budget per media, animazioni e caratteri.", "Misura ciò che percepiscono i visitatori, non solo ciò che valutano gli strumenti."],
        b: [
          ["La velocità è un risultato del design", ["Grandi media in apertura, molti pesi di carattere e animazioni complesse hanno un costo. Quando un design arriva allo sviluppo, gran parte delle prestazioni è già decisa."]],
          ["Fissate insieme un budget", ["Un budget semplice – quanti media per pagina, quanti file di font, quali interazioni possono essere animate – offre a design e sviluppo un vincolo condiviso."]],
          ["Misura la velocità percepita", ["I visitatori giudicano la velocità da quanto presto possono leggere e agire. Osserva quando appare il contenuto principale, se il layout salta e quanto rispondono le prime interazioni."]],
        ],
      },
    },
  },
  {
    key: "local-seo-four-languages", serviceKey: "marketing", imageId: 21, date: "2026-07-22T07:50:00Z", updated: "2026-07-23T08:30:00Z",
    authorKey: "u12", editorKey: "u14", views: 4030, visibility: true, readingTime: 6,
    title: { en: "Local SEO for Swiss SMEs: getting found in four languages", de: "Lokales SEO für Schweizer KMU: in vier Sprachen gefunden werden", fr: "SEO local pour les PME suisses : être trouvé en quatre langues", it: "SEO locale per le PMI svizzere: farsi trovare in quattro lingue" },
    description: {
      en: "Why language regions, location pages and a well-kept business profile matter more than a long keyword list.",
      de: "Warum Sprachregionen, Standortseiten und ein gepflegtes Unternehmensprofil mehr bringen als lange Keyword-Listen.",
      fr: "Pourquoi les régions linguistiques, les pages locales et une fiche d’entreprise soignée comptent plus qu’une longue liste de mots-clés.",
      it: "Perché regioni linguistiche, pagine locali e un profilo aziendale curato contano più di una lunga lista di parole chiave.",
    },
    keywords: {
      en: ["local SEO", "multilingual SEO", "Google Business Profile", "Swiss SMEs"],
      de: ["lokales SEO", "mehrsprachiges SEO", "Google-Unternehmensprofil", "Schweizer KMU"],
      fr: ["SEO local", "SEO multilingue", "fiche Google Business", "PME suisses"],
      it: ["SEO locale", "SEO multilingue", "Profilo dell’attività su Google", "PMI svizzere"],
    },
    body: {
      en: {
        t: ["Treat each language region as its own search market.", "Build one useful page per location or service area instead of thin duplicates.", "Keep your business profile, reviews and opening hours current – search engines notice."],
        b: [
          ["Four languages, four search habits", ["People in Bern, Lausanne and Lugano search for the same service with different words – and sometimes with different expectations. A German page translated word for word into French rarely matches what a customer in Geneva actually types.", "Start by researching the terms each region uses, then write for that audience. Hreflang tags and clean language URLs tell search engines which version to show where."]],
          ["Location pages that earn their place", ["A page for every town you serve is only useful if it says something specific: how to reach you, which team covers the area, projects nearby. Copy-paste pages with a swapped city name tend to be ignored.", "Two or three strong location pages usually outperform twenty thin ones."]],
          ["The profile is part of the website", ["For many searches, your Google Business Profile is the first thing people see. Accurate categories, current opening hours, real photos and a steady flow of reviews build trust before anyone clicks.", "Answer reviews in the language they were written in – it signals that you serve that community."]],
        ],
      },
      de: {
        t: ["Behandeln Sie jede Sprachregion als eigenen Suchmarkt.", "Erstellen Sie pro Standort eine wirklich nützliche Seite statt dünner Duplikate.", "Halten Sie Unternehmensprofil, Bewertungen und Öffnungszeiten aktuell."],
        b: [
          ["Vier Sprachen, vier Suchgewohnheiten", ["Menschen in Bern, Lausanne und Lugano suchen denselben Service mit unterschiedlichen Begriffen. Eine Wort für Wort übersetzte Seite trifft selten, was jemand in Genf tatsächlich eintippt."]],
          ["Standortseiten mit echtem Mehrwert", ["Eine Seite pro Ort lohnt sich nur, wenn sie etwas Konkretes sagt: Anfahrt, zuständiges Team, Projekte in der Nähe. Zwei, drei starke Standortseiten schlagen meist zwanzig dünne."]],
          ["Das Profil gehört zur Website", ["Bei vielen Suchen ist das Google-Unternehmensprofil das Erste, was Menschen sehen. Korrekte Kategorien, aktuelle Öffnungszeiten, echte Fotos und regelmässige Bewertungen schaffen Vertrauen."]],
        ],
      },
      fr: {
        t: ["Traitez chaque région linguistique comme un marché de recherche à part entière.", "Créez une page vraiment utile par site plutôt que des doublons pauvres.", "Tenez à jour votre fiche d’entreprise, vos avis et vos horaires."],
        b: [
          ["Quatre langues, quatre habitudes de recherche", ["À Berne, Lausanne et Lugano, on cherche le même service avec des mots différents. Une page traduite mot à mot correspond rarement à ce qu’un client genevois tape réellement."]],
          ["Des pages locales qui méritent leur place", ["Une page par localité n’est utile que si elle dit quelque chose de précis : accès, équipe responsable, projets à proximité. Deux ou trois pages locales solides valent mieux que vingt pages creuses."]],
          ["La fiche fait partie du site", ["Pour de nombreuses recherches, la fiche Google Business est la première chose que l’on voit. Catégories exactes, horaires à jour, vraies photos et avis réguliers créent la confiance."]],
        ],
      },
      it: {
        t: ["Tratta ogni regione linguistica come un mercato di ricerca a sé.", "Crea una pagina davvero utile per ogni sede invece di duplicati poveri.", "Mantieni aggiornati profilo aziendale, recensioni e orari di apertura."],
        b: [
          ["Quattro lingue, quattro abitudini di ricerca", ["A Berna, Losanna e Lugano si cerca lo stesso servizio con parole diverse. Una pagina tradotta parola per parola raramente corrisponde a ciò che un cliente di Ginevra digita davvero."]],
          ["Pagine locali che meritano il loro posto", ["Una pagina per località serve solo se dice qualcosa di concreto: come arrivare, il team di riferimento, progetti vicini. Due o tre pagine locali solide battono di solito venti pagine vuote."]],
          ["Il profilo fa parte del sito", ["Per molte ricerche il Profilo dell’attività su Google è la prima cosa che le persone vedono. Categorie corrette, orari aggiornati, foto reali e recensioni costanti creano fiducia."]],
        ],
      },
    },
  },
  {
    key: "website-care-plan", serviceKey: "it-support", imageId: 22, date: "2026-07-08T08:20:00Z", updated: "2026-07-08T08:20:00Z",
    authorKey: "u14", editorKey: "u14", views: 1180, visibility: true, readingTime: 5,
    title: { en: "What a good website care plan actually covers", de: "Was ein guter Website-Betreuungsplan wirklich abdeckt", fr: "Ce que couvre vraiment un bon contrat de maintenance de site", it: "Cosa copre davvero un buon piano di assistenza per il sito" },
    description: {
      en: "Updates, backups and monitoring are the baseline. The value is in response times, reporting and small improvements.",
      de: "Updates, Backups und Monitoring sind die Basis. Der Mehrwert liegt in Reaktionszeiten, Reporting und kleinen Verbesserungen.",
      fr: "Mises à jour, sauvegardes et surveillance sont la base. La valeur se trouve dans les délais de réponse, le reporting et les petites améliorations.",
      it: "Aggiornamenti, backup e monitoraggio sono la base. Il valore sta nei tempi di risposta, nei report e nei piccoli miglioramenti.",
    },
    keywords: {
      en: ["website care plan", "website maintenance", "support response times", "website backups"],
      de: ["Website-Betreuungsplan", "Website-Wartung", "Reaktionszeiten", "Website-Backups"],
      fr: ["contrat de maintenance web", "maintenance de site", "délais de réponse", "sauvegardes de site"],
      it: ["piano di assistenza del sito", "manutenzione del sito", "tempi di risposta", "backup del sito"],
    },
    body: {
      en: {
        t: ["Ask for response times in writing, split by urgency.", "Expect a monthly report you can read in five minutes.", "Reserve part of the budget for improvements, not only fixes."],
        b: [
          ["The baseline every plan should include", ["Security updates for the platform and plugins, daily backups with tested restores, and uptime monitoring are the minimum. If a plan does not name these clearly, assume they are not included.", "Also ask who applies updates and whether the website is checked afterwards – automatic updates without a visual check are a common source of broken layouts."]],
          ["Response times you can rely on", ["A good plan distinguishes between “the site is down”, “a form is broken” and “please change this text”. Each category deserves its own response time, agreed before anything goes wrong.", "One inbox or ticket form for all requests keeps nothing from getting lost in personal email threads."]],
          ["Room for improvement", ["The best care plans include a small monthly budget for improvements: a faster image format, a clearer contact form, a new landing page for a campaign. Over a year, these small steps add up to a noticeably better website.", "Review the list of ideas together every quarter and pick the next three."]],
        ],
      },
      de: {
        t: ["Lassen Sie sich Reaktionszeiten schriftlich geben, nach Dringlichkeit gestaffelt.", "Erwarten Sie einen Monatsbericht, den Sie in fünf Minuten lesen können.", "Reservieren Sie einen Teil des Budgets für Verbesserungen, nicht nur für Korrekturen."],
        b: [
          ["Die Basis jedes Plans", ["Sicherheitsupdates für Plattform und Plugins, tägliche Backups mit getesteten Wiederherstellungen und Verfügbarkeits-Monitoring sind das Minimum."]],
          ["Verlässliche Reaktionszeiten", ["Ein guter Plan unterscheidet zwischen «die Website ist offline», «ein Formular funktioniert nicht» und «bitte diesen Text ändern» – jeweils mit eigener Reaktionszeit."]],
          ["Raum für Verbesserungen", ["Die besten Betreuungspläne enthalten ein kleines Monatsbudget für Verbesserungen. Über ein Jahr ergibt das eine spürbar bessere Website."]],
        ],
      },
      fr: {
        t: ["Demandez des délais de réponse écrits, selon l’urgence.", "Attendez-vous à un rapport mensuel lisible en cinq minutes.", "Réservez une part du budget aux améliorations, pas seulement aux corrections."],
        b: [
          ["La base de tout contrat", ["Mises à jour de sécurité de la plateforme et des extensions, sauvegardes quotidiennes avec restaurations testées et surveillance de la disponibilité sont un minimum."]],
          ["Des délais de réponse fiables", ["Un bon contrat distingue « le site est hors ligne », « un formulaire ne fonctionne pas » et « merci de modifier ce texte », chacun avec son propre délai."]],
          ["De la place pour s’améliorer", ["Les meilleurs contrats prévoient un petit budget mensuel d’améliorations. Sur une année, ces petits pas donnent un site nettement meilleur."]],
        ],
      },
      it: {
        t: ["Chiedi tempi di risposta scritti, distinti per urgenza.", "Aspettati un report mensile che si legge in cinque minuti.", "Riserva parte del budget ai miglioramenti, non solo alle correzioni."],
        b: [
          ["La base di ogni piano", ["Aggiornamenti di sicurezza per piattaforma e plugin, backup giornalieri con ripristini testati e monitoraggio della disponibilità sono il minimo."]],
          ["Tempi di risposta affidabili", ["Un buon piano distingue tra «il sito non è raggiungibile», «un modulo non funziona» e «per favore cambia questo testo», ognuno con il proprio tempo di risposta."]],
          ["Spazio per migliorare", ["I migliori piani includono un piccolo budget mensile per i miglioramenti. In un anno questi piccoli passi rendono il sito sensibilmente migliore."]],
        ],
      },
    },
  },
  {
    key: "accessibility-quality-bar", serviceKey: "design", imageId: 23, date: "2026-06-24T09:05:00Z", updated: "2026-06-25T10:10:00Z",
    authorKey: "u14", editorKey: "u12", views: 960, visibility: true, readingTime: 6,
    title: { en: "Accessibility is a quality bar, not a feature", de: "Barrierefreiheit ist ein Qualitätsmassstab, kein Feature", fr: "L’accessibilité est un niveau de qualité, pas une fonctionnalité", it: "L’accessibilità è uno standard di qualità, non una funzionalità" },
    description: {
      en: "Contrast, structure and keyboard support make a website better for everyone – and they are cheapest when planned early.",
      de: "Kontrast, Struktur und Tastaturbedienung machen eine Website für alle besser – und sind am günstigsten, wenn man sie früh plant.",
      fr: "Contraste, structure et navigation au clavier améliorent le site pour tous – et coûtent le moins quand ils sont prévus tôt.",
      it: "Contrasto, struttura e navigazione da tastiera migliorano il sito per tutti e costano meno se pianificati presto.",
    },
    keywords: {
      en: ["web accessibility", "WCAG", "inclusive design", "eCH-0059"],
      de: ["Barrierefreiheit", "WCAG", "inklusives Design", "eCH-0059"],
      fr: ["accessibilité web", "WCAG", "design inclusif", "eCH-0059"],
      it: ["accessibilità web", "WCAG", "design inclusivo", "eCH-0059"],
    },
    body: {
      en: {
        t: ["Check colour contrast while choosing the palette, not after launch.", "Use real headings, labels and buttons – structure is what assistive technology reads.", "Test every key journey with a keyboard before you call it done."],
        b: [
          ["Better for everyone", ["Accessible design helps people with permanent disabilities, but also someone reading in bright sunlight, using a phone with one hand or recovering from an injury. Clear contrast, readable type and predictable navigation are simply good design.", "In Switzerland, public-sector websites already follow the eCH-0059 standard, and customers increasingly expect the same care from businesses."]],
          ["Structure is the interface", ["Screen readers and search engines both rely on structure: one main heading, logical subheadings, labelled form fields and buttons that are really buttons. Getting this right costs almost nothing when a page is built, and a lot when it is retrofitted.", "Alternative text for images belongs in the content workflow – the CMS should ask for it every time an image is uploaded."]],
          ["Test with the keyboard", ["Put the mouse aside and try to complete a booking, submit the contact form or open the menu. If focus disappears or a dialog cannot be closed, some visitors cannot finish the journey at all.", "Make this five-minute check part of every release."]],
        ],
      },
      de: {
        t: ["Prüfen Sie den Farbkontrast bei der Wahl der Palette, nicht nach dem Launch.", "Verwenden Sie echte Überschriften, Labels und Buttons – Struktur ist das, was Hilfstechnologien lesen.", "Testen Sie jeden wichtigen Ablauf mit der Tastatur."],
        b: [
          ["Besser für alle", ["Barrierefreies Design hilft Menschen mit Behinderungen, aber auch allen, die im Sonnenlicht lesen, das Smartphone mit einer Hand bedienen oder sich von einer Verletzung erholen."]],
          ["Struktur ist die Oberfläche", ["Screenreader und Suchmaschinen stützen sich auf Struktur: eine Hauptüberschrift, logische Zwischentitel, beschriftete Formularfelder und echte Buttons."]],
          ["Mit der Tastatur testen", ["Legen Sie die Maus beiseite und versuchen Sie, eine Buchung abzuschliessen oder das Kontaktformular zu senden. Machen Sie diese Fünf-Minuten-Prüfung zu einem Teil jedes Releases."]],
        ],
      },
      fr: {
        t: ["Vérifiez le contraste des couleurs en choisissant la palette, pas après le lancement.", "Utilisez de vrais titres, libellés et boutons : c’est la structure que lisent les aides techniques.", "Testez chaque parcours clé au clavier."],
        b: [
          ["Mieux pour tout le monde", ["Un design accessible aide les personnes en situation de handicap, mais aussi celles qui lisent en plein soleil, utilisent leur téléphone d’une main ou se remettent d’une blessure."]],
          ["La structure est l’interface", ["Lecteurs d’écran et moteurs de recherche s’appuient sur la structure : un titre principal, des sous-titres logiques, des champs de formulaire étiquetés et de vrais boutons."]],
          ["Tester au clavier", ["Mettez la souris de côté et essayez de réserver ou d’envoyer le formulaire de contact. Faites de ce test de cinq minutes une étape de chaque mise en production."]],
        ],
      },
      it: {
        t: ["Verifica il contrasto dei colori mentre scegli la palette, non dopo il lancio.", "Usa veri titoli, etichette e pulsanti: la struttura è ciò che leggono le tecnologie assistive.", "Prova ogni percorso chiave con la tastiera."],
        b: [
          ["Meglio per tutti", ["Un design accessibile aiuta le persone con disabilità, ma anche chi legge sotto il sole, usa il telefono con una mano o si sta riprendendo da un infortunio."]],
          ["La struttura è l’interfaccia", ["Screen reader e motori di ricerca si basano sulla struttura: un titolo principale, sottotitoli logici, campi dei moduli etichettati e veri pulsanti."]],
          ["Prova con la tastiera", ["Metti da parte il mouse e prova a completare una prenotazione o a inviare il modulo di contatto. Rendi questo controllo di cinque minuti parte di ogni rilascio."]],
        ],
      },
    },
  },
  {
    key: "multilingual-website-planning", serviceKey: "development", imageId: 24, date: "2026-06-10T08:40:00Z", updated: "2026-06-12T15:00:00Z",
    authorKey: "admin", editorKey: "u14", views: 1640, visibility: true, readingTime: 7,
    title: { en: "Planning a multilingual website without doubling the work", de: "Eine mehrsprachige Website planen, ohne die Arbeit zu verdoppeln", fr: "Planifier un site multilingue sans doubler le travail", it: "Pianificare un sito multilingue senza raddoppiare il lavoro" },
    description: {
      en: "Content models, translation workflows and URL structure decide whether four languages feel like one site or four projects.",
      de: "Content-Modelle, Übersetzungsabläufe und URL-Struktur entscheiden, ob vier Sprachen wie eine Website wirken oder wie vier Projekte.",
      fr: "Modèles de contenu, flux de traduction et structure des URL déterminent si quatre langues forment un seul site ou quatre projets.",
      it: "Modelli di contenuto, flussi di traduzione e struttura degli URL decidono se quattro lingue sembrano un solo sito o quattro progetti.",
    },
    keywords: {
      en: ["multilingual website", "website localisation", "hreflang", "translation workflow"],
      de: ["mehrsprachige Website", "Website-Lokalisierung", "hreflang", "Übersetzungsprozess"],
      fr: ["site multilingue", "localisation de site", "hreflang", "processus de traduction"],
      it: ["sito multilingue", "localizzazione del sito", "hreflang", "flusso di traduzione"],
    },
    body: {
      en: {
        t: ["Decide which content is shared and which is local before designing templates.", "Give every language its own clean URL and slug.", "Plan translation as a workflow with owners and deadlines, not a last-minute task."],
        b: [
          ["Shared and local content", ["Some content is identical everywhere – product specifications, team photos, prices. Other content should differ by region – examples, contact people, legal notes. Separating the two in the content model keeps editors from maintaining four copies of the same thing.", "In the CMS, shared fields are entered once; localized fields get a tab per language."]],
          ["URLs and slugs per language", ["/de/leistungen and /fr/prestations are easier to share and rank better than one URL that switches language with a cookie. Each language version should have its own slug, title and meta description.", "Hreflang tags then connect the versions so search engines show the right one."]],
          ["Translation as a workflow", ["Treat translation like any other production step: who translates, who reviews, and when is it due? A simple status per language – draft, in review, published – prevents half-translated pages from going live.", "Launch with fewer pages in every language rather than all pages in one."]],
        ],
      },
      de: {
        t: ["Legen Sie fest, welche Inhalte geteilt und welche lokal sind, bevor Sie Vorlagen gestalten.", "Geben Sie jeder Sprache eigene, saubere URLs und Slugs.", "Planen Sie Übersetzung als Ablauf mit Verantwortlichen und Terminen."],
        b: [
          ["Geteilte und lokale Inhalte", ["Manche Inhalte sind überall gleich – Produktdaten, Teamfotos, Preise. Andere sollten sich je Region unterscheiden – Beispiele, Ansprechpersonen, rechtliche Hinweise."]],
          ["URLs und Slugs pro Sprache", ["/de/leistungen und /fr/prestations lassen sich leichter teilen und ranken besser als eine URL, die die Sprache per Cookie wechselt."]],
          ["Übersetzung als Ablauf", ["Behandeln Sie Übersetzung wie jeden anderen Produktionsschritt: Wer übersetzt, wer prüft, bis wann? Ein einfacher Status pro Sprache verhindert halb übersetzte Seiten."]],
        ],
      },
      fr: {
        t: ["Décidez quels contenus sont partagés et lesquels sont locaux avant de concevoir les gabarits.", "Donnez à chaque langue ses propres URL et slugs.", "Planifiez la traduction comme un flux avec des responsables et des échéances."],
        b: [
          ["Contenus partagés et locaux", ["Certains contenus sont identiques partout – fiches produits, photos d’équipe, prix. D’autres doivent varier selon la région – exemples, interlocuteurs, mentions légales."]],
          ["URL et slugs par langue", ["/de/leistungen et /fr/prestations se partagent plus facilement et se positionnent mieux qu’une URL unique qui change de langue via un cookie."]],
          ["La traduction comme un flux", ["Traitez la traduction comme toute autre étape de production : qui traduit, qui relit et pour quand ? Un statut simple par langue évite de publier des pages à moitié traduites."]],
        ],
      },
      it: {
        t: ["Decidi quali contenuti sono condivisi e quali locali prima di progettare i modelli.", "Dai a ogni lingua URL e slug propri e puliti.", "Pianifica la traduzione come un flusso con responsabili e scadenze."],
        b: [
          ["Contenuti condivisi e locali", ["Alcuni contenuti sono uguali ovunque – schede prodotto, foto del team, prezzi. Altri dovrebbero cambiare per regione – esempi, referenti, note legali."]],
          ["URL e slug per lingua", ["/de/leistungen e /fr/prestations si condividono più facilmente e si posizionano meglio di un unico URL che cambia lingua con un cookie."]],
          ["La traduzione come flusso", ["Tratta la traduzione come qualsiasi altra fase di produzione: chi traduce, chi rivede ed entro quando? Uno stato semplice per lingua evita pagine tradotte a metà."]],
        ],
      },
    },
  },
  {
    key: "social-media-calendar", serviceKey: "marketing", imageId: 25, date: "2026-05-27T07:15:00Z", updated: "2026-05-28T09:25:00Z",
    authorKey: "u12", editorKey: "u12", views: 870, visibility: true, readingTime: 5,
    title: { en: "A social media calendar your team will actually keep", de: "Ein Social-Media-Kalender, den Ihr Team wirklich einhält", fr: "Un calendrier social que votre équipe tiendra vraiment", it: "Un calendario social che il tuo team rispetterà davvero" },
    description: {
      en: "Fewer formats, fixed rhythms and a shared backlog make consistent publishing realistic for small teams.",
      de: "Weniger Formate, feste Rhythmen und ein gemeinsamer Themenspeicher machen regelmässiges Posten auch für kleine Teams realistisch.",
      fr: "Moins de formats, des rythmes fixes et une réserve d’idées partagée rendent la publication régulière réaliste pour les petites équipes.",
      it: "Meno formati, ritmi fissi e un archivio di idee condiviso rendono realistica una pubblicazione costante anche per i team piccoli.",
    },
    keywords: {
      en: ["social media calendar", "content planning", "small business marketing", "social media formats"],
      de: ["Social-Media-Kalender", "Content-Planung", "KMU-Marketing", "Social-Media-Formate"],
      fr: ["calendrier éditorial social", "planification de contenu", "marketing pour PME", "formats sociaux"],
      it: ["calendario social", "pianificazione dei contenuti", "marketing per PMI", "formati social"],
    },
    body: {
      en: {
        t: ["Pick three recurring formats and rotate them.", "Plan a month ahead, but leave one slot per week for timely posts.", "Keep a backlog of ideas so no one starts from a blank page."],
        b: [
          ["Start with formats, not posts", ["Recurring formats – a project snapshot, a team tip, a customer question – are easier to produce and easier for followers to recognise. Three good formats are enough for most small businesses.", "Each format gets a simple template for image and text, so production takes minutes instead of hours."]],
          ["A rhythm that fits the team", ["Two posts a week that actually happen beat daily posting that stops after a month. Put the rhythm in a shared calendar and assign an owner to each slot.", "Leave one flexible slot per week for news, events or trends."]],
          ["The backlog saves the week", ["Collect ideas in one shared list whenever they come up: questions from sales calls, photos from projects, comments from customers. When a slot is empty, the backlog fills it.", "Review what performed best every month and add more of it to the backlog."]],
        ],
      },
      de: {
        t: ["Wählen Sie drei wiederkehrende Formate und wechseln Sie sie ab.", "Planen Sie einen Monat voraus, lassen Sie aber pro Woche Platz für Aktuelles.", "Führen Sie einen Themenspeicher, damit niemand bei null beginnt."],
        b: [
          ["Mit Formaten beginnen, nicht mit Posts", ["Wiederkehrende Formate – ein Projekt-Einblick, ein Tipp aus dem Team, eine Kundenfrage – sind leichter zu produzieren und für Follower leichter wiederzuerkennen."]],
          ["Ein Rhythmus, der zum Team passt", ["Zwei Posts pro Woche, die wirklich erscheinen, sind besser als tägliches Posten, das nach einem Monat abbricht."]],
          ["Der Themenspeicher rettet die Woche", ["Sammeln Sie Ideen laufend in einer gemeinsamen Liste: Fragen aus Verkaufsgesprächen, Fotos aus Projekten, Kommentare von Kunden."]],
        ],
      },
      fr: {
        t: ["Choisissez trois formats récurrents et alternez-les.", "Planifiez un mois à l’avance, mais gardez chaque semaine un créneau pour l’actualité.", "Tenez une réserve d’idées pour ne jamais partir d’une page blanche."],
        b: [
          ["Commencer par les formats, pas par les posts", ["Des formats récurrents – un aperçu de projet, une astuce de l’équipe, une question client – sont plus faciles à produire et à reconnaître."]],
          ["Un rythme adapté à l’équipe", ["Deux posts par semaine réellement publiés valent mieux qu’une publication quotidienne qui s’arrête au bout d’un mois."]],
          ["La réserve d’idées sauve la semaine", ["Rassemblez les idées dans une liste partagée : questions des rendez-vous commerciaux, photos de projets, commentaires de clients."]],
        ],
      },
      it: {
        t: ["Scegli tre formati ricorrenti e alternali.", "Pianifica con un mese di anticipo, ma lascia ogni settimana uno spazio per l’attualità.", "Tieni un archivio di idee, così nessuno parte da una pagina bianca."],
        b: [
          ["Parti dai formati, non dai post", ["Formati ricorrenti – uno sguardo a un progetto, un consiglio del team, una domanda di un cliente – sono più facili da produrre e da riconoscere."]],
          ["Un ritmo adatto al team", ["Due post a settimana che escono davvero valgono più di una pubblicazione quotidiana che si ferma dopo un mese."]],
          ["L’archivio di idee salva la settimana", ["Raccogli le idee in un’unica lista condivisa: domande dalle chiamate commerciali, foto dai progetti, commenti dei clienti."]],
        ],
      },
    },
  },
  {
    key: "template-or-custom-build", serviceKey: "development", imageId: 26, date: "2026-09-26T13:40:00Z", updated: "2026-09-28T10:05:00Z",
    authorKey: "u14", editorKey: "u14", views: 0, visibility: false, readingTime: 5,
    title: { en: "Template or custom build? How to decide for your next website", de: "Vorlage oder Individualentwicklung? So entscheiden Sie für Ihre nächste Website", fr: "Modèle ou développement sur mesure ? Comment choisir pour votre prochain site", it: "Template o sviluppo su misura? Come decidere per il tuo prossimo sito" },
    description: {
      en: "A short checklist that compares budget, timeline, integrations and long-term flexibility.",
      de: "Eine kurze Checkliste, die Budget, Zeitplan, Integrationen und langfristige Flexibilität vergleicht.",
      fr: "Une courte liste de contrôle qui compare budget, délais, intégrations et flexibilité à long terme.",
      it: "Una breve checklist che confronta budget, tempi, integrazioni e flessibilità a lungo termine.",
    },
    keywords: {
      en: ["website template", "custom website", "website budget", "web development"],
      de: ["Website-Vorlage", "individuelle Website", "Website-Budget", "Webentwicklung"],
      fr: ["modèle de site", "site sur mesure", "budget de site web", "développement web"],
      it: ["template per siti", "sito su misura", "budget del sito", "sviluppo web"],
    },
    body: {
      en: {
        t: ["Templates win on speed when your content fits their structure.", "Custom builds pay off when integrations or unusual journeys matter.", "Either way, plan who maintains the site after launch."],
        b: [
          ["When a template is enough", ["If your site is mainly pages, a blog and a contact form, a well-chosen template can launch in weeks. Customise colours, typography and imagery so it still feels like your brand.", "Check the template’s update history – abandoned themes become a security risk."]],
          ["When custom makes sense", ["Booking flows, product configurators, member areas or deep CRM integration usually outgrow templates quickly. A custom build lets the structure follow your process instead of the other way round.", "It also avoids paying for features you will never use."]],
          ["The question after launch", ["Whichever route you choose, someone needs to update, back up and improve the site. Include the care plan in the decision, not as an afterthought."]],
        ],
      },
      de: {
        t: ["Vorlagen sind schneller, wenn Ihre Inhalte zu ihrer Struktur passen.", "Individualentwicklung lohnt sich, wenn Integrationen oder besondere Abläufe wichtig sind.", "Planen Sie in jedem Fall, wer die Website nach dem Launch pflegt."],
        b: [
          ["Wann eine Vorlage reicht", ["Besteht Ihre Website vor allem aus Seiten, einem Blog und einem Kontaktformular, kann eine gut gewählte Vorlage in wenigen Wochen live gehen."]],
          ["Wann sich Individualentwicklung lohnt", ["Buchungsabläufe, Produktkonfiguratoren, Mitgliederbereiche oder tiefe CRM-Integrationen sprengen Vorlagen meist schnell."]],
          ["Die Frage nach dem Launch", ["Egal welcher Weg: Jemand muss die Website aktualisieren, sichern und verbessern. Beziehen Sie den Betreuungsplan in die Entscheidung ein."]],
        ],
      },
      fr: {
        t: ["Les modèles sont plus rapides quand vos contenus correspondent à leur structure.", "Le sur-mesure est rentable quand les intégrations ou les parcours particuliers comptent.", "Dans tous les cas, prévoyez qui entretient le site après le lancement."],
        b: [
          ["Quand un modèle suffit", ["Si votre site se compose surtout de pages, d’un blog et d’un formulaire de contact, un modèle bien choisi peut être en ligne en quelques semaines."]],
          ["Quand le sur-mesure s’impose", ["Parcours de réservation, configurateurs de produits, espaces membres ou intégration CRM poussée dépassent vite les modèles."]],
          ["La question après le lancement", ["Quelle que soit la voie choisie, il faut mettre à jour, sauvegarder et améliorer le site. Intégrez le contrat de maintenance à la décision."]],
        ],
      },
      it: {
        t: ["I template vincono in velocità quando i contenuti si adattano alla loro struttura.", "Lo sviluppo su misura conviene quando contano integrazioni o percorsi particolari.", "In ogni caso, pianifica chi curerà il sito dopo il lancio."],
        b: [
          ["Quando basta un template", ["Se il tuo sito è fatto soprattutto di pagine, un blog e un modulo di contatto, un template ben scelto può andare online in poche settimane."]],
          ["Quando conviene il su misura", ["Flussi di prenotazione, configuratori di prodotto, aree riservate o integrazioni profonde con il CRM superano presto i template."]],
          ["La domanda dopo il lancio", ["Qualunque strada tu scelga, qualcuno dovrà aggiornare, salvare e migliorare il sito. Includi il piano di assistenza nella decisione."]],
        ],
      },
    },
  },
  {
    key: "tested-backups", serviceKey: "hosting", imageId: 27, date: "2026-09-24T15:20:00Z", updated: "2026-09-27T08:45:00Z",
    authorKey: "admin", editorKey: "admin", views: 0, visibility: false, readingTime: 4,
    title: { en: "Backups you have not tested are only hopes", de: "Ungetestete Backups sind nur Hoffnungen", fr: "Des sauvegardes jamais testées ne sont que des espoirs", it: "I backup mai testati sono solo speranze" },
    description: {
      en: "A quarterly restore test takes an hour and turns a backup policy into a recovery plan.",
      de: "Ein vierteljährlicher Wiederherstellungstest dauert eine Stunde und macht aus einer Backup-Regel einen Notfallplan.",
      fr: "Un test de restauration trimestriel prend une heure et transforme une politique de sauvegarde en plan de reprise.",
      it: "Un test di ripristino trimestrale richiede un’ora e trasforma una politica di backup in un piano di recupero.",
    },
    keywords: {
      en: ["website backups", "disaster recovery", "restore test", "managed hosting"],
      de: ["Website-Backups", "Notfallwiederherstellung", "Wiederherstellungstest", "Managed Hosting"],
      fr: ["sauvegardes de site", "plan de reprise", "test de restauration", "hébergement géré"],
      it: ["backup del sito", "disaster recovery", "test di ripristino", "hosting gestito"],
    },
    body: {
      en: {
        t: ["Restore a full copy of the site at least once a quarter.", "Write down how long the restore took and what was missing.", "Keep one backup copy outside the hosting provider."],
        b: [
          ["Why backups fail", ["Most failed recoveries are not caused by missing backups but by backups nobody tried to restore: an excluded folder, an expired password, a database dump that stops halfway.", "A restore test finds these gaps while there is still time to fix them."]],
          ["A one-hour quarterly routine", ["Restore the latest backup to a staging server, open the key pages, submit a test form and log in to the CMS. Note the time it took and anything that did not work.", "Repeat after every major platform change."]],
          ["Keep a copy elsewhere", ["If the hosting account itself is affected, backups stored in the same place are affected too. Keep at least one encrypted copy with a different provider."]],
        ],
      },
      de: {
        t: ["Stellen Sie mindestens einmal pro Quartal eine vollständige Kopie der Website wieder her.", "Notieren Sie, wie lange es dauerte und was fehlte.", "Bewahren Sie eine Kopie ausserhalb des Hosting-Anbieters auf."],
        b: [
          ["Warum Backups scheitern", ["Die meisten gescheiterten Wiederherstellungen liegen nicht an fehlenden Backups, sondern an Backups, die nie jemand zurückgespielt hat."]],
          ["Eine Stunde pro Quartal", ["Spielen Sie das letzte Backup auf einem Testserver ein, öffnen Sie die wichtigsten Seiten, senden Sie ein Testformular und melden Sie sich im CMS an."]],
          ["Eine Kopie an einem anderen Ort", ["Ist das Hosting-Konto selbst betroffen, sind es die dort gespeicherten Backups auch. Bewahren Sie mindestens eine verschlüsselte Kopie bei einem anderen Anbieter auf."]],
        ],
      },
      fr: {
        t: ["Restaurez une copie complète du site au moins une fois par trimestre.", "Notez la durée de la restauration et ce qui manquait.", "Conservez une copie en dehors de l’hébergeur."],
        b: [
          ["Pourquoi les sauvegardes échouent", ["La plupart des restaurations ratées ne viennent pas d’une sauvegarde manquante, mais d’une sauvegarde que personne n’a jamais essayé de restaurer."]],
          ["Une heure par trimestre", ["Restaurez la dernière sauvegarde sur un serveur de test, ouvrez les pages clés, envoyez un formulaire test et connectez-vous au CMS."]],
          ["Une copie ailleurs", ["Si le compte d’hébergement est touché, les sauvegardes qui s’y trouvent le sont aussi. Gardez au moins une copie chiffrée chez un autre fournisseur."]],
        ],
      },
      it: {
        t: ["Ripristina una copia completa del sito almeno una volta a trimestre.", "Annota quanto è durato il ripristino e cosa mancava.", "Conserva una copia fuori dal fornitore di hosting."],
        b: [
          ["Perché i backup falliscono", ["La maggior parte dei ripristini falliti non dipende da backup mancanti, ma da backup che nessuno ha mai provato a ripristinare."]],
          ["Un’ora a trimestre", ["Ripristina l’ultimo backup su un server di prova, apri le pagine principali, invia un modulo di test e accedi al CMS."]],
          ["Una copia altrove", ["Se è colpito lo stesso account di hosting, lo sono anche i backup salvati lì. Conserva almeno una copia cifrata presso un altro fornitore."]],
        ],
      },
    },
  },
];

// JSON-LD BlogPosting per language (what the add/edit form's "blogSchema" editor holds).
function blogSchemaFor(post, lang, { websiteUrl, imageUrl, authorName }) {
  return {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: post.title[lang],
    description: post.description[lang],
    inLanguage: LOCALE_TAG[lang],
    datePublished: post.date.slice(0, 10),
    dateModified: post.updated.slice(0, 10),
    author: { "@type": "Person", name: authorName },
    publisher: { "@type": "Organization", name: "OrgTik", url: websiteUrl },
    image: imageUrl,
    mainEntityOfPage: `${websiteUrl}/${lang}/insights/${post.slug[lang]}`,
    keywords: post.keywords[lang].join(", "),
    timeRequired: `PT${post.readingTime}M`,
  };
}

// ctx: { serviceIdByKey, userIdByKey, userName(id), imageUrl(id), websiteUrl }
function buildBlogs(ctx) {
  return POSTS.map((p, i) => {
    const slug = Object.fromEntries(LANGS.map((l) => [l, p.slug?.[l] || (l === "en" ? p.key : slugify(p.title[l]))]));
    const post = { ...p, slug };
    const createdById = ctx.userIdByKey(p.authorKey);
    const updatedById = ctx.userIdByKey(p.editorKey);
    return {
      id: i + 1,
      title: p.title,
      description: p.description,
      slug,
      content: Object.fromEntries(LANGS.map((l) => [l, html(l, p.body[l])])),
      seoTitle: mapLoc(p.title, (t) => `${t} | OrgTik Insights`),
      seoDescription: p.description,
      seoKeywords: p.keywords,
      visibility: p.visibility,
      featureImageId: p.imageId,
      serviceId: ctx.serviceIdByKey(p.serviceKey),
      blogSchema: Object.fromEntries(LANGS.map((l) => [l, blogSchemaFor(post, l, { websiteUrl: ctx.websiteUrl, imageUrl: ctx.imageUrl(p.imageId), authorName: ctx.userName(createdById) })])),
      views: p.views,
      readingTime: p.readingTime,
      createdById,
      updatedById,
      createdAt: new Date(p.date).toISOString(),
      updatedAt: new Date(p.updated).toISOString(),
    };
  });
}

module.exports = { buildBlogs, blogSchemaFor, POSTS, stripHtml };
