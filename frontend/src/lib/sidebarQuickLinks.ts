import { useCallback, useEffect, useState } from "react";
import { getFeatureNavigation, findFeature } from "./featureRegistry";

export type SidebarQuickLinkGroup = "core" | "do" | "grow";

export type SidebarQuickLink = {
  url: string;
  labelFa: string;
  labelEn: string;
  group: SidebarQuickLinkGroup;
  required?: boolean;
};

export const GROUP_LABELS: Record<SidebarQuickLinkGroup, { fa: string; en: string }> = {
  core: { fa: "اصلی و ساختار", en: "Core & Structure" },
  do: { fa: "برنامه‌ریزی و اجرا", en: "Planning & Execution" },
  grow: { fa: "یادداشت و اهداف", en: "Notes & Goals" },
};

export const SIDEBAR_QUICK_LINKS_KEY = "arshnaz_sidebar_quick_links_v1";
export const SIDEBAR_QUICK_LINKS_EVENT = "arshnaz:sidebar-quick-links-changed";

function featureQuickLink(route: string, group: SidebarQuickLinkGroup, required?: boolean): SidebarQuickLink {
  const { url, label } = getFeatureNavigation(`/app/${route}`);
  return { url, labelFa: label, labelEn: findFeature(url)!.nameEn, group, ...(required ? { required } : {}) };
}

export const SIDEBAR_QUICK_LINK_OPTIONS: SidebarQuickLink[] = [
  // 1. Core / Structure
  featureQuickLink("today", "core", true),
  { url: "__folders", labelFa: "فولدرها", labelEn: "Folders", group: "core" },
  { url: "__tags", labelFa: "تگ‌ها", labelEn: "Tags", group: "core" },

  // 2. Planning & Execution
  ...["inbox", "planning", "calendar", "tomorrow", "next7", "smart", "pomodoro", "stats", "widgets"]
    .map((route) => featureQuickLink(route, "do")),

  // 3. Notes & Goals
  ...["notes", "values", "shared"]
    .map((route) => featureQuickLink(route, "grow")),
];

export const DEFAULT_QUICK_LINKS: string[] = [
  "/app/today",
  "/app/planning",
  "/app/calendar",
  "/app/inbox",
  "/app/notes",
  "/app/next7",
  "/app/pomodoro",
  "/app/stats",
];
export const DEFAULT_SIDEBAR_QUICK_LINKS = DEFAULT_QUICK_LINKS;

export function normalizeSidebarQuickLinks(urls: unknown): string[] {
  const allowed = new Set(SIDEBAR_QUICK_LINK_OPTIONS.map((item) => item.url));
  const rawList = Array.isArray(urls)
    ? urls.filter((url): url is string => typeof url === "string" && allowed.has(url))
    : DEFAULT_QUICK_LINKS;

  const withoutToday = rawList.filter((u) => u !== "/app/today");
  const uniqueUrls: string[] = [];
  for (const u of withoutToday) {
    if (!uniqueUrls.includes(u)) {
      uniqueUrls.push(u);
    }
  }
  return ["/app/today", ...uniqueUrls];
}

export function getSidebarQuickLinks(): string[] {
  if (typeof window === "undefined") return DEFAULT_QUICK_LINKS;
  try {
    const raw = localStorage.getItem(SIDEBAR_QUICK_LINKS_KEY);
    return raw ? normalizeSidebarQuickLinks(JSON.parse(raw)) : DEFAULT_QUICK_LINKS;
  } catch {
    return DEFAULT_QUICK_LINKS;
  }
}

export function setSidebarQuickLinks(urls: string[]): void {
  const next = normalizeSidebarQuickLinks(urls);
  try {
    localStorage.setItem(SIDEBAR_QUICK_LINKS_KEY, JSON.stringify(next));
  } catch {
    /* storage is optional */
  }
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(SIDEBAR_QUICK_LINKS_EVENT, { detail: next }));
  }
}

export function moveSidebarQuickLink(url: string, direction: "up" | "down"): string[] {
  if (url === "/app/today") return getSidebarQuickLinks();
  const current = getSidebarQuickLinks();
  const idx = current.indexOf(url);
  if (idx <= 1 && direction === "up") return current;
  if (idx === -1 || (idx === current.length - 1 && direction === "down")) return current;

  const next = [...current];
  const targetIdx = direction === "up" ? idx - 1 : idx + 1;
  const temp = next[idx];
  next[idx] = next[targetIdx];
  next[targetIdx] = temp;

  setSidebarQuickLinks(next);
  return next;
}

export function toggleSidebarQuickLink(url: string, enabled: boolean): string[] {
  if (url === "/app/today") return getSidebarQuickLinks();
  const current = getSidebarQuickLinks();
  let next: string[];
  if (enabled) {
    next = current.includes(url) ? current : [...current, url];
  } else {
    next = current.filter((u) => u !== url);
  }
  setSidebarQuickLinks(next);
  return next;
}

export function resetSidebarQuickLinks(): string[] {
  setSidebarQuickLinks(DEFAULT_QUICK_LINKS);
  return DEFAULT_QUICK_LINKS;
}

export function useSidebarQuickLinks() {
  const [quickLinks, setQuickLinks] = useState<string[]>(getSidebarQuickLinks);

  useEffect(() => {
    const refresh = () => setQuickLinks(getSidebarQuickLinks());
    window.addEventListener(SIDEBAR_QUICK_LINKS_EVENT, refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener(SIDEBAR_QUICK_LINKS_EVENT, refresh);
      window.removeEventListener("storage", refresh);
    };
  }, []);

  const update = useCallback((urls: string[]) => setSidebarQuickLinks(urls), []);
  const move = useCallback((url: string, direction: "up" | "down") => moveSidebarQuickLink(url, direction), []);
  const toggle = useCallback((url: string, enabled: boolean) => toggleSidebarQuickLink(url, enabled), []);
  const reset = useCallback(() => resetSidebarQuickLinks(), []);

  return { quickLinks, setQuickLinks: update, moveQuickLink: move, toggleQuickLink: toggle, resetQuickLinks: reset };
}
