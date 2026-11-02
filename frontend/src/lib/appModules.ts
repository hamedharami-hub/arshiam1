import { useSyncExternalStore } from "react";

export type ModuleId = "study" | "mind";

type ModuleDef = { titleFa: string; titleEn: string; descFa: string; descEn: string; paths: string[]; prefetch: () => Promise<unknown> };

export const APP_MODULES: Record<ModuleId, ModuleDef> = {
  study: {
    titleFa: "استودیوی مطالعه",
    titleEn: "Study studio",
    descFa: "غیرفعال در نسخهٔ ویژه برنامه‌ریزی",
    descEn: "Disabled in Planning edition",
    paths: ["/app/knowledge", "/app/interactive-study", "/app/knowledge-mindmap", "/app/continue"],
    prefetch: () => Promise.resolve(),
  },
  mind: {
    titleFa: "ذهن",
    titleEn: "Mind",
    descFa: "غیرفعال در نسخهٔ ویژه برنامه‌ریزی",
    descEn: "Disabled in Planning edition",
    paths: ["/app/mind", "/app/checkin", "/app/thoughts", "/app/abc", "/app/calm", "/app/sleep", "/app/breathing", "/app/screener", "/app/worry"],
    prefetch: () => Promise.resolve(),
  },
};

export const MODULE_IDS: ModuleId[] = [];

export type ModulesState = { ready: boolean; unlocked: ModuleId[]; installed: ModuleId[]; isAdmin: boolean; isOwner: boolean };

const READY_STATE: ModulesState = { ready: true, unlocked: [], installed: [], isAdmin: false, isOwner: false };
let state: ModulesState = READY_STATE;
let accountSession = 0;
const listeners = new Set<() => void>();

function emit(next: ModulesState) {
  state = next;
  listeners.forEach((l) => l());
}

export function setModulesState(next: Partial<ModulesState>) {
  emit({ ...state, ready: true, ...next });
}

export function getModulesState() {
  return state;
}

export class StaleModulesSessionError extends Error {
  constructor() { super("The module account session has changed."); }
}

export function getModulesSession(): number { return accountSession; }

export function useModulesSession(): number {
  return useSyncExternalStore((l) => { listeners.add(l); return () => listeners.delete(l); }, getModulesSession, getModulesSession);
}

export function useModules(): ModulesState {
  return useSyncExternalStore((l) => { listeners.add(l); return () => listeners.delete(l); }, () => state, () => state);
}

export function isPathAllowed(path: string, _s: ModulesState = state): boolean {
  const clean = path.split(/[?#]/)[0];
  if (/^\/app\/(?:pharmacy(?:-[^/]*)?|review)(?:\/|$)/.test(clean)) return false;
  return true;
}

export function hasModule(_id: ModuleId, _s: ModulesState = state): boolean {
  return false;
}

export async function syncModulesForUser(_uid: string | null): Promise<void> {
  accountSession++;
  emit(READY_STATE);
}

export async function redeemModuleCode(_code: string): Promise<ModuleId[]> {
  return [];
}

export async function setModuleInstalled(_id: ModuleId, _installed: boolean): Promise<void> {}

export type ModuleCode = { id: string; label: string; modules: string[]; max_uses: number | null; uses: number; expires_at: string | null; revoked: boolean; created_at: string; code?: string };

export const listModuleCodes = async (): Promise<ModuleCode[]> => [];
export const createModuleCode = async (_body: { label: string; modules: string[]; max_uses?: number | null; expires_in_days?: number | null }): Promise<ModuleCode> => {
  throw new Error("Module codes are disabled in the Planning edition.");
};
export const revokeModuleCode = async (_id: string, _withdrawAccess: boolean) => ({ ok: true, withdrawn: 0 });
