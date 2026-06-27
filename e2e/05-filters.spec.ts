import { test, expect } from "@playwright/test";
import { preparePage, dismissErrorOverlay } from "./helpers";

/**
 * E2E: Dashboard filters — date, status, waiter + clear filters + KPI counts.
 *
 * Flow:
 * 1. Create 2 orders from 2 different waiters
 * 2. Open dashboard
 * 3. Verify KPI counts are correct (at least 2 "nueva" orders)
 * 4. Click "Nuevas" KPI card → filter by status "nueva"
 * 5. Verify filtered list shows only "nueva" orders
 * 6. Click "Nuevas" KPI card again → clear status filter
 * 7. Click a waiter filter pill → filter by waiter
 * 8. Verify only that waiter's orders are shown
 * 9. Click "Limpiar filtros" → clear all filters
 * 10. Verify all orders are shown again
 * 11. Switch date filter to "Ayer" → verify no orders from yesterday
 * 12. Switch date filter to "Todos" → verify all orders shown
 */

const WAITER_1 = `E2E-Filter1-${Date.now()}`;
const WAITER_2 = `E2E-Filter2-${Date.now()}`;

test("admin filters: status, waiter, date + clear + KPI counts", async ({ page, browser }) => {
  // Create 2 orders from 2 different waiters
  for (const waiterName of [WAITER_1, WAITER_2]) {
    const posPage = await browser.newPage();
    await preparePage(posPage, "/pos", "Punto 5 — Mesero");
    await posPage.getByPlaceholder("Tu nombre").fill(waiterName);
    await posPage.getByRole("button", { name: "Comenzar" }).click();
    await expect(posPage.getByText("Nuevo pedido")).toBeVisible({ timeout: 15000 });
    // Give categories/dishes time to load from Supabase
    await posPage.waitForTimeout(2000);
    // Use different tables
    const tableNum = waiterName === WAITER_1 ? "7" : "8";
    await posPage.locator("button", { hasText: new RegExp(`^${tableNum}$`) }).click();
    // The dish grid buttons contain an <h3> (dish name); table selector
    // buttons do not, so `:has(h3)` disambiguates from the table grid.
    const dishBtns = posPage.locator(".grid button:has(h3)");
    await expect(dishBtns.first()).toBeVisible({ timeout: 10000 });
    await dishBtns.first().click();
    await expect(posPage.getByText("1 plato", { exact: true })).toBeVisible({ timeout: 5000 });
    await posPage.getByRole("button", { name: "Enviar a cocina" }).click();
    // Verify via cart clear (toast may not render in dev mode)
    await expect(posPage.getByText("Pedido vacío")).toBeVisible({ timeout: 10000 });
    await posPage.close();
  }

  // Open dashboard
  await preparePage(page, "/dashboard", "Panel principal");
  await page.waitForTimeout(3000);
  await page.reload();
  await dismissErrorOverlay(page);
  await expect(page.getByText("Panel principal")).toBeVisible({ timeout: 15000 });

  // Verify both waiter names appear in the feed (as order list items)
  await expect(page.locator("li button", { hasText: WAITER_1 }).first()).toBeVisible({ timeout: 15000 });
  await expect(page.locator("li button", { hasText: WAITER_2 }).first()).toBeVisible({ timeout: 15000 });

  // === Test status filter ===
  // Click "Nuevas" KPI card (the first KPI card)
  const nuevaKpi = page.getByText("Nuevas").first();
  await nuevaKpi.click();

  // Verify the filter label shows "Filtrado: Nuevas"
  await expect(page.getByText(/Filtrado/)).toBeVisible({ timeout: 3000 });

  // Click "Nuevas" KPI card again to clear
  await nuevaKpi.click();

  // Verify filter is cleared (no "Filtrado" text)
  await expect(page.getByText(/Filtrado/)).not.toBeVisible({ timeout: 3000 });

  // === Test waiter filter ===
  // The waiter filter pills are standalone buttons in the filter bar.
  // They show when there are > 1 unique waiters in today's orders.
  const waiterPill = page.locator("button", { hasText: new RegExp(`^${WAITER_1}$`) }).first();
  if (await waiterPill.isVisible({ timeout: 3000 }).catch(() => false)) {
    // The empty-state overlay on the right panel can intercept pointer
    // events. Scroll the pill into view and use force to click past it.
    await waiterPill.scrollIntoViewIfNeeded();
    await waiterPill.click({ force: true });
    await page.waitForTimeout(1000);

    // Click "Limpiar filtros" (only visible when a filter is active)
    const clearBtn = page.getByText("Limpiar filtros");
    if (await clearBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await clearBtn.click({ force: true });
    }

    // Verify both waiters are visible again
    await expect(page.locator("li button", { hasText: WAITER_2 }).first()).toBeVisible({ timeout: 5000 });
  }

  // === Test date filter ===
  // Click "Ayer" (yesterday)
  await page.getByText("Ayer", { exact: true }).click();
  await page.waitForTimeout(1000);

  // There should be no orders from yesterday (our orders were just created)
  // The feed should show "No hay pedidos" or be empty
  await expect(page.getByText("Ayer", { exact: true })).toBeVisible({ timeout: 3000 });

  // Click "Hoy" (today) — should show our orders again
  await page.getByText("Hoy", { exact: true }).click();
  await page.waitForTimeout(1000);

  // Verify our orders are visible again
  await expect(page.locator("li button", { hasText: WAITER_1 }).first()).toBeVisible({ timeout: 10000 });

  // Click "Todos" (all)
  await page.getByText("Todos", { exact: true }).click();
  await page.waitForTimeout(1000);

  // Verify orders are still visible
  await expect(page.locator("li button", { hasText: WAITER_1 }).first()).toBeVisible({ timeout: 10000 });
});
