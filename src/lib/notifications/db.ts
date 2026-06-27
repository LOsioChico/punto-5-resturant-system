/**
 * IndexedDB wrapper for push notification history.
 *
 * The service worker stores incoming push notifications here so the app
 * can display them even if the user dismissed the system notification.
 */

const DB_NAME = "punto5-notifications";
const DB_VERSION = 1;
const STORE = "notifications";

export interface StoredNotification {
  id?: number;
  title: string;
  body: string;
  tag: string;
  url: string;
  timestamp: number;
  read: boolean;
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        const store = db.createObjectStore(STORE, { keyPath: "id", autoIncrement: true });
        store.createIndex("timestamp", "timestamp", { unique: false });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function txDone(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

/** Load all stored notifications, newest first. */
export async function loadNotifications(): Promise<StoredNotification[]> {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE, "readonly");
    const req = tx.objectStore(STORE).getAll();
    const result = await new Promise<StoredNotification[]>((resolve) => {
      req.onsuccess = () => resolve((req.result as StoredNotification[]) ?? []);
      req.onerror = () => resolve([]);
    });
    db.close();
    return result.sort((a, b) => b.timestamp - a.timestamp);
  } catch {
    return [];
  }
}

/** Mark all notifications as read. */
export async function markAllNotificationsRead(): Promise<void> {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE, "readwrite");
    const store = tx.objectStore(STORE);
    const req = store.getAll();
    const all = await new Promise<StoredNotification[]>((resolve) => {
      req.onsuccess = () => resolve((req.result as StoredNotification[]) ?? []);
      req.onerror = () => resolve([]);
    });
    for (const n of all) {
      if (!n.read) {
        store.put({ ...n, read: true });
      }
    }
    await txDone(tx);
    db.close();
  } catch {
    // ignore
  }
}

/** Clear all stored notifications. */
export async function clearNotifications(): Promise<void> {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).clear();
    await txDone(tx);
    db.close();
  } catch {
    // ignore
  }
}

/** Count unread notifications. */
export async function getUnreadCount(): Promise<number> {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE, "readonly");
    const req = tx.objectStore(STORE).getAll();
    const all = await new Promise<StoredNotification[]>((resolve) => {
      req.onsuccess = () => resolve((req.result as StoredNotification[]) ?? []);
      req.onerror = () => resolve([]);
    });
    db.close();
    return all.filter((n) => !n.read).length;
  } catch {
    return 0;
  }
}
