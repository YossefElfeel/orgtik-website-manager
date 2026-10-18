// Gallery, projects, contacts, reviews, sitemap categories/blogs and the legacy section endpoints.
const fs = require("fs");
const path = require("path");
const { L, LA, LANGS, mapLoc, slugify, daysAgo } = require("../lib");
const { COVERS } = require("../covers");

const ASSETS_DIR = path.join(__dirname, "..", "assets");

// ---- gallery ----------------------------------------------------------------------------------------------
// file: copied from the OrgTik website clone into apps/content/assets; cover: generated SVG (covers.js).
const GALLERY = [
  { file: "orgtik-lockup-color.svg", alt: "OrgTik logo – colour lockup" },
  { file: "orgtik-mark-black.svg", alt: "OrgTik mark – black" },
  { file: "orgtik-app-icon.svg", alt: "OrgTik app icon" },
  { file: "brand-cards.webp", alt: "OrgTik business cards on dark stone" },
  { file: "brand-glass.webp", alt: "Glass tile with the OrgTik mark held against a violet gradient" },
  { file: "brand-phone.webp", alt: "OrgTik app icon on a smartphone home screen" },
  { file: "brand-tablet.webp", alt: "Designer working on a tablet that shows the OrgTik logo" },
  { file: "cinematic-desktop.webp", alt: "Homepage hero still – glass tile (desktop)" },
  { file: "cinematic-mobile.webp", alt: "Homepage hero still – glass tile (mobile)" },
  { file: "cinematic-desktop.mp4", alt: "Homepage hero film – desktop loop" },
  { file: "heading-services-1440.png", alt: "Services page – web design services hero" },
  { file: "software-builder.png", alt: "Software page – plan builder with bundle savings" },
  { file: "contact-intro-1440.png", alt: "Contact page – introduction and enquiry form" },
  { file: "testimonials-1440.png", alt: "Homepage – client testimonial carousel" },
  { file: "heading-project-1440.png", alt: "Project detail page – heading" },
  { file: "mobile-home.png", alt: "Homepage on a mobile screen" },
  { file: "service-work-desktop.png", alt: "Service page – related work section" },
  { file: "legal-intro-1440.png", alt: "Legal pages – introduction" },
  { file: "logo-ph-1.svg", alt: "Client logo placeholder" },
  { file: "logo-ph-4.svg", alt: "Client logo placeholder (wordmark)" },
  { cover: "local-seo", alt: "Cover – Local SEO for Swiss SMEs" },
  { cover: "website-care", alt: "Cover – What a website care plan covers" },
  { cover: "accessibility", alt: "Cover – Accessibility is a quality bar" },
  { cover: "multilingual", alt: "Cover – Multilingual websites" },
  { cover: "social-calendar", alt: "Cover – Social media calendar" },
  { cover: "template-vs-custom", alt: "Cover – Template or custom build" },
  { cover: "tested-backups", alt: "Cover – Tested backups" },
  { cover: "nile-foods", alt: "Nile Foods online shop – project cover" },
  { cover: "sahel-resorts", alt: "Sahel Resorts booking website – project cover" },
  { cover: "riyadh-logistics", alt: "Riyadh Logistics tracking portal – project cover" },
  { cover: "cairo-bites", alt: "Cairo Bites magazine relaunch – project cover" },
  { cover: "aarewelle", alt: "Aarewelle Physiotherapy website – project cover" },
  { cover: "careers", alt: "Careers at OrgTik – page cover" },
];
const MIME = { ".svg": "image/svg+xml", ".webp": "image/webp", ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".gif": "image/gif", ".mp4": "video/mp4", ".webm": "video/webm" };

function buildGallery() {
  return GALLERY.map((g, i) => {
    const id = i + 1;
    // Oldest first (ids ascending); the list endpoint returns newest first.
    const createdAt = daysAgo(260 - i * 7, 3 + (i % 5));
    if (g.cover) {
      if (!COVERS[g.cover]) throw new Error(`missing cover ${g.cover}`);
      return { id, source: "cover", file: `covers/${g.cover}.svg`, originalName: `${g.cover}.svg`, alt: g.alt, mimeType: "image/svg+xml", size: 4200, uploadedById: 14, createdAt, updatedAt: createdAt };
    }
    let size = 0;
    try { size = fs.statSync(path.join(ASSETS_DIR, g.file)).size; } catch { /* asset missing: still listed */ }
    return { id, source: "seed", file: g.file, originalName: g.file, alt: g.alt, mimeType: MIME[path.extname(g.file).toLowerCase()] || "application/octet-stream", size, uploadedById: i < 10 ? 1 : 14, createdAt, updatedAt: createdAt };
  });
}

