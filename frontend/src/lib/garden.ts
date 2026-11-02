// Lightweight no-op stub replacing the retired Garden gamification engine.
export function setGardenUser(_userId: string | null): void {}
export function resetGardenOnLogout(): void {}
export function getGardenState() {
  return { waterDrops: 0, sunEnergy: 0, focusBlossoms: 0, totalHarvests: 0, activePlant: null, herbarium: [], soundEnabled: false, timeOfDayMode: "auto" };
}
export function saveGardenState(_state: unknown): void {}
export function awardTaskWatering(_taskId?: string, _title?: string): { awarded: boolean; dropsAdded: number } {
  return { awarded: false, dropsAdded: 0 };
}
export function awardDailyCheckinDrops(): { awarded: boolean; dropsAdded: number } {
  return { awarded: false, dropsAdded: 0 };
}
export function awardFocusWatering(_minutes: number, _taskTitle?: string): { dropsAdded: number; sunAdded: number; blossomEarned: boolean } {
  return { dropsAdded: 0, sunAdded: 0, blossomEarned: false };
}
export function recordPomodoroFocusSession(_minutes: number, _sessionId?: string): { awarded: boolean; dropsAdded: number; sunAdded: number; blossomEarned: boolean } {
  return { awarded: false, dropsAdded: 0, sunAdded: 0, blossomEarned: false };
}
