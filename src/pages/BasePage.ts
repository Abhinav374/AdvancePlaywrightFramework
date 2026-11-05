import type { Page } from '@playwright/test';
import type { Logger } from 'winston';
import { logger } from '../utils/logger';
import { UtilElementLocator } from '../utils/UtilElementLocator';

export abstract class BasePage {
  protected readonly page: Page;
  protected readonly el: UtilElementLocator;
  protected readonly log: Logger;

  protected constructor(page: Page, pageName: string) {
    this.page = page;
    this.el = new UtilElementLocator();
    this.log = logger.child({ page: pageName });
  }

  protected async goto(path: string): Promise<void> {
    const response = await this.page.goto(path);
    if (response && !response.ok()) {
      throw new Error(`Navigation to "${path}" failed with HTTP ${response.status()}.`);
    }
  }
}
