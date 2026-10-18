// Static reference catalogs: currencies (with cached USD rates), countries, languages, VAT rates.

// usdRate = units of this currency per 1 USD (null = no cached rate, so not selectable).
const CURRENCY_LIST = [
  ["USD", "US Dollar", "US Dollar", "$", "$", 2, 1, ["US"]],
  ["EUR", "Euro", "Euro", "€", "€", 2, 0.92, ["DE", "FR", "IT", "ES", "NL", "BE", "AT", "IE", "PT", "GR"]],
  ["GBP", "British Pound", "British Pound", "£", "£", 2, 0.79, ["GB"]],
  ["CHF", "Swiss Franc", "Schweizer Franken", "CHF", "CHF", 2, 0.88, ["CH"]],
  ["EGP", "Egyptian Pound", "جنيه مصري", "E£", "ج.م", 2, 48.5, ["EG"]],
  ["SAR", "Saudi Riyal", "ريال سعودي", "SAR", "ر.س", 2, 3.75, ["SA"]],
  ["AED", "UAE Dirham", "درهم إماراتي", "AED", "د.إ", 2, 3.6725, ["AE"]],
  ["QAR", "Qatari Riyal", "ريال قطري", "QAR", "ر.ق", 2, 3.64, ["QA"]],
  ["KWD", "Kuwaiti Dinar", "دينار كويتي", "KWD", "د.ك", 3, 0.307, ["KW"]],
  ["BHD", "Bahraini Dinar", "دينار بحريني", "BHD", "د.ب", 3, 0.376, ["BH"]],
  ["OMR", "Omani Rial", "ريال عماني", "OMR", "ر.ع", 3, 0.385, ["OM"]],
  ["JOD", "Jordanian Dinar", "دينار أردني", "JOD", "د.أ", 3, 0.709, ["JO"]],
  ["MAD", "Moroccan Dirham", "درهم مغربي", "MAD", "د.م", 2, 9.95, ["MA"]],
  ["TND", "Tunisian Dinar", "دينار تونسي", "TND", "د.ت", 3, 3.1, ["TN"]],
  ["TRY", "Turkish Lira", "Türk Lirası", "₺", "₺", 2, 34.2, ["TR"]],
  ["SEK", "Swedish Krona", "Svensk krona", "kr", "kr", 2, 10.4, ["SE"]],
  ["NOK", "Norwegian Krone", "Norsk krone", "kr", "kr", 2, 10.6, ["NO"]],
  ["DKK", "Danish Krone", "Dansk krone", "kr", "kr", 2, 6.86, ["DK"]],
  ["CAD", "Canadian Dollar", "Canadian Dollar", "CA$", "$", 2, 1.36, ["CA"]],
  ["AUD", "Australian Dollar", "Australian Dollar", "A$", "$", 2, 1.49, ["AU"]],
  ["NZD", "New Zealand Dollar", "New Zealand Dollar", "NZ$", "$", 2, 1.63, ["NZ"]],
  ["SGD", "Singapore Dollar", "Singapore Dollar", "S$", "$", 2, 1.3, ["SG"]],
  ["MYR", "Malaysian Ringgit", "Ringgit Malaysia", "RM", "RM", 2, 4.25, ["MY"]],
  ["INR", "Indian Rupee", "भारतीय रुपया", "₹", "₹", 2, 83.6, ["IN"]],
  ["PKR", "Pakistani Rupee", "پاکستانی روپیہ", "Rs", "Rs", 2, 278.4, ["PK"]],
  ["CNY", "Chinese Yuan", "人民币", "CN¥", "¥", 2, 7.12, ["CN"]],
  ["JPY", "Japanese Yen", "日本円", "¥", "¥", 0, 146.5, ["JP"]],
  ["KRW", "South Korean Won", "대한민국 원", "₩", "₩", 0, 1335, ["KR"]],
  ["MXN", "Mexican Peso", "Peso mexicano", "MX$", "$", 2, 18.9, ["MX"]],
  ["BRL", "Brazilian Real", "Real brasileiro", "R$", "R$", 2, 5.45, ["BR"]],
  ["ZAR", "South African Rand", "South African Rand", "R", "R", 2, 17.9, ["ZA"]],
  ["KES", "Kenyan Shilling", "Shilingi ya Kenya", "KSh", "KSh", 2, 129, ["KE"]],
  ["NGN", "Nigerian Naira", "Nigerian Naira", "₦", "₦", 2, null, ["NG"]],
  ["LBP", "Lebanese Pound", "ليرة لبنانية", "LBP", "ل.ل", 2, null, ["LB"]],
];

const RATES_AS_OF = new Date(Date.now() - 2 * 36e5).toISOString();
const CURRENCIES = {};
for (const [code, name, nativeName, symbol, symbolNative, minorUnits, usdRate, countryCodes] of CURRENCY_LIST) {
  CURRENCIES[code] = { code, name, nativeName, symbol, symbolNative, minorUnits, usdRate, countryCodes, rateUpdatedAt: usdRate ? RATES_AS_OF : null };
}

