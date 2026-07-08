import { useSettings, type Language } from "./settings";

type Dict = Record<string, { en: string; hi: string }>;

const dict: Dict = {
  "app.name": { en: "Church Companion", hi: "चर्च कंपैनियन" },
  "nav.home": { en: "Home", hi: "होम" },
  "nav.search": { en: "Search", hi: "खोज" },
  "nav.bookmarks": { en: "Bookmarks", hi: "बुकमार्क" },
  "nav.settings": { en: "Settings", hi: "सेटिंग्स" },
  "nav.almanac": { en: "Almanac", hi: "पंचांग" },
  "nav.admin": { en: "Admin", hi: "एडमिन" },
  "home.today": { en: "Today's Songs", hi: "आज के गीत" },
  "home.no_today": { en: "No songs selected today", hi: "आज कोई गीत चयनित नहीं" },
  "home.books": { en: "Books", hi: "पुस्तकें" },
  "home.greeting": { en: "Peace be with you", hi: "शांति आप पर हो" },
  "song.number": { en: "Song #", hi: "गीत #" },
  "song.search_ph": { en: "Search by number, title or lyrics", hi: "नंबर, शीर्षक या बोल खोजें" },
  "common.search_ph": { en: "Search everything", hi: "सब कुछ खोजें" },
  "common.copy": { en: "Copy", hi: "कॉपी" },
  "common.copied": { en: "Copied", hi: "कॉपी हुआ" },
  "common.share": { en: "Share", hi: "शेयर" },
  "common.favorite": { en: "Favorite", hi: "पसंदीदा" },
  "common.bookmark": { en: "Bookmark", hi: "बुकमार्क" },
  "common.remove": { en: "Remove", hi: "हटाएँ" },
  "common.open": { en: "Open", hi: "खोलें" },
  "common.back": { en: "Back", hi: "वापस" },
  "common.save": { en: "Save", hi: "सहेजें" },
  "common.cancel": { en: "Cancel", hi: "रद्द करें" },
  "common.loading": { en: "Loading…", hi: "लोड हो रहा है…" },
  "common.empty": { en: "Nothing here yet", hi: "अभी कुछ नहीं" },
  "settings.font_size": { en: "Font size", hi: "फ़ॉन्ट आकार" },
  "settings.theme": { en: "Theme", hi: "थीम" },
  "settings.accent": { en: "Accent color", hi: "एक्सेंट रंग" },
  "settings.language": { en: "Language", hi: "भाषा" },
  "settings.light": { en: "Light", hi: "लाइट" },
  "settings.dark": { en: "Dark", hi: "डार्क" },
  "settings.system": { en: "System", hi: "सिस्टम" },
  "fs.s": { en: "Small", hi: "छोटा" },
  "fs.m": { en: "Medium", hi: "मध्यम" },
  "fs.l": { en: "Large", hi: "बड़ा" },
  "fs.xl": { en: "X-Large", hi: "बहुत बड़ा" },
  "admin.title": { en: "Admin", hi: "एडमिन" },
  "admin.super_login": { en: "Super Admin", hi: "सुपर एडमिन" },
  "admin.admin_login": { en: "Admin", hi: "एडमिन" },
  "admin.email": { en: "Email", hi: "ईमेल" },
  "admin.password": { en: "Password", hi: "पासवर्ड" },
  "admin.sign_in": { en: "Sign in", hi: "साइन इन" },
  "admin.sign_up": { en: "Create account", hi: "अकाउंट बनाएँ" },
  "admin.request": { en: "Request admin access", hi: "एडमिन एक्सेस का अनुरोध करें" },
  "admin.request_reason": { en: "Why should you be an admin?", hi: "आप एडमिन क्यों बनना चाहते हैं?" },
  "admin.request_submit": { en: "Submit request", hi: "अनुरोध भेजें" },
  "admin.dashboard": { en: "Dashboard", hi: "डैशबोर्ड" },
  "admin.upload": { en: "Upload", hi: "अपलोड" },
  "admin.today_pick": { en: "Today's Songs", hi: "आज के गीत" },
  "admin.requests": { en: "Requests", hi: "अनुरोध" },
  "admin.sign_out": { en: "Sign out", hi: "साइन आउट" },
  "admin.approve": { en: "Approve", hi: "स्वीकारें" },
  "admin.reject": { en: "Reject", hi: "अस्वीकारें" },
  "admin.publish": { en: "Publish", hi: "प्रकाशित करें" },
  "upload.choose": { en: "Choose PDF, DOCX or TXT", hi: "PDF, DOCX या TXT चुनें" },
  "upload.parsing": { en: "Parsing…", hi: "पार्स हो रहा है…" },
  "upload.target_book": { en: "Target book", hi: "लक्षित पुस्तक" },
  "upload.title": { en: "Title (Hindi)", hi: "शीर्षक (हिन्दी)" },
  "upload.title_en": { en: "Title (English, optional)", hi: "शीर्षक (अंग्रेज़ी, वैकल्पिक)" },
  "upload.number": { en: "Number (optional)", hi: "नंबर (वैकल्पिक)" },
  "upload.body": { en: "Body", hi: "मुख्य पाठ" },
  "upload.publish": { en: "Publish to library", hi: "लाइब्रेरी में प्रकाशित करें" },
  "upload.song": { en: "As a song", hi: "गीत के रूप में" },
  "upload.section": { en: "As book section", hi: "पुस्तक खंड के रूप में" },
};

export function useT() {
  const { language } = useSettings();
  const t = (key: string, fallback?: string) => {
    const entry = dict[key];
    if (!entry) return fallback ?? key;
    return entry[language] || entry.en;
  };
  return { t, language };
}

export function pickLang<T extends string | null | undefined>(en: T, hi: T, lang: Language): T {
  if (lang === "hi") return (hi ?? en) as T;
  return (en ?? hi) as T;
}
