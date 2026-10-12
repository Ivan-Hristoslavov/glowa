"use client";

import { CheckCircle2, FileUp, Loader2, Upload } from "lucide-react";
import { useTranslations } from "next-intl";
import { useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useRouter } from "@/i18n/navigation";
import { importBusinessClients } from "@/lib/actions/crm-import";
import {
  IMPORT_CHUNK_SIZE,
  IMPORT_FIELDS,
  IMPORT_MAX_ROWS,
  detectMapping,
  parseDelimited,
  prepareImport,
  type ColumnMapping,
  type ImportField,
  type ParsedTable,
} from "@/lib/crm/import";
import { cn } from "@/lib/utils";

const MAX_FILE_BYTES = 5 * 1024 * 1024;
const NONE = "none";

/**
 * Excel on a Bulgarian or Romanian Windows saves "CSV" in the legacy
 * Windows-1251 / 1250 code page unless the person picks "CSV UTF-8". Reading
 * that as UTF-8 turns every name into question marks, and the salon would
 * import a client list it cannot read. So: try UTF-8 strictly, and fall back.
 */
async function readFileText(file: File) {
  const bytes = await file.arrayBuffer();
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    return new TextDecoder("windows-1251").decode(bytes);
  }
}

type Outcome = { imported: number; skipped: number; invalid: number };

/**
 * Bring a client list from another system. A salon's clients are the one thing
 * that keeps it on a platform it is unhappy with, so getting them out of
 * there and into here is a feature, not an afterthought.
 *
 * Nothing leaves the browser until "Import" is pressed: the file is parsed
 * and previewed locally, and the person can correct which column is which.
 */
