/** One-time cleanup of keys that referenced removed features; leaves every other user choice untouched. */

/** Paths that redirect instead of rendering, so a pinned or restored link is dead weight. */
const RETIRED_PATH =
  /^\/app\/(?:garden|contacts|diary|knowledge(?:-mindmap)?|interactive-study|continue|recall|tools|life-architect|mind|self|checkin|thoughts|abc|calm|breathing|sleep|screener|worry|cycle|crisis|sos|about-me|habits|buckets|kanban|rewrite-article)(?:[/?#]|$)/;

function isRetired(value: unknown): boolean {
  if (typeof value === "string") return /socratic/i.test(value) || RETIRED_PATH.test(value);
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    const target = record.url ?? record.href ?? record.to ?? record.path;
    if (typeof target === "string" && RETIRED_PATH.test(target)) return true;
    try {
      return /socratic/i.test(JSON.stringify(value));
    } catch {
      return false;
    }
  }
  return false;
}

export function purgeRetiredFeatureKeys() {
  if (typeof localStorage === "undefined") return;
  try {
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const k = localStorage.key(i);
      if (!k) continue;
      const isPins = k.startsWith("mind_pinned_tools_v2_");
      const isQuick = k.includes("sidebar_quick_links") || k.includes("sidebarQuickLinks");
      if (!isPins && !isQuick) continue;
      const raw = localStorage.getItem(k);
      if (!raw) continue;
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) continue;
      const next = parsed.filter((item) => !isRetired(item));
      if (next.length !== parsed.length) localStorage.setItem(k, JSON.stringify(next));
    }
  } catch {
    /* storage is optional */
  }
}
