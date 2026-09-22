export type AssistantMessage = { role: "user" | "assistant"; content: string };

/**
 * The aggregate picture the assistant is allowed to see. Deliberately contains
 * no client names, emails, phone numbers or notes: the assistant answers
 * operational questions and drafts copy, and neither needs personal data.
 */
export type AssistantContext = {
  businessName: string;
  currency: string;
  timezone: string;
  locale: string;
  rangeLabel: string;
  metrics: Record<string, number | null>;
  services: Array<{ name: string; durationMinutes: number; priceCents: number }>;
  staffCount: number;
};

export type AssistantReply =
  | { ok: true; text: string }
  | { ok: false; code: "unavailable" | "generic" };

export interface AssistantProvider {
  readonly id: string;
  complete(input: {
    context: AssistantContext;
    messages: AssistantMessage[];
    signal?: AbortSignal;
  }): Promise<AssistantReply>;
}
