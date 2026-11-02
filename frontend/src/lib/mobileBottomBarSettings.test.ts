import { afterEach, describe, expect, it, vi } from "vitest";
import { getAccessibleMobileTabs, DEFAULT_MOBILE_BOTTOM_TABS, resetMobileBottomTabs, setMobileBottomTabs, setMobileTabHoldEnabled, useMobileBottomTabs } from "./mobileBottomBarSettings";
import { act, renderHook } from "@testing-library/react";
import type { ModulesState } from "./appModules";

afterEach(() => vi.restoreAllMocks());

const defaultModules: ModulesState = {
  ready: true,
  unlocked: [],
  installed: [],
  isAdmin: false,
  isOwner: false,
};

describe("mobile bottom navigation options", () => {
  it("migrates saved tabs without losing order and refreshes across tabs", () => {
    localStorage.setItem("arshnaz_mobile_bottom_tabs", JSON.stringify(["planning", "notes", "today"]));
    const { result } = renderHook(() => useMobileBottomTabs());
    expect(result.current).toEqual(["planning", "notes", "today", "calendar"]);
    act(() => {
      localStorage.removeItem("arshnaz_mobile_bottom_tabs");
      window.dispatchEvent(new StorageEvent("storage", { key: null }));
    });
    expect(result.current).toEqual(DEFAULT_MOBILE_BOTTOM_TABS);
  });

  it("does not update subscribers or announce saves when storage silently rejects writes", () => {
    resetMobileBottomTabs();
    const { result } = renderHook(() => useMobileBottomTabs());
    const saved = vi.fn();
    window.addEventListener("arshnaz:bottom-tabs-changed", saved);
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {});
    act(() => expect(setMobileBottomTabs(["planning", "calendar", "notes", "inbox"])).toBe(false));
    expect(result.current).toEqual(DEFAULT_MOBILE_BOTTOM_TABS);
    expect(saved).not.toHaveBeenCalled();
    window.removeEventListener("arshnaz:bottom-tabs-changed", saved);
  });

  it("does not report success for duplicate slots or storage failures", () => {
    expect(setMobileBottomTabs(["today", "today", "notes", "inbox"])).toBe(false);
    expect(setMobileBottomTabs(["constructor", "calendar", "notes", "inbox"])).toBe(false);
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("quota"); });
    expect(setMobileBottomTabs(["today", "calendar", "notes", "inbox"])).toBe(false);
    expect(setMobileTabHoldEnabled(true)).toBe(false);
  });

  it("replaces retired tabs with accessible planning tabs", () => {
    const tabs = getAccessibleMobileTabs(["mind", "knowledge", "today"], defaultModules);
    expect(tabs.map((tab) => tab.key)).toEqual(["today", "planning", "calendar", "inbox"]);
  });
});