// ---- projects (portfolio) ---------------------------------------------------------------------------------
// The first five are the OrgTik website's own projects (src/reference/projects.js); `link` opens the local website clone.
const PROJECTS = [
  {
    slug: "orgtik-identity-system", imageId: 4, date: "2026-01-14T09:00:00Z", author: "admin",
    title: L("OrgTik identity system", "OrgTik Markenidentität", "Système d’identité OrgTik", "Sistema di identità OrgTik"),
    description: L(
      "A connected identity built to move from strategy into every useful touchpoint. From a strong mark to a complete, flexible brand experience.",
      "Eine vernetzte Identität, die von der Strategie in jeden relevanten Berührungspunkt reicht. Vom starken Zeichen zu einem vollständigen, flexiblen Markenerlebnis.",
      "Une identité connectée, pensée pour passer de la stratégie à chaque point de contact utile. D’un signe fort à une expérience de marque complète et flexible.",
      "Un’identità connessa, pensata per passare dalla strategia a ogni punto di contatto utile. Da un segno forte a un’esperienza di brand completa e flessibile.",
    ),
    tags: LA(["Brand & digital design", "Technology", "OrgTik-owned work"], ["Marke & digitales Design", "Technologie", "Eigenes OrgTik-Projekt"], ["Marque et design numérique", "Technologie", "Projet OrgTik"], ["Brand e design digitale", "Tecnologia", "Progetto OrgTik"]),
  },
  {
    slug: "connected-platform-concept", imageId: 7, date: "2026-02-09T10:30:00Z", author: "admin",
    title: L("Connected platform concept", "Konzept für eine vernetzte Plattform", "Concept de plateforme connectée", "Concept di piattaforma connessa"),
    description: L(
      "A product direction for bringing six everyday systems into one coherent workspace. From disconnected tools to one clearer operating picture.",
      "Eine Produktrichtung, die sechs alltägliche Systeme in einem stimmigen Arbeitsbereich vereint. Von getrennten Werkzeugen zu einem klareren Gesamtbild.",
      "Une orientation produit pour réunir six systèmes du quotidien dans un espace de travail cohérent. D’outils déconnectés à une vision plus claire de l’activité.",
      "Una direzione di prodotto per riunire sei sistemi quotidiani in un unico spazio di lavoro coerente. Da strumenti scollegati a un quadro operativo più chiaro.",
    ),
    tags: LA(["Platform", "Business operations", "Concept preview"], ["Plattform", "Geschäftsbetrieb", "Konzeptvorschau"], ["Plateforme", "Opérations", "Aperçu de concept"], ["Piattaforma", "Operazioni aziendali", "Anteprima del concept"]),
  },
  {
    slug: "managed-digital-presence", imageId: 5, date: "2026-03-03T08:15:00Z", author: "u14",
    title: L("Managed digital presence", "Betreute digitale Präsenz", "Présence numérique gérée", "Presenza digitale gestita"),
    description: L(
      "A connected service model spanning the website, hosting, monitoring, and ongoing improvement. From launch-day delivery to a dependable long-term digital partnership.",
      "Ein vernetztes Servicemodell für Website, Hosting, Monitoring und laufende Verbesserung. Von der Lieferung am Launch-Tag zu einer verlässlichen, langfristigen digitalen Partnerschaft.",
      "Un modèle de service connecté couvrant le site, l’hébergement, la surveillance et l’amélioration continue. D’une livraison le jour du lancement à un partenariat numérique durable.",
      "Un modello di servizio connesso che comprende sito, hosting, monitoraggio e miglioramento continuo. Dalla consegna al lancio a una partnership digitale affidabile nel tempo.",
    ),
    tags: LA(["Hosting & support", "Digital infrastructure", "Private-preview sample"], ["Hosting & Support", "Digitale Infrastruktur", "Beispiel (private Vorschau)"], ["Hébergement et support", "Infrastructure numérique", "Exemple en aperçu privé"], ["Hosting e supporto", "Infrastruttura digitale", "Esempio in anteprima privata"]),
  },
  {
    slug: "campaign-growth-system", imageId: 6, date: "2026-03-26T13:00:00Z", author: "u12",
    title: L("Campaign growth system", "Wachstumssystem für Kampagnen", "Système de croissance des campagnes", "Sistema di crescita per campagne"),
    description: L(
      "A mock campaign system connecting audience decisions, content, publishing, and the learning loop. From scattered activity to a campaign rhythm the whole team can see.",
      "Ein Beispiel-Kampagnensystem, das Zielgruppenentscheidungen, Inhalte, Veröffentlichung und Lernschleife verbindet. Von verstreuter Aktivität zu einem Kampagnenrhythmus, den das ganze Team sieht.",
      "Un système de campagne fictif reliant choix d’audience, contenus, publication et boucle d’apprentissage. D’actions dispersées à un rythme de campagne visible par toute l’équipe.",
      "Un sistema di campagna dimostrativo che collega scelte sul pubblico, contenuti, pubblicazione e ciclo di apprendimento. Da attività sparse a un ritmo di campagna visibile a tutto il team.",
    ),
    tags: LA(["Marketing & growth", "Professional services", "Mock project"], ["Marketing & Wachstum", "Professionelle Dienstleistungen", "Beispielprojekt"], ["Marketing et croissance", "Services professionnels", "Projet fictif"], ["Marketing e crescita", "Servizi professionali", "Progetto dimostrativo"]),
  },
  {
    slug: "support-continuity-system", imageId: 17, date: "2026-04-20T09:45:00Z", author: "u14",
    title: L("Support continuity system", "System für kontinuierlichen Support", "Système de continuité du support", "Sistema di continuità del supporto"),
    description: L(
      "A mock support experience that makes requests, priorities, fixes, and follow-up easier to understand. From reactive fixes to a visible rhythm of care and improvement.",
      "Ein Beispiel-Supporterlebnis, das Anfragen, Prioritäten, Korrekturen und Nachverfolgung verständlicher macht. Von reaktiven Korrekturen zu einem sichtbaren Rhythmus aus Pflege und Verbesserung.",
      "Une expérience de support fictive qui rend demandes, priorités, correctifs et suivi plus lisibles. De corrections réactives à un rythme visible de suivi et d’amélioration.",
      "Un’esperienza di supporto dimostrativa che rende più comprensibili richieste, priorità, correzioni e follow-up. Da interventi reattivi a un ritmo visibile di cura e miglioramento.",
    ),
    tags: LA(["IT support", "Business operations", "Mock project"], ["IT-Support", "Geschäftsbetrieb", "Beispielprojekt"], ["Support informatique", "Opérations", "Projet fictif"], ["Supporto IT", "Operazioni aziendali", "Progetto dimostrativo"]),
  },
  {
    slug: "nile-foods-online-shop", imageId: 28, date: "2026-05-18T07:30:00Z", author: "admin", client: true,
    title: L("Nile Foods online shop", "Onlineshop für Nile Foods", "Boutique en ligne Nile Foods", "Negozio online Nile Foods"),
    description: L(
      "A faster, bilingual online shop for Nile Foods with a simpler checkout, clearer product ranges and a recipe hub that brings customers back.",
      "Ein schnellerer, zweisprachiger Onlineshop für Nile Foods mit einfacherem Checkout, klareren Sortimenten und einem Rezeptbereich, der Kundinnen und Kunden zurückbringt.",
      "Une boutique en ligne bilingue et plus rapide pour Nile Foods, avec un paiement simplifié, des gammes plus lisibles et un espace recettes qui fidélise.",
      "Un negozio online bilingue e più veloce per Nile Foods, con un checkout più semplice, gamme più chiare e una sezione ricette che fa tornare i clienti.",
    ),
    tags: LA(["E-commerce", "Food & beverage", "Web development"], ["E-Commerce", "Lebensmittel & Getränke", "Webentwicklung"], ["E-commerce", "Agroalimentaire", "Développement web"], ["E-commerce", "Food & beverage", "Sviluppo web"]),
  },
  {
    slug: "sahel-resorts-booking-website", imageId: 29, date: "2026-06-22T11:10:00Z", author: "u14", client: true,
    title: L("Sahel Resorts booking website", "Buchungswebsite für Sahel Resorts", "Site de réservation Sahel Resorts", "Sito di prenotazione Sahel Resorts"),
    description: L(
      "A multilingual resort website with live room availability, seasonal offers and a concierge request form connected to the reservations team.",
      "Eine mehrsprachige Resort-Website mit Live-Zimmerverfügbarkeit, saisonalen Angeboten und einem Concierge-Formular, das direkt beim Reservierungsteam ankommt.",
      "Un site multilingue pour un complexe hôtelier, avec disponibilités en temps réel, offres saisonnières et formulaire de conciergerie relié à l’équipe des réservations.",
      "Un sito multilingue per un resort con disponibilità delle camere in tempo reale, offerte stagionali e un modulo concierge collegato al team prenotazioni.",
    ),
    tags: LA(["Hospitality", "Web & app design", "Multilingual"], ["Hotellerie", "Web- & App-Design", "Mehrsprachig"], ["Hôtellerie", "Web design et applications", "Multilingue"], ["Ospitalità", "Web e app design", "Multilingue"]),
  },
  {
    slug: "riyadh-logistics-tracking-portal", imageId: 30, date: "2026-07-15T08:50:00Z", author: "admin", client: true,
    title: L("Riyadh Logistics tracking portal", "Sendungsverfolgungsportal für Riyadh Logistics", "Portail de suivi Riyadh Logistics", "Portale di tracciamento Riyadh Logistics"),
    description: L(
      "A custom customer portal where shippers track consignments, download proof of delivery and raise claims without calling the operations desk.",
      "Ein individuelles Kundenportal, in dem Versender Sendungen verfolgen, Zustellnachweise herunterladen und Reklamationen erfassen – ohne Anruf beim Operations-Team.",
      "Un portail client sur mesure où les expéditeurs suivent leurs envois, téléchargent les preuves de livraison et déposent des réclamations sans appeler le service des opérations.",
      "Un portale clienti su misura dove gli spedizionieri seguono le spedizioni, scaricano le prove di consegna e aprono reclami senza chiamare l’ufficio operativo.",
    ),
    tags: LA(["Custom app development", "Logistics", "Integrations"], ["Individuelle App-Entwicklung", "Logistik", "Integrationen"], ["Applications sur mesure", "Logistique", "Intégrations"], ["App su misura", "Logistica", "Integrazioni"]),
  },
  {
    slug: "cairo-bites-magazine-relaunch", imageId: 31, date: "2026-08-11T12:20:00Z", author: "u12", client: true,
    title: L("Cairo Bites magazine relaunch", "Relaunch des Magazins Cairo Bites", "Relance du magazine Cairo Bites", "Rilancio della rivista Cairo Bites"),
    description: L(
      "An editorial redesign for a food and lifestyle magazine: a flexible article template, faster image delivery and a newsletter sign-up that finally works on mobile.",
      "Ein redaktionelles Redesign für ein Food- und Lifestyle-Magazin: flexible Artikelvorlage, schnellere Bildauslieferung und eine Newsletter-Anmeldung, die endlich mobil funktioniert.",
      "Une refonte éditoriale pour un magazine culinaire et lifestyle : un gabarit d’article flexible, des images plus rapides et une inscription à la newsletter enfin efficace sur mobile.",
      "Un redesign editoriale per una rivista di cucina e lifestyle: un modello di articolo flessibile, immagini più veloci e un’iscrizione alla newsletter che finalmente funziona su mobile.",
    ),
    tags: LA(["Editorial", "Website management", "Performance"], ["Redaktionell", "Website-Betreuung", "Performance"], ["Éditorial", "Gestion de site", "Performance"], ["Editoriale", "Gestione del sito", "Prestazioni"]),
  },
  {
    slug: "aarewelle-physiotherapy", imageId: 32, date: "2026-09-16T09:05:00Z", author: "u14", client: true,
    title: L("Aarewelle Physiotherapy, Bern", "Aarewelle Physiotherapie, Bern", "Aarewelle Physiothérapie, Berne", "Aarewelle Fisioterapia, Berna"),
    description: L(
      "A calm, accessible website for a physiotherapy practice in Bern, with online appointment requests and local SEO for three treatment locations.",
      "Eine ruhige, barrierearme Website für eine Physiotherapiepraxis in Bern – mit Online-Terminanfrage und lokalem SEO für drei Standorte.",
      "Un site apaisant et accessible pour un cabinet de physiothérapie à Berne, avec demande de rendez-vous en ligne et SEO local pour trois sites.",
      "Un sito sobrio e accessibile per uno studio di fisioterapia a Berna, con richiesta di appuntamento online e SEO locale per tre sedi.",
    ),
    tags: LA(["Local SEO", "Healthcare", "Web design"], ["Lokales SEO", "Gesundheit", "Webdesign"], ["SEO local", "Santé", "Web design"], ["SEO locale", "Sanità", "Web design"]),
  },
];

