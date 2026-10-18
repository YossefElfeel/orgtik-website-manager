// Service families and sub-services, taken from the OrgTik website (orgtik-website/landing-directions
// src/reference/Services.jsx) and translated into the four website languages (en, de, fr, it; Swiss German spelling).
const { L, LA, slugify, mapLoc } = require("../lib");

// The website's shared process ("How we work" on every service page). Image ids refer to seed/gallery.js.
const STEPS = [
  {
    title: L("Understand", "Verstehen", "Comprendre", "Capire"),
    description: L(
      "Start with the right questions: your business, your people, and what needs to work better.",
      "Mit den richtigen Fragen beginnen: Ihr Unternehmen, Ihre Menschen und was besser funktionieren muss.",
      "Commencer par les bonnes questions : votre entreprise, vos équipes et ce qui doit mieux fonctionner.",
      "Partire dalle domande giuste: la tua azienda, le tue persone e ciò che deve funzionare meglio.",
    ),
    imageId: 5,
  },
  {
    title: L("Design", "Gestalten", "Concevoir", "Progettare"),
    description: L(
      "Make the way forward clear: a shared direction, a considered experience, and a practical plan.",
      "Den Weg klar machen: eine gemeinsame Richtung, ein durchdachtes Erlebnis und ein praktikabler Plan.",
      "Rendre la voie claire : une direction partagée, une expérience réfléchie et un plan concret.",
      "Rendere chiara la strada: una direzione condivisa, un’esperienza curata e un piano concreto.",
    ),
    imageId: 4,
  },
  {
    title: L("Deliver", "Umsetzen", "Livrer", "Realizzare"),
    description: L(
      "Bring the details together: design and technology shaped into something people can use.",
      "Die Details zusammenführen: Design und Technologie, geformt zu etwas, das Menschen nutzen können.",
      "Assembler les détails : design et technologie façonnés en quelque chose d’utile.",
      "Mettere insieme i dettagli: design e tecnologia trasformati in qualcosa che le persone possono usare.",
    ),
    imageId: 7,
  },
  {
    title: L("Evolve", "Weiterentwickeln", "Faire évoluer", "Evolvere"),
    description: L(
      "Keep making it better: learn from the work, respond to change, and build on what matters.",
      "Es laufend verbessern: aus der Arbeit lernen, auf Veränderungen reagieren und auf dem Wichtigen aufbauen.",
      "Continuer à améliorer : apprendre du travail, s’adapter au changement et construire sur l’essentiel.",
      "Continuare a migliorare: imparare dal lavoro, rispondere al cambiamento e costruire su ciò che conta.",
    ),
    imageId: 6,
  },
];

// Focus / Connected / Partnership plans shown on every service detail page (prototype CHF estimates from the website).
const PLANS = [
  {
    iconId: 3,
    price: 1800,
    name: L("Focus", "Focus", "Focus", "Focus"),
    brief: L(
      "One service, one clear outcome and a defined delivery window.",
      "Ein Service, ein klares Ergebnis und ein definiertes Lieferfenster.",
      "Un service, un résultat clair et un délai de livraison défini.",
      "Un servizio, un risultato chiaro e una finestra di consegna definita.",
    ),
    whatsIncluded: LA(
      ["Discovery call", "Scoped brief", "Defined delivery window"],
      ["Erstgespräch", "Abgestimmtes Briefing", "Definiertes Lieferfenster"],
      ["Appel de découverte", "Brief cadré", "Délai de livraison défini"],
      ["Call conoscitiva", "Brief definito", "Finestra di consegna definita"],
    ),
  },
  {
    iconId: 3,
    price: 4200,
    name: L("Connected", "Connected", "Connected", "Connected"),
    brief: L(
      "A coordinated bundle for two adjacent capabilities that need to move together.",
      "Ein abgestimmtes Paket für zwei benachbarte Leistungen, die gemeinsam vorankommen müssen.",
      "Un ensemble coordonné pour deux compétences voisines qui doivent avancer ensemble.",
      "Un pacchetto coordinato per due competenze vicine che devono procedere insieme.",
    ),
    whatsIncluded: LA(
      ["Joint planning workshop", "Two coordinated workstreams", "Shared review rhythm"],
      ["Gemeinsamer Planungsworkshop", "Zwei abgestimmte Arbeitsstränge", "Gemeinsamer Review-Rhythmus"],
      ["Atelier de planification commun", "Deux chantiers coordonnés", "Rythme de revue partagé"],
      ["Workshop di pianificazione congiunto", "Due flussi di lavoro coordinati", "Ritmo di revisione condiviso"],
    ),
  },
  {
    iconId: 3,
    price: 1450,
    name: L("Partnership", "Partnership", "Partenariat", "Partnership"),
    brief: L(
      "An ongoing service rhythm with delivery, support and measured improvement.",
      "Ein laufender Service-Rhythmus mit Umsetzung, Support und messbarer Verbesserung.",
      "Un rythme de service continu avec livraison, support et amélioration mesurée.",
      "Un ritmo di servizio continuo con consegna, supporto e miglioramento misurato.",
    ),
    whatsIncluded: LA(
      ["Monthly delivery budget", "Priority support", "Improvement roadmap"],
      ["Monatliches Umsetzungsbudget", "Priorisierter Support", "Verbesserungs-Roadmap"],
      ["Budget de réalisation mensuel", "Support prioritaire", "Feuille de route d’amélioration"],
      ["Budget mensile di consegna", "Supporto prioritario", "Roadmap di miglioramento"],
    ),
  },
];

