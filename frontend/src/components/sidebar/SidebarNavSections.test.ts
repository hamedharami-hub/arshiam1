import { describe, expect, it } from "vitest";
import { NAV_ITEMS, SECTIONS, EN_LABELS, filterNavByModules } from "./SidebarNavSections";
import { findFeature, getFeatureNavigation } from "@/lib/featureRegistry";
import type { ModulesState } from "@/lib/appModules";

const state: ModulesState = { ready: true, installed: [], unlocked: [], isAdmin: false, isOwner: false };

describe("Planning navigation hierarchy", () => {
  it("uses registry routes, bilingual labels and icons", () => {
    for (const item of NAV_ITEMS) {
      const feature = findFeature(item.url!)!;
      expect(feature).toBeDefined();
      expect(item.label).toBe(feature.nameFa);
      expect(EN_LABELS[item.label]).toBe(feature.nameEn);
      expect(item.icon).toBe(feature.icon);
    }
  });

  it("role-gates the admin item", () => {
    const items = [getFeatureNavigation("/app/planning"), getFeatureNavigation("/app/admin")];
    expect(filterNavByModules(items, state).map((item) => item.url)).toEqual(["/app/planning"]);
    expect(filterNavByModules(items, state, true).map((item) => item.url)).toEqual(["/app/planning", "/app/admin"]);
  });

  it("keeps Planning in primary navigation and removes the global Kanban entry", () => {
    const primary = NAV_ITEMS.slice(0, 4).map((item) => item.url);
    expect(primary).not.toContain("/app/buckets");
    expect(primary).not.toContain("/app/kanban");
    expect(primary).toContain("/app/planning");
    const doSection = SECTIONS.find((section) => section.id === "do");
    expect(doSection?.items.some((item) => item.url === "/app/kanban")).toBe(false);
    expect(doSection?.items.some((item) => item.url === "/app/buckets")).toBe(false);
  });
});
