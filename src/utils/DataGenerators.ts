import { JsonValue, LLMGateway } from '../AI/LLMGateway';
import { checkoutCustomerPrompt } from '../AI/prompts/checkoutCustomer';

export interface CheckoutCustomer extends Record<string, JsonValue> {
  firstName: string;
  lastName: string;
  postalCode: string;
}

export class DataGenerator {
  static async checkoutCustomer(): Promise<CheckoutCustomer> {
    const customer =
      await LLMGateway.fromEnvironment().generateJson<CheckoutCustomer>(
        checkoutCustomerPrompt,
        { temperature: 0.7, maxTokens: 128 },
      );

    if (
      !customer ||
      typeof customer !== 'object' ||
      typeof customer.firstName !== 'string' ||
      typeof customer.lastName !== 'string' ||
      typeof customer.postalCode !== 'string' ||
      !customer.firstName.trim() ||
      !customer.lastName.trim() ||
      !customer.postalCode.trim()
    ) {
      throw new Error(
        'LLM returned invalid checkout customer data; expected non-empty firstName, lastName, and postalCode.',
      );
    }

    return {
      firstName: customer.firstName.trim(),
      lastName: customer.lastName.trim(),
      postalCode: customer.postalCode.trim(),
    };
  }
}
