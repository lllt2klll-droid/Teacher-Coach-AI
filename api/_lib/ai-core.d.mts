export interface AiRequestArgs {
  action: string;
  payload?: unknown;
  model?: string;
  clientId?: string;
  apiKey?: string;
  env?: Record<string, string | undefined>;
}

export interface AiResponse {
  status: number;
  body: Record<string, unknown>;
}

export function handleAiRequest(args: AiRequestArgs): Promise<AiResponse>;
export function getAiConfig(env?: Record<string, string | undefined>): {
  configured: boolean;
  model: string;
};
