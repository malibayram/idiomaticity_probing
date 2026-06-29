import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import en from "./locales/en.json";
import tr from "./locales/tr.json";

const STORAGE_KEY = "studio-language";
const USER_SET_KEY = "studio-language-user-set";
const PREFERENCE_VERSION_KEY = "studio-language-preference-version";
export const LANGUAGE_PREFERENCE_VERSION = "2";

type Language = "en" | "tr";
type LanguageStorage = Pick<Storage, "getItem">;

/**
 * Deterministic initial language. An explicit user selection (EN/TR switcher)
 * wins; otherwise the default is English unless the browser's PRIMARY language
 * is Turkish. Secondary navigator languages (e.g. a Turkish region on an English
 * UI) never force Turkish - this is the "browser-first, default English" rule.
 */
export function detectInitialLanguage(
  storage: LanguageStorage | null,
  browserLanguage: string,
): Language {
  const hasCurrentPreference = storage?.getItem(PREFERENCE_VERSION_KEY) === LANGUAGE_PREFERENCE_VERSION;
  if (hasCurrentPreference && storage?.getItem(USER_SET_KEY) === "1") {
    const saved = storage.getItem(STORAGE_KEY);
    if (saved === "en" || saved === "tr") return saved;
  }
  if (browserLanguage.toLowerCase().startsWith("tr")) {
    return "tr";
  }
  return "en";
}

const initialLanguage = detectInitialLanguage(
  typeof window !== "undefined" ? window.localStorage : null,
  typeof window !== "undefined" ? window.navigator.language || "" : "",
);

/** Persist an explicit user choice from the EN/TR switcher. */
export function setUserLanguage(language: "en" | "tr"): void {
  if (typeof window !== "undefined") {
    window.localStorage.setItem(PREFERENCE_VERSION_KEY, LANGUAGE_PREFERENCE_VERSION);
    window.localStorage.setItem(USER_SET_KEY, "1");
    window.localStorage.setItem(STORAGE_KEY, language);
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
    lng: initialLanguage,
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
