/**
 * Bringing a client list from somewhere else - another booking platform, a
 * spreadsheet, a paper diary typed up - into the CRM.
 *
 * Pure functions only, shared by the browser (to preview a file before it goes
 * anywhere) and the server action (which trusts nothing the browser sends and
 * runs the same cleaning again). That is why this has no `server-only` and no
 * imports.
 */

export const IMPORT_MAX_ROWS = 5000;
/** One request; the browser sends a larger file in several of these. */
export const IMPORT_CHUNK_SIZE = 500;

export type ImportField = "name" | "lastName" | "phone" | "email" | "notes";
export const IMPORT_FIELDS: readonly ImportField[] = [
  "name",
  "lastName",
  "phone",
  "email",
  "notes",
];

/** Column index per field; a field that is absent is simply not imported. */
export type ColumnMapping = Partial<Record<ImportField, number>>;

export type ParsedTable = {
  headers: string[];
  rows: string[][];
  delimiter: "," | ";" | "\t";
};

export type ImportRow = {
  fullName: string;
  email: string;
  phone: string;
  notes: string;
};

// ------------------------------------------------------------------ parsing

function detectDelimiter(firstLine: string): ParsedTable["delimiter"] {
  // Bulgarian and Romanian Excel save "CSV" with semicolons, because the comma
  // is their decimal separator; everything else uses commas. Count outside
  // quotes so a name like "Иванов, Иван" does not decide it.
  const counts = { ",": 0, ";": 0, "\t": 0 };
  let quoted = false;
  for (const char of firstLine) {
    if (char === '"') quoted = !quoted;
    else if (!quoted && char in counts) counts[char as keyof typeof counts] += 1;
  }
  if (counts["\t"] > 0 && counts["\t"] >= counts[";"] && counts["\t"] >= counts[","]) return "\t";
  return counts[";"] > counts[","] ? ";" : ",";
}

/** RFC 4180 with the two liberties real exports take: any line ending, any delimiter. */
export function parseDelimited(input: string): ParsedTable {
  const text = input.replace(/^﻿/, "");
  const firstLine = text.split(/\r\n|\n|\r/, 1)[0] ?? "";
  const delimiter = detectDelimiter(firstLine);

  const records: string[][] = [];
  let record: string[] = [];
  let field = "";
  let quoted = false;

  const endField = () => {
    record.push(field);
    field = "";
  };
  const endRecord = () => {
    endField();
    // A line with nothing in it is a blank line, not a client.
    if (record.some((cell) => cell.trim() !== "")) records.push(record);
    record = [];
  };

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    if (quoted) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 1;
        } else {
          quoted = false;
        }
      } else {
        field += char;
      }
    } else if (char === '"' && field === "") {
      quoted = true;
    } else if (char === delimiter) {
      endField();
    } else if (char === "\r" || char === "\n") {
      if (char === "\r" && text[i + 1] === "\n") i += 1;
      endRecord();
    } else {
      field += char;
    }
  }
  if (field !== "" || record.length > 0) endRecord();

  const [headers = [], ...rows] = records;
  return { headers: headers.map((cell) => cell.trim()), rows, delimiter };
}

// ---------------------------------------------------------- column detection

// Romanian diacritics folded by hand. Unicode decomposition (NFD) would be
// shorter, but it also splits the Cyrillic "й" into "и" plus a breve, and
// stripping the breve turns "имейл" into "имеил" - which is how the first
// version failed to find the email column in every Bulgarian file.
const LATIN_FOLD: Record<string, string> = {
  ă: "a",
  â: "a",
  î: "i",
  ș: "s",
  ş: "s",
  ț: "t",
  ţ: "t",
};

