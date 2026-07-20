import type { AIProvider } from "./base";
import { openaiProvider } from "./openai";
import { geminiProvider } from "./gemini";
import { claudeProvider } from "./claude";
import { grokProvider } from "./grok";
import { deepseekProvider } from "./deepseek";
import { openrouterProvider } from "./openrouter";

export const aiProviders: AIProvider[] = [
  openaiProvider,
  geminiProvider,
  claudeProvider,
  grokProvider,
  deepseekProvider,
  openrouterProvider,
];
