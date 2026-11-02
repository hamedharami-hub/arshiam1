import { beforeEach, describe, expect, it } from "vitest";
import { findFeature } from "./featureRegistry";
import {
  getSidebarQuickLinks,
  normalizeSidebarQuickLinks,
  SIDEBAR_QUICK_LINKS_KEY,
  setSidebarQuickLinks,
  toggleSidebarQuickLink,
  moveSidebarQuickLink,
  resetSidebarQuickLinks,
  DEFAULT_SIDEBAR_QUICK_LINKS,
  SIDEBAR_QUICK_LINK_OPTIONS,
} from "./sidebarQuickLinks";

describe("sidebar quick links", () => {
  beforeEach(() => localStorage.clear());

  it("shares canonical labels with the registry while retaining structural shortcuts and groups", () => {
    for (const option of SIDEBAR_QUICK_LINK_OPTIONS.filter((option) => option.url.startsWith("/app/"))) {
      const feature = findFeature(option.url)!;
      expect(option.labelFa).toBe(feature.nameFa);
      expect(option.labelEn).toBe(feature.nameEn);
    }
    expect(SIDEBAR_QUICK_LINK_OPTIONS.find((option) => option.url === "__folders")?.group).toBe("core");
    expect(SIDEBAR_QUICK_LINK_OPTIONS.find((option) => option.url === "__tags")?.group).toBe("core");
    expect(SIDEBAR_QUICK_LINK_OPTIONS.find((option) => option.url === "/app/values")?.group).toBe("grow");
  });

  it("keeps Today available and rejects unknown routes", () => {
    setSidebarQuickLinks(["/app/notes", "/app/not-a-route"]);
    expect(getSidebarQuickLinks()).toEqual(["/app/today", "/app/notes"]);
    expect(localStorage.getItem(SIDEBAR_QUICK_LINKS_KEY)).toContain("/app/today");
    expect(localStorage.getItem(SIDEBAR_QUICK_LINKS_KEY)).not.toContain("not-a-route");
  });

  it("toggles quick links correctly while keeping Today pinned at 0", () => {
    setSidebarQuickLinks(["/app/today", "/app/planning", "/app/notes"]);
    toggleSidebarQuickLink("/app/notes", false);
    expect(getSidebarQuickLinks()).toEqual(["/app/today", "/app/planning"]);
    toggleSidebarQuickLink("/app/calendar", true);
    expect(getSidebarQuickLinks()).toEqual(["/app/today", "/app/planning", "/app/calendar"]);
    toggleSidebarQuickLink("/app/today", false);
    expect(getSidebarQuickLinks()[0]).toBe("/app/today");
  });

  it("moves quick links up and down while keeping Today pinned at index 0", () => {
    setSidebarQuickLinks(["/app/today", "/app/planning", "/app/notes", "/app/calendar"]);
    moveSidebarQuickLink("/app/notes", "up");
    expect(getSidebarQuickLinks()).toEqual(["/app/today", "/app/notes", "/app/planning", "/app/calendar"]);
    moveSidebarQuickLink("/app/notes", "up");
    expect(getSidebarQuickLinks()).toEqual(["/app/today", "/app/notes", "/app/planning", "/app/calendar"]);
    moveSidebarQuickLink("/app/notes", "down");
    expect(getSidebarQuickLinks()).toEqual(["/app/today", "/app/planning", "/app/notes", "/app/calendar"]);
    moveSidebarQuickLink("/app/today", "down");
    expect(getSidebarQuickLinks()[0]).toBe("/app/today");
  });

  it("resets quick links to default configuration", () => {
    setSidebarQuickLinks(["/app/today", "/app/notes"]);
    resetSidebarQuickLinks();
    expect(getSidebarQuickLinks()).toEqual(DEFAULT_SIDEBAR_QUICK_LINKS);
  });

  it("removes retired module quick links from stored preferences", () => {
    expect(normalizeSidebarQuickLinks(["/app/pharmacy-products", "/app/mind", "/app/review", "/app/notes"])).toEqual(["/app/today", "/app/notes"]);
  });
});
