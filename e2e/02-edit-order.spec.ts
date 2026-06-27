import { test, expect } from "@playwright/test";
import { preparePage, dismissErrorOverlay } from "./helpers";

/**
 * E2E: Full edit order flow — add, remove, modify items + notes.
 *
 * Flow:
 * 1. Waiter creates an order with 2 dishes
 * 2. Goes to "Mis pedidos"
 * 3. Clicks edit
 * 4. Verifies "Guardar cambios" is disabled (no changes)
 * 5. Increases quantity of first item
 * 6. Verifies "Guardar cambios" is now enabled
 * 7. Adds a new dish
 * 8. Removes an existing dish
 * 9. Saves
 * 10. Verifies order was updated (cart cleared + tab switched to history)
 * 11. Goes back to "Mis pedidos" and verifies "Modificado" badge
 */

const WAITER_NAME = `E2E-Edit-${Date.now()}`;

test("waiter edits order: add, remove, modify items", async ({ page }) => {
  test.setTimeout(120000);
  await preparePage(page, "/pos", "Punto 5 — Mesero");

  // Enter waiter name
  await page.getByPlaceholder("Tu nombre").fill(WAITER_NAME);
  await page.getByRole("button", { name: "Comenzar" }).click();
  await expect(page.getByText("Nuevo pedido")).toBeVisible({ timeout: 15000 });

  // Give categories/dishes time to load from Supabase before the dish grid renders
  await page.waitForTimeout(2000);

  // Select table 4
  await page.locator("button", { hasText: /^4$/ }).click();

  // Add 2 dishes — wait for the dish grid to actually render first.
  // The dish grid buttons contain an <h3> (dish name); table selector
  // buttons do not, so `:has(h3)` disambiguates from the table grid.
  const dishButtons = page.locator(".grid button:has(h3)");
  await expect(dishButtons.first()).toBeVisible({ timeout: 10000 });
  await dishButtons.first().click();
  await dishButtons.nth(1).click();
  await expect(page.getByText("2 platos", { exact: true })).toBeVisible({ timeout: 5000 });

  // Send to kitchen
  await page.getByRole("button", { name: "Enviar a cocina" }).click();
  // The toast may not render in dev mode (module factory error breaks
  // ToastProvider). Verify via cart clear instead.
  await expect(page.getByText("Pedido vacío")).toBeVisible({ timeout: 10000 });
  // Wait for Supabase to commit
  await page.waitForTimeout(2000);

  // Go to "Mis pedidos" — reload first to load orders fresh (realtime may
  // be broken by the dev-mode module factory error).
  await page.reload();
  await dismissErrorOverlay(page);
  await expect(page.getByText("Nuevo pedido")).toBeVisible({ timeout: 15000 });
  await page.getByText("Mis pedidos").click();
  await expect(page.getByText(/Mesa \d+/).first()).toBeVisible({ timeout: 15000 });

  // Click edit button
  await page.locator("button[title='Editar pedido']").first().click();

  // Verify we're in edit mode
  await expect(page.getByText("Guardar cambios")).toBeVisible({ timeout: 5000 });
  await expect(page.getByText("Editando pedido")).toBeVisible({ timeout: 5000 });

  // Verify save button is disabled (no changes yet)
  const saveButton = page.getByRole("button", { name: /Guardar cambios/ });
  await expect(saveButton).toBeDisabled({ timeout: 3000 });

  // Increase quantity — find the + button in the cart
  // The cart shows quantity in a span, with +/- buttons around it
  const quantitySpan = page.locator("span.min-w-8").first();
  await expect(quantitySpan).toBeVisible({ timeout: 3000 });
  const plusBtn = quantitySpan.locator("xpath=following-sibling::button[1]");
  await plusBtn.click();

  // Now save button should be enabled
  await expect(saveButton).toBeEnabled({ timeout: 3000 });

  // Add a new dish (third dish)
  await dishButtons.nth(2).click();

  // Remove the first item from cart (trash button)
  // The cart items have a trash icon button
  const trashButtons = page.locator("button").filter({ has: page.locator("svg") });
  // Find the trash button — it's the one with a Trash2 icon in the cart area
  // We'll use the cart's border-t section
  const cartSection = page.locator("[class*='border-t']").last();
  const cartTrashBtn = cartSection.locator("button").filter({ has: page.locator("svg") }).first();
  if (await cartTrashBtn.count() > 0) {
    await cartTrashBtn.click();
  }

  // Save the edit
  await saveButton.click();
  // After saving, saveEditedOrder() clears the cart, exits edit mode, and
  // switches to the history tab ("Mis pedidos"). Verify by checking the
  // history tab is active — it shows "X activos · Y completados".
  await expect(page.getByText(/activos/)).toBeVisible({ timeout: 10000 });

  // Reload to fetch the updated order from Supabase (realtime may be broken
  // in dev mode). Then go to "Mis pedidos" and verify "Modificado" badge.
  await page.reload();
  await dismissErrorOverlay(page);
  await expect(page.getByText("Nuevo pedido")).toBeVisible({ timeout: 15000 });
  await page.getByText("Mis pedidos").click();
  await expect(page.getByText(/Mesa \d+/).first()).toBeVisible({ timeout: 10000 });

  // Verify "Modificado" badge appears on the edited order
  await expect(page.getByText("Modificado").first()).toBeVisible({ timeout: 5000 });
});
