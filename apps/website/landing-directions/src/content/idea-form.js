import { currentLocale } from "./locale.js";

const copy = {
  en: [
    "Idea title",
    "Give your idea a short, clear title",
    "Add a title of up to 180 characters.",
    "I consent to OrgTik using my details to review this idea.",
    "Privacy notice",
  ],
  ar: [
    "عنوان الفكرة",
    "اكتب عنوانًا قصيرًا وواضحًا لفكرتك",
    "أضف عنوانًا لا يتجاوز 180 حرفًا.",
    "أوافق على استخدام OrgTik لبياناتي لمراجعة هذه الفكرة.",
    "إشعار الخصوصية",
  ],
  de: [
    "Titel der Idee",
    "Gib deiner Idee einen kurzen, klaren Titel",
    "Füge einen Titel mit höchstens 180 Zeichen hinzu.",
    "Ich stimme zu, dass OrgTik meine Angaben zur Prüfung dieser Idee verwendet.",
    "Datenschutzhinweis",
  ],
  fr: [
    "Titre de l’idée",
    "Donnez un titre court et clair à votre idée",
    "Ajoutez un titre de 180 caractères maximum.",
    "J’accepte qu’OrgTik utilise mes coordonnées pour examiner cette idée.",
    "Avis de confidentialité",
  ],
  it: [
    "Titolo dell’idea",
    "Dai alla tua idea un titolo breve e chiaro",
    "Aggiungi un titolo di massimo 180 caratteri.",
    "Acconsento all’uso dei miei dati da parte di OrgTik per valutare questa idea.",
    "Informativa sulla privacy",
  ],
};

export const ideaFormCopy = () => {
  const [title, placeholder, titleError, consent, privacy] =
    copy[currentLocale()] ?? copy.en;
  return { title, placeholder, titleError, consent, privacy };
};