function buildProjects({ websiteUrl, userIdByKey }) {
  return PROJECTS.map((p, i) => {
    const uid = userIdByKey(p.author);
    return {
      id: i + 1,
      slug: p.slug,
      title: p.title,
      description: p.description,
      tags: p.tags,
      link: p.client ? `${websiteUrl}/work` : `${websiteUrl}/projects/${p.slug}`,
      mainImageId: p.imageId,
      logoImageId: p.client ? 19 : 1,
      createdById: uid,
      updatedById: uid,
      createdAt: new Date(p.date).toISOString(),
      updatedAt: new Date(new Date(p.date).getTime() + 3 * 864e5).toISOString(),
    };
  });
}

// ---- contact form submissions ----------------------------------------------------------------------------
// [firstName, lastName, company, email, phone, serviceKey, subKey, subject, message, status, daysAgo, hoursAgo, ip, owner, notes]
const CONTACTS = [
  ["Sara", "Nabil", "Horizon Academy", "sara.nabil@horizonacademy.test", "+20 12 3344 5566", "development", "custom-app-development", "Student attendance app",
    "Hello, we’re a private school in New Cairo looking for an attendance and parent-communication app. Do you have experience with education projects? We’d like to launch before the second term.", "new", 16, 2, "156.197.44.12", "Omar Farouk", null],
  ["Daniel", "Frei", "Frei Sanitär AG", "daniel.frei@frei-sanitaer.test", "+41 31 721 64 80", "it-support", "website-management", "Kontaktformular sendet keine E-Mails",
    "Hallo zusammen\n\nSeit gestern kommen die Anfragen aus unserem Kontaktformular nicht mehr an. Können Sie bitte nachsehen? Wir erwarten diese Woche viele Offertanfragen.\n\nDanke und Gruss\nDaniel Frei", "replied", 52, 5, "178.197.231.88", "Mahmoud Gamal",
    "SMTP password had expired at the mail provider. Updated credentials, sent a test enquiry and the client confirmed receipt."],
  ["Elena", "Rossi", "Rossi Immobiliare", "elena.rossi@rossi-immo.test", "+41 91 610 55 20", "design", "brand-development", "Nuovo logo e sito",
    "Buongiorno, stiamo aprendo una seconda agenzia a Lugano e vorremmo rinnovare logo e sito web. Potete inviarci qualche esempio di lavori simili?\n\nCordiali saluti\nElena Rossi", "replied", 45, 1, "185.12.64.211", "Tamer Wagdy",
    "Sent portfolio (identity system + Aarewelle). Meeting booked for 10 October in Lugano."],
  ["Anna", "Schmid", "Bäckerei Schmid Belp", "anna@baeckerei-schmid.test", "+41 31 819 23 05", "marketing", "seo-services", "Google-Profil und Öffnungszeiten",
    "Hallo, auf Google stehen noch unsere alten Öffnungszeiten. Können Sie das Profil aktualisieren und uns zeigen, wie wir Fotos selbst hochladen? Danke! Anna Schmid", "replied", 40, 3, "178.197.228.19", "Dina Fathy",
    "Profile updated, 12 new photos added. 20-minute training call done with Anna."],
  ["Mariam", "Hassan", "Cairo Bites", "mariam.hassan@cairobites.test", "+20 11 2345 7781", "marketing", "social-media-marketing", "Social media package",
    "Hello! We loved the magazine relaunch. Could you also manage our Instagram and TikTok for three months while our editor is on leave?", "replied", 33, 6, "41.46.108.73", "Dina Fathy",
    "Proposed a 3-month social package (3 posts/week + 2 reels). Client confirmed a start on 1 September."],
  ["Thomas", "Keller", "Keller Treuhand GmbH", "t.keller@keller-treuhand.test", "+41 44 380 26 11", "design", "web-and-app-design", "Relaunch unserer Website",
    "Guten Tag\n\nUnsere Website ist acht Jahre alt und auf dem Smartphone kaum nutzbar. Wir möchten einen Relaunch mit Mandantenportal für den Dokumentenaustausch. Wann hätten Sie Zeit für ein erstes Gespräch?\n\nBeste Grüsse\nThomas Keller", "replied", 27, 4, "83.150.2.47", "Tamer Wagdy",
    "First meeting held on site in Zurich. Interested in the website relaunch plus the Files module. Proposal due 5 October."],
  ["Yasmin", "Farag", "Sahel Resorts", "yasmin.farag@sahelresorts.test", "+20 12 7788 4410", "hosting", "managed-hosting", "Hosting renewal and staging server",
    "Hi, our hosting contract renews in November. We’d also like a staging server for testing new offers before they go live. Could you send the updated plan?", "replied", 20, 2, "197.34.170.5", "Omar Farouk",
    "Renewal quote sent with a staging add-on (CHF 45/month). Waiting for approval from their finance team."],
  ["Hassan", "Youssef", "Nile Foods", "hassan.youssef@nilefoods.test", "+20 10 5566 7788", "hosting", "managed-hosting", "Traffic peak during the Ramadan campaign",
    "Hi, we expect three times the usual traffic during the Ramadan campaign next spring. Can we review the hosting capacity and caching setup before then?", "replied", 18, 7, "156.214.9.130", "Mahmoud Gamal",
    "Load test planned for January. Recommended CDN image caching and a temporary upgrade for March."],
  ["Ahmed", "Al-Qahtani", "Riyadh Logistics Co.", "a.alqahtani@riyadhlogistics.test", "+966 11 486 2291", "development", "custom-app-development", "Driver app for the tracking portal",
    "Hello, the customer portal works well. We now need a simple Android app for our drivers to scan parcels and capture signatures. What would a first release look like?", "replied", 14, 3, "188.50.211.62", "Tamer Wagdy",
    "Discovery workshop proposed for October. Needs offline scanning and an Arabic interface."],
  ["Lea", "Zimmermann", "Zimmermann Events", "lea@zimmermann-events.test", "+41 61 271 90 33", "marketing", "social-media-marketing", "Instagram für unsere Hochzeitsmessen",
    "Grüezi\n\nWir organisieren Hochzeitsmessen in Basel und Bern und möchten auf Instagram professioneller auftreten. Bieten Sie auch Content-Produktion vor Ort an?\n\nHerzliche Grüsse\nLea Zimmermann", "new", 12, 5, "212.51.140.9", "Dina Fathy", null],
  ["Omar", "Mansour", "Delta Pharma", "omar.mansour@deltapharma.test", "+20 2 2735 1180", "it-support", "software-support", "Portal login errors",
    "Dear OrgTik team, since last Friday some of our pharmacists cannot log in to the product information portal. The error says ‘session expired’ immediately after login. Can you investigate urgently?", "replied", 11, 1, "41.33.192.18", "Mahmoud Gamal",
    "Root cause: cookie domain changed after the certificate renewal. Fix deployed on 19 September and confirmed with the client."],
  ["Nour", "Khaled", "Nile Foods", "nour.khaled@nilefoods.test", "+20 10 1234 5698", "development", "web-development", "Checkout improvements – phase 2",
    "Hi team, following the launch of the new shop we’d like to plan phase 2: saved addresses, Apple Pay and a faster checkout on mobile. Can we book a planning call next week?", "replied", 9, 4, "156.197.60.241", "Omar Farouk",
    "Call on 22 September with Nour and their IT lead. Scope: saved addresses, Apple Pay, one-page checkout. Estimate draft sent; follow-up on 1 October."],
  ["Karim", "Adel", "Adel Motors", "karim.adel@adelmotors.test", "+20 10 9876 5432", "development", "web-development", "Car inventory website",
    "We need a website that pulls our used-car inventory from our dealer system every hour, with filters and a financing calculator. Budget is flexible for the right solution.", "new", 8, 6, "197.55.23.140", "Omar Farouk", null],
  ["Julien", "Favre", "Favre Architectes", "julien.favre@favre-archi.test", "+41 22 700 48 16", "design", "graphic-design", "Brochure et présentation de projets",
    "Bonjour,\n\nNous cherchons un graphiste pour notre nouvelle brochure et un modèle de présentation pour les concours d’architecture. Travaillez-vous aussi sur des projets print ?\n\nCordialement\nJulien Favre", "new", 6, 2, "178.198.14.77", "Tamer Wagdy", null],
  ["Marco", "Bernasconi", "Ticino Travel Sagl", "marco.bernasconi@ticinotravel.test", "+41 91 922 15 37", "marketing", "digital-advertising-switzerland", "Campagna Google Ads autunno",
    "Buongiorno, vorremmo lanciare una campagna Google Ads per le offerte d’autunno in Ticino e nella Svizzera tedesca. Potete aiutarci con strategia e annunci in due lingue?\n\nGrazie, Marco Bernasconi", "new", 4, 3, "185.72.106.58", "Dina Fathy", null],
  ["Camille", "Rochat", "Rochat & Fils SA", "camille.rochat@rochat-fils.test", "+41 21 634 77 02", "marketing", "seo-services", "Référencement local à Lausanne",
    "Bonjour,\n\nNous sommes une menuiserie à Lausanne et nous aimerions être mieux visibles sur Google dans la région. Pourriez-vous nous proposer un audit SEO et un accompagnement sur six mois ?\n\nMerci d’avance,\nCamille Rochat", "new", 2, 5, "178.195.66.103", "Dina Fathy", null],
  ["Lukas", "Meier", "Meier Holzbau AG", "lukas.meier@meier-holzbau.test", "+41 31 552 18 40", "design", "brand-development", "Rebranding zum 60-Jahr-Jubiläum",
    "Guten Tag\n\nWir feiern nächstes Jahr unser 60-jähriges Firmenjubiläum und möchten bei dieser Gelegenheit Logo und Website auffrischen. Können Sie uns ein Angebot für einen Markenworkshop und ein neues Erscheinungsbild machen?\n\nFreundliche Grüsse\nLukas Meier", "new", 1, 2, "178.197.230.14", "Tamer Wagdy", null],
  ["Sophie", "Brunner", "Praxis Aarewelle", "sophie.brunner@aarewelle.test", "+41 31 318 44 90", "it-support", "website-management", "Neue Therapeutin auf der Teamseite",
    "Hallo zusammen\n\nAb 1. Oktober arbeitet Frau Dr. Keller bei uns. Könnten Sie ihr Profil mit Foto auf der Teamseite ergänzen? Text und Foto sende ich separat per E-Mail.\n\nLiebe Grüsse\nSophie Brunner", "new", 0, 3, "178.197.225.61", "Mahmoud Gamal", null],
];

