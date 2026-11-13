import { expect, test } from '@playwright/test';
import { DataGenerator } from '../../utils/DataGenerators';

test('creates validated checkout customer data through the LLM gateway', async () => {
  const originalFetch = globalThis.fetch;
  const environmentNames = [
    'LLM_PROVIDER',
    'LLM_API_KEY',
    'LLM_MODEL',
    'DEEPSEEK_API_KEY',
    'DEEPSEEK_MODEL',
    'LLM_BASE_URL',
  ];
  const originalEnvironment = new Map(
    environmentNames.map((name) => [name, process.env[name]]),
  );

  process.env.LLM_PROVIDER = 'deepseek';
  process.env.DEEPSEEK_API_KEY = 'test-key';
  process.env.DEEPSEEK_MODEL = 'test-model';
  delete process.env.LLM_API_KEY;
  delete process.env.LLM_MODEL;
  globalThis.fetch = async () =>
    new Response(
      JSON.stringify({
        choices: [
          {
            message: {
              content:
                '{"firstName":"Taylor","lastName":"Morgan","postalCode":"94105"}',
            },
          },
        ],
      }),
      { headers: { 'Content-Type': 'application/json' } },
    );

  try {
    await expect(DataGenerator.checkoutCustomer()).resolves.toEqual({
      firstName: 'Taylor',
      lastName: 'Morgan',
      postalCode: '94105',
    });
  } finally {
    globalThis.fetch = originalFetch;
    for (const [name, value] of originalEnvironment) {
      if (value === undefined) {
        delete process.env[name];
      } else {
        process.env[name] = value;
      }
    }
  }
});

test('generates checkout customer data with the configured LLM', async () => {
  test.skip(
    process.env.RUN_LIVE_LLM_TESTS !== 'true',
    'Set RUN_LIVE_LLM_TESTS=true to call the configured LLM provider.',
  );

  const customer = await DataGenerator.checkoutCustomer();

  expect(customer.firstName).toBeTruthy();
  expect(customer.lastName).toBeTruthy();
  expect(customer.postalCode).toBeTruthy();
  expect(Object.keys(customer).sort()).toEqual([
    'firstName',
    'lastName',
    'postalCode',
  ]);
});
