import { createServer, type IncomingHttpHeaders, type Server } from 'node:http';
import { expect, test } from '@playwright/test';
import { LLMGateway } from '../../AI/LLMGateway';

interface CapturedRequest {
  url: string | undefined;
  headers: IncomingHttpHeaders;
  body: Record<string, unknown>;
}

async function startMockProvider(responseBody: unknown): Promise<{
  baseUrl: string;
  requests: CapturedRequest[];
  close: () => Promise<void>;
}> {
  const requests: CapturedRequest[] = [];
  const server: Server = createServer((request, response) => {
    const chunks: Buffer[] = [];
    request.on('data', (chunk: Buffer) => chunks.push(chunk));
    request.on('end', () => {
      requests.push({
        url: request.url,
        headers: request.headers,
        body: JSON.parse(Buffer.concat(chunks).toString('utf8')) as Record<
          string,
          unknown
        >,
      });
      response.writeHead(200, { 'Content-Type': 'application/json' });
      response.end(JSON.stringify(responseBody));
    });
  });

  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });

  const address = server.address();
  if (!address || typeof address === 'string') {
    throw new Error('Mock provider server did not bind to a TCP port.');
  }

  return {
    baseUrl: `http://127.0.0.1:${address.port}/v1`,
    requests,
    close: () =>
      new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      }),
  };
}

test('requests JSON from an OpenAI-compatible provider', async () => {
  const mock = await startMockProvider({
    choices: [{ message: { content: '{"summary":"passed"}' } }],
  });

  try {
    const gateway = new LLMGateway({
      provider: 'deepseek',
      apiKey: 'test-key',
      model: 'test-model',
      baseUrl: mock.baseUrl,
    });

    await expect(
      gateway.generateJson<{ summary: string }>('Summarize the test.'),
    ).resolves.toEqual({ summary: 'passed' });

    expect(mock.requests).toHaveLength(1);
    expect(mock.requests[0].url).toBe('/v1/chat/completions');
    expect(mock.requests[0].headers.authorization).toBe('Bearer test-key');
    expect(mock.requests[0].body.response_format).toEqual({
      type: 'json_object',
    });
  } finally {
    await mock.close();
  }
});

test('uses Anthropic messages API and parses its text response', async () => {
  const mock = await startMockProvider({
    content: [{ type: 'text', text: '{"answer":42}' }],
  });

  try {
    const gateway = new LLMGateway({
      provider: 'anthropic',
      apiKey: 'test-key',
      model: 'test-model',
      baseUrl: mock.baseUrl,
    });

    await expect(
      gateway.generateJson<{ answer: number }>('Return an answer.'),
    ).resolves.toEqual({ answer: 42 });

    expect(mock.requests).toHaveLength(1);
    expect(mock.requests[0].url).toBe('/v1/messages');
    expect(mock.requests[0].headers['x-api-key']).toBe('test-key');
    expect(mock.requests[0].body.system).toContain('valid JSON object');
  } finally {
    await mock.close();
  }
});
