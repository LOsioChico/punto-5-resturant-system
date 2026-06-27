import type { Page } from "@playwright/test";

/**
 * Block the PWA service worker — it caches JS chunks and can cause stale
 * module issues on page reloads in dev mode.
 */
export async function blockServiceWorker(page: Page) {
  await page.route("**/sw.js", (route) => route.abort());
}

/**
 * Navigate to a URL and wait for the expected text to become visible.
 * Blocks the service worker and uses `networkidle` to ensure all chunks
 * are loaded before proceeding. Reloads once if the first load fails
 * (cold dev server compilation).
 */
export async function preparePage(
  page: Page,
  url: string,
  expectedText: string,
  timeout = 15000,
) {
  await blockServiceWorker(page);
  await page.goto(url, { waitUntil: "networkidle" });

  // If the expected text is not visible within a short window, reload once
  // to recover from a cold-dev-server compilation delay.
  try {
    await page.getByText(expectedText).waitFor({ state: "visible", timeout: 8000 });
  } catch {
    await page.reload({ waitUntil: "networkidle" });
    await page.getByText(expectedText).waitFor({ state: "visible", timeout });
  }
}

/**
 * Dismiss the Next.js dev-mode error overlay if present.
 * The overlay renders an "icon" button and a close button. Clicking the
 * close button removes it so it doesn't block interactions.
 */
export async function dismissErrorOverlay(page: Page) {
  const closeBtn = page.locator("#nextjs__container_errors_ button[aria-label='Close'], #nextjs-portal button[aria-label='Close']").first();
  if (await closeBtn.isVisible({ timeout: 500 }).catch(() => false)) {
    await closeBtn.click().catch(() => {});
  }
}
