// Website pages (SEO) + content sections edited by ContentReusableForm (app/[locale]/(dashboard)/content/[sectionId]).
// Section type schemas follow what that form understands:
//   - localized field: { type: "object", "x-i18n": true, properties: { en, de, fr, it } }  (rich text: properties.en.type = "rich-text")
//     a localized field whose `description` contains "description" renders as a textarea
//   - image picker: a key named "imageId"/"galleryId" with type "number"
//   - arrays: { type: "array", items: { type: "object", properties } } (top level, or inside array items)
//   - root arrays: sectionType.isArrayBased = true and schema.type = "array"
// Only string/number/object/array are used, because the form's zod schema drops anything else on save.
const { LANGS, L } = require("../lib");
const { STEPS, PLANS } = require("./services");

const S = {
  i18n: (description, rich = false) => ({ type: "object", "x-i18n": true, description, properties: Object.fromEntries(LANGS.map((l) => [l, { type: rich ? "rich-text" : "string" }])) }),
  str: (description) => ({ type: "string", description }),
  num: (description) => ({ type: "number", description }),
  obj: (properties, required) => ({ type: "object", properties, ...(required ? { required } : {}) }),
  arr: (properties, required) => ({ type: "array", items: { type: "object", properties, ...(required ? { required } : {}) } }),
};
const button = () => S.obj({ label: S.i18n("Button label"), link: S.str("Button link") }, ["link"]);

const SECTION_TYPES = [
  {
    name: "home_hero", displayName: "Home hero", isArrayBased: false,
    description: "Full-screen hero at the top of the home page: rotating headline, intro text, two calls to action and the background film.",
    schema: S.obj({
      eyebrow: S.i18n("Small label above the heading"),
      title: S.i18n("Main heading"),
      subtitle: S.i18n("Supporting description below the heading"),
      rotatingWords: S.arr({ text: S.i18n("Rotating phrase") }),
      primaryButton: button(),
      secondaryButton: button(),
      imageId: S.num("Poster image shown while the film loads"),
      galleryId: S.num("Background film from the gallery"),
    }, ["imageId"]),
  },
  {
    name: "page_hero", displayName: "Page hero", isArrayBased: false,
    description: "Heading block at the top of a page: eyebrow, two-line heading, supporting text and a hero image.",
    schema: S.obj({
      eyebrow: S.i18n("Small label above the heading"),
      title: S.i18n("Main heading"),
      highlight: S.i18n("Violet accent line after the heading"),
      subtitle: S.i18n("Supporting description below the heading"),
      imageId: S.num("Hero image"),
    }, ["imageId"]),
  },
  {
    name: "services_overview", displayName: "Services overview", isArrayBased: false,
    description: "The five service families shown as image cards on the home page.",
    schema: S.obj({
      eyebrow: S.i18n("Small label above the heading"),
      title: S.i18n("Section heading"),
      description: S.i18n("Short description under the heading"),
      items: S.arr({
        title: S.i18n("Service name"),
        category: S.i18n("Category label"),
        text: S.i18n("Card description"),
        tags: S.arr({ label: S.i18n("Tag") }),
        link: S.str("Link to the service page"),
        imageId: S.num("Card image"),
      }, ["link"]),
    }),
  },
  {
    name: "software_modules", displayName: "Software modules", isArrayBased: false,
    description: "The six OrgTik software products (HR, CRM, Files, Tasks, Marketing, Website Manager).",
    schema: S.obj({
      eyebrow: S.i18n("Small label above the heading"),
      title: S.i18n("Section heading"),
      description: S.i18n("Short description under the heading"),
      modules: S.arr({
        name: S.str("Product name"),
        category: S.i18n("Category label"),
        headline: S.i18n("Product headline"),
        text: S.i18n("Product description"),
        link: S.str("Link to the product page"),
        price: S.num("Starting price per month (CHF)"),
      }, ["name", "link"]),
    }),
  },
  {
    name: "process_steps", displayName: "Process steps", isArrayBased: true,
    description: "Numbered stages with a heading, text and an image (used for “How we work” and the About journey).",
    schema: { type: "array", items: { type: "object", properties: { step: S.i18n("Stage name"), title: S.i18n("Stage heading"), description: S.i18n("Stage description"), imageId: S.num("Stage image") }, required: ["imageId"] } },
  },
  {
    name: "faq", displayName: "FAQ", isArrayBased: true,
    description: "Questions and answers shown in the FAQ accordion.",
    schema: { type: "array", items: { type: "object", properties: { question: S.i18n("Question"), answer: S.i18n("Answer description") } } },
  },
  {
    name: "service_packs", displayName: "Service packs", isArrayBased: true,
    description: "Focus, Connected and Partnership engagement plans with prototype CHF estimates.",
    schema: { type: "array", items: { type: "object", properties: { name: S.i18n("Pack name"), note: S.i18n("Short description of the pack"), badge: S.i18n("Badge text"), period: S.i18n("Billing period label"), price: S.num("Price in CHF") }, required: ["price"] } },
  },
  {
    name: "value_cards", displayName: "Mission and goals", isArrayBased: false,
    description: "Mission statement with an image and a set of goal cards.",
    schema: S.obj({
      eyebrow: S.i18n("Small label above the heading"),
      title: S.i18n("Section heading"),
      description: S.i18n("Mission description"),
      imageId: S.num("Section image"),
      items: S.arr({ label: S.i18n("Card label"), title: S.i18n("Card heading"), description: S.i18n("Card description") }),
    }, ["imageId"]),
  },
  {
    name: "stats", displayName: "Key figures", isArrayBased: true,
    description: "Short figures with a label.",
    schema: { type: "array", items: { type: "object", properties: { value: S.str("Figure, e.g. 6"), label: S.i18n("What the figure means") }, required: ["value"] } },
  },
  {
    name: "contact_info", displayName: "Contact details", isArrayBased: false,
    description: "Studio address, phone, email and opening hours shown next to the contact form.",
    schema: S.obj({
      title: S.i18n("Panel heading"),
      description: S.i18n("Short description of how to reach the studio"),
      openingHours: S.i18n("Opening hours"),
      address: S.str("Street address"),
      phone: S.str("Phone number"),
      email: S.str("Contact email"),
      mapLink: S.str("Map link"),
    }, ["address", "phone"]),
  },
  {
    name: "enquiry_paths", displayName: "Enquiry paths", isArrayBased: true,
    description: "The choices at the top of the contact form (they pre-select the enquiry topic).",
    schema: { type: "array", items: { type: "object", properties: { title: S.i18n("Path name"), description: S.i18n("Path description"), note: S.i18n("Small label under the path"), topic: S.str("Pre-selected enquiry topic") }, required: ["topic"] } },
  },
  {
    name: "job_openings", displayName: "Open positions", isArrayBased: true,
    description: "Job openings listed on the careers page.",
    schema: { type: "array", items: { type: "object", properties: { title: S.i18n("Job title"), department: S.i18n("Team"), location: S.i18n("Location"), description: S.i18n("Role description"), employmentType: S.str("Employment type"), applyLink: S.str("Application link") }, required: ["employmentType"] } },
  },
  {
    name: "legal_document", displayName: "Legal document", isArrayBased: false,
    description: "A legal page (imprint, privacy policy, terms) with a rich-text body.",
    schema: S.obj({
      title: S.i18n("Page heading"),
      summary: S.i18n("Short description shown under the heading"),
      body: S.i18n("Document text", true),
      lastUpdated: S.str("Last updated (YYYY-MM-DD)"),
    }, ["lastUpdated"]),
  },
  // ---- shared sections (not bound to a page) ----
  {
    name: "navigation", displayName: "Main navigation", isArrayBased: true,
    description: "Links in the site header (desktop and mobile menu).",
    schema: { type: "array", items: { type: "object", properties: { label: S.i18n("Menu label"), link: S.str("Menu link") }, required: ["link"] } },
  },
  {
    name: "footer", displayName: "Footer", isArrayBased: false,
    description: "Footer brand line, contact details and link columns shown on every page.",
    schema: S.obj({
      tagline: S.i18n("Short brand line under the logo"),
      copyright: S.i18n("Copyright line"),
      address: S.str("Street address"),
      phone: S.str("Phone number"),
      email: S.str("Contact email"),
      columns: S.arr({ title: S.i18n("Column heading"), links: S.arr({ label: S.i18n("Link label"), link: S.str("Link") }) }),
    }),
  },
  {
    name: "closing_cta", displayName: "Closing call to action", isArrayBased: false,
    description: "The violet contact band with the large OrgTik mark at the end of every page.",
    schema: S.obj({
      title: S.i18n("Heading"),
      highlight: S.i18n("Violet accent line"),
      description: S.i18n("Supporting description"),
      button: button(),
      imageId: S.num("Background mark"),
    }, ["imageId"]),
  },
  {
    name: "social_links", displayName: "Social links", isArrayBased: true,
    description: "Social profiles in the footer. Leave the link empty to show an unlinked icon.",
    schema: { type: "array", items: { type: "object", properties: { platform: S.str("Platform name"), link: S.str("Profile link") }, required: ["platform"] } },
  },
  {
    name: "announcement_bar", displayName: "Announcement bar", isArrayBased: false,
    description: "Thin bar above the header for news and launches.",
    schema: S.obj({ message: S.i18n("Announcement text"), linkLabel: S.i18n("Link label"), link: S.str("Link") }),
  },
];

