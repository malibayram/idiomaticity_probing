import { describe, expect, test } from "vitest";
import {
  detectInitialLanguage,
  LANGUAGE_PREFERENCE_VERSION,
} from "../src/i18n";

function storage(values: Record<string, string>) {
  return {
    getItem(key: string) {
      return values[key] ?? null;
    },
  };
}

describe("initial language detection", () => {
  test("uses English for an English browser without a user preference", () => {
    expect(detectInitialLanguage(storage({}), "en-US")).toBe("en");
  });

  test("uses Turkish for a Turkish browser without a user preference", () => {
    expect(detectInitialLanguage(storage({}), "tr-TR")).toBe("tr");
  });

  test("ignores a stale Turkish preference from the previous preference schema", () => {
    expect(detectInitialLanguage(storage({
      "studio-language-user-set": "1",
      "studio-language": "tr",
    }), "en-GB")).toBe("en");
  });

  test("keeps an explicit preference written by the current schema", () => {
    expect(detectInitialLanguage(storage({
      "studio-language-preference-version": LANGUAGE_PREFERENCE_VERSION,
      "studio-language-user-set": "1",
      "studio-language": "tr",
    }), "en-US")).toBe("tr");
  });
});