const FAMILIES = [
  {
    key: "design",
    imageId: 4,
    title: L("Web design services", "Webdesign-Dienstleistungen", "Services de conception web", "Servizi di web design"),
    description: L(
      "Brand thinking, visual communication, and responsive interfaces connected across every useful touchpoint.",
      "Markendenken, visuelle Kommunikation und responsive Oberflächen – verbunden über jeden relevanten Berührungspunkt.",
      "Réflexion de marque, communication visuelle et interfaces responsives, reliées à chaque point de contact utile.",
      "Pensiero di brand, comunicazione visiva e interfacce responsive, collegati in ogni punto di contatto utile.",
    ),
    slug: L("design", "design", "design", "design"),
    seoTitle: L(
      "Web design services in Switzerland | OrgTik",
      "Webdesign-Dienstleistungen in der Schweiz | OrgTik",
      "Services de conception web en Suisse | OrgTik",
      "Servizi di web design in Svizzera | OrgTik",
    ),
    seoDescription: L(
      "Identity and experiences with one clear direction: graphic design, brand development and web & app design from OrgTik in Belp.",
      "Identität und Erlebnisse mit einer klaren Richtung: Grafikdesign, Markenentwicklung sowie Web- und App-Design von OrgTik in Belp.",
      "Identité et expériences avec une direction claire : design graphique, développement de marque et conception web par OrgTik à Belp.",
      "Identità ed esperienze con una direzione chiara: progettazione grafica, sviluppo del brand e web design di OrgTik a Belp.",
    ),
    seoKeywords: ["web design", "brand development", "graphic design", "UI/UX design", "Webdesign Schweiz"],
  },
  {
    key: "development",
    imageId: 7,
    title: L("Development services", "Web- und App-Entwicklung", "Développement web et d’applications", "Sviluppo web e app"),
    description: L(
      "From requirements and architecture to tested implementation, launch, and considered iteration.",
      "Von Anforderungen und Architektur über getestete Umsetzung bis zum Launch und zur durchdachten Weiterentwicklung.",
      "Des exigences et de l’architecture à une mise en œuvre testée, au lancement et à des itérations réfléchies.",
      "Dai requisiti e dall’architettura a un’implementazione testata, al lancio e a iterazioni ponderate.",
    ),
    slug: L("development", "entwicklung", "developpement", "sviluppo"),
    seoTitle: L(
      "Web & app development in Switzerland | OrgTik",
      "Web- und App-Entwicklung in der Schweiz | OrgTik",
      "Développement web et d’applications en Suisse | OrgTik",
      "Sviluppo web e app in Svizzera | OrgTik",
    ),
    seoDescription: L(
      "Digital products built around the result: web development, custom applications, integrations and testing by OrgTik.",
      "Digitale Produkte, gebaut rund um das Ergebnis: Webentwicklung, individuelle Anwendungen, Integrationen und Tests von OrgTik.",
      "Des produits numériques pensés pour le résultat : développement web, applications sur mesure, intégrations et tests par OrgTik.",
      "Prodotti digitali costruiti attorno al risultato: sviluppo web, applicazioni su misura, integrazioni e test di OrgTik.",
    ),
    seoKeywords: ["web development", "custom app development", "Next.js", "software integrations", "Webentwicklung Bern"],
  },
  {
    key: "marketing",
    imageId: 5,
    title: L("Marketing services", "Marketing-Dienstleistungen", "Services marketing", "Servizi di marketing"),
    description: L(
      "Strategy, campaigns, search, and content shaped around the people your business needs to reach.",
      "Strategie, Kampagnen, Suche und Inhalte – ausgerichtet auf die Menschen, die Ihr Unternehmen erreichen muss.",
      "Stratégie, campagnes, référencement et contenus pensés pour les personnes que votre entreprise doit atteindre.",
      "Strategia, campagne, ricerca e contenuti pensati per le persone che la tua azienda deve raggiungere.",
    ),
    slug: L("marketing", "marketing", "marketing", "marketing"),
    seoTitle: L(
      "Digital marketing & SEO in Switzerland | OrgTik",
      "Digitales Marketing & SEO in der Schweiz | OrgTik",
      "Marketing digital et SEO en Suisse | OrgTik",
      "Marketing digitale e SEO in Svizzera | OrgTik",
    ),
    seoDescription: L(
      "Turn attention into meaningful momentum with social media, digital advertising for Swiss audiences and SEO from OrgTik.",
      "Aus Aufmerksamkeit wird Wirkung: Social Media, digitale Werbung für Schweizer Zielgruppen und SEO von OrgTik.",
      "Transformez l’attention en élan avec les réseaux sociaux, la publicité digitale pour la Suisse et le SEO par OrgTik.",
      "Trasforma l’attenzione in slancio con social media, pubblicità digitale per la Svizzera e SEO di OrgTik.",
    ),
    seoKeywords: ["digital marketing", "SEO services", "social media marketing", "Google Ads Switzerland", "Online-Marketing"],
  },
  {
    key: "it-support",
    imageId: 6,
    title: L("IT support", "IT-Support", "Support informatique", "Supporto IT"),
    description: L(
      "Ongoing care, troubleshooting, and thoughtful improvements for the digital tools your team depends on.",
      "Laufende Betreuung, Fehlerbehebung und durchdachte Verbesserungen für die digitalen Werkzeuge, auf die Ihr Team angewiesen ist.",
      "Suivi continu, dépannage et améliorations réfléchies pour les outils numériques dont votre équipe dépend.",
      "Assistenza continua, risoluzione dei problemi e miglioramenti ponderati per gli strumenti digitali da cui dipende il tuo team.",
    ),
    slug: L("it-support", "it-support", "support-informatique", "supporto-it"),
    seoTitle: L(
      "IT support & website management | OrgTik",
      "IT-Support & Website-Betreuung | OrgTik",
      "Support informatique et gestion de site web | OrgTik",
      "Supporto IT e gestione del sito web | OrgTik",
    ),
    seoDescription: L(
      "Reliable support for the systems behind the day: website management, software support and error fixing from OrgTik.",
      "Verlässlicher Support für die Systeme hinter dem Alltag: Website-Betreuung, Software-Support und Fehlerbehebung von OrgTik.",
      "Un support fiable pour les systèmes du quotidien : gestion de site web, support logiciel et correction d’erreurs par OrgTik.",
      "Supporto affidabile per i sistemi di ogni giorno: gestione del sito, supporto software e correzione di errori di OrgTik.",
    ),
    seoKeywords: ["IT support", "website management", "software support", "bug fixing", "Website-Wartung"],
  },
  {
    key: "hosting",
    imageId: 8,
    title: L("OrgTik hosting", "OrgTik Hosting", "Hébergement OrgTik", "Hosting OrgTik"),
    description: L(
      "Managed hosting, monitoring, backups, and performance care connected to the people who already understand your website.",
      "Managed Hosting, Monitoring, Backups und Performance-Pflege – betreut von den Menschen, die Ihre Website bereits kennen.",
      "Hébergement géré, surveillance, sauvegardes et optimisation des performances, assurés par les personnes qui connaissent déjà votre site.",
      "Hosting gestito, monitoraggio, backup e cura delle prestazioni, affidati alle persone che conoscono già il tuo sito.",
    ),
    slug: L("hosting", "hosting", "hebergement", "hosting"),
    seoTitle: L(
      "Managed website hosting in Switzerland | OrgTik",
      "Managed Website-Hosting in der Schweiz | OrgTik",
      "Hébergement de sites web géré en Suisse | OrgTik",
      "Hosting gestito di siti web in Svizzera | OrgTik",
    ),
    seoDescription: L(
      "A dependable home for your digital presence: managed hosting with monitoring, tested backups and direct support.",
      "Ein verlässliches Zuhause für Ihre digitale Präsenz: Managed Hosting mit Monitoring, getesteten Backups und direktem Support.",
      "Un foyer fiable pour votre présence numérique : hébergement géré avec surveillance, sauvegardes testées et support direct.",
      "Una casa affidabile per la tua presenza digitale: hosting gestito con monitoraggio, backup testati e supporto diretto.",
    ),
    seoKeywords: ["managed hosting", "website hosting Switzerland", "backups", "monitoring", "Webhosting Schweiz"],
  },
];

