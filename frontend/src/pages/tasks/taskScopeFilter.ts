import { addDays, endOfDay, startOfDay } from "date-fns";
import { isStandaloneTaskForScope } from "@/features/tasks/taskTree";
import type { GoalKanban } from "@/lib/kanbanGoals";
import { PRIORITY_META } from "@/lib/priority";
import { filterAndSortTasks, type TaskFilters } from "@/lib/smartListService";
import { getLocalDateString, taskDueTimestamp, taskWorkDate } from "@/lib/taskDate";
import { getTaskPlanning, isTaskMissedWorkDay, isTaskOverdue } from "@/lib/taskPlanning";
import type { Task } from "@/lib/taskTypes";
import { currentAnchor, doesTaskMatchBucketScope } from "@/lib/timeBuckets";
import { getTimeSettings } from "@/lib/timeHorizon";
import type { FolderPrefs } from "@/lib/folderPrefs";

export type TasksViewScope = "inbox" | "today" | "tomorrow" | "next7" | "smart" | "folder" | "tag";

export function filterTopLevelTasksByScope({
  effectiveAllTasks,
  scope,
  scopeId,
  sourceFilter,
  filters,
  showCompletedTasks,
  taskTagsMap,
  graceMap,
  taskMap,
  goals,
}: {
  effectiveAllTasks: Task[];
  scope: TasksViewScope;
  scopeId?: string;
  sourceFilter?: string | null;
  filters: TaskFilters;
  showCompletedTasks: boolean;
  taskTagsMap: Record<string, string[]>;
  graceMap: Record<string, number>;
  taskMap: Map<string, Task>;
  goals: GoalKanban[];
}): Task[] {
  const nowMs = Date.now();
  const isGraceActive = (id: string) => (graceMap[id] || 0) > nowMs;
  let list = effectiveAllTasks;

  if (scope === "inbox") {
    list = list.filter((t) => !t.parent_id && !t.folder_id);
  } else if (scope === "today") {
    const e = endOfDay(new Date()).getTime();
    const todayAnchor = currentAnchor("day");
    const todayDate = getLocalDateString();
    const timeSettings = getTimeSettings();
    const isDueTodayOrOverdue = (t: Task) => {
      if (isTaskOverdue(t, timeSettings) || isTaskMissedWorkDay(t, timeSettings)) return true;
      const dueDate = taskWorkDate(t);
      if (dueDate && taskDueTimestamp(dueDate) <= e) return true;
      const plan = getTaskPlanning(t, timeSettings);
      if (plan?.horizon === "day" && plan.start === todayDate) return true;
      if (t.bucket_kind === "day" && (!t.bucket_anchor || t.bucket_anchor === todayAnchor)) return true;
      return false;
    };
    list = list.filter((t) => isStandaloneTaskForScope(t, isDueTodayOrOverdue, taskMap));
  } else if (scope === "tomorrow") {
    const s = startOfDay(addDays(new Date(), 1)).getTime();
    const e = endOfDay(addDays(new Date(), 1)).getTime();
    const tmrwDateStr = getLocalDateString(addDays(new Date(), 1));
    const timeSettings = getTimeSettings();
    const isDueTomorrow = (t: Task) => {
      const dueDate = taskWorkDate(t);
      if (dueDate) {
        const ts = taskDueTimestamp(dueDate);
        if (ts >= s && ts <= e) return true;
      }
      const plan = getTaskPlanning(t, timeSettings);
      if (plan?.horizon === "day" && plan.start === tmrwDateStr) return true;
      if (t.bucket_kind === "day" && t.bucket_anchor === tmrwDateStr) return true;
      return false;
    };
    list = list.filter((t) => isStandaloneTaskForScope(t, isDueTomorrow, taskMap));
  } else if (scope === "next7") {
    const e = endOfDay(addDays(new Date(), 7)).getTime();
    const lastDay = getLocalDateString(addDays(new Date(), 7));
    const todayDate = getLocalDateString();
    const timeSettings = getTimeSettings();
    const isDueNext7 = (t: Task) => {
      if (isTaskOverdue(t, timeSettings) || isTaskMissedWorkDay(t, timeSettings)) return true;
      const dueDate = taskWorkDate(t);
      if (dueDate && taskDueTimestamp(dueDate) <= e) return true;
      const plan = getTaskPlanning(t, timeSettings);
      if (plan?.horizon === "day" && plan.start <= lastDay) return true;
      if (plan?.horizon === "week" && plan.start <= lastDay && plan.end >= todayDate) return true;
      if (t.bucket_kind) {
        const match = doesTaskMatchBucketScope(t, { scopeKind: "week", hierarchical: true });
        if (match.matches) return true;
      }
      return false;
    };
    list = list.filter((t) => isStandaloneTaskForScope(t, isDueNext7, taskMap));
  } else if (scope === "smart") {
    list = list.filter((t) => !t.parent_id && (!t.completed || isGraceActive(t.id)));
  } else if (scope === "folder") {
    list = list.filter((t) => !t.parent_id && t.folder_id === scopeId);
  } else if (scope === "tag") {
    const tagId = scopeId;
    const hasTag = (t?: Task) => !!t && !!tagId && (taskTagsMap[t.id] || []).includes(tagId);
    list = list.filter((t) => hasTag(t) && (!t.parent_id || !hasTag(taskMap.get(t.parent_id))));
  } else {
    list = list.filter((t) => !t.parent_id);
  }

  if (sourceFilter === "mind") {
    list = list.filter((t) => t.source_type === "cbt_thought" || t.source_type === "abc_model" || t.source_type === "worry_tree");
  }

  const effectiveFilters: TaskFilters = {
    ...filters,
    show_completed: showCompletedTasks,
  };
  list = filterAndSortTasks(list, effectiveFilters, taskTagsMap, goals);

  const ghostList = effectiveAllTasks.filter((t) => isGraceActive(t.id) && !list.some((x) => x.id === t.id));
  if (ghostList.length > 0) {
    list = [...list, ...ghostList];
  }

  return list;
}

export function sortFolderTopLevelTasks(topLevel: Task[], isFolder: boolean, sortOrder: FolderPrefs["sortOrder"]): Task[] {
  if (!isFolder || sortOrder === "manual") return topLevel;
  return [...topLevel].sort((a, b) => {
    if (sortOrder === "priority") {
      return (PRIORITY_META[a.priority]?.rank ?? 3) - (PRIORITY_META[b.priority]?.rank ?? 3);
    }
    if (sortOrder === "due_date") {
      const aDueValue = taskWorkDate(a);
      const bDueValue = taskWorkDate(b);
      const aDue = aDueValue ? taskDueTimestamp(aDueValue) : Infinity;
      const bDue = bDueValue ? taskDueTimestamp(bDueValue) : Infinity;
      return aDue - bDue;
    }
    return a.title.localeCompare(b.title, "fa");
  });
}