function buildContacts({ serviceIdByKey, subServiceIdByKey }) {
  return CONTACTS.map(([firstName, lastName, companyName, email, phoneNumber, serviceKey, subKey, subject, message, status, d, h, ipAddress, owner, notes], i) => {
    const createdAt = daysAgo(d, h);
    const updatedAt = status === "replied" ? daysAgo(Math.max(0, d - 2), h) : createdAt;
    return {
      id: i + 1, firstName, lastName, companyName, email, phoneNumber, subject, message,
      serviceId: serviceIdByKey(serviceKey), subServiceId: subServiceIdByKey(subKey),
      status, ipAddress, customerServiceName: owner, notes, source: "website-contact-form", createdAt, updatedAt,
    };
  });
}

// ---- client reviews ---------------------------------------------------------------------------------------
const REVIEWS = [
  ["Nour Khaled", "Marketing Director, Nile Foods", "OrgTik rebuilt our online shop in eight weeks and the checkout is finally simple on mobile. The team explained every decision and kept us involved without drowning us in meetings.", 5, true, 16],
  ["Sophie Brunner", "Practice Manager, Aarewelle Physiotherapy", "Our new website feels calm and professional, just like our practice. Patients send appointment requests online now, and changes to the team page are done within a day.", 5, true, 10],
  ["Ahmed Al-Qahtani", "Operations Director, Riyadh Logistics Co.", "The tracking portal took a lot of pressure off our operations desk within the first month. OrgTik understood our process before writing a single line of code.", 5, true, 38],
  ["Yasmin Farag", "Digital Marketing Lead, Sahel Resorts", "Great multilingual booking site and very responsive hosting support. We would have liked the Arabic version a little earlier, but the result was worth the wait.", 4, true, 55],
  ["Thomas Keller", "Managing Partner, Keller Treuhand GmbH", "Clear proposal, fair price and a relaunch that finally works on the phone. Our clients now exchange documents through the portal every week.", 5, true, 21],
  ["Mariam Hassan", "Editor-in-Chief, Cairo Bites Magazine", "The relaunch made our articles faster and more beautiful, and our newsletter sign-ups have grown steadily since the new template went live.", 5, true, 30],
  ["Anna Schmid", "Owner, Bäckerei Schmid Belp", "Freundlich, schnell und unkompliziert. Unser Google-Profil ist jetzt immer aktuell und wir wissen selbst, wie wir neue Fotos hochladen.", 5, true, 36],
  ["Omar Mansour", "IT Manager, Delta Pharma", "When our portal had login problems, OrgTik found the cause within a day and explained it clearly. A dependable partner for maintenance.", 4, true, 8],
  ["Daniel Frei", "CEO, Frei Sanitär AG", "Wir bekommen wieder alle Anfragen und haben endlich eine feste Ansprechperson für unsere Website.", 5, true, 48],
  ["Hassan Youssef", "Head of IT, Nile Foods", "Monitoring, backups and quick answers whenever we need them. Hosting is one thing we no longer worry about.", 5, true, 14],
  ["Martin Graf", "Communications, Verein Aaretal Kultur", "OrgTik hat unsere Event-Website barrierearm neu aufgebaut und war geduldig mit unseren vielen Freigaben. Die neue Agenda pflegen wir jetzt selbst.", 5, true, 70],
  ["Elena Rossi", "Founder, Rossi Immobiliare", "Il nuovo logo ci rappresenta finalmente. Processo chiaro e ben organizzato, anche a distanza.", 4, false, 3],
  ["Lea Zimmermann", "Owner, Zimmermann Events", "Good ideas for our Instagram, but the first month took longer to get started than planned. Communication improved a lot afterwards.", 3, false, 5],
];

function buildReviews() {
  return REVIEWS.map(([clientName, clientTitle, reviewContent, rate, isPublic, d], i) => {
    const createdAt = daysAgo(d, 2 + (i % 6));
    return { id: i + 1, clientName, clientTitle, reviewContent, rate, isPublic, createdAt, updatedAt: createdAt };
  });
}

