import { Capacitor, registerPlugin } from "@capacitor/core";
import { GoogleAuthProvider, signInWithCredential, signInWithPopup, signInWithRedirect } from "firebase/auth";
import { auth, googleProvider } from "./firebase";
import config from "../../firebase-applet-config.json";

const nativeGoogle = registerPlugin<{ signIn(options: { clientId: string }): Promise<{ idToken: string }> }>("ArshnazGoogleAuth");

/**
 * Browsers and in-app webviews can refuse an OAuth popup outright (Chrome shows
 * "پنجرهٔ ورود بسته شد"). When that happens the only way forward is a full-page
 * redirect, which the /auth/callback route already completes through the normal
 * auth state listener. The guard keeps a browser that blocks both from bouncing
 * the user between Google and the app forever.
 */
const REDIRECT_GUARD = "google_redirect_attempted";
const REDIRECT_FALLBACK_CODES = new Set([
  "auth/popup-blocked",
  "auth/popup-closed-by-user",
  "auth/cancelled-popup-request",
  "auth/operation-not-supported-in-this-environment",
]);

function redirectAlreadyAttempted(): boolean {
  try {
    return sessionStorage.getItem(REDIRECT_GUARD) === "1";
  } catch {
    return false;
  }
}

function markRedirectAttempted() {
  try {
    sessionStorage.setItem(REDIRECT_GUARD, "1");
  } catch {
    /* private mode without storage: allow the single fallback anyway */
  }
}

/** Called by the callback route so a later attempt in the same tab can fall back again. */
export function clearGoogleRedirectGuard() {
  try {
    sessionStorage.removeItem(REDIRECT_GUARD);
  } catch {
    /* ignore */
  }
}

export async function signInGoogleCredential() {
  if (Capacitor.getPlatform() !== "android") {
    try {
      return await signInWithPopup(auth, googleProvider);
    } catch (err: any) {
      const code = err?.code || "";
      if (!REDIRECT_FALLBACK_CODES.has(code) || redirectAlreadyAttempted()) throw err;
      markRedirectAttempted();
      await signInWithRedirect(auth, googleProvider);
      // The page is navigating to Google; nothing after this resolves.
      return null;
    }
  }
  const { idToken } = await nativeGoogle.signIn({ clientId: config.oAuthClientId });
  if (!idToken) throw Object.assign(new Error("Missing Google credential"), { code: "GOOGLE_CREDENTIAL" });
  return signInWithCredential(auth, GoogleAuthProvider.credential(idToken));
}

export function googleSignInError(code: string): string {
  const messages: Record<string, string> = {
    GOOGLE_CONFIG: "ورود گوگل در اندروید آماده نیست. حساب Google و Google Play Services گوشی و تنظیمات شناسه برنامه و امضای APK در Google/Firebase باید بررسی شوند.",
    GOOGLE_CANCELLED: "ورود گوگل کامل نشد (GOOGLE_CANCELLED). اگر خودتان پنجره را نبستید و پس از انتخاب حساب برگشتید، ثبت شناسه و امضای این نسخهٔ اندروید در Google/Firebase باید بررسی شود.",
    GOOGLE_BUSY: "ورود گوگل در حال انجام است.",
    GOOGLE_CREDENTIAL: "اطلاعات ورود گوگل معتبر دریافت نشد. دوباره تلاش کنید.",
    "auth/unauthorized-domain": "دامنه برنامه در تنظیمات ورود Firebase مجاز نیست.",
    "auth/operation-not-allowed": "ورود با گوگل در Firebase فعال نیست.",
    "auth/admin-restricted-operation": "ورود توسط تنظیمات مدیر محدود شده است.",
    "auth/popup-blocked": "مرورگر پنجره ورود را مسدود کرده است.",
    "auth/popup-closed-by-user": "پنجرهٔ ورود بسته شد.",
    "auth/network-request-failed": "ارتباط با سرویس ورود برقرار نشد. اینترنت را بررسی کنید.",
    "auth/account-exists-with-different-credential": "این ایمیل با روش ورود دیگری ثبت شده است. با همان روش وارد شوید.",
  };
  return messages[code] || `ورود گوگل انجام نشد (${code || "UNKNOWN"}).`;
}
