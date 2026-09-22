import "server-only";

import { createOpenAIAssistant } from "./openai";
import type { AssistantProvider } from "./types";

/**
 * One place decides whether the assistant exists. Every surface asks this
 * rather than reading the env var, so "not configured" is a first-class state
 * the UI can explain instead of a request that fails at the end.
 */
export function getAssistantProvider(): AssistantProvider | null {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;
  return createOpenAIAssistant(apiKey);
}

export function isAssistantConfigured() {
  return Boolean(process.env.OPENAI_API_KEY);
}

export type {
  AssistantContext,
  AssistantMessage,
  AssistantProvider,
  AssistantReply,
} from "./types";
