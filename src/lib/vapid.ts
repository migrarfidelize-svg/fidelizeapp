// Public VAPID key — safe to expose to browsers (that's the point of "public").
// If you regenerate, update both this constant and the VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY secrets.
export const VAPID_PUBLIC_KEY =
  "BFmbHB3cxbuLYopyPHbgLXv1Hn30WG5iY-KX3XVVWQQ7FBwEw4rA36tBeAzqAUtMJGufuebwk67gSvgBms0m0So";

/** base64url -> Uint8Array for PushManager.subscribe applicationServerKey. */
export function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; ++i) out[i] = raw.charCodeAt(i);
  return out;
}

const VAPID_STORAGE_KEY = "fidelize:vapid-public-key:v1";

function sameApplicationServerKey(actual: ArrayBuffer | null, expected: Uint8Array) {
  if (!actual) return false;
  const bytes = new Uint8Array(actual);
  return bytes.length === expected.length && bytes.every((value, index) => value === expected[index]);
}

export function isPushSubscriptionCompatible(subscription: PushSubscription | null): subscription is PushSubscription {
  if (!subscription) return false;
  const actualKey = subscription.options?.applicationServerKey ?? null;
  if (actualKey) return sameApplicationServerKey(actualKey, urlBase64ToUint8Array(VAPID_PUBLIC_KEY));
  const storedKey = typeof localStorage !== "undefined" ? localStorage.getItem(VAPID_STORAGE_KEY) : null;
  return storedKey === VAPID_PUBLIC_KEY;
}

/**
 * Returns a subscription bound to the current public VAPID key. Existing valid
 * subscriptions are preserved; an old/unknown key is unsubscribed and replaced
 * once, preventing stale subscriptions after a VPS key rotation.
 */
export async function ensureCompatiblePushSubscription(registration: ServiceWorkerRegistration) {
  const expectedKey = urlBase64ToUint8Array(VAPID_PUBLIC_KEY);
  let subscription = await registration.pushManager.getSubscription();
  let rotated = false;
  let previousEndpoint: string | undefined;

  if (subscription) {
    const staleSubscription = subscription;
    if (!isPushSubscriptionCompatible(subscription)) {
      previousEndpoint = staleSubscription.endpoint;
      const removed = await staleSubscription.unsubscribe();
      if (!removed) throw new Error("Não foi possível substituir a assinatura antiga de notificações.");
      subscription = null;
      rotated = true;
    }
  }

  if (!subscription) {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: expectedKey as BufferSource,
    });
  }

  if (typeof localStorage !== "undefined") localStorage.setItem(VAPID_STORAGE_KEY, VAPID_PUBLIC_KEY);
  return { subscription, rotated, previousEndpoint };
}
