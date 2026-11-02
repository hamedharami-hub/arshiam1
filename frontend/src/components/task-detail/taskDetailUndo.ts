import type { Task, TaskNote } from "@/lib/taskTypes";

export const AUTOSAVE_DELAY_MS = 1200;
export const TASK_DRAWER_SNAP_POINTS: Array<number | string> = [0.5, 1];

export type TaskUndoSnapshot = Partial<Task>;
export type TaskNoteSnapshot = Partial<Pick<TaskNote, "title" | "content">>;

const TASK_UNDO_IGNORED_FIELDS = new Set<keyof Task>(["id", "user_id", "created_at", "updated_at", "_graceUntil"]);

function cloneUndoValue(value: unknown): unknown {
  const normalized = value ?? null;
  if (normalized === null || typeof normalized !== "object") return normalized;
  try { return JSON.parse(JSON.stringify(normalized)); }
  catch { return normalized; }
}

export function sameUndoValue(left: unknown, right: unknown): boolean {
  try { return JSON.stringify(left ?? null) === JSON.stringify(right ?? null); }
  catch { return Object.is(left, right); }
}

export function captureTaskUndoSnapshots(patch: Partial<Task>, saved: Task) {
  const before: TaskUndoSnapshot = {};
  const after: TaskUndoSnapshot = {};
  const fields: Array<keyof Task> = [];
  for (const [rawKey, rawAfter] of Object.entries(patch)) {
    const key = rawKey as keyof Task;
    if (TASK_UNDO_IGNORED_FIELDS.has(key)) continue;
    const rawBefore = saved[key];
    if (sameUndoValue(rawBefore, rawAfter)) continue;
    (before as unknown as Record<string, unknown>)[key] = cloneUndoValue(rawBefore);
    (after as unknown as Record<string, unknown>)[key] = cloneUndoValue(rawAfter);
    fields.push(key);
  }
  return { before, after, fields };
}

export function noteSnapshot(note: TaskNote, fields: Array<keyof TaskNoteSnapshot> = ["title", "content"]): TaskNoteSnapshot {
  const snapshot: TaskNoteSnapshot = {};
  for (const field of fields) snapshot[field] = note[field] ?? "";
  return snapshot;
}

export function noteSnapshotMatches(note: TaskNote, snapshot: TaskNoteSnapshot): boolean {
  return Object.entries(snapshot).every(([key, value]) => note[key as "title" | "content"] === value);
}
