import { beforeEach, describe, expect, it } from "vitest";
import { purgeRetiredFeatureKeys } from "./retiredFeatures";

describe("retired feature key purge", () => {
  beforeEach(() => localStorage.clear());

  it("drops pinned and quick links that point at redirected routes", () => {
    localStorage.setItem("arshnaz_sidebar_quick_links_v1", JSON.stringify(["/app/today", "/app/garden", "/app/planning"]));
    localStorage.setItem("mind_pinned_tools_v2_user-1", JSON.stringify([{ url: "/app/mind" }, { url: "/app/notes" }, "socratic-dialog"]));

    purgeRetiredFeatureKeys();

    expect(JSON.parse(localStorage.getItem("arshnaz_sidebar_quick_links_v1")!)).toEqual(["/app/today", "/app/planning"]);
    expect(JSON.parse(localStorage.getItem("mind_pinned_tools_v2_user-1")!)).toEqual([{ url: "/app/notes" }]);
  });

  it("leaves unrelated keys and non-array payloads untouched", () => {
    localStorage.setItem("unrelated_key", JSON.stringify(["/app/garden"]));
    localStorage.setItem("arshnaz_sidebar_quick_links_v1", JSON.stringify({ pinned: ["/app/garden"] }));

    purgeRetiredFeatureKeys();

    expect(JSON.parse(localStorage.getItem("unrelated_key")!)).toEqual(["/app/garden"]);
    expect(JSON.parse(localStorage.getItem("arshnaz_sidebar_quick_links_v1")!)).toEqual({ pinned: ["/app/garden"] });
  });
});
