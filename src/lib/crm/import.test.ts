import { describe, expect, it } from "vitest";

import {
  cleanImportRow,
  detectMapping,
  emptyContacts,
  isKnownContact,
  normalizeEmail,
  normalizePhone,
  parseDelimited,
  phoneKey,
  prepareImport,
  rememberContact,
} from "./import";

describe("parseDelimited", () => {
  it("reads a plain comma file", () => {
    const table = parseDelimited("Name,Phone\nAnna,0888123456\nBoris,0899111222\n");
    expect(table.delimiter).toBe(",");
    expect(table.headers).toEqual(["Name", "Phone"]);
    expect(table.rows).toEqual([
      ["Anna", "0888123456"],
      ["Boris", "0899111222"],
    ]);
  });

  it("detects the semicolons a Bulgarian Excel writes", () => {
    const table = parseDelimited("Име;Телефон\r\nАнна;0888 123 456\r\n");
    expect(table.delimiter).toBe(";");
    expect(table.rows).toEqual([["Анна", "0888 123 456"]]);
  });

  it("keeps a comma inside quotes and unescapes doubled quotes", () => {
    const table = parseDelimited('Name,Notes\n"Иванов, Иван","казва ""Ваня"""\n');
    expect(table.rows).toEqual([["Иванов, Иван", 'казва "Ваня"']]);
  });

  it("keeps a line break inside a quoted cell", () => {
    const table = parseDelimited('Name,Notes\nAnna,"first line\nsecond line"\n');
    expect(table.rows).toEqual([["Anna", "first line\nsecond line"]]);
  });

  it("strips a byte-order mark and skips blank lines", () => {
    const table = parseDelimited("﻿Name,Email\n\nAnna,a@b.co\n,\n");
    expect(table.headers).toEqual(["Name", "Email"]);
    expect(table.rows).toEqual([["Anna", "a@b.co"]]);
  });

  it("reads tab-separated files", () => {
    const table = parseDelimited("Name\tPhone\nAnna\t0888123456");
    expect(table.delimiter).toBe("\t");
    expect(table.rows).toEqual([["Anna", "0888123456"]]);
  });

  it("returns nothing for an empty file", () => {
    expect(parseDelimited("")).toMatchObject({ headers: [], rows: [] });
  });
});

describe("detectMapping", () => {
  it("recognises Bulgarian headers", () => {
    expect(detectMapping(["Име и фамилия", "Телефон", "Имейл", "Бележки"])).toEqual({
      name: 0,
      phone: 1,
      email: 2,
      notes: 3,
    });
  });

  it("does not read 'Имейл' as a name even though it starts with 'име'", () => {
    const mapping = detectMapping(["Имейл", "Име", "Фамилия"]);
    expect(mapping).toEqual({ email: 0, name: 1, lastName: 2 });
  });

  it("recognises English headers and separate first and last names", () => {
    expect(detectMapping(["First name", "Last name", "Mobile", "E-mail", "Notes"])).toEqual({
      name: 0,
      lastName: 1,
      phone: 2,
      email: 3,
      notes: 4,
    });
  });

  it("recognises Romanian headers", () => {
    expect(detectMapping(["Prenume", "Nume", "Telefon", "Email"])).toEqual({
      name: 0,
      lastName: 1,
      phone: 2,
      email: 3,
    });
  });

  it("leaves fields it cannot find unmapped", () => {
    expect(detectMapping(["Foo", "Bar"])).toEqual({});
  });
});

describe("normalizePhone", () => {
  it("strips spaces and punctuation but keeps a leading plus", () => {
    expect(normalizePhone("+359 (88) 123-4567")).toBe("+359881234567");
  });

  it("reads 00 as plus", () => {
    expect(normalizePhone("00359881234567")).toBe("+359881234567");
  });

  it("does not invent a country for a local number", () => {
    expect(normalizePhone("0888 123 456")).toBe("0888123456");
  });

  it("rejects what cannot be a phone number", () => {
    expect(normalizePhone("12")).toBeNull();
    expect(normalizePhone("n/a")).toBeNull();
    expect(normalizePhone("1".repeat(16))).toBeNull();
    expect(normalizePhone("")).toBeNull();
  });
});

