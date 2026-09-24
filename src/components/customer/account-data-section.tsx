"use client";

import { Download, Loader2, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { AUTH_CHANGED_EVENT } from "@/components/layout/use-account";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useRouter } from "@/i18n/navigation";
import { deleteAccount } from "@/lib/actions/account";

/** Download a copy, or leave: the two rights people use most, self-service. */
export function AccountDataSection({ email }: { email: string }) {
  const t = useTranslations("settings.data");
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [confirm, setConfirm] = useState("");
  const [isPending, startTransition] = useTransition();

  function remove() {
    startTransition(async () => {
      const result = await deleteAccount({ confirmEmail: confirm });
      if (!result.ok) {
        toast.error(t(`errors.${result.code}`));
        return;
      }
      setOpen(false);
      toast.success(t("deleted"));
      window.dispatchEvent(new Event(AUTH_CHANGED_EVENT));
      router.replace("/");
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 rounded-xl border p-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-medium">{t("downloadTitle")}</p>
          <p className="text-muted-foreground text-sm">{t("downloadBody")}</p>
        </div>
        <Button asChild variant="outline" className="shrink-0">
          {/* A file, not a page: a plain link with `download`. */}
          <a href="/api/me/export" download>
            <Download className="size-4" aria-hidden />
            {t("download")}
          </a>
        </Button>
      </div>

      <div className="border-destructive/30 flex flex-col gap-3 rounded-xl border p-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-medium">{t("deleteTitle")}</p>
          <p className="text-muted-foreground text-sm">{t("deleteBody")}</p>
        </div>
        <Button
          variant="outline"
          className="text-destructive hover:text-destructive shrink-0"
          onClick={() => setOpen(true)}
        >
          <Trash2 className="size-4" aria-hidden />
          {t("delete")}
        </Button>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t("dialogTitle")}</DialogTitle>
            <DialogDescription>{t("dialogBody")}</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="delete-confirm">{t("confirmLabel", { email })}</Label>
            <Input
              id="delete-confirm"
              type="email"
              autoComplete="off"
              value={confirm}
              onChange={(event) => setConfirm(event.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              {t("cancel")}
            </Button>
            <Button
              variant="destructive"
              onClick={remove}
              disabled={isPending || confirm.trim().toLowerCase() !== email.toLowerCase()}
            >
              {isPending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
              {t("confirmDelete")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