const hero = (eyebrow, title, highlight, subtitle, imageId) => ({ eyebrow, title, highlight, subtitle, imageId });
const steps = (list) => list.map((s, i) => ({ step: L(`0${i + 1}`, `0${i + 1}`, `0${i + 1}`, `0${i + 1}`), title: s.title, description: s.description, imageId: s.imageId }));

// Legal wording mirrors the website's own placeholders (owner-approved text still pending).
const legalBody = (sections) => Object.fromEntries(LANGS.map((l) => [l, sections.map(([h, p]) => `<h3>${h[l]}</h3><p>${p[l]}</p>`).join("")]));

function buildSite({ websiteUrl, jobs }) {
  const home = websiteUrl;
  const PAGES = [
    { type: "home", seo: [
      L("OrgTik – Strategy, design and technology from Switzerland", "OrgTik – Strategie, Design und Technologie aus der Schweiz", "OrgTik – Stratégie, design et technologie depuis la Suisse", "OrgTik – Strategia, design e tecnologia dalla Svizzera"),
      L("Websites, apps, marketing, support, hosting and connected business software – built by one team in Belp.", "Websites, Apps, Marketing, Support, Hosting und vernetzte Business-Software – von einem Team in Belp.", "Sites web, applications, marketing, support, hébergement et logiciels d’entreprise connectés – par une seule équipe à Belp.", "Siti web, app, marketing, supporto, hosting e software aziendale connesso – da un unico team a Belp."),
      ["OrgTik", "digital agency Switzerland", "web design", "business software", "Belp"],
    ] },
    { type: "services", seo: [
      L("Services – design, development, marketing, support and hosting | OrgTik", "Leistungen – Design, Entwicklung, Marketing, Support und Hosting | OrgTik", "Services – design, développement, marketing, support et hébergement | OrgTik", "Servizi – design, sviluppo, marketing, supporto e hosting | OrgTik"),
      L("Five connected service families delivered by one team, from brand identity to managed hosting.", "Fünf vernetzte Leistungsbereiche aus einem Team – von der Markenidentität bis zum Managed Hosting.", "Cinq familles de services connectées, assurées par une seule équipe, de l’identité de marque à l’hébergement géré.", "Cinque famiglie di servizi collegate, offerte da un unico team, dall’identità di brand all’hosting gestito."),
      ["web design services", "web development", "digital marketing", "IT support", "managed hosting"],
    ] },
    { type: "software", seo: [
      L("Software – HR, CRM, Files, Tasks, Marketing and Website Manager | OrgTik", "Software – HR, CRM, Dateien, Aufgaben, Marketing und Website Manager | OrgTik", "Logiciels – RH, CRM, fichiers, tâches, marketing et Website Manager | OrgTik", "Software – HR, CRM, file, attività, marketing e Website Manager | OrgTik"),
      L("Six connected SaaS products. Start with one module or combine them into a bundle with prototype savings.", "Sechs vernetzte SaaS-Produkte. Starten Sie mit einem Modul oder kombinieren Sie sie zu einem Paket.", "Six produits SaaS connectés. Commencez par un module ou combinez-les dans un pack.", "Sei prodotti SaaS collegati. Inizia con un modulo o combinali in un pacchetto."),
      ["business software", "HR software", "CRM", "task management", "SaaS Switzerland"],
    ] },
    { type: "work", seo: [
      L("Selected work – projects and case studies | OrgTik", "Ausgewählte Arbeiten – Projekte und Fallstudien | OrgTik", "Réalisations – projets et études de cas | OrgTik", "Lavori selezionati – progetti e casi di studio | OrgTik"),
      L("Brand systems, platforms, campaigns and ongoing care: a selection of OrgTik work and client projects.", "Markensysteme, Plattformen, Kampagnen und laufende Betreuung: eine Auswahl von OrgTik-Arbeiten und Kundenprojekten.", "Systèmes de marque, plateformes, campagnes et suivi continu : une sélection de travaux OrgTik et de projets clients.", "Sistemi di brand, piattaforme, campagne e assistenza continua: una selezione di lavori OrgTik e progetti per clienti."),
      ["portfolio", "case studies", "web projects", "brand identity"],
    ] },
    { type: "about", seo: [
      L("About OrgTik – we connect the work behind progress", "Über OrgTik – wir verbinden die Arbeit hinter dem Fortschritt", "À propos d’OrgTik – nous relions le travail derrière le progrès", "Chi siamo – colleghiamo il lavoro dietro al progresso"),
      L("OrgTik brings strategy, design, technology and operations together so businesses can make clearer decisions.", "OrgTik verbindet Strategie, Design, Technologie und Betrieb, damit Unternehmen klarer entscheiden können.", "OrgTik réunit stratégie, design, technologie et opérations pour aider les entreprises à décider plus clairement.", "OrgTik unisce strategia, design, tecnologia e operazioni perché le aziende possano decidere con più chiarezza."),
      ["about OrgTik", "digital studio Belp", "OrgTik team", "mission"],
    ] },
    { type: "insights", seo: [
      L("Insights – articles on design, development and growth | OrgTik", "Insights – Artikel zu Design, Entwicklung und Wachstum | OrgTik", "Insights – articles sur le design, le développement et la croissance | OrgTik", "Insights – articoli su design, sviluppo e crescita | OrgTik"),
      L("Practical articles from the OrgTik team on websites, brands, marketing, support and hosting.", "Praxisnahe Artikel des OrgTik-Teams zu Websites, Marken, Marketing, Support und Hosting.", "Des articles pratiques de l’équipe OrgTik sur les sites web, les marques, le marketing, le support et l’hébergement.", "Articoli pratici del team OrgTik su siti web, brand, marketing, supporto e hosting."),
      ["blog", "insights", "web design tips", "SEO tips", "hosting guide"],
    ] },
    { type: "contact", seo: [
      L("Contact OrgTik – let’s find your first useful step", "Kontakt – finden wir Ihren ersten sinnvollen Schritt | OrgTik", "Contact – trouvons votre premier pas utile | OrgTik", "Contatti – troviamo il tuo primo passo utile | OrgTik"),
      L("Tell us what needs to work better. Studio in Belp, Switzerland – phone +41 31 812 74 84.", "Sagen Sie uns, was besser funktionieren soll. Studio in Belp – Telefon +41 31 812 74 84.", "Dites-nous ce qui doit mieux fonctionner. Studio à Belp, Suisse – téléphone +41 31 812 74 84.", "Dicci cosa deve funzionare meglio. Studio a Belp, Svizzera – telefono +41 31 812 74 84."),
      ["contact OrgTik", "web agency Bern", "start a project", "Belp"],
    ] },
    { type: "careers", seo: [
      L("Careers at OrgTik – build what comes next with us", "Karriere bei OrgTik – gestalten Sie mit uns, was kommt", "Carrières chez OrgTik – construisez la suite avec nous", "Lavora con OrgTik – costruisci con noi ciò che verrà"),
      L("Open positions in design, engineering, marketing and support in Belp and Cairo.", "Offene Stellen in Design, Entwicklung, Marketing und Support in Belp und Kairo.", "Postes ouverts en design, développement, marketing et support à Belp et au Caire.", "Posizioni aperte in design, sviluppo, marketing e supporto a Belp e al Cairo."),
      ["jobs", "careers", "frontend developer job", "UX designer job", "Belp"],
    ] },
    { type: "legal", seo: [
      L("Legal information – imprint, privacy and terms | OrgTik", "Rechtliches – Impressum, Datenschutz und AGB | OrgTik", "Informations légales – mentions, confidentialité et conditions | OrgTik", "Note legali – impressum, privacy e condizioni | OrgTik"),
      L("Imprint, privacy policy and terms and conditions for the OrgTik website.", "Impressum, Datenschutzerklärung und Geschäftsbedingungen der OrgTik-Website.", "Mentions légales, politique de confidentialité et conditions générales du site OrgTik.", "Impressum, informativa sulla privacy e condizioni generali del sito OrgTik."),
      ["imprint", "privacy policy", "terms and conditions"],
    ] },
    { type: "roadmap", seo: [
      L("Roadmap – what OrgTik is building next", "Roadmap – woran OrgTik als Nächstes arbeitet", "Feuille de route – ce qu’OrgTik prépare", "Roadmap – a cosa lavora OrgTik"),
      L("Past, current and upcoming OrgTik projects, with community suggestions and delivery status.", "Vergangene, laufende und geplante OrgTik-Projekte mit Community-Vorschlägen und Lieferstatus.", "Projets OrgTik passés, en cours et à venir, avec suggestions de la communauté et état d’avancement.", "Progetti OrgTik passati, in corso e futuri, con suggerimenti della community e stato di avanzamento."),
      ["roadmap", "product updates", "OrgTik software"],
    ] },
  ];

  const pages = PAGES.map((p, i) => ({
    id: i + 1,
    type: p.type,
    seoTitle: p.seo[0],
    seoDescription: p.seo[1],
    seoKeywords: p.seo[2],
    order: i + 1,
    createdAt: new Date(Date.UTC(2025, 9, 1 + i, 8)).toISOString(),
    updatedAt: new Date(Date.UTC(2026, 8, 2 + i, 9, 30)).toISOString(),
  }));
  const pageId = (type) => pages.find((p) => p.type === type).id;

  const services = [
    ["design", L("Brand & digital design", "Marke & digitales Design", "Marque et design numérique", "Brand e design digitale"), L("Make it matter", "Wirkung erzielen", "Faire la différence", "Fare la differenza"),
      L("From the first impression to the smallest interaction. Identity and experiences built around your audience.", "Vom ersten Eindruck bis zur kleinsten Interaktion. Identität und Erlebnisse, gebaut rund um Ihr Publikum.", "De la première impression à la plus petite interaction. Identité et expériences pensées pour votre public.", "Dalla prima impressione alla più piccola interazione. Identità ed esperienze costruite attorno al tuo pubblico."),
      [L("Brand systems", "Markensysteme", "Systèmes de marque", "Sistemi di brand"), L("Visual identity", "Visuelle Identität", "Identité visuelle", "Identità visiva"), L("UI/UX design", "UI/UX-Design", "Design UI/UX", "Design UI/UX")], 4],
    ["development", L("Web & app development", "Web- & App-Entwicklung", "Développement web et applications", "Sviluppo web e app"), L("Make it work", "Zum Laufen bringen", "Faire fonctionner", "Farlo funzionare"),
      L("Translate an ambitious idea into a considered digital experience. Websites and applications with a purpose.", "Machen Sie aus einer ehrgeizigen Idee ein durchdachtes digitales Erlebnis. Websites und Anwendungen mit Zweck.", "Traduisez une idée ambitieuse en une expérience numérique réfléchie. Des sites et applications avec un but.", "Trasforma un’idea ambiziosa in un’esperienza digitale curata. Siti e applicazioni con uno scopo."),
      [L("Web platforms", "Webplattformen", "Plateformes web", "Piattaforme web"), L("Applications", "Anwendungen", "Applications", "Applicazioni"), L("E-commerce", "E-Commerce", "E-commerce", "E-commerce")], 7],
    ["marketing", L("Marketing & growth", "Marketing & Wachstum", "Marketing et croissance", "Marketing e crescita"), L("Make it move", "In Bewegung bringen", "Mettre en mouvement", "Metterlo in movimento"),
      L("Connect your story with the people who need to hear it. A clearer strategy for meaningful attention.", "Verbinden Sie Ihre Geschichte mit den Menschen, die sie hören sollten. Eine klarere Strategie für echte Aufmerksamkeit.", "Reliez votre histoire aux personnes qui doivent l’entendre. Une stratégie plus claire pour une attention qui compte.", "Collega la tua storia alle persone che devono ascoltarla. Una strategia più chiara per un’attenzione che conta."),
      [L("Campaign strategy", "Kampagnenstrategie", "Stratégie de campagne", "Strategia di campagna"), L("Search", "Suche", "Référencement", "Ricerca"), L("Content systems", "Content-Systeme", "Systèmes de contenu", "Sistemi di contenuto")], 5],
    ["it-support", L("IT & ongoing support", "IT & laufender Support", "IT et support continu", "IT e supporto continuo"), L("Keep it moving", "In Bewegung halten", "Garder l’élan", "Mantenerlo in movimento"),
      L("A dependable partner for the work after launch. Keep improving the systems your business relies on.", "Ein verlässlicher Partner für die Arbeit nach dem Launch. Verbessern Sie laufend die Systeme, auf die Ihr Unternehmen baut.", "Un partenaire fiable pour l’après-lancement. Continuez d’améliorer les systèmes sur lesquels repose votre activité.", "Un partner affidabile per il lavoro dopo il lancio. Continua a migliorare i sistemi su cui si basa la tua attività."),
      [L("Website care", "Website-Pflege", "Soin du site", "Cura del sito"), L("Technical support", "Technischer Support", "Support technique", "Supporto tecnico"), L("Improvements", "Verbesserungen", "Améliorations", "Miglioramenti")], 6],
    ["hosting", L("OrgTik hosting", "OrgTik Hosting", "Hébergement OrgTik", "Hosting OrgTik"), L("Keep it online", "Online halten", "Rester en ligne", "Restare online"),
      L("Reliable hosting shaped for your website, with the performance, monitoring, backups, and support it needs to stay ready.", "Verlässliches Hosting für Ihre Website – mit Performance, Monitoring, Backups und dem Support, den sie braucht.", "Un hébergement fiable pensé pour votre site, avec les performances, la surveillance, les sauvegardes et le support nécessaires.", "Un hosting affidabile pensato per il tuo sito, con prestazioni, monitoraggio, backup e il supporto di cui ha bisogno."),
      [L("Managed hosting", "Managed Hosting", "Hébergement géré", "Hosting gestito"), L("Monitoring & backups", "Monitoring & Backups", "Surveillance et sauvegardes", "Monitoraggio e backup"), L("Performance care", "Performance-Pflege", "Soin des performances", "Cura delle prestazioni")], 8],
  ];

  const modules = [
    ["HR", L("Operations", "Betrieb", "Opérations", "Operazioni"), L("A little less admin. A lot more human.", "Etwas weniger Verwaltung. Viel mehr Mensch.", "Un peu moins d’administratif. Beaucoup plus d’humain.", "Un po’ meno burocrazia. Molto più umano."),
      L("Give people, documents, and everyday processes a clearer place in your business.", "Geben Sie Menschen, Dokumenten und Alltagsprozessen einen klareren Platz in Ihrem Unternehmen.", "Donnez aux personnes, aux documents et aux processus du quotidien une place plus claire dans votre entreprise.", "Dai a persone, documenti e processi quotidiani un posto più chiaro nella tua azienda."), "/software#/product/hr", 39],
    ["CRM", L("Growth", "Wachstum", "Croissance", "Crescita"), L("Make the next conversation count.", "Damit das nächste Gespräch zählt.", "Faites compter la prochaine conversation.", "Fai contare la prossima conversazione."),
      L("Organize contacts, understand opportunities, and keep the next action in view.", "Kontakte organisieren, Chancen verstehen und die nächste Aktion im Blick behalten.", "Organisez vos contacts, comprenez vos opportunités et gardez la prochaine action en vue.", "Organizza i contatti, comprendi le opportunità e tieni d’occhio la prossima azione."), "/software#/product/crm", 49],
    ["Files", L("Operations", "Betrieb", "Opérations", "Operazioni"), L("Find the file. Keep the flow.", "Datei finden. Im Fluss bleiben.", "Trouvez le fichier. Gardez le rythme.", "Trova il file. Mantieni il ritmo."),
      L("Bring the documents that matter into a clear, shared structure your team can understand.", "Bringen Sie wichtige Dokumente in eine klare, gemeinsame Struktur, die Ihr Team versteht.", "Rassemblez les documents importants dans une structure claire et partagée que votre équipe comprend.", "Porta i documenti importanti in una struttura chiara e condivisa che il tuo team capisce."), "/software#/product/files", 19],
    ["Tasks", L("Operations", "Betrieb", "Opérations", "Operazioni"), L("From a good idea to a job well done.", "Von der guten Idee zur gut erledigten Arbeit.", "D’une bonne idée à un travail bien fait.", "Da una buona idea a un lavoro ben fatto."),
      L("Connect projects, people, and next steps so everyone can see what moves the work forward.", "Verbinden Sie Projekte, Menschen und nächste Schritte, damit alle sehen, was die Arbeit voranbringt.", "Reliez projets, personnes et prochaines étapes pour que chacun voie ce qui fait avancer le travail.", "Collega progetti, persone e prossimi passi perché tutti vedano cosa fa avanzare il lavoro."), "/software#/product/tasks", 25],
    ["Marketing", L("Growth", "Wachstum", "Croissance", "Crescita"), L("Give every campaign a direction.", "Geben Sie jeder Kampagne eine Richtung.", "Donnez une direction à chaque campagne.", "Dai una direzione a ogni campagna."),
      L("Bring campaign plans, content, and customer activity into a more considered marketing workflow.", "Führen Sie Kampagnenpläne, Inhalte und Kundenaktivitäten in einem durchdachten Marketing-Workflow zusammen.", "Réunissez plans de campagne, contenus et activité client dans un flux marketing plus réfléchi.", "Riunisci piani di campagna, contenuti e attività dei clienti in un flusso di marketing più curato."), "/software#/product/marketing", 35],
    ["Website Manager", L("Growth", "Wachstum", "Croissance", "Crescita"), L("Keep your digital front door open.", "Halten Sie Ihre digitale Eingangstür offen.", "Gardez votre porte d’entrée numérique ouverte.", "Tieni aperta la tua porta d’ingresso digitale."),
      L("See content, requests, and website priorities together, with a clearer path from update to action.", "Sehen Sie Inhalte, Anfragen und Website-Prioritäten zusammen – mit einem klareren Weg vom Update zur Aktion.", "Voyez ensemble contenus, demandes et priorités du site, avec un chemin plus clair de la mise à jour à l’action.", "Vedi insieme contenuti, richieste e priorità del sito, con un percorso più chiaro dall’aggiornamento all’azione."), "/software#/product/website", 29],
  ];

  const journey = [
    { title: L("Start with the problem", "Beim Problem beginnen", "Partir du problème", "Partire dal problema"), description: L("Every engagement begins by listening: the business, the people involved and the one thing that needs to work better first.", "Jede Zusammenarbeit beginnt mit Zuhören: das Unternehmen, die beteiligten Menschen und das eine, was zuerst besser funktionieren muss.", "Chaque collaboration commence par l’écoute : l’entreprise, les personnes concernées et la première chose qui doit mieux fonctionner.", "Ogni collaborazione inizia ascoltando: l’azienda, le persone coinvolte e la prima cosa che deve funzionare meglio."), imageId: 5 },
    { title: L("Connect the capabilities", "Die Fähigkeiten verbinden", "Relier les compétences", "Collegare le competenze"), description: L("Strategy, design, technology and operations sit in one team, so the solution is shaped as a whole rather than hand-off by hand-off.", "Strategie, Design, Technologie und Betrieb sitzen in einem Team – die Lösung entsteht als Ganzes statt Übergabe für Übergabe.", "Stratégie, design, technologie et opérations réunis dans une équipe : la solution se construit d’un bloc, pas relais après relais.", "Strategia, design, tecnologia e operazioni in un unico team: la soluzione nasce come un insieme, non passaggio dopo passaggio."), imageId: 4 },
    { title: L("Build with care", "Mit Sorgfalt bauen", "Construire avec soin", "Costruire con cura"), description: L("Work is delivered in visible steps, tested with the people who will use it and documented so it can be owned after launch.", "Die Arbeit wird in sichtbaren Schritten geliefert, mit den späteren Nutzern getestet und so dokumentiert, dass sie nach dem Launch übernommen werden kann.", "Le travail est livré par étapes visibles, testé avec ses futurs utilisateurs et documenté pour être repris après le lancement.", "Il lavoro è consegnato a passi visibili, testato con chi lo userà e documentato per essere gestito dopo il lancio."), imageId: 7 },
    { title: L("Stay for what comes next", "Für das Nächste bleiben", "Rester pour la suite", "Restare per ciò che verrà"), description: L("Support, hosting and software keep the relationship going – and every improvement builds on what the team already knows.", "Support, Hosting und Software halten die Beziehung lebendig – und jede Verbesserung baut auf dem auf, was das Team bereits weiss.", "Support, hébergement et logiciels font vivre la relation – et chaque amélioration s’appuie sur ce que l’équipe connaît déjà.", "Supporto, hosting e software mantengono viva la relazione, e ogni miglioramento si basa su ciò che il team conosce già."), imageId: 6 },
  ];

  const openPositions = jobs.filter((j) => j.isActive).map((j) => ({
    title: j.title, department: j.department, location: j.location, description: j.description,
    employmentType: j.employmentTypeLabel, applyLink: `mailto:${j.applyEmail}?subject=${encodeURIComponent(j.title.en)}`,
  }));

  const SECTIONS = [
    // home
    ["home", "Hero", "home_hero", {
      eyebrow: L("Strategy · Design · Technology", "Strategie · Design · Technologie", "Stratégie · Design · Technologie", "Strategia · Design · Tecnologia"),
      title: L("Build and grow. Run it better.", "Aufbauen und wachsen. Besser betreiben.", "Construire et grandir. Mieux piloter.", "Costruire e crescere. Gestire meglio."),
      subtitle: L(
        "OrgTik brings strategy, design, technology and operations together – services that shape your digital presence and software that connects the everyday work behind it.",
        "OrgTik verbindet Strategie, Design, Technologie und Betrieb – mit Leistungen, die Ihre digitale Präsenz prägen, und Software, die die Alltagsarbeit dahinter verbindet.",
        "OrgTik réunit stratégie, design, technologie et opérations – des services qui façonnent votre présence numérique et des logiciels qui relient le travail du quotidien.",
        "OrgTik unisce strategia, design, tecnologia e operazioni: servizi che danno forma alla tua presenza digitale e software che collega il lavoro di ogni giorno.",
      ),
      rotatingWords: [
        { text: L("Run it better.", "Besser betreiben.", "Mieux piloter.", "Gestire meglio.") },
        { text: L("Make it matter.", "Wirkung erzielen.", "Faire la différence.", "Fare la differenza.") },
        { text: L("Make it work.", "Zum Laufen bringen.", "Faire fonctionner.", "Farlo funzionare.") },
        { text: L("Make it move.", "In Bewegung bringen.", "Mettre en mouvement.", "Metterlo in movimento.") },
        { text: L("Keep it moving.", "In Bewegung halten.", "Garder l’élan.", "Mantenerlo in movimento.") },
      ],
      primaryButton: { label: L("Start a project", "Projekt starten", "Démarrer un projet", "Avvia un progetto"), link: "/contact" },
      secondaryButton: { label: L("Explore plans", "Pläne entdecken", "Découvrir les offres", "Scopri i piani"), link: "/software#plan-builder" },
      imageId: 8,
      galleryId: 10,
    }],
    ["home", "Services overview", "services_overview", {
      eyebrow: L("Services", "Leistungen", "Services", "Servizi"),
      title: L("Build & grow with one connected team.", "Aufbauen & wachsen mit einem vernetzten Team.", "Construire et grandir avec une équipe connectée.", "Costruire e crescere con un unico team connesso."),
      description: L("Five service families that combine without extra hand-offs – from the first brand idea to the hosting that keeps it online.", "Fünf Leistungsbereiche, die sich ohne zusätzliche Übergaben kombinieren lassen – von der ersten Markenidee bis zum Hosting.", "Cinq familles de services qui se combinent sans relais supplémentaires – de la première idée de marque à l’hébergement.", "Cinque famiglie di servizi che si combinano senza passaggi in più, dalla prima idea di brand all’hosting."),
      items: services.map(([key, title, category, text, tags, imageId]) => ({ title, category, text, tags: tags.map((label) => ({ label })), link: `/services/${key}`, imageId })),
    }],
    ["home", "Software modules", "software_modules", {
      eyebrow: L("Run it better", "Besser betreiben", "Mieux piloter", "Gestire meglio"),
      title: L("Six products. One connected workspace.", "Sechs Produkte. Ein vernetzter Arbeitsbereich.", "Six produits. Un espace de travail connecté.", "Sei prodotti. Un unico spazio di lavoro."),
      description: L("Start with a single module or combine several – bundles save up to 25 % on the prototype estimate.", "Starten Sie mit einem Modul oder kombinieren Sie mehrere – Pakete sparen bis zu 25 % gegenüber der Prototyp-Schätzung.", "Commencez par un module ou combinez-en plusieurs – les packs font économiser jusqu’à 25 % sur l’estimation.", "Inizia con un modulo o combinane diversi: i pacchetti fanno risparmiare fino al 25 % sulla stima."),
      modules: modules.map(([name, category, headline, text, link, price]) => ({ name, category, headline, text, link, price })),
    }],
    ["home", "How we work", "process_steps", steps(STEPS)],
    ["home", "FAQ", "faq", [
      { question: L("Can we start with a single project?", "Können wir mit einem einzelnen Projekt starten?", "Pouvons-nous commencer par un seul projet ?", "Possiamo iniziare con un solo progetto?"),
        answer: L("Yes. Start with the website, identity, workflow, or campaign that matters most. We can shape a focused brief and build from there.", "Ja. Beginnen Sie mit der Website, der Identität, dem Ablauf oder der Kampagne, die am wichtigsten ist. Wir erarbeiten ein fokussiertes Briefing und bauen darauf auf.", "Oui. Commencez par le site, l’identité, le processus ou la campagne qui compte le plus. Nous définissons un brief ciblé et avançons à partir de là.", "Sì. Parti dal sito, dall’identità, dal processo o dalla campagna più importante. Definiamo un brief mirato e costruiamo da lì.") },
      { question: L("How do the services and the software fit together?", "Wie passen Leistungen und Software zusammen?", "Comment les services et les logiciels s’articulent-ils ?", "Come si integrano servizi e software?"),
        answer: L("Our services shape your digital presence. The software brings your everyday business tools together. We help you explore the combination that fits your team.", "Unsere Leistungen prägen Ihre digitale Präsenz. Die Software bringt Ihre täglichen Werkzeuge zusammen. Wir helfen Ihnen, die passende Kombination für Ihr Team zu finden.", "Nos services façonnent votre présence numérique. Les logiciels réunissent vos outils du quotidien. Nous vous aidons à trouver la combinaison adaptée à votre équipe.", "I nostri servizi danno forma alla tua presenza digitale. Il software riunisce gli strumenti di ogni giorno. Ti aiutiamo a trovare la combinazione giusta per il tuo team.") },
      { question: L("Can I choose only the modules I need?", "Kann ich nur die Module wählen, die ich brauche?", "Puis-je choisir uniquement les modules dont j’ai besoin ?", "Posso scegliere solo i moduli che mi servono?"),
        answer: L("Start with a single module or combine several. Final availability, features, and pricing are confirmed with the OrgTik team.", "Starten Sie mit einem Modul oder kombinieren Sie mehrere. Verfügbarkeit, Funktionen und Preise bestätigt das OrgTik-Team.", "Commencez par un module ou combinez-en plusieurs. Disponibilité, fonctionnalités et prix sont confirmés avec l’équipe OrgTik.", "Inizia con un modulo o combinane diversi. Disponibilità, funzioni e prezzi vengono confermati con il team OrgTik.") },
      { question: L("Do you work in several languages?", "Arbeiten Sie in mehreren Sprachen?", "Travaillez-vous en plusieurs langues ?", "Lavorate in più lingue?"),
        answer: L("Yes. Websites and content are planned in English, German, French and Italian from the start, with clean URLs for every language.", "Ja. Websites und Inhalte planen wir von Anfang an auf Deutsch, Englisch, Französisch und Italienisch – mit sauberen URLs pro Sprache.", "Oui. Sites et contenus sont prévus dès le départ en français, allemand, anglais et italien, avec des URL propres pour chaque langue.", "Sì. Siti e contenuti sono pianificati fin dall’inizio in italiano, tedesco, francese e inglese, con URL puliti per ogni lingua.") },
      { question: L("Where is my website hosted?", "Wo wird meine Website gehostet?", "Où mon site est-il hébergé ?", "Dove viene ospitato il mio sito?"),
        answer: L("OrgTik hosting runs on infrastructure in Switzerland, with monitoring, daily backups and support from the team that knows your website.", "OrgTik Hosting läuft auf Infrastruktur in der Schweiz – mit Monitoring, täglichen Backups und Support vom Team, das Ihre Website kennt.", "L’hébergement OrgTik fonctionne sur une infrastructure en Suisse, avec surveillance, sauvegardes quotidiennes et le support de l’équipe qui connaît votre site.", "L’hosting OrgTik si basa su un’infrastruttura in Svizzera, con monitoraggio, backup giornalieri e il supporto del team che conosce il tuo sito.") },
    ]],
    // services
    ["services", "Hero", "page_hero", hero(
      L("Services", "Leistungen", "Services", "Servizi"),
      L("Strategy, design and technology", "Strategie, Design und Technologie", "Stratégie, design et technologie", "Strategia, design e tecnologia"),
      L("shaped around the result.", "ausgerichtet auf das Ergebnis.", "pensés pour le résultat.", "pensati per il risultato."),
      L("Five connected service families – from brand and websites to marketing, support and hosting – delivered by one team.", "Fünf vernetzte Leistungsbereiche – von Marke und Website bis zu Marketing, Support und Hosting – aus einem Team.", "Cinq familles de services connectées – de la marque et du site web au marketing, au support et à l’hébergement – par une seule équipe.", "Cinque famiglie di servizi collegate – dal brand al sito, dal marketing al supporto e all’hosting – offerte da un unico team."),
      4,
    )],
    ["services", "Service packs", "service_packs", PLANS.map((p, i) => ({
      name: p.name, note: p.brief, price: p.price,
      badge: [L("Starter", "Einstieg", "Démarrage", "Base"), L("Recommended", "Empfohlen", "Recommandé", "Consigliato"), L("Ongoing", "Laufend", "Continu", "Continuativo")][i],
      period: i === 2 ? L("per month", "pro Monat", "par mois", "al mese") : L("defined scope", "definierter Umfang", "périmètre défini", "ambito definito"),
    }))],
    ["services", "Process", "process_steps", steps(STEPS)],
    // software
    ["software", "Hero", "page_hero", hero(
      L("Software", "Software", "Logiciels", "Software"),
      L("Six products.", "Sechs Produkte.", "Six produits.", "Sei prodotti."),
      L("One connected workspace.", "Ein vernetzter Arbeitsbereich.", "Un espace de travail connecté.", "Un unico spazio di lavoro connesso."),
      L("HR, CRM, Files, Tasks, Marketing and Website Manager – start with one module or combine them into a bundle.", "HR, CRM, Dateien, Aufgaben, Marketing und Website Manager – starten Sie mit einem Modul oder kombinieren Sie sie zu einem Paket.", "RH, CRM, fichiers, tâches, marketing et Website Manager – commencez par un module ou combinez-les dans un pack.", "HR, CRM, file, attività, marketing e Website Manager: inizia con un modulo o combinali in un pacchetto."),
      12,
    )],
    ["software", "Modules", "software_modules", {
      eyebrow: L("Choose how to start", "Wählen Sie Ihren Start", "Choisissez comment commencer", "Scegli come iniziare"),
      title: L("Pick what you need. We’ll apply the savings.", "Wählen Sie, was Sie brauchen. Wir rechnen die Ersparnis ein.", "Choisissez ce dont vous avez besoin. Nous appliquons les économies.", "Scegli ciò che ti serve. Applichiamo noi il risparmio."),
      description: L("Prototype estimates in CHF per month. Operations and Growth bundles save 15 %, the complete suite saves 25 %.", "Prototyp-Schätzungen in CHF pro Monat. Die Pakete Betrieb und Wachstum sparen 15 %, die komplette Suite 25 %.", "Estimations prototypes en CHF par mois. Les packs Opérations et Croissance font économiser 15 %, la suite complète 25 %.", "Stime prototipo in CHF al mese. I pacchetti Operazioni e Crescita fanno risparmiare il 15 %, la suite completa il 25 %."),
      modules: modules.map(([name, category, headline, text, link, price]) => ({ name, category, headline, text, link, price })),
    }],
    // work
    ["work", "Hero", "page_hero", hero(
      L("Selected work", "Ausgewählte Arbeiten", "Réalisations", "Lavori selezionati"),
      L("Our identity,", "Unsere Identität,", "Notre identité,", "La nostra identità,"),
      L("in the world.", "in der Welt.", "dans le monde.", "nel mondo."),
      L("Brand systems, platforms, campaigns and ongoing care – a selection of OrgTik work, concepts and client projects.", "Markensysteme, Plattformen, Kampagnen und laufende Betreuung – eine Auswahl an OrgTik-Arbeiten, Konzepten und Kundenprojekten.", "Systèmes de marque, plateformes, campagnes et suivi continu – une sélection de travaux, concepts et projets clients d’OrgTik.", "Sistemi di brand, piattaforme, campagne e assistenza continua: una selezione di lavori, concept e progetti per clienti di OrgTik."),
      15,
    )],
    // about
    ["about", "Hero", "page_hero", hero(
      L("About OrgTik", "Über OrgTik", "À propos d’OrgTik", "Chi siamo"),
      L("We connect the work", "Wir verbinden die Arbeit", "Nous relions le travail", "Colleghiamo il lavoro"),
      L("behind progress.", "hinter dem Fortschritt.", "derrière le progrès.", "dietro al progresso."),
      L("OrgTik brings strategy, design, technology and operations together so businesses can make clearer decisions and build with confidence.", "OrgTik verbindet Strategie, Design, Technologie und Betrieb, damit Unternehmen klarer entscheiden und mit Zuversicht bauen können.", "OrgTik réunit stratégie, design, technologie et opérations pour que les entreprises décident plus clairement et construisent en confiance.", "OrgTik unisce strategia, design, tecnologia e operazioni perché le aziende decidano con più chiarezza e costruiscano con fiducia."),
      5,
    )],
    ["about", "Mission and goals", "value_cards", {
      eyebrow: L("Mission", "Mission", "Mission", "Missione"),
      title: L("Bring the whole problem.", "Bringen Sie das ganze Problem mit.", "Apportez tout le problème.", "Porta tutto il problema."),
      description: L("We’ll help find the most useful place to start, connect the right capabilities, and keep the wider system in view.", "Wir helfen, den sinnvollsten Startpunkt zu finden, die richtigen Fähigkeiten zu verbinden und das Gesamtsystem im Blick zu behalten.", "Nous aidons à trouver le meilleur point de départ, à réunir les bonnes compétences et à garder une vue d’ensemble.", "Ti aiutiamo a trovare il punto di partenza più utile, a collegare le competenze giuste e a tenere d’occhio il sistema nel suo insieme."),
      imageId: 5,
      items: [
        { label: L("Goal 01", "Ziel 01", "Objectif 01", "Obiettivo 01"), title: L("Create clarity before complexity.", "Klarheit vor Komplexität schaffen.", "Créer de la clarté avant la complexité.", "Creare chiarezza prima della complessità."), description: L("Every project starts with a shared picture of the problem and a small, useful first step.", "Jedes Projekt beginnt mit einem gemeinsamen Bild des Problems und einem kleinen, nützlichen ersten Schritt.", "Chaque projet commence par une vision commune du problème et un premier pas utile.", "Ogni progetto parte da una visione condivisa del problema e da un primo passo piccolo e utile.") },
        { label: L("Goal 02", "Ziel 02", "Objectif 02", "Obiettivo 02"), title: L("Build connected value.", "Vernetzten Mehrwert schaffen.", "Créer une valeur connectée.", "Creare valore connesso."), description: L("Brand, website, software and support work better when they are planned as one system.", "Marke, Website, Software und Support wirken besser, wenn sie als ein System geplant werden.", "Marque, site, logiciels et support fonctionnent mieux lorsqu’ils sont pensés comme un seul système.", "Brand, sito, software e supporto funzionano meglio quando sono pianificati come un unico sistema.") },
        { label: L("Goal 03", "Ziel 03", "Objectif 03", "Obiettivo 03"), title: L("Leave teams stronger.", "Teams stärker zurücklassen.", "Laisser des équipes plus fortes.", "Lasciare team più forti."), description: L("Documentation, training and clear ownership mean your team can run what we build together.", "Dokumentation, Schulung und klare Verantwortung sorgen dafür, dass Ihr Team das Gebaute selbst betreiben kann.", "Documentation, formation et responsabilités claires permettent à votre équipe de faire vivre ce que nous construisons.", "Documentazione, formazione e responsabilità chiare permettono al tuo team di gestire ciò che costruiamo insieme.") },
      ],
    }],
    ["about", "Our journey", "process_steps", steps(journey)],
    ["about", "In numbers", "stats", [
      { value: "5", label: L("Connected service families", "Vernetzte Leistungsbereiche", "Familles de services connectées", "Famiglie di servizi collegate") },
      { value: "6", label: L("Software products in one workspace", "Software-Produkte in einem Arbeitsbereich", "Produits logiciels dans un seul espace", "Prodotti software in un unico spazio") },
      { value: "4", label: L("Website languages", "Website-Sprachen", "Langues du site", "Lingue del sito") },
      { value: "2", label: L("Studios: Belp and Cairo", "Studios: Belp und Kairo", "Studios : Belp et Le Caire", "Studi: Belp e Il Cairo") },
    ]],
    // insights
    ["insights", "Hero", "page_hero", hero(
      L("Insights", "Insights", "Insights", "Insights"),
      L("Notes on building", "Notizen zum Bauen", "Notes pour construire", "Appunti per costruire"),
      L("better digital work.", "besserer digitaler Arbeit.", "un meilleur travail numérique.", "un lavoro digitale migliore."),
      L("Practical articles on design, development, marketing, support and hosting from the OrgTik team.", "Praxisnahe Artikel zu Design, Entwicklung, Marketing, Support und Hosting vom OrgTik-Team.", "Des articles pratiques sur le design, le développement, le marketing, le support et l’hébergement par l’équipe OrgTik.", "Articoli pratici su design, sviluppo, marketing, supporto e hosting dal team OrgTik."),
      7,
    )],
    // contact
    ["contact", "Introduction", "page_hero", hero(
      L("Contact · Talk to us", "Kontakt · Sprechen Sie mit uns", "Contact · Parlons-en", "Contatti · Parliamone"),
      L("Let’s find your", "Finden wir Ihren", "Trouvons votre", "Troviamo il tuo"),
      L("first useful step.", "ersten sinnvollen Schritt.", "premier pas utile.", "primo passo utile."),
      L("Tell us what needs to work better. We’ll listen first, then suggest the smallest useful place to start.", "Sagen Sie uns, was besser funktionieren soll. Wir hören zuerst zu und schlagen dann den kleinsten sinnvollen Startpunkt vor.", "Dites-nous ce qui doit mieux fonctionner. Nous écoutons d’abord, puis proposons le plus petit point de départ utile.", "Dicci cosa deve funzionare meglio. Prima ascoltiamo, poi proponiamo il punto di partenza più piccolo e utile."),
      13,
    )],
    ["contact", "Contact details", "contact_info", {
      title: L("Reach the studio", "Das Studio erreichen", "Joindre le studio", "Contatta lo studio"),
      description: L("Call us, write to us or visit the studio in Belp – we reply to every enquiry within one working day.", "Rufen Sie an, schreiben Sie uns oder besuchen Sie das Studio in Belp – wir antworten innerhalb eines Arbeitstags.", "Appelez-nous, écrivez-nous ou passez au studio à Belp – nous répondons à chaque demande sous un jour ouvré.", "Chiamaci, scrivici o passa allo studio di Belp: rispondiamo a ogni richiesta entro un giorno lavorativo."),
      openingHours: L("Monday to Friday, 08:30–17:30", "Montag bis Freitag, 08.30–17.30 Uhr", "Du lundi au vendredi, 8 h 30–17 h 30", "Dal lunedì al venerdì, 8:30–17:30"),
      address: "Muristrasse 3, 3123 Belp, Switzerland",
      phone: "+41 31 812 74 84",
      email: "hello@orgtik.test",
      mapLink: "https://www.openstreetmap.org/search?query=Muristrasse%203%2C%203123%20Belp",
    }],
    ["contact", "Enquiry paths", "enquiry_paths", [
      { title: L("Start a project", "Projekt starten", "Démarrer un projet", "Avvia un progetto"), description: L("Brand, website, app or campaign. Tell us the goal and we’ll shape the first step.", "Marke, Website, App oder Kampagne. Nennen Sie uns das Ziel, wir gestalten den ersten Schritt.", "Marque, site, application ou campagne. Donnez-nous l’objectif, nous dessinons la première étape.", "Brand, sito, app o campagna. Dicci l’obiettivo e definiamo il primo passo."), note: L("For new work", "Für neue Projekte", "Pour un nouveau projet", "Per nuovi progetti"), topic: "A new project" },
      { title: L("Explore software", "Software entdecken", "Découvrir les logiciels", "Scopri il software"), description: L("Talk through which of the six systems fit your team, or build a plan first.", "Besprechen Sie, welche der sechs Systeme zu Ihrem Team passen, oder stellen Sie zuerst einen Plan zusammen.", "Voyons lesquels des six systèmes conviennent à votre équipe, ou composez d’abord une offre.", "Parliamo di quali dei sei sistemi si adattano al tuo team, oppure crea prima un piano."), note: L("For your operations", "Für Ihren Betrieb", "Pour vos opérations", "Per le tue operazioni"), topic: "Software" },
      { title: L("Get ongoing care", "Laufende Betreuung", "Obtenir un suivi", "Assistenza continua"), description: L("Support, hosting or improvements for something that already exists.", "Support, Hosting oder Verbesserungen für etwas, das bereits existiert.", "Support, hébergement ou améliorations pour un existant.", "Supporto, hosting o miglioramenti per qualcosa che esiste già."), note: L("For existing systems", "Für bestehende Systeme", "Pour les systèmes existants", "Per sistemi esistenti"), topic: "Support & hosting" },
    ]],
    // careers
    ["careers", "Hero", "page_hero", hero(
      L("Careers", "Karriere", "Carrières", "Lavora con noi"),
      L("Build what comes next", "Gestalten Sie, was kommt", "Construisez la suite", "Costruisci ciò che verrà"),
      L("with us.", "mit uns.", "avec nous.", "con noi."),
      L("Join a small, connected team in Belp and Cairo that cares about clear thinking, good craft and kind collaboration.", "Werden Sie Teil eines kleinen, vernetzten Teams in Belp und Kairo, dem klares Denken, gutes Handwerk und freundliche Zusammenarbeit wichtig sind.", "Rejoignez une petite équipe connectée à Belp et au Caire, attachée à la clarté, au travail bien fait et à une collaboration bienveillante.", "Unisciti a un piccolo team connesso tra Belp e Il Cairo, che tiene al pensiero chiaro, al lavoro ben fatto e a una collaborazione gentile."),
      33,
    )],
    ["careers", "Open positions", "job_openings", openPositions],
    // legal
    ["legal", "Imprint", "legal_document", {
      title: L("Imprint", "Impressum", "Mentions légales", "Impressum"),
      summary: L("Company and contact information for this website.", "Firmen- und Kontaktangaben zu dieser Website.", "Informations sur l’entreprise et coordonnées pour ce site.", "Informazioni sull’azienda e contatti per questo sito."),
      body: legalBody([
        [L("Organisation", "Organisation", "Organisation", "Organizzazione"), L("OrgTik. Final legal entity, registration details, and authorized representation require owner approval before publication.", "OrgTik. Rechtsform, Registerangaben und Vertretungsberechtigung werden vor der Veröffentlichung von der Inhaberschaft bestätigt.", "OrgTik. La forme juridique, les données d’inscription et la représentation autorisée doivent être validées avant publication.", "OrgTik. Forma giuridica, dati di registrazione e rappresentanza autorizzata richiedono l’approvazione prima della pubblicazione.")],
        [L("Contact", "Kontakt", "Contact", "Contatto"), L("Muristrasse 3, 3123 Belp, Switzerland. Phone: +41 31 812 74 84.", "Muristrasse 3, 3123 Belp, Schweiz. Telefon: +41 31 812 74 84.", "Muristrasse 3, 3123 Belp, Suisse. Téléphone : +41 31 812 74 84.", "Muristrasse 3, 3123 Belp, Svizzera. Telefono: +41 31 812 74 84.")],
        [L("Publication status", "Veröffentlichungsstatus", "Statut de publication", "Stato di pubblicazione"), L("This page uses the approved legal template. It is not final legal wording.", "Diese Seite verwendet die freigegebene Rechtsvorlage. Es handelt sich nicht um den finalen Rechtstext.", "Cette page utilise le modèle juridique validé. Il ne s’agit pas du texte juridique définitif.", "Questa pagina usa il modello legale approvato. Non si tratta del testo legale definitivo.")],
      ]),
      lastUpdated: "2026-09-12",
    }],
    ["legal", "Privacy policy", "legal_document", {
      title: L("Privacy policy", "Datenschutzerklärung", "Politique de confidentialité", "Informativa sulla privacy"),
      summary: L("How personal data is handled on this website.", "Wie auf dieser Website mit Personendaten umgegangen wird.", "Comment les données personnelles sont traitées sur ce site.", "Come vengono trattati i dati personali su questo sito."),
      body: legalBody([
        [L("Data controller", "Verantwortliche Stelle", "Responsable du traitement", "Titolare del trattamento"), L("The data controller’s legal identity and contact details are supplied and reviewed before publication.", "Rechtliche Identität und Kontaktangaben der verantwortlichen Stelle werden vor der Veröffentlichung ergänzt und geprüft.", "L’identité juridique et les coordonnées du responsable du traitement sont fournies et vérifiées avant publication.", "L’identità giuridica e i contatti del titolare del trattamento vengono forniti e verificati prima della pubblicazione.")],
        [L("Contact form", "Kontaktformular", "Formulaire de contact", "Modulo di contatto"), L("Enquiries sent through the contact form are stored in the website CMS and used only to answer the request.", "Anfragen über das Kontaktformular werden im Website-CMS gespeichert und nur zur Beantwortung verwendet.", "Les demandes envoyées via le formulaire sont enregistrées dans le CMS du site et servent uniquement à y répondre.", "Le richieste inviate tramite il modulo vengono salvate nel CMS del sito e usate solo per rispondere.")],
        [L("Final policy", "Finale Fassung", "Version définitive", "Versione definitiva"), L("Purposes, legal bases, third parties, retention, rights, transfers, and cookie details require approved source wording.", "Zwecke, Rechtsgrundlagen, Dritte, Aufbewahrung, Rechte, Übermittlungen und Cookie-Angaben erfordern einen freigegebenen Quelltext.", "Finalités, bases légales, tiers, conservation, droits, transferts et cookies nécessitent un texte source validé.", "Finalità, basi giuridiche, terze parti, conservazione, diritti, trasferimenti e cookie richiedono un testo approvato.")],
      ]),
      lastUpdated: "2026-09-12",
    }],
    ["legal", "Terms and conditions", "legal_document", {
      title: L("Terms and conditions", "Allgemeine Geschäftsbedingungen", "Conditions générales", "Condizioni generali"),
      summary: L("A readable template awaiting approved commercial and legal text.", "Eine lesbare Vorlage, die auf freigegebene kommerzielle und rechtliche Texte wartet.", "Un modèle lisible en attente du texte commercial et juridique validé.", "Un modello leggibile in attesa del testo commerciale e legale approvato."),
      body: legalBody([
        [L("Scope", "Geltungsbereich", "Champ d’application", "Ambito"), L("Final scope and contracting-party language must be supplied by the business and reviewed by legal counsel.", "Geltungsbereich und Vertragsparteien werden vom Unternehmen geliefert und rechtlich geprüft.", "Le champ d’application et les parties contractantes sont fournis par l’entreprise et vérifiés juridiquement.", "Ambito e parti contraenti devono essere forniti dall’azienda e verificati da un legale.")],
        [L("Services and commercial terms", "Leistungen und kommerzielle Bedingungen", "Services et conditions commerciales", "Servizi e condizioni commerciali"), L("Prices, payment, delivery, intellectual property, warranty, liability, cancellation, and venue remain pending.", "Preise, Zahlung, Lieferung, geistiges Eigentum, Gewährleistung, Haftung, Kündigung und Gerichtsstand sind noch offen.", "Prix, paiement, livraison, propriété intellectuelle, garantie, responsabilité, résiliation et for restent à définir.", "Prezzi, pagamento, consegna, proprietà intellettuale, garanzia, responsabilità, recesso e foro sono ancora da definire.")],
        [L("Preview status", "Vorschaustatus", "Statut d’aperçu", "Stato di anteprima"), L("No offer, payment, subscription, or transaction is created through the website plan builder.", "Über den Planer der Website entstehen weder Angebote noch Zahlungen, Abos oder Transaktionen.", "Aucune offre, aucun paiement, abonnement ou transaction n’est créé via le configurateur du site.", "Il configuratore del sito non crea offerte, pagamenti, abbonamenti o transazioni.")],
      ]),
      lastUpdated: "2026-09-12",
    }],
    // shared
    [null, "Main navigation", "navigation", [
      { label: L("Home", "Startseite", "Accueil", "Home"), link: "/" },
      { label: L("Services", "Leistungen", "Services", "Servizi"), link: "/services" },
      { label: L("Software", "Software", "Logiciels", "Software"), link: "/software" },
      { label: L("Work", "Arbeiten", "Réalisations", "Lavori"), link: "/work" },
      { label: L("About", "Über uns", "À propos", "Chi siamo"), link: "/about" },
      { label: L("Insights", "Insights", "Insights", "Insights"), link: "/insights" },
    ]],
    [null, "Footer", "footer", {
      tagline: L("Strategy. Design. Technology.", "Strategie. Design. Technologie.", "Stratégie. Design. Technologie.", "Strategia. Design. Tecnologia."),
      copyright: L("© 2026 OrgTik. Made in Switzerland.", "© 2026 OrgTik. Made in Switzerland.", "© 2026 OrgTik. Made in Switzerland.", "© 2026 OrgTik. Made in Switzerland."),
      address: "Muristrasse 3, 3123 Belp, Switzerland",
      phone: "+41 31 812 74 84",
      email: "hello@orgtik.test",
      columns: [
        { title: L("Explore", "Entdecken", "Découvrir", "Scopri"), links: [
          { label: L("Software", "Software", "Logiciels", "Software"), link: "/software" },
          { label: L("Services", "Leistungen", "Services", "Servizi"), link: "/services" },
          { label: L("Selected work", "Ausgewählte Arbeiten", "Réalisations", "Lavori selezionati"), link: "/work" },
          { label: L("Insights", "Insights", "Insights", "Insights"), link: "/insights" },
          { label: L("About OrgTik", "Über OrgTik", "À propos d’OrgTik", "Chi siamo"), link: "/about" },
        ] },
        { title: L("Start", "Starten", "Commencer", "Inizia"), links: [
          { label: L("Build a software plan", "Software-Plan erstellen", "Composer une offre logicielle", "Crea un piano software"), link: "/software#plan-builder" },
          { label: L("Tell us about your project", "Erzählen Sie uns von Ihrem Projekt", "Parlez-nous de votre projet", "Raccontaci il tuo progetto"), link: "/contact" },
          { label: L("Roadmap", "Roadmap", "Feuille de route", "Roadmap"), link: "/roadmap" },
          { label: L("Careers", "Karriere", "Carrières", "Lavora con noi"), link: "/careers" },
        ] },
        { title: L("Legal", "Rechtliches", "Informations légales", "Note legali"), links: [
          { label: L("Imprint", "Impressum", "Mentions légales", "Impressum"), link: "/imprint" },
          { label: L("Privacy policy", "Datenschutz", "Confidentialité", "Privacy"), link: "/privacy" },
          { label: L("Terms and conditions", "AGB", "Conditions générales", "Condizioni generali"), link: "/terms" },
          { label: L("Sitemap", "Sitemap", "Plan du site", "Mappa del sito"), link: "/sitemap" },
        ] },
      ],
    }],
    [null, "Closing call to action", "closing_cta", {
      title: L("Let’s build what", "Bauen wir, was", "Construisons ce qui", "Costruiamo ciò che"),
      highlight: L("comes next.", "als Nächstes kommt.", "vient ensuite.", "verrà dopo."),
      description: L("Tell us what needs to work better. We’ll listen first, then suggest the smallest useful place to start.", "Sagen Sie uns, was besser funktionieren soll. Wir hören zuerst zu und schlagen dann den kleinsten sinnvollen Startpunkt vor.", "Dites-nous ce qui doit mieux fonctionner. Nous écoutons d’abord, puis proposons le plus petit point de départ utile.", "Dicci cosa deve funzionare meglio. Prima ascoltiamo, poi proponiamo il punto di partenza più piccolo e utile."),
      button: { label: L("Talk to us", "Sprechen Sie mit uns", "Parlons-en", "Parliamone"), link: "/contact" },
      imageId: 2,
    }],
    [null, "Social links", "social_links", ["Facebook", "Instagram", "LinkedIn", "X", "TikTok", "Pinterest", "Snapchat", "YouTube"].map((platform) => ({ platform, link: "" }))],
    [null, "Announcement bar", "announcement_bar", {
      message: L("New: Website Manager joins the OrgTik software suite.", "Neu: Website Manager ergänzt die OrgTik Software-Suite.", "Nouveau : Website Manager rejoint la suite logicielle OrgTik.", "Novità: Website Manager entra nella suite software OrgTik."),
      linkLabel: L("Explore plans", "Pläne entdecken", "Découvrir les offres", "Scopri i piani"),
      link: "/software#plan-builder",
    }],
  ];

  const typeIds = new Map(SECTION_TYPES.map((t, i) => [t.name, i + 1]));
  const sectionTypes = SECTION_TYPES.map((t, i) => ({
    id: i + 1, ...t, isActive: true,
    createdAt: new Date(Date.UTC(2025, 8, 15, 10, i)).toISOString(),
    updatedAt: new Date(Date.UTC(2026, 5, 3, 12, i)).toISOString(),
  }));
  const orderByPage = {};
  const sections = SECTIONS.map(([pageType, name, typeName, content], i) => {
    const pid = pageType ? pageId(pageType) : null;
    const key = pid ?? "shared";
    orderByPage[key] = (orderByPage[key] || 0) + 1;
    if (!typeIds.has(typeName)) throw new Error(`Unknown section type ${typeName}`);
    return {
      id: i + 1, pageId: pid, name, sectionTypeName: typeName, content, order: orderByPage[key], isActive: true,
      createdAt: new Date(Date.UTC(2025, 9, 5, 9, i)).toISOString(),
      updatedAt: new Date(Date.UTC(2026, 8, 3 + (i % 20), 8 + (i % 9), 15)).toISOString(),
    };
  });

  return { pages, sectionTypes, sections, home };
}

