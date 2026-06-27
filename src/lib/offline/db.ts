/**
 * IndexedDB wrapper for offline dashboard support.
 *
 * Two object stores:
 * - `orders`: caches the latest orders fetched from Supabase
 * - `queue`:  mutations made while offline, replayed on reconnect
 *
 * Uses the raw IndexedDB API — no dependency needed for this small surface.
 */

const DB_NAME = "punto5-dashboard";
const DB_VERSION = 1;
const ORDERS_STORE = "orders";
const QUEUE_STORE = "queue";

export interface QueuedMutation {
  id?: number;
  table: "orders" | "order_events";
  operation: "update" | "insert";
  recordId?: string; // for updates
  payload: Record<string, unknown>;
  createdAt: string;
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(ORDERS_STORE)) {
        db.createObjectStore(ORDERS_STORE); // key = "all-orders"
      }
      if (!db.objectStoreNames.contains(QUEUE_STORE)) {
        db.createObjectStore(QUEUE_STORE, { keyPath: "id", autoIncrement: true });
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

/** Add a mutation to the offline queue. */
export async function enqueueMutation(mutation: Omit<QueuedMutation, "id" | "createdAt">): Promise<void> {
  const db = await openDB();
  const tx = db.transaction(QUEUE_STORE, "readwrite");
  tx.objectStore(QUEUE_STORE).add({
    ...mutation,
    createdAt: new Date().toISOString(),
  });
  await txDone(tx);
  db.close();
}

/** Get all queued mutations, ordered by insertion. */
export async function getQueuedMutations(): Promise<QueuedMutation[]> {
  try {
    const db = await openDB();
    const tx = db.transaction(QUEUE_STORE, "readonly");
    const req = tx.objectStore(QUEUE_STORE).getAll();
    const result = await new Promise<QueuedMutation[]>((resolve) => {
      req.onsuccess = () => resolve((req.result as QueuedMutation[]) ?? []);
      req.onerror = () => resolve([]);
    });
    db.close();
    return result.sort((a, b) => (a.id ?? 0) - (b.id ?? 0));
  } catch {
    return [];
  }
}

/** Remove a mutation from the queue after successful sync. */
export async function dequeueMutation(id: number): Promise<void> {
  const db = await openDB();
  const tx = db.transaction(QUEUE_STORE, "readwrite");
  tx.objectStore(QUEUE_STORE).delete(id);
  await txDone(tx);
  db.close();
}

/** Clear the entire queue (after all mutations synced). */
export async function clearQueue(): Promise<void> {
  const db = await openDB();
  const tx = db.transaction(QUEUE_STORE, "readwrite");
  tx.objectStore(QUEUE_STORE).clear();
  await txDone(tx);
  db.close();
}

/** Count queued mutations (for UI badge). */
export async function queueCount(): Promise<number> {
  try {
    const db = await openDB();
    const tx = db.transaction(QUEUE_STORE, "readonly");
    const req = tx.objectStore(QUEUE_STORE).count();
    const result = await new Promise<number>((resolve) => {
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(0);
    });
    db.close();
    return result;
  } catch {
    return 0;
  }
}
