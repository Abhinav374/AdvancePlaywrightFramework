import type { Locator } from '@playwright/test';

export class UtilElementLocator {
  async fill(locator: Locator, value: string): Promise<void> {
    await locator.fill(value);
  }

  async click(locator: Locator): Promise<void> {
    await locator.click();
  }

  async waitForHidden(locator: Locator): Promise<void> {
    await locator.waitFor({ state: 'hidden' });
  }

  async getAllTexts(locator: Locator): Promise<string[]> {
    const texts = await locator.allTextContents();
    return texts.map((text) => text.trim());
  }
}
