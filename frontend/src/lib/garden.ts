// Headless garden engine.
//
// The Garden screens were retired in the planning edition, but task completion,
// daily check-in and focus sessions still credit drops. Keeping the state
// machine here (without rendering, toasts, mascot or cloud sync) preserves the
// reward semantics and the tests that pin them, while leaving no dead UI.

export type TimeOfDay = "morning" | "day" | "sunset" | "night";

export interface GardenState {
  waterDrops: number;
  sunEnergy: number;
  totalHarvests: number;
  focusBlossoms: number;
  activePlant: null;
  herbarium: never[];
  soundEnabled: boolean;
  timeOfDayMode: "auto" | TimeOfDay;
  lastCheckinRewardDate?: string;
  updatedAt?: number;
}

const STATE_KEY = "arshnaz_garden_state_v2";
const USER_KEY = "arshnaz_garden_user";

let currentGardenUserId: string | null = (() => {
  try {
    return localStorage.getItem(USER_KEY);
  } catch {
    return null;
  }
})();

const processedFocusEvents = new Set<string>();

const defaultGardenState = (): GardenState => ({
  waterDrops: 30,
  sunEnergy: 10,
  totalHarvests: 0,
  focusBlossoms: 0,
  activePlant: null,
  herbarium: [],
  soundEnabled: false,
  timeOfDayMode: "auto",
});

const gardenKey = (userId: string | null = currentGardenUserId) =>
  userId ? `${STATE_KEY}_${userId}` : STATE_KEY;

export function setGardenUser(userId: string | null): void {
  currentGardenUserId = userId;
  processedFocusEvents.clear();
  try {
    if (userId) localStorage.setItem(USER_KEY, userId);
    else localStorage.removeItem(USER_KEY);
  } catch {
    /* storage unavailable: the in-memory identity is enough */
  }
}

export function resetGardenOnLogout(): void {
  setGardenUser(null);
}

export function getGardenState(): GardenState {
  try {
    const raw = localStorage.getItem(gardenKey());
    if (!raw) return defaultGardenState();
    const parsed = JSON.parse(raw) as Partial<GardenState>;
    return { ...defaultGardenState(), ...parsed };
  } catch {
    return defaultGardenState();
  }
}

export function saveGardenState(state: GardenState): void {
  try {
    localStorage.setItem(gardenKey(), JSON.stringify({ ...state, updatedAt: Date.now() }));
  } catch (error) {
    console.warn("Garden state could not be saved:", error);
  }
}

/** Earning drops on a completed task (10 for a task, 5 for a subtask). */
export function awardTaskWatering(_title: string, isSubtask = false): { awarded: boolean; dropsAdded: number } {
  const amount = isSubtask ? 5 : 10;
  const current = getGardenState();
  saveGardenState({
    ...current,
    waterDrops: current.waterDrops + amount,
    sunEnergy: current.sunEnergy + Math.ceil(amount / 2),
  });
  return { awarded: true, dropsAdded: amount };
}

/** One reward per local date, so retries and edits cannot double-credit. */
export function awardDailyCheckinDrops(todayStr: string, amount = 20, _reason?: string): { awarded: boolean; drops: number } {
  const current = getGardenState();
  if (!todayStr || current.lastCheckinRewardDate === todayStr) {
    return { awarded: false, drops: current.waterDrops };
  }
  const drops = current.waterDrops + amount;
  saveGardenState({
    ...current,
    waterDrops: drops,
    sunEnergy: current.sunEnergy + Math.ceil(amount / 2),
    lastCheckinRewardDate: todayStr,
  });
  return { awarded: true, drops };
}

export function awardFocusWatering(minutes: number, _taskTitle?: string): { dropsAdded: number; sunAdded: number; blossomEarned: boolean } {
  const dropsAdded = Math.max(10, Math.floor(minutes * 0.8));
  const current = getGardenState();
  saveGardenState({
    ...current,
    waterDrops: current.waterDrops + dropsAdded,
    sunEnergy: current.sunEnergy + Math.ceil(minutes / 2),
    focusBlossoms: current.focusBlossoms + 1,
  });
  return { dropsAdded, sunAdded: Math.ceil(minutes / 2), blossomEarned: true };
}

/** A finished focus session credits drops once per session id. */
export function recordPomodoroFocusSession(minutes: number, eventId?: string): { dropsAwarded: number; newBlossoms: number } {
  const current = getGardenState();
  if (eventId) {
    if (processedFocusEvents.has(eventId)) {
      return { dropsAwarded: 0, newBlossoms: current.focusBlossoms };
    }
    processedFocusEvents.add(eventId);
  }
  const dropsAwarded = Math.max(10, Math.floor(minutes * 0.8));
  const newBlossoms = current.focusBlossoms + 1;
  saveGardenState({
    ...current,
    waterDrops: current.waterDrops + dropsAwarded,
    sunEnergy: current.sunEnergy + Math.ceil(minutes / 2),
    focusBlossoms: newBlossoms,
  });
  return { dropsAwarded, newBlossoms };
}
