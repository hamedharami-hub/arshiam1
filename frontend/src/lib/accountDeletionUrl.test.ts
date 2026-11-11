import { describe, expect, it } from "vitest";
import { resolveAccountDeletionUrl } from "./accountDeletionUrl";

describe("account deletion endpoint", () => {
  it("uses the web app origin even when a separate FastAPI origin exists", () => {
    expect(resolveAccountDeletionUrl("https://arshnaz.vercel.app", false, "https://other.example")).toBe("https://arshnaz.vercel.app/api/user/delete-account");
  });

  it("requires an explicit HTTPS Vercel origin in a native build", () => {
    expect(() => resolveAccountDeletionUrl("capacitor://localhost", true)).toThrow("VITE_ACCOUNT_API_URL");
    expect(resolveAccountDeletionUrl("capacitor://localhost", true, "https://arshnaz.vercel.app")).toBe("https://arshnaz.vercel.app/api/user/delete-account");
    expect(() => resolveAccountDeletionUrl("capacitor://localhost", true, "http://insecure.example")).toThrow("HTTPS");
    expect(() => resolveAccountDeletionUrl("capacitor://localhost", true, "https://arshnaz.vercel.app/other")).toThrow("HTTPS");
  });
});
