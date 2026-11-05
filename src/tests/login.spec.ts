import { test, expect } from '@playwright/test';
import { LoginPage } from '../pages/LoginPage';

test.describe('POM with Login Page Simple', () => {
    test('Login with valid credentials', async ({ page }) => {
        const loginPage = new LoginPage(page);
        await loginPage.open();
        await loginPage.loginAs('standard_user', 'tta_secret');
        await expect(page).toHaveTitle('TTACart - Products');
    });
});