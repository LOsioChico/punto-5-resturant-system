/**
 * IndexedDB wrapper for offline dashboard support.
 *
 * Caches the latest orders so the admin can view them when offline.
 * Read-only — mutations are disabled while offline.
 *
 * Uses the raw IndexedDB API — no dependency needed for this small surface.
 */

const DB_NAME = "punto5-dashboard";
const DB_VERSION = 1;
const ORDERS_STORE = "orders";

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(ORDERS_STORE)) {
        db.createObjectStore(ORDERS_STORE); // key = "all-orders"
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

/** Wait for a transaction to complete. */
function txDone(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

/** Save all orders to IndexedDB (replaces previous cache). */
export async function cacheOrders(orders: unknown[]): Promise<void> {
  try {
    const db = await openDB();
    const tx = db.transaction(ORDERS_STORE, "readwrite");
    tx.objectStore(ORDERS_STORE).put(orders, "all-orders");
    await txDone(tx);
    db.close();
  } catch {
    // IndexedDB might be unavailable (private mode) — silently ignore
  }
}

/** Load cached orders from IndexedDB. Returns null if none or error. */
export async function loadCachedOrders<T = unknown>(): Promise<T[] | null> {
  try {
    const db = await openDB();
    const tx = db.transaction(ORDERS_STORE, "readonly");
    const req = tx.objectStore(ORDERS_STORE).get("all-orders");
    const result = await new Promise<T[] | null>((resolve) => {
      req.onsuccess = () => resolve((req.result as T[]) ?? null);
      req.onerror = () => resolve(null);
    });
    db.close();
    return result;
  } catch {
    return null;
  }
}
