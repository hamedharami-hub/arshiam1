import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  platform: vi.fn(), native: vi.fn(), popup: vi.fn(), redirect: vi.fn(), credential: vi.fn(), signIn: vi.fn(),
}));
vi.mock("@capacitor/core", () => ({ Capacitor: { getPlatform: mocks.platform }, registerPlugin: () => ({ signIn: mocks.native }) }));
vi.mock("firebase/auth", () => ({ GoogleAuthProvider: { credential: mocks.credential }, signInWithPopup: mocks.popup, signInWithRedirect: mocks.redirect, signInWithCredential: mocks.signIn }));
vi.mock("./firebase", () => ({ auth: {}, googleProvider: {} }));
import { clearGoogleRedirectGuard, googleSignInError, signInGoogleCredential } from "./googleSignIn";

describe("Google login platform boundary", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    sessionStorage.clear();
  });
  it("uses system Google credential on Android and authenticates it with Firebase", async () => {
    mocks.platform.mockReturnValue("android");
    mocks.native.mockResolvedValue({ idToken: "test-google-token" });
    mocks.credential.mockReturnValue({ providerId: "google.com" });
    mocks.signIn.mockResolvedValue({ user: { uid: "test-user" } });
    await expect(signInGoogleCredential()).resolves.toEqual({ user: { uid: "test-user" } });
    expect(mocks.popup).not.toHaveBeenCalled();
    expect(mocks.credential).toHaveBeenCalledWith("test-google-token");
    expect(mocks.signIn).toHaveBeenCalledOnce();
  });
  it("retains browser popup login on web", async () => {
    mocks.platform.mockReturnValue("web");
    await signInGoogleCredential();
    expect(mocks.popup).toHaveBeenCalledOnce();
    expect(mocks.native).not.toHaveBeenCalled();
  });
  it("never falls back to a WebView popup when native login fails", async () => {
    mocks.platform.mockReturnValue("android");
    mocks.native.mockRejectedValue({ code: "GOOGLE_CANCELLED" });
    await expect(signInGoogleCredential()).rejects.toEqual({ code: "GOOGLE_CANCELLED" });
    expect(mocks.popup).not.toHaveBeenCalled();
    expect(mocks.signIn).not.toHaveBeenCalled();
  });
  it("rejects an empty native credential", async () => {
    mocks.platform.mockReturnValue("android");
    mocks.native.mockResolvedValue({ idToken: "" });
    await expect(signInGoogleCredential()).rejects.toMatchObject({ code: "GOOGLE_CREDENTIAL" });
    expect(mocks.signIn).not.toHaveBeenCalled();
  });
  it("distinguishes provider configuration from popup errors", () => {
    expect(googleSignInError("auth/unauthorized-domain")).not.toEqual(googleSignInError("auth/popup-blocked"));
    expect(googleSignInError("auth/operation-not-allowed")).toContain("فعال نیست");
  });

  it("falls back to a full-page redirect when the browser blocks the popup", async () => {
    mocks.platform.mockReturnValue("web");
    mocks.popup.mockRejectedValue({ code: "auth/popup-blocked" });
    mocks.redirect.mockResolvedValue(undefined);
    await expect(signInGoogleCredential()).resolves.toBeNull();
    expect(mocks.redirect).toHaveBeenCalledOnce();
  });

  it("redirects at most once per tab so a browser that blocks both cannot loop", async () => {
    mocks.platform.mockReturnValue("web");
    mocks.popup.mockRejectedValue({ code: "auth/popup-blocked" });
    mocks.redirect.mockResolvedValue(undefined);
    await signInGoogleCredential();
    await expect(signInGoogleCredential()).rejects.toMatchObject({ code: "auth/popup-blocked" });
    expect(mocks.redirect).toHaveBeenCalledOnce();
  });

  it("clears the guard after the callback route so a later attempt can redirect again", async () => {
    mocks.platform.mockReturnValue("web");
    mocks.popup.mockRejectedValue({ code: "auth/popup-blocked" });
    mocks.redirect.mockResolvedValue(undefined);
    await signInGoogleCredential();
    clearGoogleRedirectGuard();
    await signInGoogleCredential();
    expect(mocks.redirect).toHaveBeenCalledTimes(2);
  });

  it("does not redirect for errors a redirect cannot fix", async () => {
    mocks.platform.mockReturnValue("web");
    mocks.popup.mockRejectedValue({ code: "auth/unauthorized-domain" });
    await expect(signInGoogleCredential()).rejects.toMatchObject({ code: "auth/unauthorized-domain" });
    expect(mocks.redirect).not.toHaveBeenCalled();
  });
});
