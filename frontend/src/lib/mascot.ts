import { useSyncExternalStore } from "react";

export type MascotMode = "full" | "calm" | "off";
export type MascotPose = "celebrate" | "tomorrow" | "garden" | "thinking";
export type MascotLook = "blonde" | "brown" | "black";

const subscribe = () => () => {};
export const MASCOT_EVENT = "arshnaz-mascot-moment";
export function getMascotMode(): MascotMode { return "off"; }
export function setMascotMode(_mode: MascotMode) {}
export function useMascotMode(): MascotMode { return useSyncExternalStore(subscribe, getMascotMode, getMascotMode); }
export function getMascotLook(): MascotLook { return "brown"; }
export function setMascotLook(_look: MascotLook) {}
export function useMascotLook(): MascotLook { return useSyncExternalStore(subscribe, getMascotLook, getMascotLook); }
export function showMascotMoment(_pose: MascotPose) {}
