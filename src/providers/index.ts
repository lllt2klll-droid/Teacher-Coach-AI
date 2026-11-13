import { GeminiProvider } from '@/providers/gemini/gemini-provider';
import { LocalRuleProvider } from '@/providers/local/local-provider';
import type { AIProvider, AIProviderRuntime } from '@/providers/types';

export function createAIProvider(runtime: AIProviderRuntime): AIProvider {
  if (runtime.kind === 'gemini') {
    return new GeminiProvider(runtime.endpoint, runtime.model, undefined, runtime.apiKey);
  }
  return new LocalRuleProvider();
}

export { GeminiProvider, LocalRuleProvider };
