import { useSyncExternalStore } from "react";
import {
  ListTodo,
  CalendarDays,
  FileText,
  Inbox,
  Timer,
  Clock,
} from "lucide-react";

import { withFeatureMetadata, type BottomTabItemConfig } from "@/components/bottom-bar/types";
import { isPathAllowed, type ModulesState } from "@/lib/appModules";

export interface MobileTabOption extends BottomTabItemConfig {
  descriptionFa: string;
  descriptionEn: string;
}

const MOBILE_TAB_OPTIONS: Record<string, MobileTabOption> = {
  today: {
    key: "today",
    labelFa: "امروز",
    labelEn: "Today",
    to: "/app/today",
    icon: ListTodo,
    shortcutKey: "4",
    shortcutLabel: "Alt+4",
    descriptionFa: "تسک‌ها و برنامه‌های روزانه جاری",
    descriptionEn: "Current daily tasks and agenda",
    match: (p) => p === "/app/today" || p === "/app",
  },
  planning: {
    key: "planning",
    labelFa: "برنامه‌ریزی",
    labelEn: "Planning",
    to: "/app/planning",
    icon: Clock,
    shortcutKey: "1",
    shortcutLabel: "Alt+1",
    descriptionFa: "برنامه‌ریزی دوره‌ای، هفتگی و ماهانه",
    descriptionEn: "Periodic, weekly and monthly planning",
    match: (p) => p.startsWith("/app/planning"),
  },
  calendar: {
    key: "calendar",
    labelFa: "تقویم",
    labelEn: "Calendar",
    to: "/app/calendar",
    icon: CalendarDays,
    shortcutKey: "3",
    shortcutLabel: "Alt+3",
    descriptionFa: "نمای تقویم، سررسیدها و رویدادها",
    descriptionEn: "Calendar view and scheduled dates",
    match: (p) => p.startsWith("/app/calendar"),
  },
  inbox: {
    key: "inbox",
    labelFa: "صندوق",
    labelEn: "Inbox",
    to: "/app/inbox",
    icon: Inbox,
    shortcutKey: "I",
    shortcutLabel: "Alt+I",
    descriptionFa: "صندوق ورودی و تسک‌های دسته‌بندی‌نشده",
    descriptionEn: "Inbox and unorganized tasks",
    match: (p) => p.startsWith("/app/inbox"),
  },
  pomodoro: {
    key: "pomodoro",
    labelFa: "تمرکز",
    labelEn: "Focus",
    to: "/app/pomodoro",
    icon: Timer,
    shortcutKey: "P",
    shortcutLabel: "Alt+P",
    descriptionFa: "تایمر پومودورو و جلسات فوکوس عمیق",
    descriptionEn: "Pomodoro timer & focus sessions",
    match: (p) => p.startsWith("/app/pomodoro") || p.startsWith("/app/focus"),
  },
  notes: {
    key: "notes",
    labelFa: "یادداشت‌ها",
    labelEn: "Notes",
    to: "/app/notes",
    icon: FileText,
    shortcutKey: "2",
    shortcutLabel: "Alt+2",
    descriptionFa: "یادداشت‌ها، دفترچه‌ها و متون",
    descriptionEn: "Notes, notebooks and drafts",
    match: (p) => p.startsWith("/app/notes"),
  },
};

export const DEFAULT_MOBILE_BOTTOM_TABS = ["today", "planning", "calendar", "inbox"];

export const ALL_MOBILE_TAB_OPTIONS: Record<string, MobileTabOption> = Object.fromEntries(
  Object.entries(MOBILE_TAB_OPTIONS).map(([key, option]) => [key, withFeatureMetadata(option)]),
);