// Sub-services: capabilities become tags + feature cards; `quote` is the website's outcome line.
const SUBS = [
  {
    family: "design", slug: "graphic-design", imageId: 4, heroImageId: 11,
    title: L("Graphic design", "Grafikdesign", "Design graphique", "Progettazione grafica"),
    slugs: L("graphic-design", "grafikdesign", "design-graphique", "progettazione-grafica"),
    description: L(
      "Brand-consistent digital and print communication, from campaign assets to the everyday materials people see and use.",
      "Markenkonforme digitale und gedruckte Kommunikation – von Kampagnenmotiven bis zu den Alltagsmaterialien, die Menschen sehen und nutzen.",
      "Une communication numérique et imprimée fidèle à la marque, des visuels de campagne aux supports du quotidien.",
      "Comunicazione digitale e stampata coerente con il brand, dai materiali di campagna agli strumenti di tutti i giorni.",
    ),
    quote: L(
      "Give every communication a stronger visual point of view.",
      "Geben Sie jeder Kommunikation einen stärkeren visuellen Standpunkt.",
      "Donnez à chaque communication un point de vue visuel plus affirmé.",
      "Dai a ogni comunicazione un punto di vista visivo più forte.",
    ),
    caps: [
      [L("Campaign design", "Kampagnendesign", "Design de campagne", "Design di campagna"),
        L("Key visuals, ads and social formats that carry one idea across every channel.", "Key Visuals, Anzeigen und Social-Formate, die eine Idee über alle Kanäle tragen.", "Visuels clés, annonces et formats sociaux qui portent une seule idée sur tous les canaux.", "Key visual, annunci e formati social che portano un’unica idea su ogni canale.")],
      [L("Business materials", "Geschäftsdrucksachen", "Supports d’entreprise", "Materiali aziendali"),
        L("Stationery, presentations and brochures that feel like the same company.", "Geschäftsausstattung, Präsentationen und Broschüren, die nach demselben Unternehmen aussehen.", "Papeterie, présentations et brochures qui reflètent la même entreprise.", "Cancelleria, presentazioni e brochure che parlano della stessa azienda.")],
      [L("Digital asset systems", "Digitale Asset-Systeme", "Systèmes d’actifs numériques", "Sistemi di asset digitali"),
        L("Organized templates and asset libraries your team can reuse with confidence.", "Geordnete Vorlagen und Asset-Bibliotheken, die Ihr Team sicher wiederverwenden kann.", "Des modèles et bibliothèques de ressources organisés que votre équipe réutilise en toute confiance.", "Modelli e librerie di asset ordinati che il tuo team può riutilizzare con sicurezza.")],
    ],
    body: L(
      "<p>Graphic design at OrgTik starts with the message, not the file format. We define what each piece needs to say, who will see it and where, then build a visual language that works as well on a trade-fair banner as on an Instagram story.</p><p>Every project ends with organized source files and simple templates, so your team can produce the next flyer or post without starting from scratch.</p>",
      "<p>Grafikdesign beginnt bei OrgTik mit der Botschaft, nicht mit dem Dateiformat. Wir klären, was jedes Element aussagen soll, wer es wo sieht, und entwickeln daraus eine Bildsprache, die auf dem Messebanner ebenso funktioniert wie in einer Instagram-Story.</p><p>Jedes Projekt endet mit geordneten Quelldateien und einfachen Vorlagen, damit Ihr Team den nächsten Flyer oder Post ohne Neustart erstellen kann.</p>",
      "<p>Chez OrgTik, le design graphique commence par le message, pas par le format de fichier. Nous définissons ce que chaque support doit dire, à qui et où, puis nous créons un langage visuel qui fonctionne aussi bien sur une bannière de salon que dans une story Instagram.</p><p>Chaque projet se termine par des fichiers sources organisés et des modèles simples, pour que votre équipe produise le prochain flyer ou post sans repartir de zéro.</p>",
      "<p>In OrgTik la progettazione grafica parte dal messaggio, non dal formato del file. Definiamo cosa deve dire ogni elemento, chi lo vedrà e dove, poi costruiamo un linguaggio visivo che funziona tanto su un banner fieristico quanto in una storia Instagram.</p><p>Ogni progetto si chiude con file sorgente ordinati e modelli semplici, così il tuo team può creare il prossimo volantino o post senza ricominciare da zero.</p>",
    ),
    seoKeywords: ["graphic design", "campaign design", "print design", "brand assets", "Grafikdesign Bern"],
  },
  {
    family: "design", slug: "brand-development", imageId: 5, heroImageId: 4,
    title: L("Brand development and corporate branding", "Markenentwicklung und Corporate Branding", "Développement de marque et identité d’entreprise", "Sviluppo del brand e corporate branding"),
    slugs: L("brand-development", "markenentwicklung", "developpement-de-marque", "sviluppo-del-brand"),
    description: L(
      "Brand strategy, identity direction, visual systems, guidance, and a practical rollout across touchpoints.",
      "Markenstrategie, Identitätsrichtung, visuelle Systeme, Richtlinien und ein praxisnaher Rollout über alle Berührungspunkte.",
      "Stratégie de marque, direction identitaire, systèmes visuels, lignes directrices et un déploiement concret sur tous les points de contact.",
      "Strategia di brand, direzione dell’identità, sistemi visivi, linee guida e un’introduzione concreta su tutti i punti di contatto.",
    ),
    quote: L(
      "Build an identity that stays coherent as the business grows.",
      "Bauen Sie eine Identität auf, die mit dem Unternehmen stimmig wächst.",
      "Construisez une identité qui reste cohérente à mesure que l’entreprise grandit.",
      "Costruisci un’identità che resta coerente mentre l’azienda cresce.",
    ),
    caps: [
      [L("Brand strategy", "Markenstrategie", "Stratégie de marque", "Strategia di brand"),
        L("Positioning, audiences and voice agreed before any logo is drawn.", "Positionierung, Zielgruppen und Tonalität werden geklärt, bevor ein Logo entsteht.", "Positionnement, publics et ton définis avant de dessiner le moindre logo.", "Posizionamento, pubblici e tono di voce definiti prima di disegnare qualsiasi logo.")],
      [L("Visual identity", "Visuelle Identität", "Identité visuelle", "Identità visiva"),
        L("Logo, colour, typography and imagery that work together as one system.", "Logo, Farbe, Typografie und Bildwelt, die als ein System zusammenspielen.", "Logo, couleurs, typographie et images qui fonctionnent comme un seul système.", "Logo, colori, tipografia e immagini che funzionano come un unico sistema.")],
      [L("Guidelines and rollout", "Richtlinien und Rollout", "Charte et déploiement", "Linee guida e rollout"),
        L("Practical guidelines and a rollout plan for every touchpoint that matters.", "Praxisnahe Richtlinien und ein Rollout-Plan für jeden wichtigen Berührungspunkt.", "Des règles pratiques et un plan de déploiement pour chaque point de contact important.", "Linee guida pratiche e un piano di rollout per ogni punto di contatto importante.")],
    ],
    body: L(
      "<p>A brand is the set of decisions that make the next decision easier. We start with strategy – who you serve, what you stand for and how you sound – and translate it into a visual identity with clear rules and room to breathe.</p><p>The rollout is part of the work: signage, digital channels, documents and templates are planned together so the identity arrives everywhere at once, not piece by piece.</p>",
      "<p>Eine Marke ist die Summe der Entscheidungen, die die nächste Entscheidung leichter machen. Wir beginnen mit der Strategie – wen Sie ansprechen, wofür Sie stehen und wie Sie klingen – und übersetzen sie in eine visuelle Identität mit klaren Regeln und genügend Spielraum.</p><p>Der Rollout gehört zur Arbeit: Beschilderung, digitale Kanäle, Dokumente und Vorlagen werden gemeinsam geplant, damit die Identität überall gleichzeitig ankommt.</p>",
      "<p>Une marque est l’ensemble des décisions qui facilitent la suivante. Nous commençons par la stratégie – qui vous servez, ce que vous défendez et votre ton – puis nous la traduisons en une identité visuelle aux règles claires, avec de la marge pour respirer.</p><p>Le déploiement fait partie du travail : signalétique, canaux numériques, documents et modèles sont planifiés ensemble pour que l’identité arrive partout en même temps.</p>",
      "<p>Un brand è l’insieme delle decisioni che rendono più facile quella successiva. Partiamo dalla strategia – chi servi, cosa rappresenti e come parli – e la traduciamo in un’identità visiva con regole chiare e spazio per respirare.</p><p>Il rollout fa parte del lavoro: insegne, canali digitali, documenti e modelli vengono pianificati insieme, così l’identità arriva ovunque nello stesso momento.</p>",
    ),
    seoKeywords: ["brand development", "corporate branding", "visual identity", "brand guidelines", "Markenentwicklung"],
  },
  {
    family: "design", slug: "web-and-app-design", imageId: 7, heroImageId: 16,
    title: L("Web design and application development", "Webdesign und Anwendungsgestaltung", "Web design et conception d’applications", "Web design e progettazione di applicazioni"),
    slugs: L("web-and-app-design", "webdesign-und-app-design", "web-design-et-applications", "web-design-e-app"),
    description: L(
      "UX and UI, responsive design, implementation, usability testing, and ongoing experience improvement.",
      "UX und UI, responsives Design, Umsetzung, Usability-Tests und laufende Verbesserung der Nutzererfahrung.",
      "UX et UI, design responsive, mise en œuvre, tests d’utilisabilité et amélioration continue de l’expérience.",
      "UX e UI, design responsive, implementazione, test di usabilità e miglioramento continuo dell’esperienza.",
    ),
    quote: L(
      "Make complex digital journeys feel clear and considered.",
      "Lassen Sie komplexe digitale Abläufe klar und durchdacht wirken.",
      "Rendez les parcours numériques complexes clairs et réfléchis.",
      "Rendi chiari e curati anche i percorsi digitali complessi.",
    ),
    caps: [
      [L("UX direction", "UX-Konzeption", "Direction UX", "Direzione UX"),
        L("Journeys, wireframes and prototypes tested with real users before build.", "Nutzerpfade, Wireframes und Prototypen, die vor der Umsetzung mit echten Nutzern getestet werden.", "Parcours, wireframes et prototypes testés avec de vrais utilisateurs avant le développement.", "Percorsi, wireframe e prototipi testati con utenti reali prima dello sviluppo.")],
      [L("Interface systems", "Interface-Systeme", "Systèmes d’interface", "Sistemi di interfaccia"),
        L("Reusable components and patterns that keep every screen consistent.", "Wiederverwendbare Komponenten und Muster, die jeden Screen konsistent halten.", "Des composants et modèles réutilisables qui gardent chaque écran cohérent.", "Componenti e pattern riutilizzabili che mantengono coerente ogni schermata.")],
      [L("Responsive implementation", "Responsive Umsetzung", "Intégration responsive", "Implementazione responsive"),
        L("Designs built to work from a small phone to a wide desktop.", "Designs, die vom kleinen Smartphone bis zum breiten Desktop funktionieren.", "Des designs conçus pour fonctionner du petit smartphone au grand écran.", "Design pensati per funzionare dal piccolo smartphone al grande desktop.")],
    ],
    body: L(
      "<p>Good interfaces feel obvious because the hard thinking happened earlier. We map the journeys that matter, prototype them, and test with the people who will use them – then turn the result into a component system developers can build with.</p><p>After launch we keep watching how the experience performs and refine it in small, measurable steps.</p>",
      "<p>Gute Oberflächen wirken selbstverständlich, weil die schwierige Denkarbeit früher stattfand. Wir skizzieren die wichtigen Nutzerpfade, bauen Prototypen und testen mit den Menschen, die sie nutzen werden – und machen daraus ein Komponentensystem, mit dem Entwickler arbeiten können.</p><p>Nach dem Launch beobachten wir die Nutzung weiter und verbessern die Erfahrung in kleinen, messbaren Schritten.</p>",
      "<p>Une bonne interface paraît évidente parce que la réflexion difficile a eu lieu en amont. Nous cartographions les parcours essentiels, les prototypons et les testons avec leurs futurs utilisateurs, puis nous en faisons un système de composants prêt pour le développement.</p><p>Après le lancement, nous suivons l’usage et affinons l’expérience par petites étapes mesurables.</p>",
      "<p>Una buona interfaccia sembra ovvia perché il lavoro difficile è stato fatto prima. Mappiamo i percorsi importanti, li prototipiamo e li testiamo con chi li userà, poi trasformiamo il risultato in un sistema di componenti pronto per lo sviluppo.</p><p>Dopo il lancio continuiamo a osservare l’esperienza e la miglioriamo a piccoli passi misurabili.</p>",
    ),
    seoKeywords: ["UX design", "UI design", "responsive web design", "usability testing", "App-Design"],
  },
  {
    family: "development", slug: "web-development", imageId: 17, heroImageId: 7,
    title: L("Web development and programming", "Webentwicklung und Programmierung", "Développement web et programmation", "Sviluppo web e programmazione"),
    slugs: L("web-development", "webentwicklung", "developpement-web", "sviluppo-web"),
    description: L(
      "Requirements, architecture, frontend implementation, integrations, testing, deployment planning, and support.",
      "Anforderungen, Architektur, Frontend-Umsetzung, Integrationen, Tests, Deployment-Planung und Support.",
      "Exigences, architecture, développement front-end, intégrations, tests, planification du déploiement et support.",
      "Requisiti, architettura, sviluppo front-end, integrazioni, test, pianificazione del rilascio e supporto.",
    ),
    quote: L(
      "Turn a clear idea into a fast, dependable digital experience.",
      "Machen Sie aus einer klaren Idee ein schnelles, verlässliches digitales Erlebnis.",
      "Transformez une idée claire en une expérience numérique rapide et fiable.",
      "Trasforma un’idea chiara in un’esperienza digitale veloce e affidabile.",
    ),
    caps: [
      [L("Technical architecture", "Technische Architektur", "Architecture technique", "Architettura tecnica"),
        L("A stack and structure chosen for your content, integrations and team.", "Ein Stack und eine Struktur, passend zu Ihren Inhalten, Integrationen und Ihrem Team.", "Une pile technique et une structure adaptées à vos contenus, intégrations et équipe.", "Stack e struttura scelti in base a contenuti, integrazioni e team.")],
      [L("Frontend implementation", "Frontend-Umsetzung", "Intégration front-end", "Implementazione front-end"),
        L("Accessible, fast pages built from a shared component library.", "Barrierearme, schnelle Seiten aus einer gemeinsamen Komponentenbibliothek.", "Des pages rapides et accessibles, construites à partir d’une bibliothèque de composants.", "Pagine veloci e accessibili costruite da una libreria di componenti condivisa.")],
      [L("Testing and launch", "Tests und Launch", "Tests et lancement", "Test e lancio"),
        L("Automated checks, staged releases and a calm launch-day plan.", "Automatisierte Prüfungen, gestaffelte Releases und ein ruhiger Launch-Plan.", "Contrôles automatisés, mises en production progressives et un lancement serein.", "Controlli automatici, rilasci graduali e un piano di lancio senza sorprese.")],
    ],
    body: L(
      "<p>We build websites and web platforms that are quick to load, easy to edit and ready to connect with the rest of your business – CRM, booking, payments or your own APIs.</p><p>Requirements and architecture are agreed up front, work is delivered in reviewable increments, and every release is tested before it reaches your visitors.</p>",
      "<p>Wir entwickeln Websites und Webplattformen, die schnell laden, einfach zu pflegen sind und sich mit dem Rest Ihres Unternehmens verbinden lassen – CRM, Buchung, Zahlungen oder Ihre eigenen APIs.</p><p>Anforderungen und Architektur werden vorab abgestimmt, die Arbeit wird in prüfbaren Schritten geliefert und jedes Release wird getestet, bevor es Ihre Besucher erreicht.</p>",
      "<p>Nous développons des sites et des plateformes web rapides à charger, faciles à mettre à jour et prêts à se connecter au reste de votre activité – CRM, réservation, paiements ou vos propres API.</p><p>Les exigences et l’architecture sont validées en amont, le travail est livré par étapes vérifiables et chaque version est testée avant d’atteindre vos visiteurs.</p>",
      "<p>Sviluppiamo siti e piattaforme web veloci da caricare, facili da aggiornare e pronti a collegarsi al resto della tua attività – CRM, prenotazioni, pagamenti o le tue API.</p><p>Requisiti e architettura vengono concordati all’inizio, il lavoro è consegnato in fasi verificabili e ogni rilascio viene testato prima di raggiungere i visitatori.</p>",
    ),
    seoKeywords: ["web development", "Next.js development", "API integrations", "frontend development", "Webentwicklung"],
  },
  {
    family: "development", slug: "custom-app-development", imageId: 12, heroImageId: 6,
    title: L("Custom app development", "Individuelle App-Entwicklung", "Développement d’applications sur mesure", "Sviluppo di app su misura"),
    slugs: L("custom-app-development", "individuelle-app-entwicklung", "applications-sur-mesure", "app-su-misura"),
    description: L(
      "Product discovery, UX and UI, tailored application development, integrations, testing, launch, and iteration.",
      "Produktfindung, UX und UI, massgeschneiderte Anwendungsentwicklung, Integrationen, Tests, Launch und Weiterentwicklung.",
      "Découverte produit, UX et UI, développement d’applications sur mesure, intégrations, tests, lancement et itérations.",
      "Discovery di prodotto, UX e UI, sviluppo di applicazioni su misura, integrazioni, test, lancio e iterazioni.",
    ),
    quote: L(
      "Shape a focused application around the way your business works.",
      "Gestalten Sie eine fokussierte Anwendung rund um die Arbeitsweise Ihres Unternehmens.",
      "Concevez une application ciblée autour de la façon dont votre entreprise travaille.",
      "Costruisci un’applicazione mirata attorno al modo in cui lavora la tua azienda.",
    ),
    caps: [
      [L("Product discovery", "Produktfindung", "Découverte produit", "Discovery di prodotto"),
        L("Workshops that turn a process pain point into a clear first release.", "Workshops, die aus einem Prozessproblem ein klares erstes Release machen.", "Des ateliers qui transforment un point de friction en une première version claire.", "Workshop che trasformano un problema di processo in una prima versione chiara.")],
      [L("Application UX", "Anwendungs-UX", "UX applicative", "UX applicativa"),
        L("Screens designed around real tasks, roles and permissions.", "Screens, die sich an echten Aufgaben, Rollen und Berechtigungen orientieren.", "Des écrans pensés autour des tâches, rôles et autorisations réels.", "Schermate progettate attorno a compiti, ruoli e permessi reali.")],
      [L("Iterative delivery", "Iterative Lieferung", "Livraison itérative", "Consegna iterativa"),
        L("Two-week increments with a working build to review each time.", "Zweiwöchige Schritte mit jeweils einer lauffähigen Version zur Abnahme.", "Des cycles de deux semaines avec une version fonctionnelle à valider.", "Cicli di due settimane con una versione funzionante da verificare ogni volta.")],
    ],
    body: L(
      "<p>Some processes do not fit an off-the-shelf tool. We start with discovery – the people, the steps and the data involved – and define the smallest application that makes a measurable difference.</p><p>From there we design, build and ship in short increments, integrating with the systems you already use and adding features only when they earn their place.</p>",
      "<p>Manche Prozesse passen in kein Standardwerkzeug. Wir beginnen mit einer Discovery-Phase – beteiligte Personen, Arbeitsschritte und Daten – und definieren die kleinste Anwendung, die einen messbaren Unterschied macht.</p><p>Danach gestalten, entwickeln und liefern wir in kurzen Schritten, integrieren Ihre bestehenden Systeme und ergänzen Funktionen erst dann, wenn sie sich lohnen.</p>",
      "<p>Certains processus ne rentrent dans aucun outil standard. Nous commençons par une phase de découverte – les personnes, les étapes et les données – pour définir la plus petite application qui fait une différence mesurable.</p><p>Ensuite, nous concevons, développons et livrons par petites étapes, en nous intégrant à vos systèmes existants et en n’ajoutant des fonctions que lorsqu’elles se justifient.</p>",
      "<p>Alcuni processi non si adattano a uno strumento standard. Partiamo dalla discovery – persone, passaggi e dati coinvolti – e definiamo l’applicazione più piccola capace di fare una differenza misurabile.</p><p>Poi progettiamo, sviluppiamo e rilasciamo a piccoli passi, integrandoci con i sistemi che già usi e aggiungendo funzioni solo quando servono davvero.</p>",
    ),
    seoKeywords: ["custom app development", "business applications", "product discovery", "React Native", "App-Entwicklung Schweiz"],
  },
  {
    family: "marketing", slug: "social-media-marketing", imageId: 6, heroImageId: 14,
    title: L("Social media marketing", "Social-Media-Marketing", "Marketing sur les réseaux sociaux", "Social media marketing"),
    slugs: L("social-media-marketing", "social-media-marketing", "marketing-reseaux-sociaux", "social-media-marketing"),
    description: L(
      "Channel strategy, content planning, publishing, community care, campaign management, and useful performance reporting.",
      "Kanalstrategie, Content-Planung, Veröffentlichung, Community-Betreuung, Kampagnenmanagement und aussagekräftiges Reporting.",
      "Stratégie de canaux, planification éditoriale, publication, animation de communauté, gestion de campagnes et reporting utile.",
      "Strategia dei canali, pianificazione dei contenuti, pubblicazione, gestione della community, campagne e report utili.",
    ),
    quote: L(
      "Build a social presence people recognize and want to follow.",
      "Bauen Sie eine Social-Media-Präsenz auf, die man erkennt und gerne verfolgt.",
      "Construisez une présence sociale que l’on reconnaît et que l’on a envie de suivre.",
      "Costruisci una presenza social riconoscibile che le persone vogliono seguire.",
    ),
    caps: [
      [L("Channel strategy", "Kanalstrategie", "Stratégie de canaux", "Strategia dei canali"),
        L("The right platforms for your audience, with a clear role for each.", "Die richtigen Plattformen für Ihre Zielgruppe – jede mit einer klaren Rolle.", "Les bonnes plateformes pour votre public, chacune avec un rôle clair.", "Le piattaforme giuste per il tuo pubblico, ognuna con un ruolo chiaro.")],
      [L("Content systems", "Content-Systeme", "Systèmes de contenu", "Sistemi di contenuto"),
        L("Formats, calendars and templates that keep publishing steady.", "Formate, Redaktionspläne und Vorlagen, die das Veröffentlichen stetig halten.", "Formats, calendriers et modèles qui assurent une publication régulière.", "Formati, calendari e modelli che rendono costante la pubblicazione.")],
      [L("Community and campaign care", "Community- und Kampagnenpflege", "Communauté et campagnes", "Community e campagne"),
        L("Replies, moderation and paid boosts managed in one rhythm.", "Antworten, Moderation und bezahlte Reichweite in einem gemeinsamen Rhythmus.", "Réponses, modération et promotions payantes gérées au même rythme.", "Risposte, moderazione e promozioni a pagamento gestite con un unico ritmo.")],
    ],
    body: L(
      "<p>Social media works when it is planned like a programme rather than posted like a to-do list. We agree the role of each channel, build a content system around a few recurring formats and keep a calendar the whole team can see.</p><p>Every month you receive a short report that explains what moved, what did not and what we will try next.</p>",
      "<p>Social Media funktioniert, wenn es wie ein Programm geplant und nicht wie eine To-do-Liste abgearbeitet wird. Wir legen die Rolle jedes Kanals fest, bauen ein Content-System aus wenigen wiederkehrenden Formaten und führen einen Kalender, den das ganze Team sieht.</p><p>Jeden Monat erhalten Sie einen kurzen Bericht: was sich bewegt hat, was nicht und was wir als Nächstes testen.</p>",
      "<p>Les réseaux sociaux fonctionnent lorsqu’ils sont planifiés comme un programme plutôt que publiés comme une liste de tâches. Nous définissons le rôle de chaque canal, construisons un système de contenus autour de quelques formats récurrents et tenons un calendrier visible par toute l’équipe.</p><p>Chaque mois, un court rapport explique ce qui a progressé, ce qui n’a pas fonctionné et ce que nous testerons ensuite.</p>",
      "<p>I social funzionano quando sono pianificati come un programma e non pubblicati come una lista di cose da fare. Definiamo il ruolo di ogni canale, costruiamo un sistema di contenuti attorno a pochi formati ricorrenti e teniamo un calendario visibile a tutto il team.</p><p>Ogni mese ricevi un breve report su cosa ha funzionato, cosa no e cosa proveremo dopo.</p>",
    ),
    seoKeywords: ["social media marketing", "content calendar", "community management", "Instagram marketing", "Social Media Agentur"],
  },
  {
    family: "marketing", slug: "digital-advertising-switzerland", imageId: 5, heroImageId: 13,
    title: L("Digital advertising Switzerland", "Digitale Werbung Schweiz", "Publicité digitale en Suisse", "Pubblicità digitale in Svizzera"),
    slugs: L("digital-advertising-switzerland", "digitale-werbung-schweiz", "publicite-digitale-suisse", "pubblicita-digitale-svizzera"),
    description: L(
      "Paid campaign planning for Swiss audiences, from targeting and creative through budget control and measured optimization.",
      "Planung bezahlter Kampagnen für Schweizer Zielgruppen – von Targeting und Kreation bis zu Budgetkontrolle und messbarer Optimierung.",
      "Planification de campagnes payantes pour le public suisse, du ciblage et des créations au contrôle du budget et à l’optimisation mesurée.",
      "Pianificazione di campagne a pagamento per il pubblico svizzero, dal targeting e dalle creatività al controllo del budget e all’ottimizzazione misurata.",
    ),
    quote: L(
      "Make every campaign clearer, more focused, and easier to improve.",
      "Machen Sie jede Kampagne klarer, fokussierter und leichter zu verbessern.",
      "Rendez chaque campagne plus claire, plus ciblée et plus facile à améliorer.",
      "Rendi ogni campagna più chiara, più mirata e più facile da migliorare.",
    ),
    caps: [
      [L("Audience planning", "Zielgruppenplanung", "Planification des audiences", "Pianificazione del pubblico"),
        L("Language regions, interests and intent mapped before budget is spent.", "Sprachregionen, Interessen und Kaufabsicht werden geklärt, bevor Budget fliesst.", "Régions linguistiques, centres d’intérêt et intentions définis avant d’engager le budget.", "Regioni linguistiche, interessi e intenzioni definiti prima di spendere il budget.")],
      [L("Campaign creative", "Kampagnenkreation", "Créations de campagne", "Creatività di campagna"),
        L("Ads written and designed for each language region, not simply translated.", "Anzeigen, die für jede Sprachregion geschrieben und gestaltet – nicht nur übersetzt – werden.", "Des annonces rédigées et conçues pour chaque région linguistique, pas simplement traduites.", "Annunci scritti e progettati per ogni regione linguistica, non semplicemente tradotti.")],
      [L("Performance optimization", "Performance-Optimierung", "Optimisation des performances", "Ottimizzazione delle performance"),
        L("Weekly budget checks and tests that keep cost per result moving down.", "Wöchentliche Budgetkontrollen und Tests, die die Kosten pro Ergebnis senken.", "Contrôles hebdomadaires du budget et tests pour réduire le coût par résultat.", "Controlli settimanali del budget e test che riducono il costo per risultato.")],
    ],
    body: L(
      "<p>Switzerland is four markets in one. We plan paid campaigns on Google, Meta and LinkedIn per language region, with creative and landing pages that speak to each audience in its own words.</p><p>Budgets are controlled weekly, results are tracked against the goal you care about, and every optimisation is documented so you always know why money moved.</p>",
      "<p>Die Schweiz ist vier Märkte in einem. Wir planen bezahlte Kampagnen auf Google, Meta und LinkedIn pro Sprachregion – mit Anzeigen und Landingpages, die jede Zielgruppe in ihrer eigenen Sprache ansprechen.</p><p>Budgets werden wöchentlich kontrolliert, Ergebnisse am Ziel gemessen, das Ihnen wichtig ist, und jede Optimierung wird dokumentiert.</p>",
      "<p>La Suisse, ce sont quatre marchés en un. Nous planifions les campagnes payantes sur Google, Meta et LinkedIn par région linguistique, avec des créations et des pages d’atterrissage qui parlent à chaque public avec ses propres mots.</p><p>Les budgets sont contrôlés chaque semaine, les résultats sont mesurés par rapport à votre objectif et chaque optimisation est documentée.</p>",
      "<p>La Svizzera è quattro mercati in uno. Pianifichiamo campagne a pagamento su Google, Meta e LinkedIn per regione linguistica, con creatività e landing page che parlano a ogni pubblico con le sue parole.</p><p>I budget sono controllati ogni settimana, i risultati misurati rispetto all’obiettivo che conta per te e ogni ottimizzazione viene documentata.</p>",
    ),
    seoKeywords: ["Google Ads Switzerland", "Meta ads", "LinkedIn ads", "paid campaigns", "Online-Werbung Schweiz"],
  },
  {
    family: "marketing", slug: "seo-services", imageId: 16, heroImageId: 5,
    title: L("SEO services", "Suchmaschinenoptimierung (SEO)", "Référencement naturel (SEO)", "Ottimizzazione per i motori di ricerca (SEO)"),
    slugs: L("seo-services", "seo-services", "services-seo", "servizi-seo"),
    description: L(
      "Technical and on-page improvements, search-led content, local relevance, and a sustainable measurement rhythm.",
      "Technische und On-Page-Verbesserungen, suchorientierte Inhalte, lokale Relevanz und ein nachhaltiger Messrhythmus.",
      "Améliorations techniques et on-page, contenus guidés par la recherche, pertinence locale et suivi régulier des résultats.",
      "Miglioramenti tecnici e on-page, contenuti guidati dalla ricerca, rilevanza locale e un ritmo di misurazione sostenibile.",
    ),
    quote: L(
      "Help the right people find you when the need is real.",
      "Sorgen Sie dafür, dass die richtigen Menschen Sie finden, wenn der Bedarf echt ist.",
      "Aidez les bonnes personnes à vous trouver au moment où le besoin est réel.",
      "Fatti trovare dalle persone giuste quando il bisogno è reale.",
    ),
    caps: [
      [L("Technical foundations", "Technische Grundlagen", "Bases techniques", "Fondamenta tecniche"),
        L("Crawlability, speed, structured data and clean multilingual URLs.", "Crawlbarkeit, Geschwindigkeit, strukturierte Daten und saubere mehrsprachige URLs.", "Exploration, vitesse, données structurées et URL multilingues propres.", "Scansionabilità, velocità, dati strutturati e URL multilingue puliti.")],
      [L("Content and keywords", "Inhalte und Keywords", "Contenus et mots-clés", "Contenuti e parole chiave"),
        L("Pages written around real questions your customers search for.", "Seiten, die sich an echten Fragen Ihrer Kundschaft orientieren.", "Des pages rédigées autour des vraies questions de vos clients.", "Pagine scritte attorno alle vere domande dei tuoi clienti.")],
      [L("Local search visibility", "Lokale Sichtbarkeit", "Visibilité locale", "Visibilità locale"),
        L("Google Business Profile, local pages and reviews for every location.", "Google-Unternehmensprofil, lokale Seiten und Bewertungen für jeden Standort.", "Fiche Google Business, pages locales et avis pour chaque site.", "Profilo dell’attività su Google, pagine locali e recensioni per ogni sede.")],
    ],
    body: L(
      "<p>SEO is a long game played in short, regular moves. We fix the technical foundations first – speed, structure and clean multilingual URLs – then build content around the questions your customers actually ask.</p><p>For local businesses we add Google Business Profile care and location pages, and we review rankings, traffic and enquiries together every month.</p>",
      "<p>SEO ist ein langes Spiel aus kurzen, regelmässigen Zügen. Zuerst bringen wir die technischen Grundlagen in Ordnung – Geschwindigkeit, Struktur und saubere mehrsprachige URLs –, danach entstehen Inhalte zu den Fragen, die Ihre Kundschaft wirklich stellt.</p><p>Für lokale Unternehmen pflegen wir zusätzlich das Google-Unternehmensprofil und Standortseiten und besprechen Rankings, Traffic und Anfragen monatlich.</p>",
      "<p>Le SEO est un travail de longue haleine fait de petits gestes réguliers. Nous corrigeons d’abord les bases techniques – vitesse, structure et URL multilingues propres – puis nous créons des contenus autour des questions que vos clients se posent vraiment.</p><p>Pour les entreprises locales, nous ajoutons le suivi de la fiche Google Business et des pages par site, et nous analysons chaque mois positions, trafic et demandes.</p>",
      "<p>La SEO è una partita lunga fatta di mosse brevi e regolari. Prima sistemiamo le fondamenta tecniche – velocità, struttura e URL multilingue puliti – poi creiamo contenuti attorno alle domande che i tuoi clienti fanno davvero.</p><p>Per le attività locali curiamo anche il Profilo dell’attività su Google e le pagine per sede, e ogni mese analizziamo posizionamenti, traffico e richieste.</p>",
    ),
    seoKeywords: ["SEO services", "local SEO", "technical SEO", "keyword research", "Suchmaschinenoptimierung"],
  },
  {
    family: "it-support", slug: "website-management", imageId: 18, heroImageId: 6,
    title: L("Website management", "Website-Betreuung", "Gestion de site web", "Gestione del sito web"),
    slugs: L("website-management", "website-betreuung", "gestion-de-site-web", "gestione-sito-web"),
    description: L(
      "Content changes, maintenance, backups, monitoring, performance care, and practical day-to-day support.",
      "Inhaltsänderungen, Wartung, Backups, Monitoring, Performance-Pflege und praktischer Support im Alltag.",
      "Modifications de contenu, maintenance, sauvegardes, surveillance, performances et support au quotidien.",
      "Modifiche ai contenuti, manutenzione, backup, monitoraggio, prestazioni e supporto pratico quotidiano.",
    ),
    quote: L(
      "Keep your website current, secure, and ready for what comes next.",
      "Halten Sie Ihre Website aktuell, sicher und bereit für das, was kommt.",
      "Gardez votre site à jour, sécurisé et prêt pour la suite.",
      "Mantieni il tuo sito aggiornato, sicuro e pronto per ciò che verrà.",
    ),
    caps: [
      [L("Content updates", "Inhaltsupdates", "Mises à jour de contenu", "Aggiornamenti dei contenuti"),
        L("Text, images and new pages published within an agreed response time.", "Texte, Bilder und neue Seiten, veröffentlicht innerhalb einer vereinbarten Reaktionszeit.", "Textes, images et nouvelles pages publiés dans un délai convenu.", "Testi, immagini e nuove pagine pubblicati entro tempi concordati.")],
      [L("Performance care", "Performance-Pflege", "Soin des performances", "Cura delle prestazioni"),
        L("Regular speed checks, image optimisation and clean-up of unused plugins.", "Regelmässige Geschwindigkeitsprüfungen, Bildoptimierung und Aufräumen ungenutzter Plugins.", "Contrôles de vitesse réguliers, optimisation des images et nettoyage des extensions inutilisées.", "Controlli periodici della velocità, ottimizzazione delle immagini e pulizia dei plugin inutilizzati.")],
      [L("Maintenance and monitoring", "Wartung und Monitoring", "Maintenance et surveillance", "Manutenzione e monitoraggio"),
        L("Updates, uptime checks and tested backups on a fixed schedule.", "Updates, Verfügbarkeitsprüfungen und getestete Backups nach festem Plan.", "Mises à jour, contrôles de disponibilité et sauvegardes testées selon un calendrier fixe.", "Aggiornamenti, controlli di disponibilità e backup testati secondo un calendario fisso.")],
    ],
    body: L(
      "<p>A website is never finished. With a care plan, your team sends requests to one place and we handle the rest: content changes, security updates, backups and the small improvements that keep the site feeling fresh.</p><p>Each month you get a short summary of what changed, what we monitored and what we recommend next.</p>",
      "<p>Eine Website ist nie fertig. Mit einem Betreuungsplan sendet Ihr Team Anfragen an eine Stelle und wir kümmern uns um den Rest: Inhaltsänderungen, Sicherheitsupdates, Backups und kleine Verbesserungen, die die Website frisch halten.</p><p>Jeden Monat erhalten Sie eine kurze Zusammenfassung der Änderungen, des Monitorings und unserer Empfehlungen.</p>",
      "<p>Un site web n’est jamais terminé. Avec un contrat de suivi, votre équipe envoie ses demandes à un seul endroit et nous nous occupons du reste : contenus, mises à jour de sécurité, sauvegardes et petites améliorations qui gardent le site vivant.</p><p>Chaque mois, vous recevez un bref résumé des changements, de la surveillance et de nos recommandations.</p>",
      "<p>Un sito web non è mai finito. Con un piano di assistenza il tuo team invia le richieste in un unico punto e noi pensiamo al resto: contenuti, aggiornamenti di sicurezza, backup e piccoli miglioramenti che mantengono il sito attuale.</p><p>Ogni mese ricevi un breve riepilogo delle modifiche, del monitoraggio e dei prossimi consigli.</p>",
    ),
    seoKeywords: ["website management", "website maintenance", "WordPress care plan", "content updates", "Website-Wartung"],
  },
  {
    family: "it-support", slug: "software-support", imageId: 15, heroImageId: 7,
    title: L("Software support and error fixing", "Software-Support und Fehlerbehebung", "Support logiciel et correction d’erreurs", "Supporto software e correzione di errori"),
    slugs: L("software-support", "software-support", "support-logiciel", "supporto-software"),
    description: L(
      "Diagnosis, bug fixing, compatibility work, maintenance, and responsive technical support for existing software.",
      "Diagnose, Fehlerbehebung, Kompatibilitätsarbeit, Wartung und reaktionsschneller technischer Support für bestehende Software.",
      "Diagnostic, correction de bugs, compatibilité, maintenance et support technique réactif pour vos logiciels existants.",
      "Diagnosi, correzione di bug, compatibilità, manutenzione e supporto tecnico reattivo per il software esistente.",
    ),
    quote: L(
      "Find the cause, restore stability, and reduce repeat problems.",
      "Finden Sie die Ursache, stellen Sie Stabilität her und vermeiden Sie Wiederholungen.",
      "Trouvez la cause, rétablissez la stabilité et évitez que les problèmes se répètent.",
      "Trova la causa, ripristina la stabilità e riduci i problemi ricorrenti.",
    ),
    caps: [
      [L("Issue diagnosis", "Fehlerdiagnose", "Diagnostic des incidents", "Diagnosi dei problemi"),
        L("Logs, reproduction steps and a clear explanation of the root cause.", "Logs, Reproduktionsschritte und eine klare Erklärung der Ursache.", "Journaux, étapes de reproduction et explication claire de la cause.", "Log, passaggi di riproduzione e una spiegazione chiara della causa.")],
      [L("Stability fixes", "Stabilitätskorrekturen", "Corrections de stabilité", "Correzioni di stabilità"),
        L("Tested fixes released safely, with a rollback plan if needed.", "Getestete Korrekturen, sicher ausgerollt – mit Rückfallplan, falls nötig.", "Des correctifs testés, déployés en toute sécurité avec un plan de retour arrière.", "Correzioni testate e rilasciate in sicurezza, con un piano di rollback se serve.")],
      [L("Ongoing maintenance", "Laufende Wartung", "Maintenance continue", "Manutenzione continua"),
        L("Dependency updates and small refactors that prevent the next outage.", "Abhängigkeits-Updates und kleine Refactorings, die den nächsten Ausfall verhindern.", "Mises à jour des dépendances et petits refactorings qui préviennent la prochaine panne.", "Aggiornamenti delle dipendenze e piccoli refactoring che prevengono il prossimo guasto.")],
    ],
    body: L(
      "<p>When software breaks, you need someone who looks for the cause, not just the symptom. We reproduce the problem, explain what is happening in plain language and ship a tested fix.</p><p>We also take on software built by other teams: after a short audit we document the system and agree a maintenance rhythm that keeps it stable.</p>",
      "<p>Wenn Software ausfällt, brauchen Sie jemanden, der nach der Ursache sucht – nicht nur nach dem Symptom. Wir reproduzieren das Problem, erklären verständlich, was passiert, und liefern eine getestete Korrektur.</p><p>Auch Software anderer Teams übernehmen wir: Nach einem kurzen Audit dokumentieren wir das System und vereinbaren einen Wartungsrhythmus.</p>",
      "<p>Quand un logiciel tombe en panne, il faut quelqu’un qui cherche la cause, pas seulement le symptôme. Nous reproduisons le problème, expliquons clairement ce qui se passe et livrons un correctif testé.</p><p>Nous reprenons aussi des logiciels développés par d’autres équipes : après un court audit, nous documentons le système et convenons d’un rythme de maintenance.</p>",
      "<p>Quando un software si guasta serve qualcuno che cerchi la causa, non solo il sintomo. Riproduciamo il problema, spieghiamo con parole semplici cosa succede e rilasciamo una correzione testata.</p><p>Prendiamo in carico anche software sviluppato da altri team: dopo un breve audit documentiamo il sistema e concordiamo un ritmo di manutenzione.</p>",
    ),
    seoKeywords: ["software support", "bug fixing", "application maintenance", "legacy software", "Software-Wartung"],
  },
  {
    family: "hosting", slug: "managed-hosting", imageId: 8, heroImageId: 5,
    title: L("Managed website hosting", "Managed Website-Hosting", "Hébergement de site web géré", "Hosting gestito per siti web"),
    slugs: L("managed-hosting", "managed-hosting", "hebergement-gere", "hosting-gestito"),
    description: L(
      "A managed hosting relationship with monitoring, backup routines, performance care, and direct support—without unsupported uptime promises.",
      "Ein betreutes Hosting mit Monitoring, Backup-Routinen, Performance-Pflege und direktem Support – ohne unhaltbare Verfügbarkeitsversprechen.",
      "Un hébergement géré avec surveillance, sauvegardes régulières, optimisation des performances et support direct – sans promesses de disponibilité intenables.",
      "Un hosting gestito con monitoraggio, backup regolari, cura delle prestazioni e supporto diretto, senza promesse di disponibilità irrealistiche.",
    ),
    quote: L(
      "Keep the website available, maintained, and ready to perform.",
      "Halten Sie die Website verfügbar, gepflegt und leistungsbereit.",
      "Gardez votre site disponible, entretenu et prêt à performer.",
      "Mantieni il sito disponibile, curato e pronto a rendere al meglio.",
    ),
    caps: [
      [L("Managed hosting", "Managed Hosting", "Hébergement géré", "Hosting gestito"),
        L("Swiss-based servers configured and maintained for your website.", "Server in der Schweiz, eingerichtet und gepflegt für Ihre Website.", "Des serveurs en Suisse configurés et entretenus pour votre site.", "Server in Svizzera configurati e mantenuti per il tuo sito.")],
      [L("Monitoring and backups", "Monitoring und Backups", "Surveillance et sauvegardes", "Monitoraggio e backup"),
        L("Around-the-clock monitoring and daily backups with tested restores.", "Rund-um-die-Uhr-Monitoring und tägliche Backups mit getesteten Wiederherstellungen.", "Surveillance 24 h/24 et sauvegardes quotidiennes avec restaurations testées.", "Monitoraggio continuo e backup giornalieri con ripristini testati.")],
      [L("Performance care", "Performance-Pflege", "Soin des performances", "Cura delle prestazioni"),
        L("Caching, image delivery and database tuning reviewed every quarter.", "Caching, Bildauslieferung und Datenbank-Tuning, vierteljährlich überprüft.", "Mise en cache, diffusion des images et optimisation de la base revues chaque trimestre.", "Cache, distribuzione delle immagini e ottimizzazione del database rivisti ogni trimestre.")],
    ],
    body: L(
      "<p>Hosting is more than storage. Your website lives on infrastructure we configure, monitor and maintain – close to the team that designed and built it, so every conversation starts with context.</p><p>Backups run daily and restores are tested; updates are reviewed before they go live; and when something needs attention, you talk to a person who knows your site.</p>",
      "<p>Hosting ist mehr als Speicherplatz. Ihre Website läuft auf einer Infrastruktur, die wir einrichten, überwachen und pflegen – nah am Team, das sie gestaltet und entwickelt hat, damit jedes Gespräch mit Kontext beginnt.</p><p>Backups laufen täglich und Wiederherstellungen werden getestet; Updates werden vor dem Livegang geprüft; und wenn etwas Aufmerksamkeit braucht, sprechen Sie mit einer Person, die Ihre Website kennt.</p>",
      "<p>L’hébergement, c’est plus que de l’espace disque. Votre site fonctionne sur une infrastructure que nous configurons, surveillons et entretenons – au plus près de l’équipe qui l’a conçu et développé.</p><p>Les sauvegardes sont quotidiennes et les restaurations testées ; les mises à jour sont vérifiées avant leur mise en ligne ; et en cas de besoin, vous parlez à quelqu’un qui connaît votre site.</p>",
      "<p>L’hosting è più di uno spazio di archiviazione. Il tuo sito vive su un’infrastruttura che configuriamo, monitoriamo e manteniamo, vicino al team che l’ha progettato e sviluppato.</p><p>I backup sono giornalieri e i ripristini vengono testati; gli aggiornamenti sono verificati prima della pubblicazione; e quando serve, parli con una persona che conosce il tuo sito.</p>",
    ),
    seoKeywords: ["managed hosting", "Swiss web hosting", "website backups", "uptime monitoring", "Webhosting Schweiz"],
  },
];

