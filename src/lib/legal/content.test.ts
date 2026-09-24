import { describe, expect, it } from "vitest";

import bg from "../../../messages/legal/bg.json";
import en from "../../../messages/legal/en.json";
import ro from "../../../messages/legal/ro.json";

type Section = { id: string; body: string[]; list?: string[] };
type Content = { meta: Record<string, string>; docs: Record<string, { sections: Section[] }> };

/** Every translation must say the same things in the same places. */
function shape(content: Content) {
  return {
    meta: Object.keys(content.meta).sort(),
    docs: Object.fromEntries(
      Object.entries(content.docs).map(([doc, value]) => [
        doc,
        value.sections.map((section) => [section.id, section.body.length, section.list?.length ?? 0]),
      ]),
    ),
  };
}

function placeholders(content: Content) {
  return [...JSON.stringify(content).matchAll(/\{(\w+)\}/g)].map((match) => match[1]).sort();
}

describe("legal texts", () => {
  it("have the same structure in every language", () => {
    expect(shape(en as Content)).toEqual(shape(bg as Content));
    expect(shape(ro as Content)).toEqual(shape(bg as Content));
  });

  it("use the same placeholders in every language", () => {
    expect(placeholders(en as Content)).toEqual(placeholders(bg as Content));
    expect(placeholders(ro as Content)).toEqual(placeholders(bg as Content));
  });
});