// Job posts (GET/POST/PATCH/DELETE /jobs). The careers page "Open positions" section is seeded from the active ones.
const JOBS = [
  {
    title: L("Senior Frontend Developer (React / Next.js)", "Senior Frontend Developer (React / Next.js)", "Développeur·se front-end senior (React / Next.js)", "Sviluppatore/trice front-end senior (React / Next.js)"),
    department: L("Engineering", "Entwicklung", "Ingénierie", "Ingegneria"),
    location: L("Belp (hybrid)", "Belp (hybrid)", "Belp (hybride)", "Belp (ibrido)"),
    description: L("Build fast, accessible websites and product interfaces with our design team, from component libraries to multilingual Next.js platforms.", "Sie entwickeln mit unserem Designteam schnelle, barrierearme Websites und Produktoberflächen – von Komponentenbibliotheken bis zu mehrsprachigen Next.js-Plattformen.", "Vous développez avec notre équipe design des sites et interfaces rapides et accessibles, des bibliothèques de composants aux plateformes Next.js multilingues.", "Sviluppi con il nostro team di design siti e interfacce veloci e accessibili, dalle librerie di componenti alle piattaforme Next.js multilingue."),
    requirements: {
      en: ["5+ years with React and TypeScript", "Experience with Next.js and headless CMS", "Care for accessibility and performance", "German or French is a plus"],
      de: ["Mindestens 5 Jahre Erfahrung mit React und TypeScript", "Erfahrung mit Next.js und Headless-CMS", "Sorgfalt bei Barrierefreiheit und Performance", "Französisch ist ein Plus"],
      fr: ["Au moins 5 ans d’expérience avec React et TypeScript", "Expérience de Next.js et des CMS headless", "Souci de l’accessibilité et de la performance", "L’allemand est un atout"],
      it: ["Almeno 5 anni di esperienza con React e TypeScript", "Esperienza con Next.js e CMS headless", "Attenzione ad accessibilità e prestazioni", "Il tedesco o il francese sono un plus"],
    },
    employmentType: "full-time", employmentTypeLabel: "Full-time", workplace: "hybrid", isActive: true, closingDate: "2026-10-31", published: "2026-09-08T08:00:00Z",
  },
  {
    title: L("Content & SEO Writer (German/English, 60–80%)", "Content- & SEO-Redaktor/in (Deutsch/Englisch, 60–80 %)", "Rédacteur·rice contenu et SEO (allemand/anglais, 60–80 %)", "Redattore/trice contenuti e SEO (tedesco/inglese, 60–80%)"),
    department: L("Marketing", "Marketing", "Marketing", "Marketing"),
    location: L("Remote, Switzerland", "Remote, Schweiz", "À distance, Suisse", "Da remoto, Svizzera"),
    description: L("Write and optimise website copy, insights articles and landing pages for OrgTik and our clients, working closely with design and marketing.", "Sie schreiben und optimieren Website-Texte, Insights-Artikel und Landingpages für OrgTik und unsere Kundschaft – eng mit Design und Marketing.", "Vous rédigez et optimisez textes de sites, articles et pages d’atterrissage pour OrgTik et ses clients, en lien étroit avec le design et le marketing.", "Scrivi e ottimizzi testi per siti, articoli e landing page per OrgTik e i suoi clienti, lavorando a stretto contatto con design e marketing."),
    requirements: {
      en: ["Excellent German and English", "Solid understanding of SEO", "Portfolio of web copy or articles"],
      de: ["Sehr gutes Deutsch und Englisch", "Fundiertes SEO-Verständnis", "Portfolio mit Webtexten oder Artikeln"],
      fr: ["Excellent allemand et anglais", "Bonne compréhension du SEO", "Portfolio de textes web ou d’articles"],
      it: ["Ottimo tedesco e inglese", "Buona conoscenza della SEO", "Portfolio di testi web o articoli"],
    },
    employmentType: "part-time", employmentTypeLabel: "Part-time (60–80%)", workplace: "remote", isActive: true, closingDate: "2026-10-15", published: "2026-09-15T09:30:00Z",
  },
  {
    title: L("UI/UX Designer", "UI/UX Designer/in", "Designer UI/UX", "UI/UX Designer"),
    department: L("Design", "Design", "Design", "Design"),
    location: L("Belp", "Belp", "Belp", "Belp"),
    description: L("Shape brand-led websites and product experiences, from research and prototypes to design systems handed over to engineering.", "Sie gestalten markengetriebene Websites und Produkterlebnisse – von Research und Prototypen bis zu Designsystemen für die Entwicklung.", "Vous concevez des sites et expériences produit guidés par la marque, de la recherche aux prototypes et aux design systems.", "Progetti siti ed esperienze di prodotto guidati dal brand, dalla ricerca ai prototipi fino ai design system per lo sviluppo."),
    requirements: {
      en: ["3+ years in UI/UX design", "Strong Figma and prototyping skills", "Experience with design systems"],
      de: ["Mindestens 3 Jahre UI/UX-Erfahrung", "Sehr gute Figma- und Prototyping-Kenntnisse", "Erfahrung mit Designsystemen"],
      fr: ["Au moins 3 ans en design UI/UX", "Très bonne maîtrise de Figma et du prototypage", "Expérience des design systems"],
      it: ["Almeno 3 anni di esperienza in UI/UX", "Ottima conoscenza di Figma e della prototipazione", "Esperienza con i design system"],
    },
    employmentType: "full-time", employmentTypeLabel: "Full-time", workplace: "on-site", isActive: true, closingDate: "2026-11-15", published: "2026-09-22T07:45:00Z",
  },
  {
    title: L("Website Support Specialist", "Website Support Specialist", "Spécialiste support web", "Specialista supporto siti web"),
    department: L("Support", "Support", "Support", "Supporto"),
    location: L("Cairo (hybrid)", "Kairo (hybrid)", "Le Caire (hybride)", "Il Cairo (ibrido)"),
    description: L("Handle client requests for content updates, monitoring alerts and small fixes across the websites we host and maintain.", "Sie bearbeiten Kundenanfragen zu Inhaltsänderungen, Monitoring-Meldungen und kleinen Korrekturen auf den Websites, die wir hosten und betreuen.", "Vous traitez les demandes des clients : mises à jour de contenu, alertes de surveillance et petites corrections sur les sites que nous hébergeons.", "Gestisci le richieste dei clienti per aggiornamenti dei contenuti, avvisi di monitoraggio e piccole correzioni sui siti che ospitiamo."),
    requirements: {
      en: ["2+ years supporting websites or web apps", "Comfortable with HTML, CSS and a CMS", "Fluent English, Arabic is a plus"],
      de: ["Mindestens 2 Jahre Support für Websites oder Web-Apps", "Sicher mit HTML, CSS und einem CMS", "Fliessend Englisch, Arabisch ist ein Plus"],
      fr: ["Au moins 2 ans de support de sites ou d’applications web", "À l’aise avec HTML, CSS et un CMS", "Anglais courant, l’arabe est un atout"],
      it: ["Almeno 2 anni di supporto a siti o web app", "Padronanza di HTML, CSS e di un CMS", "Inglese fluente, l’arabo è un plus"],
    },
    employmentType: "full-time", employmentTypeLabel: "Full-time", workplace: "hybrid", isActive: true, closingDate: "2026-10-20", published: "2026-09-02T10:00:00Z",
  },
  {
    title: L("Digital Marketing Intern (6 months)", "Praktikum Digital Marketing (6 Monate)", "Stage marketing digital (6 mois)", "Stage in marketing digitale (6 mesi)"),
    department: L("Marketing", "Marketing", "Marketing", "Marketing"),
    location: L("Belp", "Belp", "Belp", "Belp"),
    description: L("Support campaign planning, social media publishing and reporting for OrgTik and selected clients.", "Sie unterstützen Kampagnenplanung, Social-Media-Veröffentlichungen und Reporting für OrgTik und ausgewählte Kunden.", "Vous participez à la planification des campagnes, à la publication sur les réseaux sociaux et au reporting.", "Supporti la pianificazione delle campagne, la pubblicazione sui social e i report per OrgTik e alcuni clienti."),
    requirements: {
      en: ["Studying marketing or communications", "Interest in social media and analytics", "German and English"],
      de: ["Studium in Marketing oder Kommunikation", "Interesse an Social Media und Analytics", "Deutsch und Englisch"],
      fr: ["Études en marketing ou communication", "Intérêt pour les réseaux sociaux et l’analyse", "Allemand et anglais"],
      it: ["Studi in marketing o comunicazione", "Interesse per social media e analisi", "Tedesco e inglese"],
    },
    employmentType: "internship", employmentTypeLabel: "Internship", workplace: "on-site", isActive: false, closingDate: "2026-08-31", published: "2026-06-30T08:00:00Z",
  },
];

function buildJobs() {
  return JOBS.map((j, i) => ({
    id: i + 1,
    title: j.title, department: j.department, location: j.location, description: j.description, requirements: j.requirements,
    employmentType: j.employmentType, employmentTypeLabel: j.employmentTypeLabel, workplace: j.workplace,
    isActive: j.isActive, closingDate: j.closingDate, applyEmail: "jobs@orgtik.test", applicationsCount: [14, 9, 21, 6, 32][i],
    publishedAt: new Date(j.published).toISOString(), createdAt: new Date(j.published).toISOString(), updatedAt: new Date(j.published).toISOString(),
  }));
}

module.exports = { buildSite, buildJobs, SECTION_TYPES };
