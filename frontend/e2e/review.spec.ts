import { test, expect, type Locator } from '@playwright/test';

async function contrast(control: Locator, foreground = 'color'): Promise<number> {
  return control.evaluate((element, property) => {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 1;
    const context = canvas.getContext('2d')!;
    function rgb(value: string) {
      context.clearRect(0, 0, 1, 1);
      context.fillStyle = value;
      context.fillRect(0, 0, 1, 1);
      return [...context.getImageData(0, 0, 1, 1).data];
    }
    function luminance(values: number[]) {
      const channels = values.slice(0, 3).map((value) => {
        const normalized = value / 255;
        return normalized <= 0.04045 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4;
      });
      return channels[0]! * 0.2126 + channels[1]! * 0.7152 + channels[2]! * 0.0722;
    }
    // The outline is offset outside the control, against its containing surface.
    let backgroundElement: Element | null =
      property === 'outline-color' ? element.parentElement : element;
    let background = rgb('white');
    while (backgroundElement) {
      const candidate = rgb(getComputedStyle(backgroundElement).backgroundColor);
      if (candidate[3] === 255) {
        background = candidate;
        break;
      }
      backgroundElement = backgroundElement.parentElement;
    }
    const first = luminance(rgb(getComputedStyle(element).getPropertyValue(property)));
    const second = luminance(background);
    return (Math.max(first, second) + 0.05) / (Math.min(first, second) + 0.05);
  }, foreground);
}

for (const appearance of ['light', 'dark']) {
  test(`${appearance} control states retain text contrast and keyboard focus`, async ({ page }) => {
    await page.goto('/design/components');
    await page.getByLabel('Appearance', { exact: true }).selectOption(appearance);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    const measurements: { control: string; state: string; ratio: number }[] = [];
    for (const name of [
      'Primary action',
      'Secondary action',
      'Quiet action',
      'Destructive action',
    ]) {
      const control = page.getByRole('button', { name, exact: true });
      await page.mouse.move(0, 0);
      measurements.push({ control: name, state: 'default', ratio: await contrast(control) });
      await control.hover();
      measurements.push({ control: name, state: 'hover', ratio: await contrast(control) });
      await page.mouse.down();
      measurements.push({ control: name, state: 'pressed', ratio: await contrast(control) });
      await page.mouse.up();
      await control.focus();
      await page.keyboard.press('Tab');
      await page.keyboard.press('Shift+Tab');
      await expect(control).toBeFocused();
      expect(await control.evaluate((element) => element.matches(':focus-visible'))).toBe(true);
      expect(await contrast(control, 'outline-color')).toBeGreaterThanOrEqual(3);
    }
    for (const result of measurements) {
      expect(result.ratio, `${result.control} ${result.state}`).toBeGreaterThanOrEqual(4.5);
    }
    await expect(page.getByRole('button', { name: 'Unavailable', exact: true })).toBeDisabled();
    const saving = page.getByRole('button', { name: 'Saving…', exact: true });
    await expect(saving).toBeDisabled();
    await expect(saving).toHaveAttribute('aria-busy', 'true');
    await page.screenshot({
      path: `artifacts/local/control-focus-${appearance}.png`,
      fullPage: true,
    });
    await test.info().attach(`control-contrast-${appearance}`, {
      body: JSON.stringify(measurements, null, 2),
      contentType: 'application/json',
    });
  });
}

test('modal keyboard traversal cannot reach background controls and Escape restores focus', async ({
  page,
}) => {
  await page.goto('/design/people/maya');
  const opener = page.getByRole('button', { name: 'Log meetup', exact: true });
  await opener.click();
  await expect(page.getByLabel('Meetup date', { exact: true })).toBeFocused();
  for (const key of ['Tab', 'Shift+Tab']) {
    for (let index = 0; index < 18; index++) {
      await page.keyboard.press(key);
      expect(
        await page.evaluate(() => {
          const focused = document.activeElement;
          return focused === document.body || Boolean(focused?.closest('dialog[open]'));
        }),
      ).toBe(true);
    }
  }
  await page.getByRole('button', { name: 'Close', exact: true }).focus();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(opener).toBeFocused();
});
