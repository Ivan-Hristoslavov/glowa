"use client";

import { Plus } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useRouter } from "@/i18n/navigation";
import { createGrowthLink } from "@/lib/actions/growth";

type Option = { id: string; label: string };

export function GrowthLinkCreator({
  businessId,
  services,
  clients,
}: {
  businessId: string;
  services: Option[];
  clients: Option[];
}) {
  const t = useTranslations("admin.growth");
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  const [kind, setKind] = useState<"qr" | "referral">("qr");
  const [label, setLabel] = useState("");
  const [target, setTarget] = useState<"book" | "business">("book");
  const [serviceId, setServiceId] = useState<string>("any");
  const [clientId, setClientId] = useState<string>("none");

  function submit() {
    startTransition(async () => {
      const result = await createGrowthLink({
        businessId,
        kind,
        label: label.trim(),
        target,
        serviceId: target === "book" && serviceId !== "any" ? serviceId : null,
        referrerClientId:
          kind === "referral" && clientId !== "none" ? clientId : null,
      });

      if (!result.ok) {
        toast.error(t(`errors.${result.code}`));
        return;
      }

      toast.success(t("created"));
      setOpen(false);
      setLabel("");
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="size-4" />
          {t("create")}
        </Button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("create")}</DialogTitle>
          <DialogDescription>{t("createHint")}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="growth-kind">{t("field.kind")}</Label>
            <Select
              value={kind}
              onValueChange={(value) => setKind(value as typeof kind)}
            >
              <SelectTrigger id="growth-kind">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="qr">{t("kind.qr")}</SelectItem>
                <SelectItem value="referral">{t("kind.referral")}</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-muted-foreground text-xs">
              {t(`kindHint.${kind}`)}
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="growth-label">{t("field.label")}</Label>
            <Input
              id="growth-label"
              value={label}
              onChange={(event) => setLabel(event.target.value)}
              placeholder={t("labelPlaceholder")}
              maxLength={80}
            />
          </div>

          {kind === "referral" ? (
            <div className="space-y-2">
              <Label htmlFor="growth-client">{t("field.referrer")}</Label>
              <Select value={clientId} onValueChange={setClientId}>
                <SelectTrigger id="growth-client">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">{t("referrerNone")}</SelectItem>
                  {clients.map((client) => (
                    <SelectItem key={client.id} value={client.id}>
                      {client.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : null}

          <div className="space-y-2">
            <Label htmlFor="growth-target">{t("field.target")}</Label>
            <Select
              value={target}
              onValueChange={(value) => setTarget(value as typeof target)}
            >
              <SelectTrigger id="growth-target">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="book">{t("target.book")}</SelectItem>
                <SelectItem value="business">{t("target.business")}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {target === "book" ? (
            <div className="space-y-2">
              <Label htmlFor="growth-service">{t("field.service")}</Label>
              <Select value={serviceId} onValueChange={setServiceId}>
                <SelectTrigger id="growth-service">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="any">{t("serviceAny")}</SelectItem>
                  {services.map((service) => (
                    <SelectItem key={service.id} value={service.id}>
                      {service.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : null}
        </div>

        <DialogFooter>
          <Button
            onClick={submit}
            disabled={pending || label.trim().length === 0}
          >
            {pending ? t("creating") : t("create")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
