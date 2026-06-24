import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import en from "./locales/en.json";
import tr from "./locales/tr.json";

const STORAGE_KEY = "studio-language";
const USER_SET_KEY = "studio-language-user-set";

/**
 * Deterministic initial language. An explicit user selection (EN/TR switcher)
 * wins; otherwise the default is English unless the browser's PRIMARY language
 * is Turkish. Secondary navigator languages (e.g. a Turkish region on an English
 * UI) never force Turkish — this is the "browser-first, default English" rule.
 */
function detectInitialLanguage(): "en" | "tr" {
  if (typeof localStorage !== "undefined" && localStorage.getItem(USER_SET_KEY) === "1") {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === "en" || saved === "tr") return saved;
  }
  if (typeof navigator !== "undefined" && (navigator.language || "").toLowerCase().startsWith("tr")) {
    return "tr";
  }
  return "en";
}

/** Persist an explicit user choice from the EN/TR switcher. */
export function setUserLanguage(language: "en" | "tr"): void {
  if (typeof localStorage !== "undefined") {
    localStorage.setItem(USER_SET_KEY, "1");
    localStorage.setItem(STORAGE_KEY, language);
  }
  void i18n.changeLanguage(language);
}

void i18n
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: en },
      tr: { translation: tr },
    },
    lng: detectInitialLanguage(),
    fallbackLng: "en",
    supportedLngs: ["en", "tr"],
    interpolation: { escapeValue: false },
  });

i18n.on("languageChanged", (lng) => {
  if (typeof document !== "undefined") {
    document.documentElement.lang = lng.startsWith("tr") ? "tr" : "en";
  }
});

if (typeof document !== "undefined") {
  document.documentElement.lang = i18n.language.startsWith("tr") ? "tr" : "en";
}

export default i18n;

/** Translate outside React components (data layer, etc.). */
export function tx(key: string, params?: Record<string, unknown>): string {
  return i18n.t(key, params);
}

export function appLocale(language = i18n.language): string {
  return language.startsWith("tr") ? "tr-TR" : "en-US";
}
