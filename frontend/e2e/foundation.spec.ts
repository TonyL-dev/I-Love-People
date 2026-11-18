import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test('sign-in cannot pretend to authenticate and the sample is explicitly synthetic', async ({
  page,
}) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Keep your people close.' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Sign in', exact: true })).toBeDisabled();
  await page.getByLabel('Password', { exact: true }).fill('synthetic-only');
  await page.getByRole('button', { name: 'Show password' }).click();
  await expect(page.getByLabel('Password', { exact: true })).toHaveAttribute('type', 'text');
  await page.getByRole('link', { name: 'Explore the sample' }).click();
  await expect(page.getByText('Synthetic people · No personal data or account')).toBeVisible();
});

test('search and deep links work; dirty meetup drafts survive Escape', async ({ page }) => {
  await page.goto('/design/people');
  await page.getByRole('searchbox').fill('maya');
  await expect(page.getByRole('link', { name: 'Maya Chen', exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Jo Martin', exact: true })).toHaveCount(0);
  await page.getByRole('link', { name: 'Maya Chen', exact: true }).click();
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Maya Chen', exact: true })).toBeVisible();
  const opener = page.getByRole('button', { name: 'Log meetup', exact: true });
  await opener.click();
  await page.getByRole('textbox', { name: /A note to remember/ }).fill('A synthetic draft');
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Keep editing' }).click();
  await expect(page.getByRole('textbox', { name: /A note to remember/ })).toHaveValue(
    'A synthetic draft',
  );
  await page.getByRole('button', { name: 'Try sample save' }).click();
  await expect(page.getByRole('status')).toContainText('No record was stored');
  await expect(opener).toBeFocused();
});

for (const appearance of ['Light', 'Dark']) {
  for (const width of [320, 390, 768, 1440]) {
    test(`${appearance} at ${width}px reflows and passes automated accessibility`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: 1000 });
      await page.goto('/design');
      await page.getByLabel('Appearance', { exact: true }).selectOption(appearance.toLowerCase());
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
        true,
      );
      const results = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
        .analyze();
      expect(results.violations).toEqual([]);
      await page.screenshot({
        path: `artifacts/local/${appearance.toLowerCase()}-${width}.png`,
        fullPage: true,
      });
    });
  }
}

test('empty, loading, offline and failed states have a recovery path', async ({ page }) => {
  await page.goto('/design');
  for (const state of ['empty', 'loading', 'error', 'offline']) {
    await page.getByLabel('Screen state', { exact: true }).selectOption(state);
    await expect(page.locator('main')).not.toBeEmpty();
  }
  await page.getByRole('button', { name: 'Try again' }).click();
  await expect(page.getByRole('link', { name: 'Maya Chen', exact: true })).toBeVisible();
});

test('keyboard navigation, larger text, long names and reduced motion', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.setViewportSize({ width: 390, height: 1000 });
  await page.goto('/design/people/maya');
  await page.keyboard.press('Tab');
  await expect(page.getByRole('link', { name: 'Skip to content' })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.locator('main')).toBeFocused();
  await page.evaluate(() => {
    document.documentElement.style.fontSize = '200%';
  });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.evaluate(() => {
    const title = document.querySelector('h1');
    if (title) title.textContent = 'Alexandria Long-Name de la Cruz — Synthetic Example';
  });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  const duration = await page
    .locator('button')
    .first()
    .evaluate((el) => getComputedStyle(el).transitionDuration);
  expect(duration).toBe('0s');
});

for (const appearance of ['light', 'dark']) {
  for (const width of [320, 1440]) {
    test(`core screens and dialog: ${appearance}, ${width}px`, async ({ page }) => {
      test.setTimeout(90_000);
      await page.setViewportSize({ width, height: 1000 });
      await page.goto('/design');
      await page.locator('#reference-appearance').selectOption(appearance);
      for (const [name, route] of [
        ['login', '/'],
        ['people', '/design/people'],
        ['profile', '/design/people/maya'],
        ['components', '/design/components'],
      ] as const) {
        await page.goto(route);
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
          true,
        );
        const results = await new AxeBuilder({ page })
          .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
          .analyze();
        expect(results.violations).toEqual([]);
        await page.screenshot({
          path: `artifacts/local/${name}-${appearance}-${width}.png`,
          fullPage: true,
        });
      }
      await page.goto('/design/people/maya');
      await page.getByRole('button', { name: 'Log meetup', exact: true }).click();
      const results = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
        .analyze();
      expect(results.violations).toEqual([]);
      expect(
        await page
          .locator('dialog')
          .evaluate((element) => element.scrollWidth <= element.clientWidth),
      ).toBe(true);
      await page.screenshot({
        path: `artifacts/local/dialog-${appearance}-${width}.png`,
        fullPage: true,
      });
    });
  }
}
