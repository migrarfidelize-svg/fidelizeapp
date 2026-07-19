// Public VAPID key — safe to expose to browsers (that's the point of "public").
// If you regenerate, update both this constant and the VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY secrets.
export const VAPID_PUBLIC_KEY =
  "BKcChuaKUYs-Z0jc0XylHSPpUMBKnqa7NKi7663KjfeQQsTqOe-rf4i1Dh7g3RC6QNFuoHqvxuKZpvyRKXRJzBU";

/** base64url -> Uint8Array for PushManager.subscribe applicationServerKey. */
export function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; ++i) out[i] = raw.charCodeAt(i);
  return out;
}