export function ClientImport({
  businessId,
  variant = "outline",
}: {
  businessId: string;
  variant?: "outline" | "default";
}) {
  const t = useTranslations("admin.clients.import");
  const common = useTranslations("common");
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);

  const [open, setOpen] = useState(false);
  const [table, setTable] = useState<ParsedTable | null>(null);
  const [fileName, setFileName] = useState("");
  const [mapping, setMapping] = useState<ColumnMapping>({});
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [dragging, setDragging] = useState(false);

  const prepared = useMemo(
    () => (table ? prepareImport(table, mapping) : null),
    [table, mapping],
  );
  const hasIdentity =
    mapping.name !== undefined || mapping.phone !== undefined || mapping.email !== undefined;

  function reset() {
    setTable(null);
    setFileName("");
    setMapping({});
    setConfirmed(false);
    setBusy(false);
    setProgress(0);
    setOutcome(null);
    if (inputRef.current) inputRef.current.value = "";
  }

  async function load(file: File | undefined) {
    if (!file) return;
    if (file.size > MAX_FILE_BYTES) {
      toast.error(t("errors.tooBig"));
      return;
    }
    try {
      const parsed = parseDelimited(await readFileText(file));
      if (parsed.headers.length === 0 || parsed.rows.length === 0) {
        toast.error(t("errors.empty"));
        return;
      }
      if (parsed.rows.length > IMPORT_MAX_ROWS) {
        toast.error(t("errors.tooMany", { max: IMPORT_MAX_ROWS }));
        return;
      }
      setTable(parsed);
      setFileName(file.name);
      setMapping(detectMapping(parsed.headers));
    } catch {
      toast.error(t("errors.unreadable"));
    }
  }

  async function run() {
    if (!prepared || prepared.rows.length === 0) return;
    setBusy(true);
    setProgress(0);
    const total: Outcome = { imported: 0, skipped: 0, invalid: 0 };

    for (let start = 0; start < prepared.rows.length; start += IMPORT_CHUNK_SIZE) {
      const chunk = prepared.rows.slice(start, start + IMPORT_CHUNK_SIZE);
      const result = await importBusinessClients({ businessId, rows: chunk });
      if (!result.ok) {
        toast.error(result.code === "forbidden" ? t("errors.forbidden") : t("errors.generic"));
        // What went in before the failure stays in; say so rather than hide it.
        if (total.imported > 0) setOutcome(total);
        setBusy(false);
        router.refresh();
        return;
      }
      total.imported += result.imported;
      total.skipped += result.skipped;
      total.invalid += result.invalid;
      setProgress(Math.min(start + chunk.length, prepared.rows.length));
    }

    setOutcome(total);
    setBusy(false);
    router.refresh();
  }

  const fieldLabel: Record<ImportField, string> = {
    name: t("fields.name"),
    lastName: t("fields.lastName"),
    phone: t("fields.phone"),
    email: t("fields.email"),
    notes: t("fields.notes"),
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (busy) return;
        setOpen(next);
        if (!next) reset();
      }}
    >
      <DialogTrigger asChild>
        <Button variant={variant} className="rounded-full">
          <Upload className="size-4" aria-hidden />
          {t("button")}
        </Button>
      </DialogTrigger>

      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{t("title")}</DialogTitle>
          <DialogDescription>{t("intro")}</DialogDescription>
        </DialogHeader>

        {outcome ? (
          <div className="space-y-4 py-2" role="status">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="text-success mt-0.5 size-6 shrink-0" aria-hidden />
              <div className="space-y-1">
                <p className="font-heading text-lg">{t("doneTitle", { count: outcome.imported })}</p>
                <p className="text-muted-foreground text-sm">
                  {t("doneBody", { skipped: outcome.skipped, invalid: outcome.invalid })}
                </p>
              </div>
            </div>
            <p className="text-muted-foreground text-sm">{t("consentNote")}</p>
            <DialogFooter>
              <Button onClick={() => setOpen(false)}>{common("close")}</Button>
            </DialogFooter>
          </div>
        ) : !table ? (
          <div className="space-y-4">
            <label
              onDragOver={(event) => {
                event.preventDefault();
                setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={(event) => {
                event.preventDefault();
                setDragging(false);
                void load(event.dataTransfer.files[0]);
              }}
              className={cn(
                "glowa-focus focus-within:ring-ring/50 flex cursor-pointer flex-col items-center gap-3 rounded-2xl border-2 border-dashed px-6 py-10 text-center transition-colors focus-within:ring-3",
                dragging ? "border-primary bg-primary/5" : "border-border hover:bg-accent/40",
              )}
            >
              <span className="bg-primary/10 text-primary flex size-12 items-center justify-center rounded-full">
                <FileUp className="size-6" aria-hidden />
              </span>
              <span className="font-medium">{t("choose")}</span>
              <span className="text-muted-foreground text-sm">{t("chooseHint")}</span>
              <input
                ref={inputRef}
                type="file"
                accept=".csv,.tsv,.txt,text/csv,text/plain,text/tab-separated-values"
                className="sr-only"
                onChange={(event) => void load(event.target.files?.[0])}
              />
            </label>
            <p className="text-muted-foreground text-sm">{t("excelTip")}</p>
          </div>
        ) : (
          <div className="space-y-5">
            <p className="text-sm">
              <span className="font-medium">{fileName}</span>
              <span className="text-muted-foreground">
                {" · "}
                {t("rowsInFile", { count: table.rows.length })}
              </span>
              <button
                type="button"
                onClick={reset}
                disabled={busy}
                className="text-primary glowa-focus ml-3 rounded text-sm underline underline-offset-2"
              >
                {t("otherFile")}
              </button>
            </p>

            <fieldset className="space-y-3" disabled={busy}>
              <legend className="font-heading text-base">{t("mapTitle")}</legend>
              <div className="grid gap-3 sm:grid-cols-2">
                {IMPORT_FIELDS.map((field) => (
                  <div key={field} className="space-y-1.5">
                    <Label htmlFor={`import-${field}`}>{fieldLabel[field]}</Label>
                    <Select
                      value={mapping[field] === undefined ? NONE : String(mapping[field])}
                      onValueChange={(value) =>
                        setMapping((current) => {
                          const next = { ...current };
                          if (value === NONE) delete next[field];
                          else next[field] = Number(value);
                          return next;
                        })
                      }
                    >
                      <SelectTrigger id={`import-${field}`} className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={NONE}>{t("skipColumn")}</SelectItem>
                        {table.headers.map((header, index) => (
                          <SelectItem key={index} value={String(index)}>
                            {header || t("unnamedColumn", { number: index + 1 })}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ))}
              </div>
            </fieldset>

            {!hasIdentity ? (
              <p className="text-destructive text-sm" role="alert">
                {t("needIdentity")}
              </p>
            ) : prepared ? (
              <div className="space-y-3">
                <p className="text-sm" aria-live="polite">
                  <span className="font-semibold tabular-nums">{prepared.rows.length}</span>{" "}
                  {t("ready")}
                  {prepared.invalid + prepared.repeated > 0 ? (
                    <span className="text-muted-foreground">
                      {" · "}
                      {t("left", { count: prepared.invalid + prepared.repeated })}
                    </span>
                  ) : null}
                </p>

                {prepared.rows.length > 0 ? (
                  <div className="overflow-x-auto rounded-xl border">
                    <table className="w-full text-left text-sm">
                      <thead className="bg-muted/50 text-muted-foreground text-xs">
                        <tr>
                          <th className="px-3 py-2 font-medium">{t("fields.name")}</th>
                          <th className="px-3 py-2 font-medium">{t("fields.phone")}</th>
                          <th className="px-3 py-2 font-medium">{t("fields.email")}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {prepared.rows.slice(0, 4).map((row, index) => (
                          <tr key={index} className="border-t">
                            <td className="px-3 py-2">{row.fullName || "–"}</td>
                            <td className="px-3 py-2 tabular-nums">{row.phone || "–"}</td>
                            <td className="px-3 py-2">{row.email || "–"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : null}
              </div>
            ) : null}

            <div className="flex items-start gap-3">
              <Checkbox
                id="import-rights"
                checked={confirmed}
                onCheckedChange={(value) => setConfirmed(value === true)}
                disabled={busy}
                className="mt-0.5"
              />
              <Label htmlFor="import-rights" className="text-sm leading-snug font-normal">
                {t("rights")}
              </Label>
            </div>

            <DialogFooter>
              <Button
                onClick={() => void run()}
                disabled={busy || !confirmed || !prepared || prepared.rows.length === 0}
              >
                {busy ? (
                  <>
                    <Loader2 className="size-4 animate-spin" aria-hidden />
                    {t("importing", { done: progress, total: prepared?.rows.length ?? 0 })}
                  </>
                ) : (
                  t("submit", { count: prepared?.rows.length ?? 0 })
                )}
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