// Build store rows. createdAt dates are fixed so the seed looks the same on every start.
function buildServices() {
  const services = FAMILIES.map((f, i) => ({
    id: i + 1,
    key: f.key,
    title: f.title,
    description: f.description,
    slug: f.slug,
    seoTitle: f.seoTitle,
    seoDescription: f.seoDescription,
    seoKeywords: f.seoKeywords,
    imageId: f.imageId,
    order: i + 1,
    createdById: 1,
    updatedById: 1,
    createdAt: new Date(Date.UTC(2025, 10, 3 + i, 9, 15)).toISOString(),
    updatedAt: new Date(Date.UTC(2026, 7, 20 + i, 14, 5)).toISOString(),
  }));
  let featureId = 1;
  let planId = 1;
  const orderIn = {};
  const subServices = SUBS.map((s, i) => {
    const service = services.find((x) => x.key === s.family);
    orderIn[service.id] = (orderIn[service.id] || 0) + 1;
    const tags = Object.fromEntries(["en", "de", "fr", "it"].map((l) => [l, s.caps.map(([t]) => t[l])]));
    return {
      id: i + 1,
      serviceId: service.id,
      key: s.slug,
      title: s.title,
      description: s.description,
      slug: s.slugs,
      seoTitle: mapLoc(s.title, (t) => `${t} | OrgTik`),
      seoDescription: s.description,
      seoKeywords: s.seoKeywords,
      imageId: s.imageId,
      featureImageId: s.heroImageId,
      tags,
      body: s.body,
      quote: s.quote,
      features: s.caps.map(([title, description]) => ({ id: featureId++, imageId: null, title, description })),
      howWeWork: STEPS.map((st) => ({ id: featureId++, imageId: st.imageId, title: st.title, description: st.description })),
      pricingPlans: PLANS.map((p) => ({ id: planId++, ...JSON.parse(JSON.stringify(p)) })),
      order: orderIn[service.id],
      createdAt: new Date(Date.UTC(2025, 10, 10 + i, 10, 30)).toISOString(),
      updatedAt: new Date(Date.UTC(2026, 8, 1 + i, 11, 45)).toISOString(),
    };
  });
  return { services, subServices };
}

module.exports = { buildServices, STEPS, PLANS, FAMILIES, slugify };
