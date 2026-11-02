import { describe, expect, it } from "vitest";
import { getModulesState, isPathAllowed, syncModulesForUser } from "@/lib/appModules";

describe("appModules (Planning Edition)", () => {
  it("keeps core planning routes allowed and blocks retired pharmacy/review paths", async () => {
    await syncModulesForUser("owner-a");
    expect(getModulesState().ready).toBe(true);
    expect(isPathAllowed("/app/today")).toBe(true);
    expect(isPathAllowed("/app/planning")).toBe(true);
    expect(isPathAllowed("/app/calendar")).toBe(true);
    expect(isPathAllowed("/app/pharmacy")).toBe(false);
    expect(isPathAllowed("/app/review")).toBe(false);
  });
});
