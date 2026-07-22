/**
 * Minimal IndexedDB key/value store used as a fallback when localStorage
 * quota is exceeded (large designs, many badges, etc.). Browser-only.
 */
const DB_NAME = "fidelize-kv";
const STORE = "kv";

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      req.result.createObjectStore(STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function idbGet<T = unknown>(key: string): Promise<T | null> {
  if (typeof indexedDB === "undefined") return null;
  try {
    const db = await openDb();
    return await new Promise<T | null>((resolve, reject) => {
      const tx = db.transaction(STORE, "readonly");
      const req = tx.objectStore(STORE).get(key);
      req.onsuccess = () => resolve((req.result as T) ?? null);
      req.onerror = () => reject(req.error);
    });
  } catch {
    return null;
  }
}

export async function idbSet(key: string, value: unknown): Promise<boolean> {
  if (typeof indexedDB === "undefined") return false;
  try {
    const db = await openDb();
    return await new Promise<boolean>((resolve) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).put(value, key);
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => resolve(false);
      tx.onabort = () => resolve(false);
    });
  } catch {
    return false;
  }
}

/**
 * Try localStorage first; on quota error (or any failure) fall back to IndexedDB.
 * Returns "ls" | "idb" | "fail".
 */
export async function persistJson(
  key: string,
  value: unknown,
): Promise<"ls" | "idb" | "fail"> {
  const json = JSON.stringify(value);
  try {
    window.localStorage.setItem(key, json);
    return "ls";
  } catch {
    const ok = await idbSet(key, json);
    return ok ? "idb" : "fail";
  }
}

export async function readJson<T = unknown>(key: string): Promise<T | null> {
  try {
    const raw = window.localStorage.getItem(key);
    if (raw) return JSON.parse(raw) as T;
  } catch {
    /* ignore */
  }
  const fallback = await idbGet<string>(key);
  if (!fallback) return null;
  try {
    return JSON.parse(fallback) as T;
  } catch {
    return null;
  }
}