function normalizeHeader(header: string) {
  return header
    .toLowerCase()
    .replace(/[ăâîșşțţ]/g, (char) => LATIN_FOLD[char] ?? char)
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

// Bulgarian, English and Romanian, plus the Latin transliteration people use
// in spreadsheet headers. First match wins; order below matters ("name" is the
// loosest and goes last, so "last name" is claimed before it).
const HEADER_PATTERNS: Array<[ImportField, RegExp]> = [
  ["email", /(e ?mail|имейл|емейл|електронна поща|поща|adresa de email)/],
  ["phone", /(phone|mobile|\bgsm\b|\btel\b|telefon|телефон|мобилен|мобилни|gsm|номер|nr tel|cell)/],
  ["notes", /(note|notes|comment|remark|бележк|коментар|забележк|observatii|mentiuni|notite)/],
  ["lastName", /(last name|surname|family name|фамилия|фамилно|nume de familie|familiya|^nume$)/],
  ["name", /(full name|^name$|first name|client|customer|клиент|^име|име и фамилия|prenume|^ime|nume)/],
];

export function detectMapping(headers: string[]): ColumnMapping {
  const mapping: ColumnMapping = {};
  const used = new Set<number>();

  // A header that holds both names in one cell must not be read as a bare
  // first name followed by a missing surname.
  const fullNameColumn = headers.findIndex((header) =>
    /(име и фамилия|full name|ime i familiya|nume si prenume|nume complet)/.test(
      normalizeHeader(header),
    ),
  );
  if (fullNameColumn >= 0) {
    mapping.name = fullNameColumn;
    used.add(fullNameColumn);
  }

  for (const [field, pattern] of HEADER_PATTERNS) {
    if (mapping[field] !== undefined) continue;
    const index = headers.findIndex(
      (header, column) => !used.has(column) && pattern.test(normalizeHeader(header)),
    );
    if (index >= 0) {
      mapping[field] = index;
      used.add(index);
    }
  }
  return mapping;
}

// ------------------------------------------------------------- normalizing

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function normalizeEmail(raw: string | undefined | null): string | null {
  const value = (raw ?? "").trim().toLowerCase();
  return value.length <= 254 && EMAIL_PATTERN.test(value) ? value : null;
}

/**
 * Digits, with a leading "+" kept. "00359…" is how a landline number is
 * dialled abroad and means the same as "+359…". Nothing is guessed about the
 * country: a bare "0888…" stays as typed, because we do not know whose it is.
 */
export function normalizePhone(raw: string | undefined | null): string | null {
  let value = (raw ?? "").trim();
  if (!value) return null;
  const plus = value.startsWith("+") || value.startsWith("00");
  value = value.replace(/^\+|^00/, "").replace(/\D/g, "");
  if (value.length < 6 || value.length > 15) return null;
  return plus ? `+${value}` : value;
}

/**
 * What makes two phone numbers the same person: the last nine digits, so
 * "+359 88 123 4567" and "088 123 4567" match. Short enough to ignore the
 * country code, long enough that two people rarely share it.
 */
export function phoneKey(phone: string) {
  const digits = phone.replace(/\D/g, "");
  return digits.slice(-9);
}

function collapse(value: string | undefined, max: number) {
  return (value ?? "").replace(/\s+/g, " ").trim().slice(0, max);
}

/** One clean row, or null when there is nothing to identify the person by. */
export function cleanImportRow(fields: {
  name?: string;
  lastName?: string;
  phone?: string;
  email?: string;
  notes?: string;
}): ImportRow | null {
  const fullName = collapse([fields.name, fields.lastName].filter(Boolean).join(" "), 120);
  const email = normalizeEmail(fields.email) ?? "";
  const phone = normalizePhone(fields.phone) ?? "";
  if (!fullName && !email && !phone) return null;
  return {
    fullName,
    email,
    phone,
    notes: (fields.notes ?? "").trim().slice(0, 4000),
  };
}

// -------------------------------------------------------------- dedupe

export type KnownContacts = {
  emails: Set<string>;
  phones: Set<string>;
  /** Names of people we hold no email or phone for - the only way to tell them apart. */
  names: Set<string>;
};

export function emptyContacts(): KnownContacts {
  return { emails: new Set(), phones: new Set(), names: new Set() };
}

/** Record a person we already hold, so a later row for them is recognised. */
export function rememberContact(
  known: KnownContacts,
  row: { fullName?: string | null; email?: string | null; phone?: string | null },
) {
  const email = normalizeEmail(row.email);
  const phone = normalizePhone(row.phone);
  if (email) known.emails.add(email);
  if (phone) known.phones.add(phoneKey(phone));
  if (!email && !phone && row.fullName?.trim()) {
    known.names.add(row.fullName.trim().toLowerCase());
  }
}

export function isKnownContact(known: KnownContacts, row: ImportRow) {
  if (row.email && known.emails.has(row.email)) return true;
  if (row.phone && known.phones.has(phoneKey(row.phone))) return true;
  return !row.email && !row.phone && known.names.has(row.fullName.toLowerCase());
}

export type PreparedImport = {
  /** Clean, and not repeated earlier in the same file. */
  rows: ImportRow[];
  /** Rows with nothing to identify a person by. */
  invalid: number;
  /** Rows that repeat an earlier row in the same file. */
  repeated: number;
};

export function prepareImport(table: ParsedTable, mapping: ColumnMapping): PreparedImport {
  const cell = (row: string[], field: ImportField) => {
    const column = mapping[field];
    return column === undefined ? undefined : row[column];
  };

  const seen = emptyContacts();
  const rows: ImportRow[] = [];
  let invalid = 0;
  let repeated = 0;

  for (const raw of table.rows) {
    const cleaned = cleanImportRow({
      name: cell(raw, "name"),
      lastName: cell(raw, "lastName"),
      phone: cell(raw, "phone"),
      email: cell(raw, "email"),
      notes: cell(raw, "notes"),
    });
    if (!cleaned) {
      invalid += 1;
    } else if (isKnownContact(seen, cleaned)) {
      repeated += 1;
    } else {
      rememberContact(seen, cleaned);
      rows.push(cleaned);
    }
  }
  return { rows, invalid, repeated };
}
