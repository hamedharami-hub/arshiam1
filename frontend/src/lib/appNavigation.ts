// Only durable app destinations may be restored. Never replay creation,
// sharing, assessment/session or action URLs on a later launch.
// Routes that render a page in this edition. Retired paths redirect instead of
// restoring, so they are deliberately absent here.
const ROUTES = new Set([
  "today", "tomorrow", "next7", "inbox", "smart", "notes", "pomodoro", "calendar",
  "stats", "planning", "values", "settings", "shared", "widgets", "admin",
]);
const SAFE_QUERY: Record<string, string[]> = {
  notes: ["folder", "tag", "select"], settings: ["tab"], widgets: ["widget"],
};

/** Backslash, whitespace and control characters are never valid in a stored route. */
function hasControlOrSpace(value: string): boolean {
  for (let i = 0; i < value.length; i += 1) {
    const code = value.charCodeAt(i);
    if (code <= 0x20 || code === 0x5c) return true;
  }
  return false;
}

export function safeLastRoute(raw: string | null): string | null {
  if (!raw || raw.length > 2048 || !raw.startsWith("/app/") || hasControlOrSpace(raw)) return null;
  try {
    const url = new URL(raw, "https://app.invalid");
    const route = url.pathname.slice(5);
    if (!ROUTES.has(route) && !/^(folder|tag)\/[A-Za-z0-9_-]+$/.test(route)) return null;
    const query = new URLSearchParams();
    for (const key of SAFE_QUERY[route] || []) {
      const value = url.searchParams.get(key);
      if (value && /^[\p{L}\p{N}_-]{1,128}$/u.test(value)) query.set(key, value);
    }
    const search = query.toString();
    return url.pathname + (search ? `?${search}` : "");
  } catch { return null; }
}

const routeKey = (owner: string) => `last_route:${encodeURIComponent(owner)}`;
export function rememberLastRoute(owner: string | undefined, raw: string) {
  if (!owner) return;
  const route = safeLastRoute(raw);
  try {
    // Unattributed legacy values cannot safely be migrated to any account.
    localStorage.removeItem("last_route");
    if (route) localStorage.setItem(routeKey(owner), route);
  } catch { /* Storage may be unavailable. Navigation must still work. */ }
}
export function readLastRoute(owner: string): string | null {
  try { return safeLastRoute(localStorage.getItem(routeKey(owner))); } catch { return null; }
}

export function navigationInteractionBlocked(target?: EventTarget | null): boolean {
  const editable = 'input, textarea, select, [contenteditable]:not([contenteditable="false"]), [role="textbox"], [data-no-swipe-nav]';
  return Boolean(
    document.querySelector('[role="dialog"]:not([data-state="closed"]), [role="alertdialog"]:not([data-state="closed"]), [role="menu"]:not([data-state="closed"]), [aria-modal="true"], [data-vaul-drawer]:not([data-state="closed"])') ||
    document.body.style.pointerEvents === "none" ||
    document.getSelection()?.toString() ||
    document.activeElement?.closest(editable) ||
    (target instanceof Element && target.closest(editable))
  );
}

const TITLES: Record<string, [string, string]> = {
  today: ["امروز", "Today"], tomorrow: ["فردا", "Tomorrow"], inbox: ["صندوق ورودی", "Inbox"],
  next7: ["هفت روز آینده", "Next seven days"], notes: ["یادداشت‌ها", "Notes"],
  settings: ["تنظیمات", "Settings"], calendar: ["تقویم", "Calendar"], planning: ["برنامه‌ریزی", "Planning"],
  smart: ["فهرست هوشمند", "Smart list"], folder: ["پوشه", "Folder"], tag: ["برچسب", "Tag"],
  pomodoro: ["تمرکز", "Focus timer"], stats: ["آمار", "Statistics"], values: ["ارزش‌ها", "Values"],
  shared: ["اشتراک‌ها", "Shared with me"], widgets: ["ابزارک‌ها", "Widgets"], widget: ["ابزارک", "Widget"],
  tasks: ["جزئیات کار", "Task details"], new: ["ایجاد مورد جدید", "Create new item"],
  admin: ["مدیریت", "Administration"],
  "share-target": ["دریافت اشتراک", "Receive shared content"],
};
export function routeTitle(pathname: string, isEn: boolean): string {
  const key = pathname.split("/")[2];
  return TITLES[key]?.[isEn ? 1 : 0] || (isEn ? "Page content" : "محتوای صفحه");
}
