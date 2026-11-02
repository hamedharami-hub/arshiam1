import type { Task } from "@/lib/taskTypes";

export type StudyTargetType =
  | "knowledge_folder"
  | "knowledge_doc"
  | "mindmap_folder"
  | "mindmap_doc"
  | "mindmap_all"
  | "leitner"
  | "leitner_folder";

export type StudyNavigation = {
  isStudyTask: boolean;
  isMindMap: boolean;
  isKnowledge: boolean;
  navUrl: string;
  badgeLabelFa: string;
  badgeLabelEn: string;
  actionTextFa: string;
  actionTextEn: string;
};

export function isLeitnerStudyTask(_task: Partial<Task>): boolean {
  return false;
}

export function getStudyTaskNavigation(_task: Partial<Task>): StudyNavigation {
  return {
    isStudyTask: false,
    isMindMap: false,
    isKnowledge: false,
    navUrl: "",
    badgeLabelFa: "",
    badgeLabelEn: "",
    actionTextFa: "",
    actionTextEn: "",
  };
}