describe("phoneKey", () => {
  it("matches the same number written with and without the country code", () => {
    expect(phoneKey("+359881234567")).toBe(phoneKey("0881234567"));
  });
});

describe("normalizeEmail", () => {
  it("lowercases and trims", () => {
    expect(normalizeEmail("  Anna@Example.COM ")).toBe("anna@example.com");
  });

  it("rejects what is not an address", () => {
    expect(normalizeEmail("anna@")).toBeNull();
    expect(normalizeEmail("anna example.com")).toBeNull();
    expect(normalizeEmail("")).toBeNull();
  });
});

describe("cleanImportRow", () => {
  it("joins first and last name", () => {
    expect(cleanImportRow({ name: "Анна", lastName: "Петрова" })?.fullName).toBe("Анна Петрова");
  });

  it("keeps a row that has a name but a broken email", () => {
    const row = cleanImportRow({ name: "Анна", email: "not-an-email" });
    expect(row).toEqual({ fullName: "Анна", email: "", phone: "", notes: "" });
  });

  it("drops a row with nothing to identify the person by", () => {
    expect(cleanImportRow({ notes: "VIP", email: "nope" })).toBeNull();
    expect(cleanImportRow({})).toBeNull();
  });

  it("accepts a phone alone", () => {
    expect(cleanImportRow({ phone: "0888 123 456" })?.phone).toBe("0888123456");
  });

  it("caps the lengths the database would otherwise reject", () => {
    const row = cleanImportRow({ name: "x".repeat(500), notes: "y".repeat(9000) });
    expect(row?.fullName).toHaveLength(120);
    expect(row?.notes).toHaveLength(4000);
  });
});

describe("known contacts", () => {
  it("recognises the same person by email, by phone in another spelling, or by bare name", () => {
    const known = emptyContacts();
    rememberContact(known, { fullName: "Анна", email: "Anna@Example.com", phone: null });
    rememberContact(known, { fullName: "Борис", email: null, phone: "+359 88 111 2222" });
    rememberContact(known, { fullName: "Вера Николова", email: null, phone: null });

    expect(isKnownContact(known, { fullName: "x", email: "anna@example.com", phone: "", notes: "" })).toBe(true);
    expect(isKnownContact(known, { fullName: "x", email: "", phone: "0881112222", notes: "" })).toBe(true);
    expect(isKnownContact(known, { fullName: "вера николова", email: "", phone: "", notes: "" })).toBe(true);
    expect(isKnownContact(known, { fullName: "Гергана", email: "g@example.com", phone: "", notes: "" })).toBe(false);
  });

  it("does not treat a name as a match when the row has a phone of its own", () => {
    const known = emptyContacts();
    rememberContact(known, { fullName: "Анна", email: null, phone: null });
    expect(isKnownContact(known, { fullName: "Анна", email: "", phone: "0888123456", notes: "" })).toBe(false);
  });
});

describe("prepareImport", () => {
  it("counts clean, invalid and repeated rows separately", () => {
    const table = parseDelimited(
      [
        "Име;Телефон;Имейл",
        "Анна;0888 123 456;anna@example.com",
        "Анна Петрова;+359 88 812 3456;",
        ";;",
        ";;нещо",
        "Борис;;",
        "Борис;;",
      ].join("\n"),
    );
    const prepared = prepareImport(table, detectMapping(table.headers));
    expect(prepared.rows.map((row) => row.fullName)).toEqual(["Анна", "Борис"]);
    // "Анна Петрова" has the same phone as "Анна", the second Борис repeats the first.
    expect(prepared.repeated).toBe(2);
    // ";;нещо" has no name, phone or email in a mapped column.
    expect(prepared.invalid).toBe(1);
  });
});
