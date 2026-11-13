# AI LLM gateway

`LLMGateway` provides a single TypeScript interface for Groq, OpenRouter,
OpenAI, Anthropic, and DeepSeek. It uses each provider's HTTP API directly
through Node's built-in `fetch`; no provider SDK is required.

## Configuration

Set the provider, API key, and model in environment variables:

| Provider | `LLM_PROVIDER` | API key variable | Provider-specific model variable |
| --- | --- | --- | --- |
| Groq | `groq` | `GROQ_API_KEY` | `GROQ_MODEL` |
| OpenRouter | `openrouter` | `OPENROUTER_API_KEY` | `OPENROUTER_MODEL` |
| OpenAI | `openai` | `OPENAI_API_KEY` | `OPENAI_MODEL` |
| Anthropic / Claude | `anthropic` | `ANTHROPIC_API_KEY` or `CLAUDE_API_KEY` | `ANTHROPIC_MODEL` or `CLAUDE_MODEL` |
| DeepSeek | `deepseek` | `DEEPSEEK_API_KEY` | `DEEPSEEK_MODEL` |

`LLM_API_KEY` and `LLM_MODEL` can be used instead of the provider-specific
variables. `LLM_BASE_URL` overrides the provider's default endpoint, and
`LLM_TIMEOUT_MS` sets the request timeout (default: 60000).

Keep API keys in an untracked `.env` file or your CI secret store; never commit
them. The project loads `.env` through its Playwright configuration. For other
entry points, make sure the environment variables are loaded before calling
`fromEnvironment()`.

Provider pricing, free quotas, and available models vary and can change. This
gateway does not make API usage free; check your company's policy and the
provider's current terms before sending prompts.

## Usage

```ts
import { LLMGateway } from './LLMGateway';

const llm = LLMGateway.fromEnvironment();

const answer = await llm.generateText('Summarize this test failure.');

const result = await llm.generateJson<{ summary: string; severity: string }>(
  'Return an object with summary and severity for this test failure.',
);
```

`generateJson` returns the parsed JSON value directly and throws an error when
the provider request fails or the model response is not valid JSON.
