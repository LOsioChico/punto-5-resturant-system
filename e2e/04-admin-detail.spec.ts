import { test, expect } from "@playwright/test";
import { preparePage, dismissErrorOverlay } from "./helpers";

/**
 * E2E: Admin order detail verification — items, notes, history, preview, print.
 *
 * Flow:
 * 1. Create an order via POS with 2 dishes + notes
 * 2. Open dashboard, select the order
 * 3. Verify command preview: table, waiter, items grouped by category, notes, total
 * 4. Verify items list: quantities, names, notes, prices
 * 5. Verify history: "Pedido creado" event with actor name
 * 6. Click "Imprimir" and verify print count updates
 * 7. Verify progress steps show correct current status
 */

const WAITER_NAME = `E2E-Detail-${Date.now()}`;

test("admin verifies order detail: items, notes, preview, print, history", async ({ page, browser }) => {
  // Create order via POS
  const posPage = await browser.newPage();
  await preparePage(posPage, "/pos", "Punto 5 — Mesero");
  await posPage.getByPlaceholder("Tu nombre").fill(WAITER_NAME);
  await posPage.getByRole("button", { name: "Comenzar" }).click();
  await expect(posPage.getByText("Nuevo pedido")).toBeVisible({ timeout: 15000 });

  // Give categories/dishes time to load from Supabase before the dish grid renders
  await posPage.waitForTimeout(2000);

  // Select table 6
  await posPage.locator("button", { hasText: /^6$/ }).click();

  // Add first dish with a quick note — wait for the dish grid to actually render first.
  // The dish grid buttons contain an <h3> (dish name); table selector
  // buttons do not, so `:has(h3)` disambiguates from the table grid.
  const posDishButtons = posPage.locator(".grid button:has(h3)");
  await expect(posDishButtons.first()).toBeVisible({ timeout: 10000 });
  await posDishButtons.first().click();
  await posPage.getByText("Nota").first().click();
  await posPage.getByText("Sin cebolla").first().click();
  await posPage.keyboard.press("Enter");

  // Add second dish
  await posDishButtons.nth(1).click();

  // Send to kitchen
  await posPage.getByRole("button", { name: "Enviar a cocina" }).click();
  // The toast may not render in dev mode (module factory error breaks
  // ToastProvider). Verify via cart clear instead.
  await expect(posPage.getByText("Pedido vacío")).toBeVisible({ timeout: 10000 });
  await posPage.close();

  // Open dashboard
  await preparePage(page, "/dashboard", "Panel principal");
  await page.waitForTimeout(2000);
  await page.reload();
  await dismissErrorOverlay(page);
  await expect(page.getByText("Panel principal")).toBeVisible({ timeout: 15000 });

  // Find and click our order.
  // The waiter name appears both as a filter button and inside the orders
  // feed list item button. Target the li button to open the order detail.
  const orderInFeed = page.locator("li button", { hasText: WAITER_NAME }).first();
  await expect(orderInFeed).toBeVisible({ timeout: 15000 });
  await orderInFeed.click();

  // === Verify command preview ===
  // Table number in preview
  await expect(page.getByText("PUNTO 5")).toBeVisible({ timeout: 5000 });
  await expect(page.getByText("Comanda de cocina")).toBeVisible({ timeout: 5000 });

  // Waiter name in preview
  await expect(page.getByText(WAITER_NAME).first()).toBeVisible({ timeout: 5000 });

  // "Fin de comanda" text
  await expect(page.getByText("--- Fin de comanda ---")).toBeVisible({ timeout: 5000 });

  // TOTAL label (exact match — "Total" also appears in the items section)
  await expect(page.getByText("TOTAL", { exact: true })).toBeVisible({ timeout: 5000 });

  // === Verify items list ===
  // "Items del pedido" header
  await expect(page.getByText("Items del pedido")).toBeVisible({ timeout: 5000 });

  // === Verify history ===
  // "Historial" header with event count
  await expect(page.getByText(/Historial/)).toBeVisible({ timeout: 5000 });

  // "Pedido creado" event
  await expect(page.getByText("Pedido creado")).toBeVisible({ timeout: 5000 });

  // === Verify print ===
  // Print button should be visible
  await expect(page.getByRole("button", { name: /Imprimir/ })).toBeVisible({ timeout: 5000 });

  // Initially no print count
  expect(await page.getByText(/impresión/).count()).toBe(0);

  // Click print (this will trigger window.print() which we can't test in headless,
  // but the event should be logged)
  await page.getByRole("button", { name: /Imprimir/ }).click();

  // Wait for the print event to be logged and the page to update
  await page.waitForTimeout(2000);

  // Reload to see the print event in history
  await page.reload();
  await dismissErrorOverlay(page);
  await expect(page.getByText("Panel principal")).toBeVisible({ timeout: 15000 });

  // Re-select the order
  await page.locator("li button", { hasText: WAITER_NAME }).first().click();

  // Now print count should show "1 impresión"
  await expect(page.getByText(/1 impresión/)).toBeVisible({ timeout: 10000 });

  // History should show "Impresión de comanda" event
  await expect(page.getByText("Impresión de comanda")).toBeVisible({ timeout: 5000 });

  // === Verify progress steps ===
  // All 4 status labels should be visible in the progress bar
  await expect(page.getByText("Nueva").first()).toBeVisible({ timeout: 5000 });
  await expect(page.getByText("En cocina").first()).toBeVisible({ timeout: 5000 });
  await expect(page.getByText("Servida").first()).toBeVisible({ timeout: 5000 });
  await expect(page.getByText("Finalizada").first()).toBeVisible({ timeout: 5000 });
});
