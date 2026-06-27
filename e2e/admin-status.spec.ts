import { test, expect } from "@playwright/test";

/**
 * E2E test: Admin advances order status and can undo.
 *
 * Flow:
 * 1. Open dashboard
 * 2. Select the first order
 * 3. Click "Enviar a cocina" (advance from nueva → en_cocina)
 * 4. Verify undo banner appears
 * 5. Click "Deshacer"
 * 6. Verify status reverts
 */

test("admin advances status and undoes", async ({ page }) => {
  await page.goto("/dashboard");

  // Wait for dashboard to load
  await expect(page.getByText("Panel principal")).toBeVisible({ timeout: 15000 });

  // Click the first order in the feed
  const firstOrder = page.locator("button:has-text('Mesa')").first();
  await firstOrder.click();

  // Wait for order detail to load
  await expect(page.getByText("Enviar a cocina").or(page.getByText("Marcar como lista")).or(page.getByText("Marcar como servida"))).toBeVisible({ timeout: 5000 });

  // If the order is "nueva", advance it
  const sendButton = page.getByRole("button", { name: "Enviar a cocina" });
  if (await sendButton.isVisible()) {
    await sendButton.click();

    // Verify undo banner appears
    await expect(page.getByText("Deshacer")).toBeVisible({ timeout: 3000 });

    // Click undo
    await page.getByText("Deshacer").click();

    // Verify undo banner disappears
    await expect(page.getByText("Deshacer")).not.toBeVisible({ timeout: 3000 });

    // Verify the button is back to "Enviar a cocina"
    await expect(page.getByRole("button", { name: "Enviar a cocina" })).toBeVisible({ timeout: 3000 });
  }
});