export function getAccessibleMobileTabs(
  selectedKeys: string[],
  modules: ModulesState,
): MobileTabOption[] {
  const candidates = [
    ...selectedKeys,
    ...DEFAULT_MOBILE_BOTTOM_TABS,
    ...Object.keys(ALL_MOBILE_TAB_OPTIONS),
  ];
  const seen = new Set<string>();
  const result: MobileTabOption[] = [];

  for (const key of candidates) {
    if (seen.has(key)) continue;
    seen.add(key);
    const tab = Object.prototype.hasOwnProperty.call(ALL_MOBILE_TAB_OPTIONS, key) ? ALL_MOBILE_TAB_OPTIONS[key] : undefined;
    if (tab && isPathAllowed(tab.to, modules)) result.push(tab);
    if (result.length === 4) break;
  }

  return result;
}

const STORAGE_KEY = "arshnaz_mobile_bottom_tabs";
const HOLD_KEY = "arshnaz_mobile_tab_hold";

export function getMobileTabHoldEnabled(): boolean {
  try { return localStorage.getItem(HOLD_KEY) === "true"; } catch { return false; }
}

export function setMobileTabHoldEnabled(enabled: boolean): boolean {
  try {
    localStorage.setItem(HOLD_KEY, String(enabled));
    if (localStorage.getItem(HOLD_KEY) !== String(enabled)) return false;
    window.dispatchEvent(new Event("arshnaz:tab-hold-changed"));
    return true;
  } catch { return false; }
}

export function useMobileTabHoldEnabled(): boolean {
  return useSyncExternalStore(callback => {
    window.addEventListener("arshnaz:tab-hold-changed", callback);
    window.addEventListener("storage", callback);
    return () => { window.removeEventListener("arshnaz:tab-hold-changed", callback); window.removeEventListener("storage", callback); };
  }, getMobileTabHoldEnabled, () => false);
}

const listeners = new Set<() => void>();

function getStoredTabs(): string[] {
  if (typeof window === "undefined") return DEFAULT_MOBILE_BOTTOM_TABS;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_MOBILE_BOTTOM_TABS;
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && (parsed.length === 3 || parsed.length === 4)) {
      const valid = parsed.filter((k) => typeof k === "string" && Object.prototype.hasOwnProperty.call(ALL_MOBILE_TAB_OPTIONS, k));
      if (valid.length > 0) return [...new Set([...valid, ...DEFAULT_MOBILE_BOTTOM_TABS])].slice(0, 4);
    }
  } catch {}
  return DEFAULT_MOBILE_BOTTOM_TABS;
}

let currentTabs: string[] = getStoredTabs();

export function setMobileBottomTabs(tabs: string[]) {
  if (tabs.length !== 4 || new Set(tabs).size !== 4 || tabs.some(key => !Object.prototype.hasOwnProperty.call(ALL_MOBILE_TAB_OPTIONS, key))) return false;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tabs));
    if (localStorage.getItem(STORAGE_KEY) !== JSON.stringify(tabs)) return false;
  } catch { return false; }
  currentTabs = [...tabs];
  listeners.forEach((l) => l());
  window.dispatchEvent(new CustomEvent("arshnaz:bottom-tabs-changed", { detail: tabs }));
  return true;
}

export function resetMobileBottomTabs() {
  return setMobileBottomTabs(DEFAULT_MOBILE_BOTTOM_TABS);
}

function subscribeToTabs(callback: () => void) {
  const refresh = () => {
    const stored = getStoredTabs();
    if (stored.join(",") !== currentTabs.join(",")) {
      currentTabs = stored;
      listeners.forEach(listener => listener());
    }
  };
  const onStorage = (event: StorageEvent) => {
    if (event.key === STORAGE_KEY || event.key === null) refresh();
  };
  listeners.add(callback);
  window.addEventListener("storage", onStorage);
  refresh();
  return () => {
    listeners.delete(callback);
    window.removeEventListener("storage", onStorage);
  };
}

export function useMobileBottomTabs(): string[] {
  return useSyncExternalStore(
    subscribeToTabs,
    () => currentTabs,
    () => DEFAULT_MOBILE_BOTTOM_TABS
  );
}
