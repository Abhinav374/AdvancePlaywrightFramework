export type LLMProvider =
  | 'groq'
  | 'openrouter'
  | 'openai'
  | 'anthropic'
  | 'deepseek';

export type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue };

export interface LLMGatewayConfig {
  provider: LLMProvider;
  apiKey: string;
  model: string;
  baseUrl?: string;
  timeoutMs?: number;
}

export interface LLMRequestOptions {
  systemPrompt?: string;
  temperature?: number;
  maxTokens?: number;
}

interface ProviderDefaults {
  baseUrl: string;
  keyEnvironmentVariables: string[];
  modelEnvironmentVariables: string[];
}

const PROVIDER_DEFAULTS: Record<LLMProvider, ProviderDefaults> = {
  groq: {
    baseUrl: 'https://api.groq.com/openai/v1',
    keyEnvironmentVariables: ['GROQ_API_KEY'],
    modelEnvironmentVariables: ['GROQ_MODEL'],
  },
  openrouter: {
    baseUrl: 'https://openrouter.ai/api/v1',
    keyEnvironmentVariables: ['OPENROUTER_API_KEY'],
    modelEnvironmentVariables: ['OPENROUTER_MODEL'],
  },
  openai: {
    baseUrl: 'https://api.openai.com/v1',
    keyEnvironmentVariables: ['OPENAI_API_KEY'],
    modelEnvironmentVariables: ['OPENAI_MODEL'],
  },
  anthropic: {
    baseUrl: 'https://api.anthropic.com/v1',
    keyEnvironmentVariables: ['ANTHROPIC_API_KEY', 'CLAUDE_API_KEY'],
    modelEnvironmentVariables: ['ANTHROPIC_MODEL', 'CLAUDE_MODEL'],
  },
  deepseek: {
    baseUrl: 'https://api.deepseek.com/v1',
    keyEnvironmentVariables: ['DEEPSEEK_API_KEY'],
    modelEnvironmentVariables: ['DEEPSEEK_MODEL'],
  },
};

const DEFAULT_TIMEOUT_MS = 60_000;
const DEFAULT_MAX_TOKENS = 2_048;
const JSON_SYSTEM_PROMPT =
  'Return only a valid JSON object. Do not include markdown fences or explanatory text.';

export class LLMGateway {
  private readonly config: Required<LLMGatewayConfig>;

  constructor(config: LLMGatewayConfig) {
    if (!config.apiKey.trim()) {
      throw new Error('An API key is required for the selected LLM provider.');
    }
    if (!config.model.trim()) {
      throw new Error('A model name is required for the selected LLM provider.');
    }
    if (
      config.timeoutMs !== undefined &&
      (!Number.isInteger(config.timeoutMs) || config.timeoutMs <= 0)
    ) {
      throw new Error('timeoutMs must be a positive integer.');
    }

    this.config = {
      ...config,
      apiKey: config.apiKey.trim(),
      model: config.model.trim(),
      baseUrl:
        config.baseUrl?.trim() || PROVIDER_DEFAULTS[config.provider].baseUrl,
      timeoutMs: config.timeoutMs ?? DEFAULT_TIMEOUT_MS,
    };
  }

  static fromEnvironment(
    environment: NodeJS.ProcessEnv = process.env,
  ): LLMGateway {
    const providerValue = environment.LLM_PROVIDER?.trim().toLowerCase();
    if (!providerValue || !isLLMProvider(providerValue)) {
      throw new Error(
        'Set LLM_PROVIDER to groq, openrouter, openai, anthropic, or deepseek.',
      );
    }

    const providerDefaults = PROVIDER_DEFAULTS[providerValue];
    const apiKey =
      environment.LLM_API_KEY?.trim() ||
      firstEnvironmentValue(environment, providerDefaults.keyEnvironmentVariables);
    const model =
      environment.LLM_MODEL?.trim() ||
      firstEnvironmentValue(environment, providerDefaults.modelEnvironmentVariables);

    if (!apiKey) {
      throw new Error(
        `Set LLM_API_KEY or ${providerDefaults.keyEnvironmentVariables.join(' or ')}.`,
      );
    }
    if (!model) {
      throw new Error(
        `Set LLM_MODEL or ${providerDefaults.modelEnvironmentVariables.join(' or ')}.`,
      );
    }

    const timeoutValue = environment.LLM_TIMEOUT_MS?.trim();
    const timeoutMs = timeoutValue ? Number(timeoutValue) : DEFAULT_TIMEOUT_MS;
    if (!Number.isInteger(timeoutMs) || timeoutMs <= 0) {
      throw new Error('LLM_TIMEOUT_MS must be a positive integer.');
    }

    return new LLMGateway({
      provider: providerValue,
      apiKey,
      model,
      baseUrl: environment.LLM_BASE_URL?.trim() || providerDefaults.baseUrl,
      timeoutMs,
    });
  }

  async generateText(
    prompt: string,
    options: LLMRequestOptions = {},
  ): Promise<string> {
    return this.request(prompt, options, false);
  }

  async generateJson<T extends JsonValue = JsonValue>(
    prompt: string,
    options: LLMRequestOptions = {},
  ): Promise<T> {
    const content = await this.request(prompt, options, true);
    return parseJsonResponse<T>(content);
  }

