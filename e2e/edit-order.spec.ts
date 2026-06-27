import { test, expect } from "@playwright/test";

/**
 * E2E test: Waiter edits an existing order.
 *
 * Flow:
 * 1. Enter as waiter
 * 2. Go to "Mis pedidos"
 * 3. Find an order with status "nueva" or "en cocina"
 * 4. Click edit
 * 5. Modify quantity
 * 6. Verify "Guardar cambios" enables
 * 7. Save
 * 8. Verify toast
 */

const WAITER_NAME = `TestEdit-${Date.now()}`;

test("waiter edits an order", async ({ page }) => {
  await page.goto("/pos");

  // Wait for hydration
  await expect(page.getByText("Punto 5 — Mesero")).toBeVisible({ timeout: 15000 });

  // Enter waiter name
  await page.getByPlaceholder("Tu nombre").fill(WAITER_NAME);
  await page.getByRole("button", { name: "Comenzar" }).click();
  await expect(page.getByText("Nuevo pedido")).toBeVisible({ timeout: 15000 });

  // Create an order first — table buttons show just the number
  await page.locator("button", { hasText: /^\d+$/ }).first().click();
  const dishAddBtn = page.locator(".grid > div button").first();
  await dishAddBtn.click();
  await expect(page.getByText("plato")).toBeVisible({ timeout: 5000 });
  await page.getByRole("button", { name: "Enviar a cocina" }).click();
  await expect(page.getByText(/Pedido enviado/)).toBeVisible({ timeout: 5000 });

  // Go to "Mis pedidos"
  await page.getByText("Mis pedidos").click();

  // Wait for the order to appear — look for any "Mesa X" text
  await expect(page.getByText(/Mesa \d+/).first()).toBeVisible({ timeout: 5000 });

  // Click edit button (pencil icon)
  const editButton = page.locator("button[title='Editar pedido']").first();
  await editButton.click();

  // Should be back in "Nuevo pedido" tab with the order loaded
  await expect(page.getByText("Guardar cambios")).toBeVisible({ timeout: 5000 });

  // The button should be disabled initially (no changes)
  const saveButton = page.getByRole("button", { name: "Guardar cambios" });
  await expect(saveButton).toBeDisabled({ timeout: 3000 });

  // Increase quantity — the cart has counter buttons with bg-stone-800
  // The + button comes after the quantity number
  const quantityDisplay = page.locator("span.min-w-8").first();
  await expect(quantityDisplay).toBeVisible({ timeout: 3000 });
  // The + button is the next sibling after the quantity span
  const plusBtn = quantityDisplay.locator("xpath=following-sibling::button[1]");
  await plusBtn.click();

  // Now the button should be enabled
  await expect(saveButton).toBeEnabled({ timeout: 3000 });

  // Save
  await saveButton.click();
  await expect(page.getByText(/Pedido actualizado/)).toBeVisible({ timeout: 5000 });
});
