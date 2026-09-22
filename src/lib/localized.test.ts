import { describe, expect, it } from "vitest";

import { isLocalizedText, pickLocalized } from "./localized";

describe("isLocalizedText", () => {
  it("rejects the shapes jsonb can also hand back", () => {
    expect(isLocalizedText(null)).toBe(false);
    expect(isLocalizedText(["bg"])).toBe(false);
    expect(isLocalizedText("Маникюр")).toBe(false);
    expect(isLocalizedText({ bg: "Маникюр" })).toBe(true);
  });
});

describe("pickLocalized", () => {
  const full = { bg: "Маникюр", en: "Manicure", ro: "Manichiură" };

  it("returns the asked-for locale", () => {
    expect(pickLocalized(full, "ro")).toBe("Manichiură");
  });

  it("falls back to Bulgarian before anything else", () => {
    expect(pickLocalized({ bg: "Маникюр", ro: "Manichiură" }, "en")).toBe(
      "Маникюр",
    );
  });

  it("falls back to any populated translation rather than rendering blank", () => {
    expect(pickLocalized({ ro: "Manichiură" }, "en")).toBe("Manichiură");
  });

  it("treats a whitespace-only translation as missing", () => {
    expect(pickLocalized({ en: "   ", bg: "Маникюр" }, "en")).toBe("Маникюр");
  });

  it("accepts a plain string, which older rows still hold", () => {
    expect(pickLocalized("Маникюр", "en")).toBe("Маникюр");
  });

  it("returns the fallback for null, an array or an empty object", () => {
    expect(pickLocalized(null, "bg", "—")).toBe("—");
    expect(pickLocalized([], "bg", "—")).toBe("—");
    expect(pickLocalized({}, "bg", "—")).toBe("—");
  });
});