// ---- sitemap categories & blogs (SEO landing pages listed in the website sitemap) ----------------------------
const SITEMAP_CATEGORIES = [
  L("Web design by city", "Webdesign nach Stadt", "Web design par ville", "Web design per città"),
  L("SEO by city", "SEO nach Stadt", "SEO par ville", "SEO per città"),
  L("Hosting guides", "Hosting-Ratgeber", "Guides d’hébergement", "Guide all’hosting"),
  L("Software guides", "Software-Ratgeber", "Guides logiciels", "Guide software"),
  L("Glossary", "Glossar", "Glossaire", "Glossario"),
  L("Industry pages", "Branchenseiten", "Pages sectorielles", "Pagine di settore"),
];

// [categoryIndex, title, seoDescription, [p1, p2] per language, keywords, visibility, daysAgo]
const SITEMAP_BLOGS = [
  [0, L("Web design in Bern", "Webdesign in Bern", "Web design à Berne", "Web design a Berna"),
    L("Websites for Bernese SMEs: design, development, hosting and care from OrgTik in Belp.", "Websites für Berner KMU: Design, Entwicklung, Hosting und Betreuung von OrgTik in Belp.", "Des sites web pour les PME bernoises : design, développement, hébergement et suivi par OrgTik à Belp.", "Siti web per le PMI bernesi: design, sviluppo, hosting e assistenza da OrgTik a Belp."),
    {
      en: ["OrgTik designs and builds websites for companies in Bern and the surrounding region from our studio in Belp, fifteen minutes from the city centre.", "From brand-new company sites to relaunches in German and French, one team handles design, development, hosting and ongoing care."],
      de: ["OrgTik gestaltet und entwickelt Websites für Unternehmen in Bern und Umgebung – aus unserem Studio in Belp, fünfzehn Minuten vom Stadtzentrum entfernt.", "Vom neuen Firmenauftritt bis zum Relaunch auf Deutsch und Französisch: Design, Entwicklung, Hosting und Betreuung aus einer Hand."],
      fr: ["OrgTik conçoit et développe des sites web pour les entreprises de Berne et de sa région depuis son studio de Belp, à quinze minutes du centre-ville.", "Du nouveau site d’entreprise à la refonte en allemand et en français, une seule équipe s’occupe du design, du développement, de l’hébergement et du suivi."],
      it: ["OrgTik progetta e sviluppa siti web per le aziende di Berna e dintorni dal suo studio di Belp, a quindici minuti dal centro.", "Dal nuovo sito aziendale al rilancio in tedesco e francese, un solo team si occupa di design, sviluppo, hosting e assistenza."],
    }, ["web design Bern", "Webdesign Bern", "website agency Bern"], true, 120],
  [0, L("Web design in Zurich", "Webdesign in Zürich", "Web design à Zurich", "Web design a Zurigo"),
    L("Fast, multilingual websites for Zurich companies – planned in workshops and built in reviewable steps.", "Schnelle, mehrsprachige Websites für Zürcher Unternehmen – in Workshops geplant und in prüfbaren Schritten gebaut.", "Des sites rapides et multilingues pour les entreprises zurichoises, planifiés en ateliers et construits par étapes.", "Siti veloci e multilingue per le aziende di Zurigo, pianificati in workshop e realizzati a passi verificabili."),
    {
      en: ["Zurich companies work with OrgTik when they want a website that is fast, multilingual and easy for their own team to update.", "We run discovery workshops on site or remotely, then design and build in short, reviewable steps."],
      de: ["Zürcher Unternehmen arbeiten mit OrgTik, wenn sie eine schnelle, mehrsprachige Website wollen, die ihr eigenes Team einfach pflegen kann.", "Wir führen Discovery-Workshops vor Ort oder remote durch und gestalten und entwickeln danach in kurzen, prüfbaren Schritten."],
      fr: ["Les entreprises zurichoises font appel à OrgTik pour un site rapide, multilingue et facile à mettre à jour par leur équipe.", "Nous animons des ateliers sur place ou à distance, puis concevons et développons par petites étapes vérifiables."],
      it: ["Le aziende di Zurigo scelgono OrgTik per un sito veloce, multilingue e facile da aggiornare dal proprio team.", "Organizziamo workshop in sede o da remoto, poi progettiamo e sviluppiamo a piccoli passi verificabili."],
    }, ["web design Zurich", "Webdesign Zürich", "website Zurich"], true, 101],
  [0, L("Web design in Basel", "Webdesign in Basel", "Web design à Bâle", "Web design a Basilea"),
    L("Website design and development for businesses in Basel and the tri-border region.", "Webdesign und Entwicklung für Unternehmen in Basel und im Dreiländereck.", "Conception et développement de sites pour les entreprises de Bâle et de la région des trois frontières.", "Progettazione e sviluppo di siti per le aziende di Basilea e della regione delle tre frontiere."),
    {
      en: ["Businesses in Basel often serve customers in three countries. We plan websites with clear language versions and fast pages for every market.", "This landing page is being prepared for the autumn campaign."],
      de: ["Unternehmen in Basel bedienen oft Kundschaft in drei Ländern. Wir planen Websites mit klaren Sprachversionen und schnellen Seiten für jeden Markt.", "Diese Landingpage wird für die Herbstkampagne vorbereitet."],
      fr: ["Les entreprises bâloises servent souvent des clients dans trois pays. Nous concevons des sites avec des versions linguistiques claires et des pages rapides pour chaque marché.", "Cette page d’atterrissage est en préparation pour la campagne d’automne."],
      it: ["Le aziende di Basilea servono spesso clienti in tre paesi. Progettiamo siti con versioni linguistiche chiare e pagine veloci per ogni mercato.", "Questa landing page è in preparazione per la campagna d’autunno."],
    }, ["web design Basel", "Webdesign Basel", "Dreiländereck"], false, 9],
  [1, L("SEO agency in Bern", "SEO-Agentur in Bern", "Agence SEO à Berne", "Agenzia SEO a Berna"),
    L("Technical SEO, local search and content for businesses in the Bern region.", "Technisches SEO, lokale Suche und Inhalte für Unternehmen in der Region Bern.", "SEO technique, recherche locale et contenus pour les entreprises de la région bernoise.", "SEO tecnica, ricerca locale e contenuti per le aziende della regione di Berna."),
    {
      en: ["We help Bernese companies get found by the customers nearby: technical fixes first, then local pages and a well-kept Google Business Profile.", "Every month we review rankings, traffic and enquiries together and agree the next improvements."],
      de: ["Wir helfen Berner Unternehmen, von der Kundschaft in der Nähe gefunden zu werden: zuerst technische Korrekturen, dann lokale Seiten und ein gepflegtes Google-Unternehmensprofil.", "Jeden Monat besprechen wir Rankings, Traffic und Anfragen und vereinbaren die nächsten Verbesserungen."],
      fr: ["Nous aidons les entreprises bernoises à être trouvées par les clients proches : corrections techniques d’abord, puis pages locales et fiche Google Business soignée.", "Chaque mois, nous analysons ensemble positions, trafic et demandes et convenons des prochaines améliorations."],
      it: ["Aiutiamo le aziende bernesi a farsi trovare dai clienti vicini: prima le correzioni tecniche, poi pagine locali e un profilo Google curato.", "Ogni mese analizziamo insieme posizionamenti, traffico e richieste e decidiamo i prossimi miglioramenti."],
    }, ["SEO Bern", "SEO Agentur Bern", "local SEO Bern"], true, 95],
  [1, L("Local SEO in Lausanne", "Lokales SEO in Lausanne", "SEO local à Lausanne", "SEO locale a Losanna"),
    L("French-language local SEO for Lausanne businesses, from Google Business Profile to location pages.", "Französischsprachiges lokales SEO für Unternehmen in Lausanne – vom Google-Profil bis zu Standortseiten.", "Référencement local en français pour les entreprises lausannoises, de la fiche Google Business aux pages locales.", "SEO locale in francese per le aziende di Losanna, dal profilo Google alle pagine locali."),
    {
      en: ["Customers in Lausanne search in French and expect local answers. We research the terms they use and write pages that match.", "Reviews, opening hours and photos are kept current so your profile builds trust before the first visit."],
      de: ["Kundschaft in Lausanne sucht auf Französisch und erwartet lokale Antworten. Wir recherchieren ihre Suchbegriffe und schreiben passende Seiten.", "Bewertungen, Öffnungszeiten und Fotos halten wir aktuell, damit Ihr Profil schon vor dem ersten Besuch Vertrauen schafft."],
      fr: ["À Lausanne, les clients cherchent en français et attendent des réponses locales. Nous étudions leurs requêtes et rédigeons des pages adaptées.", "Avis, horaires et photos sont tenus à jour pour que votre fiche inspire confiance avant la première visite."],
      it: ["A Losanna i clienti cercano in francese e si aspettano risposte locali. Studiamo le loro ricerche e scriviamo pagine adatte.", "Recensioni, orari e foto sono sempre aggiornati, così il tuo profilo crea fiducia prima della prima visita."],
    }, ["SEO Lausanne", "référencement local Lausanne", "Google Business Lausanne"], true, 74],
  [2, L("Managed WordPress hosting in Switzerland", "Managed WordPress-Hosting in der Schweiz", "Hébergement WordPress géré en Suisse", "Hosting WordPress gestito in Svizzera"),
    L("Swiss WordPress hosting with updates, tested backups, monitoring and support from people who know your site.", "Schweizer WordPress-Hosting mit Updates, getesteten Backups, Monitoring und Support von Menschen, die Ihre Website kennen.", "Hébergement WordPress suisse avec mises à jour, sauvegardes testées, surveillance et support par des personnes qui connaissent votre site.", "Hosting WordPress svizzero con aggiornamenti, backup testati, monitoraggio e supporto da chi conosce il tuo sito."),
    {
      en: ["WordPress sites need regular care: core and plugin updates, security checks and backups that can actually be restored.", "OrgTik hosting runs on Swiss infrastructure and includes monitoring and direct support from the team that maintains your site."],
      de: ["WordPress-Websites brauchen regelmässige Pflege: Core- und Plugin-Updates, Sicherheitsprüfungen und Backups, die sich wirklich wiederherstellen lassen.", "OrgTik Hosting läuft auf Schweizer Infrastruktur und umfasst Monitoring sowie direkten Support vom Team, das Ihre Website betreut."],
      fr: ["Un site WordPress demande un entretien régulier : mises à jour du cœur et des extensions, contrôles de sécurité et sauvegardes réellement restaurables.", "L’hébergement OrgTik fonctionne sur une infrastructure suisse et inclut surveillance et support direct de l’équipe qui entretient votre site."],
      it: ["I siti WordPress richiedono cura costante: aggiornamenti di core e plugin, controlli di sicurezza e backup davvero ripristinabili.", "L’hosting OrgTik si basa su un’infrastruttura svizzera e include monitoraggio e supporto diretto dal team che cura il tuo sito."],
    }, ["WordPress hosting Switzerland", "managed WordPress", "Webhosting Schweiz"], true, 88],
  [2, L("How to move your website to a new host", "So ziehen Sie Ihre Website zu einem neuen Hoster um", "Comment migrer votre site vers un nouvel hébergeur", "Come trasferire il sito a un nuovo hosting"),
    L("A step-by-step checklist for moving a website without downtime or lost emails.", "Eine Schritt-für-Schritt-Checkliste für den Umzug ohne Ausfall und ohne verlorene E-Mails.", "Une liste étape par étape pour migrer un site sans interruption ni e-mails perdus.", "Una checklist passo passo per trasferire un sito senza interruzioni né e-mail perse."),
    {
      en: ["Start with an inventory: domains, DNS records, email accounts, databases and scheduled tasks. Then copy the site to the new server and test it before touching DNS.", "Lower the DNS time-to-live a day in advance, switch the records during a quiet hour and keep the old hosting running for a week."],
      de: ["Beginnen Sie mit einer Bestandsaufnahme: Domains, DNS-Einträge, E-Mail-Konten, Datenbanken und geplante Aufgaben. Kopieren Sie die Website auf den neuen Server und testen Sie sie, bevor Sie DNS ändern.", "Senken Sie die DNS-TTL einen Tag vorher, stellen Sie die Einträge in einer ruhigen Stunde um und lassen Sie das alte Hosting eine Woche weiterlaufen."],
      fr: ["Commencez par un inventaire : domaines, enregistrements DNS, comptes e-mail, bases de données et tâches planifiées. Copiez ensuite le site sur le nouveau serveur et testez-le avant de modifier le DNS.", "Réduisez la durée de vie DNS la veille, basculez les enregistrements à une heure creuse et gardez l’ancien hébergement actif une semaine."],
      it: ["Parti da un inventario: domini, record DNS, caselle e-mail, database e attività pianificate. Poi copia il sito sul nuovo server e testalo prima di toccare il DNS.", "Riduci il TTL del DNS il giorno prima, cambia i record in un’ora tranquilla e mantieni attivo il vecchio hosting per una settimana."],
    }, ["website migration", "change web host", "DNS migration"], true, 60],
  [3, L("HR software for Swiss SMEs", "HR-Software für Schweizer KMU", "Logiciel RH pour les PME suisses", "Software HR per le PMI svizzere"),
    L("What small Swiss teams need from HR software: people records, leave, onboarding and documents in one place.", "Was kleine Schweizer Teams von HR-Software brauchen: Personaldaten, Absenzen, Onboarding und Dokumente an einem Ort.", "Ce dont les petites équipes suisses ont besoin : dossiers du personnel, congés, intégration et documents au même endroit.", "Cosa serve ai piccoli team svizzeri: dati del personale, assenze, onboarding e documenti in un unico posto."),
    {
      en: ["Spreadsheets work until the team grows past ten people. After that, leave requests, contracts and onboarding checklists start to get lost.", "The OrgTik HR module keeps people, documents and everyday processes in one clear place – and connects with Files and Tasks when you need more."],
      de: ["Tabellen funktionieren, bis das Team grösser als zehn Personen wird. Danach gehen Absenzgesuche, Verträge und Onboarding-Checklisten verloren.", "Das OrgTik HR-Modul hält Menschen, Dokumente und Alltagsprozesse an einem klaren Ort – und verbindet sich bei Bedarf mit Dateien und Aufgaben."],
      fr: ["Les tableurs suffisent jusqu’à une dizaine de personnes. Au-delà, demandes de congé, contrats et listes d’intégration commencent à se perdre.", "Le module RH d’OrgTik réunit personnes, documents et processus du quotidien en un seul endroit, et se connecte aux fichiers et aux tâches si besoin."],
      it: ["I fogli di calcolo funzionano finché il team non supera le dieci persone. Poi richieste di ferie, contratti e checklist di onboarding iniziano a perdersi.", "Il modulo HR di OrgTik riunisce persone, documenti e processi quotidiani in un unico posto chiaro, e si collega a file e attività quando serve."],
    }, ["HR software Switzerland", "HR-Software KMU", "leave management"], true, 45],
  [4, L("What is a CDN?", "Was ist ein CDN?", "Qu’est-ce qu’un CDN ?", "Che cos’è una CDN?"),
    L("A content delivery network explained in plain language, and when a small website needs one.", "Ein Content Delivery Network einfach erklärt – und wann eine kleine Website eines braucht.", "Un réseau de diffusion de contenu expliqué simplement, et quand un petit site en a besoin.", "Una rete di distribuzione dei contenuti spiegata in modo semplice, e quando serve a un piccolo sito."),
    {
      en: ["A content delivery network stores copies of images, scripts and pages on servers close to your visitors, so they load faster wherever people are.", "For a local business website, a good image setup often matters more; for international audiences or traffic peaks, a CDN is worth it."],
      de: ["Ein Content Delivery Network speichert Kopien von Bildern, Skripten und Seiten auf Servern nahe bei Ihren Besuchern, damit sie überall schneller laden.", "Für eine lokale Website ist oft eine gute Bildoptimierung wichtiger; bei internationalem Publikum oder Traffic-Spitzen lohnt sich ein CDN."],
      fr: ["Un réseau de diffusion de contenu stocke des copies des images, scripts et pages sur des serveurs proches de vos visiteurs pour un chargement plus rapide.", "Pour un site local, une bonne optimisation des images compte souvent davantage ; pour un public international ou des pics de trafic, un CDN vaut la peine."],
      it: ["Una rete di distribuzione dei contenuti salva copie di immagini, script e pagine su server vicini ai visitatori, così si caricano più velocemente ovunque.", "Per un sito locale conta spesso di più una buona ottimizzazione delle immagini; per un pubblico internazionale o picchi di traffico una CDN conviene."],
    }, ["CDN", "content delivery network", "website speed"], true, 30],
  [4, L("What is a domain name?", "Was ist ein Domainname?", "Qu’est-ce qu’un nom de domaine ?", "Che cos’è un nome di dominio?"),
    L("Domains, DNS and registrars explained – and how to keep control of your company’s domain.", "Domains, DNS und Registrare erklärt – und wie Sie die Kontrolle über Ihre Firmendomain behalten.", "Domaines, DNS et registraires expliqués, et comment garder la maîtrise du domaine de votre entreprise.", "Domini, DNS e registrar spiegati, e come mantenere il controllo del dominio aziendale."),
    {
      en: ["A domain name is the address people type to reach your website, such as orgtik.ch. It is registered with a registrar and points to your hosting through DNS records.", "Register the domain in the company’s name, keep the login in a shared password manager and turn on automatic renewal."],
      de: ["Ein Domainname ist die Adresse, die Menschen eintippen, um Ihre Website zu erreichen, zum Beispiel orgtik.ch. Er wird bei einem Registrar registriert und zeigt per DNS auf Ihr Hosting.", "Registrieren Sie die Domain auf das Unternehmen, bewahren Sie das Login in einem gemeinsamen Passwortmanager auf und aktivieren Sie die automatische Verlängerung."],
      fr: ["Un nom de domaine est l’adresse que l’on tape pour accéder à votre site, par exemple orgtik.ch. Il est enregistré auprès d’un registraire et pointe vers votre hébergement via le DNS.", "Enregistrez le domaine au nom de l’entreprise, conservez l’accès dans un gestionnaire de mots de passe partagé et activez le renouvellement automatique."],
      it: ["Un nome di dominio è l’indirizzo che si digita per raggiungere il sito, per esempio orgtik.ch. Si registra presso un registrar e punta all’hosting tramite i record DNS.", "Registra il dominio a nome dell’azienda, conserva l’accesso in un gestore di password condiviso e attiva il rinnovo automatico."],
    }, ["domain name", "DNS", "Domain registrieren"], true, 21],
];

