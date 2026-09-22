import "server-only";

import type {
  AssistantContext,
  AssistantMessage,
  AssistantProvider,
  AssistantReply,
} from "./types";

const MODEL = "gpt-4.1-mini";

function systemPrompt(context: AssistantContext) {
  return [
    "You are the operations assistant inside GLOWA, a booking and CRM platform for beauty businesses.",
    "You are talking to the owner or a manager of one salon.",
    "",
    "Rules you must follow:",
    "- Answer only from the figures given below. If a figure is not there, say you do not have it.",
    "- Never invent appointments, prices, availability, client names or review counts.",
    "- You cannot create, move or cancel bookings. Point the user to the calendar instead.",
    "- You have no access to client personal data and must not ask for it.",
    `- Reply in the same language as the question. The business default is ${context.locale}.`,
    "- Be brief and concrete. Prefer a sentence and a number over a paragraph.",
    "",
    `Business: ${context.businessName} (${context.timezone}, ${context.currency})`,
    `Period: ${context.rangeLabel}`,
    `Metrics: ${JSON.stringify(context.metrics)}`,
    `Services: ${JSON.stringify(context.services)}`,
    `Bookable specialists: ${context.staffCount}`,
  ].join("\n");
}

/**
 * Server-side only. The key never reaches the browser, and the request carries
 * the aggregate context above - nothing per-client.
 */
export function createOpenAIAssistant(apiKey: string): AssistantProvider {
  return {
    id: "openai",

    async complete({ context, messages, signal }): Promise<AssistantReply> {
      try {
        const response = await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model: MODEL,
            temperature: 0.2,
            max_tokens: 600,
            messages: [
              { role: "system", content: systemPrompt(context) },
              ...messages.map((message: AssistantMessage) => ({
                role: message.role,
                content: message.content,
              })),
            ],
          }),
          signal,
        });

        if (!response.ok) return { ok: false, code: "generic" };

        const payload: unknown = await response.json();
        const text =
          typeof payload === "object" &&
          payload !== null &&
          "choices" in payload &&
          Array.isArray((payload as { choices: unknown[] }).choices)
            ? ((payload as { choices: Array<{ message?: { content?: string } }> })
                .choices[0]?.message?.content ?? "")
            : "";

        if (!text.trim()) return { ok: false, code: "generic" };
        return { ok: true, text: text.trim() };
      } catch {
        return { ok: false, code: "generic" };
      }
    },
  };
}