// [code, name, nativeName, currencyCodes, languageCodes]
const COUNTRY_LIST = [
  ["EG", "Egypt", "مصر", ["EGP"], ["ar", "en"]],
  ["SA", "Saudi Arabia", "المملكة العربية السعودية", ["SAR"], ["ar"]],
  ["AE", "United Arab Emirates", "الإمارات العربية المتحدة", ["AED"], ["ar", "en"]],
  ["KW", "Kuwait", "الكويت", ["KWD"], ["ar"]],
  ["QA", "Qatar", "قطر", ["QAR"], ["ar"]],
  ["BH", "Bahrain", "البحرين", ["BHD"], ["ar"]],
  ["OM", "Oman", "عُمان", ["OMR"], ["ar"]],
  ["JO", "Jordan", "الأردن", ["JOD"], ["ar"]],
  ["LB", "Lebanon", "لبنان", ["LBP", "USD"], ["ar", "fr"]],
  ["MA", "Morocco", "المغرب", ["MAD"], ["ar", "fr"]],
  ["TN", "Tunisia", "تونس", ["TND"], ["ar", "fr"]],
  ["DE", "Germany", "Deutschland", ["EUR"], ["de"]],
  ["FR", "France", "France", ["EUR"], ["fr"]],
  ["IT", "Italy", "Italia", ["EUR"], ["it"]],
  ["ES", "Spain", "España", ["EUR"], ["es"]],
  ["NL", "Netherlands", "Nederland", ["EUR"], ["nl"]],
  ["BE", "Belgium", "België", ["EUR"], ["nl", "fr", "de"]],
  ["AT", "Austria", "Österreich", ["EUR"], ["de"]],
  ["CH", "Switzerland", "Schweiz", ["CHF", "EUR"], ["de", "fr", "it"]],
  ["IE", "Ireland", "Éire", ["EUR"], ["en"]],
  ["PT", "Portugal", "Portugal", ["EUR"], ["pt"]],
  ["GR", "Greece", "Ελλάδα", ["EUR"], ["el"]],
  ["SE", "Sweden", "Sverige", ["SEK"], ["sv"]],
  ["NO", "Norway", "Norge", ["NOK"], ["no"]],
  ["DK", "Denmark", "Danmark", ["DKK"], ["da"]],
  ["GB", "United Kingdom", "United Kingdom", ["GBP"], ["en"]],
  ["TR", "Turkey", "Türkiye", ["TRY"], ["tr"]],
  ["US", "United States", "United States", ["USD"], ["en"]],
  ["CA", "Canada", "Canada", ["CAD"], ["en", "fr"]],
  ["MX", "Mexico", "México", ["MXN"], ["es"]],
  ["BR", "Brazil", "Brasil", ["BRL"], ["pt"]],
  ["IN", "India", "भारत", ["INR"], ["hi", "en"]],
  ["PK", "Pakistan", "پاکستان", ["PKR"], ["ur", "en"]],
  ["CN", "China", "中国", ["CNY"], ["zh"]],
  ["JP", "Japan", "日本", ["JPY"], ["ja"]],
  ["KR", "South Korea", "대한민국", ["KRW"], ["ko"]],
  ["SG", "Singapore", "Singapore", ["SGD"], ["en"]],
  ["MY", "Malaysia", "Malaysia", ["MYR"], ["ms"]],
  ["AU", "Australia", "Australia", ["AUD"], ["en"]],
  ["NZ", "New Zealand", "New Zealand", ["NZD"], ["en"]],
  ["ZA", "South Africa", "South Africa", ["ZAR"], ["en"]],
  ["NG", "Nigeria", "Nigeria", ["NGN"], ["en"]],
  ["KE", "Kenya", "Kenya", ["KES"], ["en", "sw"]],
];
const COUNTRIES = COUNTRY_LIST.map(([code, name, nativeName, currencyCodes, languageCodes]) => ({ code, name, nativeName, currencyCodes, languageCodes }));
const countryByCode = (code) => COUNTRIES.find((c) => c.code === String(code || "").toUpperCase());

const LANGUAGES = [
  ["en", "English", "English", "ltr"],
  ["ar", "Arabic", "العربية", "rtl"],
  ["de", "German", "Deutsch", "ltr"],
  ["fr", "French", "Français", "ltr"],
  ["it", "Italian", "Italiano", "ltr"],
  ["es", "Spanish", "Español", "ltr"],
  ["pt", "Portuguese", "Português", "ltr"],
  ["nl", "Dutch", "Nederlands", "ltr"],
  ["tr", "Turkish", "Türkçe", "ltr"],
  ["el", "Greek", "Ελληνικά", "ltr"],
  ["sv", "Swedish", "Svenska", "ltr"],
  ["hi", "Hindi", "हिन्दी", "ltr"],
  ["ur", "Urdu", "اردو", "rtl"],
  ["zh", "Chinese", "中文", "ltr"],
  ["ja", "Japanese", "日本語", "ltr"],
  ["ko", "Korean", "한국어", "ltr"],
].map(([code, name, nativeName, direction]) => ({ code, name, nativeName, direction }));
const languageByCode = (code) => LANGUAGES.find((l) => l.code === code);

const VAT_COUNTRIES = [
  ["EG", "Egypt", 14], ["SA", "Saudi Arabia", 15], ["AE", "United Arab Emirates", 5], ["KW", "Kuwait", 0],
  ["QA", "Qatar", 0], ["BH", "Bahrain", 10], ["OM", "Oman", 5], ["JO", "Jordan", 16],
  ["CH", "Switzerland", 8.1], ["DE", "Germany", 19], ["FR", "France", 20], ["IT", "Italy", 22],
  ["ES", "Spain", 21], ["NL", "Netherlands", 21], ["AT", "Austria", 20], ["BE", "Belgium", 21],
  ["GB", "United Kingdom", 20], ["TR", "Turkey", 20], ["US", "United States", 0], ["CA", "Canada", 5],
].map(([code, name, vatRate]) => ({ code, name, vatRate }));
const vatRateOf = (code) => VAT_COUNTRIES.find((v) => v.code === String(code || "").toUpperCase())?.vatRate ?? 0;

module.exports = { CURRENCIES, RATES_AS_OF, COUNTRIES, countryByCode, LANGUAGES, languageByCode, VAT_COUNTRIES, vatRateOf };