function buildSitemap() {
  const categories = SITEMAP_CATEGORIES.map((name, i) => {
    const createdAt = daysAgo(150 - i * 12, 4);
    return { id: i + 1, name, createdAt, updatedAt: createdAt };
  });
  const blogs = SITEMAP_BLOGS.map(([ci, title, seoDescription, paras, seoKeywords, visibility, d], i) => {
    const createdAt = daysAgo(d, 2 + (i % 4));
    return {
      id: i + 1,
      title,
      content: Object.fromEntries(LANGS.map((l) => [l, paras[l].map((p) => `<p>${p}</p>`).join("")])),
      categoryId: ci + 1,
      visibility,
      seoTitle: mapLoc(title, (t) => `${t} | OrgTik`),
      seoDescription,
      seoKeywords,
      slug: mapLoc(title, (t) => slugify(t)),
      createdAt,
      updatedAt: createdAt,
    };
  });
  return { categories, blogs };
}

// ---- legacy endpoints (declared in redux/features but not used by any current page) --------------------------
function buildLegacy() {
  const t = "2026-03-02T09:00:00.000Z";
  const std = (title, sub, desc) => ({ id: 1, title, sub_title: sub, description: desc, created_at: t, updated_at: t });
  const docs = {
    "hero-section": {
      id: 1,
      alert: L("New: Website Manager is live", "Neu: Website Manager ist live", "Nouveau : Website Manager est disponible", "Novità: Website Manager è disponibile"),
      title: L("Build and grow. Run it better.", "Aufbauen und wachsen. Besser betreiben.", "Construire et grandir. Mieux piloter.", "Costruire e crescere. Gestire meglio."),
      description: L("Strategy, design, technology and operations from one team.", "Strategie, Design, Technologie und Betrieb aus einem Team.", "Stratégie, design, technologie et opérations par une seule équipe.", "Strategia, design, tecnologia e operazioni da un unico team."),
      button_1: L("Start a project", "Projekt starten", "Démarrer un projet", "Avvia un progetto"),
      button_2: L("Explore plans", "Pläne entdecken", "Découvrir les offres", "Scopri i piani"),
      button_1_link: "/contact", button_2_link: "/software", gallery_id: "8", created_at: t, updated_at: t,
    },
    "testimonial-section": std(L("In our clients’ words", "In den Worten unserer Kunden", "Avec les mots de nos clients", "Con le parole dei nostri clienti"), L("Testimonials", "Referenzen", "Témoignages", "Testimonianze"), L("What working with OrgTik feels like.", "Wie sich die Zusammenarbeit mit OrgTik anfühlt.", "Ce que l’on ressent en travaillant avec OrgTik.", "Com’è lavorare con OrgTik.")),
    "timeline-section": std(L("Our journey", "Unser Weg", "Notre parcours", "Il nostro percorso"), L("About", "Über uns", "À propos", "Chi siamo"), L("Four chapters of how we work.", "Vier Kapitel unserer Arbeitsweise.", "Quatre chapitres de notre façon de travailler.", "Quattro capitoli del nostro modo di lavorare.")),
    "feature-section": std(L("Six products, one workspace", "Sechs Produkte, ein Arbeitsbereich", "Six produits, un espace", "Sei prodotti, un unico spazio"), L("Software", "Software", "Logiciels", "Software"), L("HR, CRM, Files, Tasks, Marketing and Website Manager.", "HR, CRM, Dateien, Aufgaben, Marketing und Website Manager.", "RH, CRM, fichiers, tâches, marketing et Website Manager.", "HR, CRM, file, attività, marketing e Website Manager.")),
    "control-section": std(L("Everything under control", "Alles unter Kontrolle", "Tout sous contrôle", "Tutto sotto controllo"), L("Hosting", "Hosting", "Hébergement", "Hosting"), L("Monitoring, backups and performance care.", "Monitoring, Backups und Performance-Pflege.", "Surveillance, sauvegardes et performances.", "Monitoraggio, backup e prestazioni.")),
    "question-section": std(L("Frequently asked questions", "Häufige Fragen", "Questions fréquentes", "Domande frequenti"), L("FAQ", "FAQ", "FAQ", "FAQ"), L("Answers to what clients ask most.", "Antworten auf die häufigsten Kundenfragen.", "Réponses aux questions les plus fréquentes.", "Risposte alle domande più frequenti.")),
    "domin-section": std(L("Find your domain", "Finden Sie Ihre Domain", "Trouvez votre domaine", "Trova il tuo dominio"), L("Domains", "Domains", "Domaines", "Domini"), L("Register and manage domains with your hosting.", "Domains zusammen mit dem Hosting registrieren und verwalten.", "Enregistrez et gérez vos domaines avec l’hébergement.", "Registra e gestisci i domini insieme all’hosting.")),
    "service-section": std(L("Build & grow", "Aufbauen & wachsen", "Construire et grandir", "Costruire e crescere"), L("Services", "Leistungen", "Services", "Servizi"), L("Five connected service families.", "Fünf vernetzte Leistungsbereiche.", "Cinq familles de services connectées.", "Cinque famiglie di servizi collegate.")),
    "hosting-hero-section": {
      id: 1, title: L("OrgTik hosting", "OrgTik Hosting", "Hébergement OrgTik", "Hosting OrgTik"),
      description: L("A dependable home for your digital presence.", "Ein verlässliches Zuhause für Ihre digitale Präsenz.", "Un foyer fiable pour votre présence numérique.", "Una casa affidabile per la tua presenza digitale."),
      button_text: L("See hosting plans", "Hosting-Pläne ansehen", "Voir les offres", "Vedi i piani"), button_link: "/services/hosting", created_at: t, updated_at: t,
    },
    "vps-hero-section": {
      id: 1, alert: L("Swiss infrastructure", "Schweizer Infrastruktur", "Infrastructure suisse", "Infrastruttura svizzera"),
      title: L("Managed servers for growing sites", "Betreute Server für wachsende Websites", "Serveurs gérés pour sites en croissance", "Server gestiti per siti in crescita"),
      description: L("Dedicated resources with monitoring and backups.", "Dedizierte Ressourcen mit Monitoring und Backups.", "Ressources dédiées avec surveillance et sauvegardes.", "Risorse dedicate con monitoraggio e backup."),
      button_text: L("Talk to us", "Sprechen Sie mit uns", "Parlons-en", "Parliamone"), button_link: "/contact", gallery_id: "5", created_at: t, updated_at: t,
    },
    "pakege-section": {
      id: 1, title: L("Service packs", "Service-Pakete", "Offres de service", "Pacchetti di servizi"), sub_title: L("Plans", "Pläne", "Offres", "Piani"),
      description: L("Focus, Connected and Partnership.", "Focus, Connected und Partnership.", "Focus, Connected et Partenariat.", "Focus, Connected e Partnership."),
      card_title: L("Not sure which pack fits?", "Unsicher, welches Paket passt?", "Vous hésitez entre les offres ?", "Non sai quale pacchetto scegliere?"),
      card_description: L("Tell us about the goal and we’ll recommend one.", "Nennen Sie uns das Ziel, wir empfehlen ein Paket.", "Décrivez l’objectif, nous vous en recommanderons une.", "Raccontaci l’obiettivo e te ne consiglieremo uno."),
      card_button_text: L("Get advice", "Beraten lassen", "Demander conseil", "Chiedi un consiglio"), card_button_link: "/contact",
    },
    footer: {
      id: 1, copy_right_text: L("© 2026 OrgTik. Made in Switzerland.", "© 2026 OrgTik. Made in Switzerland.", "© 2026 OrgTik. Made in Switzerland.", "© 2026 OrgTik. Made in Switzerland."),
      footer_links: [
        { category: L("Explore", "Entdecken", "Découvrir", "Scopri"), links: [{ title: L("Services", "Leistungen", "Services", "Servizi"), link: "/services" }, { title: L("Software", "Software", "Logiciels", "Software"), link: "/software" }] },
        { category: L("Legal", "Rechtliches", "Légal", "Note legali"), links: [{ title: L("Imprint", "Impressum", "Mentions légales", "Impressum"), link: "/imprint" }, { title: L("Privacy", "Datenschutz", "Confidentialité", "Privacy"), link: "/privacy" }] },
      ],
    },
    "admin/ad-banner": {
      description: L("Autumn offer: 15 % off the Operations bundle", "Herbstangebot: 15 % Rabatt auf das Paket Betrieb", "Offre d’automne : 15 % sur le pack Opérations", "Offerta d’autunno: 15 % sul pacchetto Operazioni"),
      discount_percent: 15, expires_at: "2026-10-31T23:59:00.000Z", is_active: true,
    },
    "admin/chatbot-script": { script: "<!-- OrgTik website chat (disabled in local preview) -->\n<script>window.orgtikChat = { enabled: false, locale: 'auto' };</script>" },
  };
  const collections = {
    control: [
      { id: 1, title: L("Monitoring", "Monitoring", "Surveillance", "Monitoraggio"), description: L("Checks what visitors experience around the clock.", "Prüft rund um die Uhr, was Besucher erleben.", "Vérifie en continu ce que vivent les visiteurs.", "Controlla 24 ore su 24 ciò che vivono i visitatori."), gallery_id: 5, created_at: t, updated_at: t },
      { id: 2, title: L("Backups", "Backups", "Sauvegardes", "Backup"), description: L("Daily copies with tested restores.", "Tägliche Kopien mit getesteten Wiederherstellungen.", "Copies quotidiennes avec restaurations testées.", "Copie giornaliere con ripristini testati."), gallery_id: 8, created_at: t, updated_at: t },
      { id: 3, title: L("Updates", "Updates", "Mises à jour", "Aggiornamenti"), description: L("Reviewed before they go live.", "Vor dem Livegang geprüft.", "Vérifiées avant la mise en ligne.", "Verificati prima della pubblicazione."), gallery_id: 6, created_at: t, updated_at: t },
    ],
    testimonial: [
      { id: 1, name: L("Nour Khaled", "Nour Khaled", "Nour Khaled", "Nour Khaled"), comment: L("The checkout is finally simple on mobile.", "Der Checkout ist mobil endlich einfach.", "Le paiement est enfin simple sur mobile.", "Il checkout è finalmente semplice da mobile."), rating: 5, gallery_id: null, created_at: t, updated_at: t },
      { id: 2, name: L("Thomas Keller", "Thomas Keller", "Thomas Keller", "Thomas Keller"), comment: L("A relaunch that works on the phone.", "Ein Relaunch, der auf dem Handy funktioniert.", "Une refonte qui fonctionne sur mobile.", "Un rilancio che funziona sul telefono."), rating: 5, gallery_id: null, created_at: t, updated_at: t },
    ],
    timelines: [
      { id: 1, title: L("Start with the problem", "Beim Problem beginnen", "Partir du problème", "Partire dal problema"), description: L("Listening first.", "Zuerst zuhören.", "D’abord écouter.", "Prima ascoltare."), gallery_id: 5, created_at: t, updated_at: t },
      { id: 2, title: L("Connect the capabilities", "Die Fähigkeiten verbinden", "Relier les compétences", "Collegare le competenze"), description: L("One team, one solution.", "Ein Team, eine Lösung.", "Une équipe, une solution.", "Un team, una soluzione."), gallery_id: 4, created_at: t, updated_at: t },
      { id: 3, title: L("Build with care", "Mit Sorgfalt bauen", "Construire avec soin", "Costruire con cura"), description: L("Visible steps, tested work.", "Sichtbare Schritte, getestete Arbeit.", "Étapes visibles, travail testé.", "Passi visibili, lavoro testato."), gallery_id: 7, created_at: t, updated_at: t },
    ],
    "social-media": ["https://www.linkedin.com/", "https://www.instagram.com/", "https://www.facebook.com/", "https://www.youtube.com/"].map((link, i) => ({ id: i + 1, link, gallery_id: null, created_at: t, updated_at: t })),
  };
  // Software features (/features) in the IFeature shape the old Features page used.
  const features = [
    ["hr", L("HR", "HR", "RH", "HR"), L("People, leave, onboarding and documents in one place.", "Menschen, Absenzen, Onboarding und Dokumente an einem Ort.", "Personnes, congés, intégration et documents au même endroit.", "Persone, assenze, onboarding e documenti in un unico posto."), 12],
    ["crm", L("CRM", "CRM", "CRM", "CRM"), L("Contacts, pipeline and follow-ups.", "Kontakte, Pipeline und Nachfassaktionen.", "Contacts, pipeline et relances.", "Contatti, pipeline e follow-up."), 12],
    ["files", L("Files", "Dateien", "Fichiers", "File"), L("A clear, shared structure for documents.", "Eine klare, gemeinsame Struktur für Dokumente.", "Une structure claire et partagée pour les documents.", "Una struttura chiara e condivisa per i documenti."), 12],
    ["tasks", L("Tasks", "Aufgaben", "Tâches", "Attività"), L("Projects, owners and progress.", "Projekte, Verantwortliche und Fortschritt.", "Projets, responsables et avancement.", "Progetti, responsabili e avanzamento."), 12],
  ].map(([key, title, description, imageId], i) => ({
    id: i + 1, key, title, description, imageId, slug: L(key, key, key, key),
    seoTitle: mapLoc(title, (x) => `${x} | OrgTik Software`), seoDescription: description, seoKeywords: [`${key} software`, "OrgTik"],
    createdAt: t, updatedAt: t,
  }));
  return { docs, collections, features };
}

module.exports = { buildGallery, buildProjects, buildContacts, buildReviews, buildSitemap, buildLegacy, GALLERY, ASSETS_DIR, MIME };