  private async request(
    prompt: string,
    options: LLMRequestOptions,
    jsonMode: boolean,
  ): Promise<string> {
    if (!prompt.trim()) {
      throw new Error('Prompt must not be empty.');
    }

    const response =
      this.config.provider === 'anthropic'
        ? await this.requestAnthropic(prompt, options, jsonMode)
        : await this.requestOpenAICompatible(prompt, options, jsonMode);

    const responseText = await response.text();
    if (!response.ok) {
      let errorBody: unknown;
      try {
        errorBody = JSON.parse(responseText) as unknown;
      } catch {
        errorBody = undefined;
      }
      throw new Error(
        `${this.config.provider} request failed with HTTP ${response.status}: ${formatProviderError(errorBody, responseText)}`,
      );
    }

    const responseBody = parseResponseBody(responseText);
    return this.config.provider === 'anthropic'
      ? extractAnthropicText(responseBody)
      : extractChatCompletionText(responseBody);
  }

  private async requestOpenAICompatible(
    prompt: string,
    options: LLMRequestOptions,
    jsonMode: boolean,
  ): Promise<Response> {
    const systemPrompt = combineSystemPrompts(options.systemPrompt, jsonMode);
    const payload: Record<string, unknown> = {
      model: this.config.model,
      messages: [
        ...(systemPrompt ? [{ role: 'system', content: systemPrompt }] : []),
        { role: 'user', content: prompt },
      ],
      temperature: options.temperature ?? 0.2,
      max_tokens: options.maxTokens ?? DEFAULT_MAX_TOKENS,
    };
    if (jsonMode) {
      payload.response_format = { type: 'json_object' };
    }

    return fetch(`${this.config.baseUrl.replace(/\/+$/, '')}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.config.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(this.config.timeoutMs),
    });
  }

  private async requestAnthropic(
    prompt: string,
    options: LLMRequestOptions,
    jsonMode: boolean,
  ): Promise<Response> {
    const systemPrompt = combineSystemPrompts(options.systemPrompt, jsonMode);
    const payload: Record<string, unknown> = {
      model: this.config.model,
      max_tokens: options.maxTokens ?? DEFAULT_MAX_TOKENS,
      messages: [{ role: 'user', content: prompt }],
    };
    if (systemPrompt) {
      payload.system = systemPrompt;
    }
    if (options.temperature !== undefined) {
      payload.temperature = options.temperature;
    }

    return fetch(`${this.config.baseUrl.replace(/\/+$/, '')}/messages`, {
      method: 'POST',
      headers: {
        'x-api-key': this.config.apiKey,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(this.config.timeoutMs),
    });
  }
}

function isLLMProvider(value: string): value is LLMProvider {
  return Object.prototype.hasOwnProperty.call(PROVIDER_DEFAULTS, value);
}

function firstEnvironmentValue(
  environment: NodeJS.ProcessEnv,
  names: string[],
): string | undefined {
  for (const name of names) {
    const value = environment[name]?.trim();
    if (value) {
      return value;
    }
  }
  return undefined;
}

function combineSystemPrompts(
  systemPrompt: string | undefined,
  jsonMode: boolean,
): string | undefined {
  const prompts = [systemPrompt?.trim(), jsonMode ? JSON_SYSTEM_PROMPT : undefined]
    .filter((value): value is string => Boolean(value));
  return prompts.length > 0 ? prompts.join('\n\n') : undefined;
}

function parseResponseBody(responseText: string): unknown {
  try {
    return JSON.parse(responseText) as unknown;
  } catch {
    throw new Error('LLM provider returned a non-JSON API response.');
  }
}

function formatProviderError(body: unknown, fallback: string): string {
  if (
    typeof body === 'object' &&
    body !== null &&
    'error' in body &&
    typeof body.error === 'object' &&
    body.error !== null &&
    'message' in body.error &&
    typeof body.error.message === 'string'
  ) {
    return body.error.message;
  }
  return fallback || 'Unknown provider error.';
}

function extractChatCompletionText(body: unknown): string {
  if (
    typeof body === 'object' &&
    body !== null &&
    'choices' in body &&
    Array.isArray(body.choices)
  ) {
    const firstChoice = body.choices[0];
    if (
      typeof firstChoice === 'object' &&
      firstChoice !== null &&
      'message' in firstChoice &&
      typeof firstChoice.message === 'object' &&
      firstChoice.message !== null &&
      'content' in firstChoice.message &&
      typeof firstChoice.message.content === 'string'
    ) {
      return firstChoice.message.content;
    }
  }
  throw new Error('LLM provider response did not contain chat completion text.');
}

function extractAnthropicText(body: unknown): string {
  if (typeof body === 'object' && body !== null && 'content' in body) {
    const content = body.content;
    if (Array.isArray(content)) {
      const text = content
        .filter(
          (block): block is { type: 'text'; text: string } =>
            typeof block === 'object' &&
            block !== null &&
            'type' in block &&
            block.type === 'text' &&
            'text' in block &&
            typeof block.text === 'string',
        )
        .map((block) => block.text)
        .join('');
      if (text) {
        return text;
      }
    }
  }
  throw new Error('Anthropic response did not contain text content.');
}

function parseJsonResponse<T extends JsonValue>(content: string): T {
  const trimmedContent = content.trim();
  const fencedContent = trimmedContent.match(
    /^```(?:json)?\s*([\s\S]*?)\s*```$/i,
  );
  const jsonContent = fencedContent?.[1] ?? trimmedContent;

  try {
    return JSON.parse(jsonContent) as T;
  } catch {
    throw new Error('LLM response was not valid JSON.');
  }
}
