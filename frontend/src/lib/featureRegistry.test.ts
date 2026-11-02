import { describe, it, expect } from "vitest";
import { FEATURES, FEATURE_CENTERS, findFeature, getFeatureLabel, featureSearchText, getFeatureNavigation, isFeatureAvailable } from "./featureRegistry";
import type { ModulesState } from "./appModules";

const NAVIGABLE_FEATURES = [
  "/app/today",
  "/app/inbox",
  "/app/planning",
  "/app/calendar",
  "/app/tomorrow",
  "/app/next7",
  "/app/smart",
  "/app/pomodoro",
  "/app/notes",
  "/app/values",
  "/app/stats",
  "/app/widgets",
  "/app/shared",
  "/app/settings",
  "/app/admin",
  "/app/new/task",
  "/app/new/note",
];

describe("featureRegistry (Planning Edition)", () => {
  it("maps canonical navigation and rejects unknown routes rather than inventing destinations", () => {
    const feature = findFeature("/app/planning")!;
    expect(getFeatureNavigation(feature.to)).toEqual({ url: feature.to, label: feature.nameFa, icon: feature.icon });
    expect(() => getFeatureNavigation("/app/not-a-route")).toThrow("Unregistered navigation feature");
  });

  it("role-gates the admin item", () => {
    const state: ModulesState = { ready: true, installed: [], unlocked: [], isAdmin: false, isOwner: false };
    expect(isFeatureAvailable(findFeature("/app/planning")!, state)).toBe(true);
    expect(isFeatureAvailable(findFeature("/app/admin")!, state)).toBe(false);
    expect(isFeatureAvailable(findFeature("/app/admin")!, state, true)).toBe(true);
  });

  it("covers every navigable feature with a registry entry (no orphans)", () => {
    const registered = new Set(FEATURES.map((feature) => feature.to));
    const orphans = NAVIGABLE_FEATURES.filter((to) => !registered.has(to));
    expect(orphans).toEqual([]);
  });

  it("has no duplicate routes", () => {
    const seen = new Set<string>();
    const duplicates: string[] = [];
    for (const feature of FEATURES) {
      if (seen.has(feature.to)) duplicates.push(feature.to);
      seen.add(feature.to);
    }
    expect(duplicates).toEqual([]);
  });

  it("gives every entry non-empty bilingual names and keywords", () => {
    for (const feature of FEATURES) {
      expect(feature.nameFa.trim().length, `${feature.to} nameFa`).toBeGreaterThan(0);
      expect(feature.nameEn.trim().length, `${feature.to} nameEn`).toBeGreaterThan(0);
      expect(feature.keywordsFa.trim().length, `${feature.to} keywordsFa`).toBeGreaterThan(0);
      expect(feature.keywordsEn.trim().length, `${feature.to} keywordsEn`).toBeGreaterThan(0);
    }
  });

  it("uses only declared centers", () => {
    const centers = new Set(FEATURE_CENTERS.map((center) => center.id));
    for (const feature of FEATURES) {
      expect(centers.has(feature.center), `${feature.to} center`).toBe(true);
    }
  });

  it("assigns each entry an icon and a unique order", () => {
    const orders = new Set<number>();
    const duplicates: number[] = [];
    for (const feature of FEATURES) {
      expect(feature.icon, `${feature.to} icon`).toBeTruthy();
      if (orders.has(feature.order)) duplicates.push(feature.order);
      orders.add(feature.order);
    }
    expect(duplicates).toEqual([]);
  });

  it("exposes helpers that resolve routes and searchable text", () => {
    expect(findFeature("/app/today")?.nameEn).toBe("Today");
    expect(findFeature("/app/does-not-exist")).toBeUndefined();
    const today = findFeature("/app/today")!;
    expect(getFeatureLabel(today, true)).toBe("Today");
    expect(getFeatureLabel(today, false)).toBe("امروز");
    expect(featureSearchText(today)).toContain("today");
  });
});
