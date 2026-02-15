import { test, expect } from '@playwright/test';

const LOAD_TIMEOUT = 30_000;

async function waitForMovies(page: ReturnType<typeof test['info']> extends never ? never : any) {
	await page.goto('/movies');
	await expect(page.locator('.status')).not.toBeVisible({ timeout: LOAD_TIMEOUT });
	await expect(page.locator('svg')).toBeVisible();
}

test.describe('Movies Page', () => {
	test('loads and renders movie dots', async ({ page }) => {
		await waitForMovies(page);
		const dots = page.locator('.dot');
		const count = await dots.count();
		expect(count).toBeGreaterThan(100);
	});

	test('control bar is visible with color, size, and genre controls', async ({ page }) => {
		await waitForMovies(page);
		await expect(page.locator('#colorBy')).toBeVisible();
		await expect(page.locator('#sizeBy')).toBeVisible();
		await expect(page.locator('.genre-pills')).toBeVisible();
		const pills = page.locator('.pill');
		expect(await pills.count()).toBeGreaterThan(10);
	});

	test('color-by changes dot fill colors', async ({ page }) => {
		await waitForMovies(page);
		const firstDot = page.locator('.dot').first();
		const defaultFill = await firstDot.getAttribute('fill');

		await page.locator('#colorBy').selectOption('rating');
		await expect(page.locator('#colorBy')).toHaveValue('rating');

		const newFill = await firstDot.getAttribute('fill');
		expect(newFill).not.toBe(defaultFill);
	});

	test('size-by changes dot radii', async ({ page }) => {
		await waitForMovies(page);
		const dots = page.locator('.dot');
		const defaultRadius = await dots.first().getAttribute('r');

		await page.locator('#sizeBy').selectOption('rating_count');
		await expect(page.locator('#sizeBy')).toHaveValue('rating_count');

		const radii = await dots.evaluateAll((els) => els.slice(0, 20).map((e) => e.getAttribute('r')));
		const unique = new Set(radii);
		expect(unique.size).toBeGreaterThan(1);
	});

	test('genre pill highlights matching movies and dims others', async ({ page }) => {
		await waitForMovies(page);
		const actionPill = page.locator('.pill', { hasText: 'Action' });
		await actionPill.click();
		await expect(actionPill).toHaveClass(/active/);

		const opacities = await page
			.locator('.dot')
			.evaluateAll((els) => els.slice(0, 50).map((e) => e.getAttribute('opacity')));

		const hasHighlighted = opacities.some((o) => o === '1');
		const hasDimmed = opacities.some((o) => o === '0.15');
		expect(hasHighlighted).toBe(true);
		expect(hasDimmed).toBe(true);
	});

	test('clicking active genre pill resets to all', async ({ page }) => {
		await waitForMovies(page);
		const dramaPill = page.locator('.pill', { hasText: 'Drama' });

		await dramaPill.click();
		await expect(dramaPill).toHaveClass(/active/);

		await dramaPill.click();
		await expect(dramaPill).not.toHaveClass(/active/);
		await expect(page.locator('.pill', { hasText: 'All' })).toHaveClass(/active/);

		const opacities = await page
			.locator('.dot')
			.evaluateAll((els) => els.slice(0, 20).map((e) => e.getAttribute('opacity')));
		expect(opacities.every((o) => o === '0.8')).toBe(true);
	});

	test('tooltip appears on dot hover', async ({ page }) => {
		await waitForMovies(page);
		const dot = page.locator('.dot').first();
		await dot.hover({ force: true });
		const tooltip = page.locator('.tooltip');
		await expect(tooltip).toBeVisible({ timeout: 2000 });
		await expect(tooltip.locator('.tt-title')).not.toBeEmpty();
		await expect(tooltip.locator('.tt-genres')).not.toBeEmpty();
	});
});
