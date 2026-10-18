// Pricing tables for the platform mock, seeded with spec 03's own numbers so its worked examples
// (R03-EX-1…12) hold exactly. Currencies, rates, zones and countries are admin data (ADM-08…15);
// the grid holds published prices per plan, cycle and zone (ADM-12).
const currencies = {
  USD: { code: "USD", name: "US dollar", decimals: 2, step: 1, mode: "nearest", active: true },
  EUR: { code: "EUR", name: "Euro", decimals: 2, step: 1, mode: "nearest", active: true },
  CHF: { code: "CHF", name: "Swiss franc", decimals: 2, step: 1, mode: "nearest", active: true },
  SAR: { code: "SAR", name: "Saudi riyal", decimals: 2, step: 1, mode: "nearest", active: true },
  AED: { code: "AED", name: "UAE dirham", decimals: 2, step: 1, mode: "nearest", active: true },
  QAR: { code: "QAR", name: "Qatari riyal", decimals: 2, step: 1, mode: "nearest", active: true },
  KWD: { code: "KWD", name: "Kuwaiti dinar", decimals: 3, step: 0.05, mode: "up", active: true },
  BHD: { code: "BHD", name: "Bahraini dinar", decimals: 3, step: 0.05, mode: "up", active: true },
  OMR: { code: "OMR", name: "Omani rial", decimals: 3, step: 0.05, mode: "up", active: true },
  EGP: { code: "EGP", name: "Egyptian pound", decimals: 2, step: 1, mode: "nearest", active: true },
};

// Admin rates (ADM-15). Zone → country pairs as the spec states them, plus USD rates for the
// Default zone and for reporting (R03-R1).
const rates = [
  { from: "SAR", to: "AED", rate: 0.98 },
  { from: "SAR", to: "KWD", rate: 0.082 },
  { from: "SAR", to: "QAR", rate: 0.97 },
  { from: "SAR", to: "BHD", rate: 0.1 },
  { from: "SAR", to: "OMR", rate: 0.1026 },
  { from: "EUR", to: "CHF", rate: 0.94 },
  { from: "USD", to: "SAR", rate: 3.75 },
  { from: "USD", to: "EUR", rate: 0.92 },
  { from: "USD", to: "EGP", rate: 48.5 },
  { from: "USD", to: "AED", rate: 3.6725 },
  { from: "USD", to: "KWD", rate: 0.307 },
  { from: "USD", to: "QAR", rate: 3.64 },
  { from: "USD", to: "BHD", rate: 0.376 },
  { from: "USD", to: "OMR", rate: 0.385 },
  { from: "USD", to: "CHF", rate: 0.86 },
];

const zones = [
  { id: "gcc", name: "GCC", currency: "SAR", isDefault: false, active: true },
  { id: "europe", name: "Europe", currency: "EUR", isDefault: false, active: true },
  { id: "egypt", name: "Egypt", currency: "EGP", isDefault: false, active: true },
  { id: "default", name: "Rest of the world", currency: "USD", isDefault: true, active: true },
];

const countries = {
  SA: { name: "Saudi Arabia", zone: "gcc", currency: "SAR" },
  AE: { name: "United Arab Emirates", zone: "gcc", currency: "AED" },
  KW: { name: "Kuwait", zone: "gcc", currency: "KWD" },
  QA: { name: "Qatar", zone: "gcc", currency: "QAR", fixed: { "chat_pro:monthly": 39 } }, // EX-4
  BH: { name: "Bahrain", zone: "gcc", currency: "BHD" },
  OM: { name: "Oman", zone: "gcc", currency: "OMR" },
  EG: { name: "Egypt", zone: "egypt", currency: "EGP" },
  DE: { name: "Germany", zone: "europe", currency: "EUR" },
  FR: { name: "France", zone: "europe", currency: "EUR" },
  IT: { name: "Italy", zone: "europe", currency: "EUR" },
  CH: { name: "Switzerland", zone: "europe", currency: "CHF" },
  BR: { name: "Brazil", zone: "default", currency: "USD" }, // EX-6: no zone price → the plan's default
  US: { name: "United States", zone: "default", currency: "USD" },
};

// Published prices: "<plan>:<cycle>:<zone>" → amount in the zone's currency. Yearly prices left out
// follow ALG-6 (monthly × 12 × (1 − discount)).
const grid = {
  "chat_pro:monthly:gcc": 45, // EX-1…3, 8, 9
  "chat_pro:monthly:europe": 11, // EX-5
  "chat_pro:monthly:egypt": 199, // EX-12
  "chat_starter:monthly:gcc": 10, // EX-10 (per user)
  "chat_starter:monthly:europe": 3,
  "chat_starter:monthly:egypt": 49,
  "tasks_pro:monthly:gcc": 30,
  "tasks_pro:monthly:europe": 8,
  "tasks_pro:monthly:egypt": 129,
  "files_pro:monthly:gcc": 25,
  "files_pro:monthly:europe": 6,
  "files_pro:monthly:egypt": 99,
  "hr_pro:monthly:gcc": 55,
  "hr_pro:monthly:europe": 14,
  "hr_pro:monthly:egypt": 249,
  "crm_pro:monthly:gcc": 65,
  "crm_pro:monthly:europe": 16,
  "crm_pro:monthly:egypt": 299,
  "marketing_pro:monthly:gcc": 40,
  "marketing_pro:monthly:europe": 10,
  "marketing_pro:monthly:egypt": 179,
};

module.exports = { currencies, rates, zones, countries, grid };
