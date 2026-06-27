import { test, expect } from "@playwright/test";

/**
 * E2E test: Waiter creates an order and admin sees it.
 *
 * Flow:
 * 1. Waiter enters name on /pos
 * 2. Selects a table
 * 3. Adds a dish from the menu
 * 4. Adds a quick note
 * 5. Sends to kitchen
 * 6. Opens /dashboard and sees the order
 */

const WAITER_NAME = `TestWaiter-${Date.now()}`;
const TABLE_NUMBER = "1";

test("waiter creates order, admin sees it on dashboard", async ({ page, browser }) => {
  // --- Waiter side ---
  await page.goto("/pos");

  // Wait for hydration to complete
  await expect(page.getByText("Punto 5 — Mesero")).toBeVisible({ timeout: 15000 });

  // Enter waiter name
  await page.getByPlaceholder("Tu nombre").fill(WAITER_NAME);
  await page.getByRole("button", { name: "Comenzar" }).click();

  // Wait for menu to load
  await expect(page.getByText("Nuevo pedido")).toBeVisible({ timeout: 15000 });

  // Select a table — buttons show just the number
  await page.locator("button", { hasText: /^\d+$/ }).first().click();

  // Add a dish — click the first + button in the dish grid
  const dishAddBtn = page.locator(".grid > div button").first();
  await dishAddBtn.click();

  // Verify item appears in cart
  await expect(page.getByText("plato")).toBeVisible({ timeout: 5000 });

  // Add a quick note
  await page.getByText("Nota").first().click();
  await page.getByText("Sin cebolla").first().click();
  // Close notes editor by pressing Enter
  await page.keyboard.press("Enter");

  // Send to kitchen
  await page.getByRole("button", { name: "Enviar a cocina" }).click();

  // Verify toast appears
  await expect(page.getByText(/Pedido enviado/)).toBeVisible({ timeout: 5000 });

  // --- Admin side ---
  const adminPage = await browser.newPage();
  await adminPage.goto("/dashboard");

  // Wait for dashboard to load
  await expect(adminPage.getByText("Panel principal")).toBeVisible({ timeout: 15000 });

  // Give the dashboard time to fetch orders, then check
  // The order was created before the admin page opened, so the initial fetch should include it
  await adminPage.waitForTimeout(2000);
  // Reload to ensure fresh data (in case service worker cached the page)
  await adminPage.reload();
  await expect(adminPage.getByText("Panel principal")).toBeVisible({ timeout: 15000 });

  // The order should appear in the feed — match by waiter name (unique per test run)
  // It appears in multiple places (active waiters, filter, feed) so use .first()
  await expect(adminPage.getByText(WAITER_NAME).first()).toBeVisible({ timeout: 15000 });

  await adminPage.close();
});
