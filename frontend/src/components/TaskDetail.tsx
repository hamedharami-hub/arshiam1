import { mindSourceRoute } from "@/lib/taskFromMind";
import { NoteMarkdown } from "@/components/NoteMarkdown";
import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";
import { hasModule, isPathAllowed, useModules } from "@/lib/appModules";
import { useIsMobile } from "@/hooks/use-mobile";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { firebaseStore } from "@/lib/firebaseStore";
import { listAttachments } from "@/lib/attachmentUpload";
import { useAuth } from "@/hooks/useAuth";
import { useShareAccess } from "@/hooks/useShareAccess";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { AutoTextarea } from "@/components/ui/auto-textarea";
import { TaskTitleInput } from "@/components/TaskTitleInput";
import { BidiText } from "@/components/BidiText";
import { Card } from "@/components/ui/card";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { toast } from "sonner";
import {
  Plus, Sparkles, Trash2, FileText, Clock, ArrowRight, Ban,
  Folder as FolderIcon, Tag as TagIcon, Check, Calendar as CalendarIcon,
  Flag, Repeat, ListTree, Paperclip, X, Image as ImageIcon, Music, Link as LinkIcon,
  CheckSquare, ListChecks, CalendarDays, Mic, MicOff, Pin, PinOff, Maximize2, Minimize2,
  GitBranch, Zap, Brain, Target,
  Save, ExternalLink, Loader2, MoreHorizontal,
  Copy, Share2, FolderInput, Timer, Network, Edit, BookOpen, FolderTree, Layers,
} from "lucide-react";
import { getAllKanbanGoals, type GoalKanban, TIME_HORIZONS } from "@/lib/kanbanGoals";
import { getStudyTaskNavigation, isLeitnerStudyTask } from "@/lib/taskStudyService";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { VoiceInput } from "@/lib/voiceInput";
import { normalizeTaskPriority, PRIORITY_META, PRIORITY_ORDER, type Priority } from "@/lib/priority";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from "@/components/ui/tooltip";

import { RecurrenceEditor } from "@/components/RecurrenceEditor";
import { TaskAIPanel } from "@/components/TaskAIPanel";
import { TaskNoteEditorDialog } from "@/components/task-detail/TaskNoteEditorDialog";
import { getTaskNotes, createTaskNote, updateTaskNote, deleteTaskNote } from "@/lib/taskNotesService";
import { TaskStepLists } from "@/components/TaskStepLists";
import { persistTaskTagChange } from "@/lib/taskTagService";
import { TaskSubtasksInline } from "@/components/TaskSubtasksInline";
import { duplicateTaskCascade } from "@/lib/taskDuplicateService";
import { isRecurringTask, advanceRecurringTask } from "@/lib/recurringTaskService";
import { awardTaskWatering } from "@/lib/garden";
import { playCompletionFeedback } from "@/lib/completionFeedback";
import { TaskAttachments } from "@/components/TaskAttachments";
import { moveDescriptionToNote } from "@/lib/taskDescriptionConversion";
import { TaskDescriptionEditor } from "@/components/TaskDescriptionEditor";
import TaskActionSheet from "@/components/TaskActionSheet";
import PomodoroSheet from "@/components/PomodoroSheet";
import { TaskOutcomeSheet } from "@/components/TaskOutcomeSheet";
import { TaskOutcomesInline } from "@/components/TaskOutcomesInline";
import { listTaskOutcomes } from "@/lib/taskOutcomes";
import { DueDatePicker } from "@/components/DueDatePicker";
import { TaskMetaBar, type TaskMetaPanel } from "@/components/task-detail/TaskMetaBar";
import { TaskSection, TaskSectionAction } from "@/components/task-detail/TaskSection";
import { formatDueLabel } from "@/lib/localeFormat";
import { TaskDetailBottomRail } from "@/components/task-detail/TaskDetailBottomRail";
import { TaskCloseDialog } from "@/components/task-detail/TaskCloseDialog";
import { SaveStatusButton, TaskDetailTopBar } from "@/components/task-detail/TaskDetailTopBar";
import { toPersianDigits } from "@/lib/persianDigits";
import { logTaskActivity } from "@/lib/taskActivity";
import { describeRule } from "@/lib/recurrence";
import { addDays } from "date-fns";
import { getLocalDateString, parseTaskDueDate, taskWorkDate, workDatePatch } from "@/lib/taskDate";
import { readSchedule, scheduleLabel as scheduleLabelOf } from "@/lib/taskSchedule";
import { getTimeSettings } from "@/lib/timeHorizon";
import { addTaskToAndroidCalendar } from "@/lib/androidNative";

import { Switch } from "@/components/ui/switch";
import { pushUndo } from "@/lib/undoStack";
import { pushDeleted, pushDeletedTask } from "@/lib/recentlyDeleted";
import { enqueueOp, cacheGet, cacheSet } from "@/lib/offlineQueue";
import { subscribeFolders, subscribeTags, persistTask, type TaskPersistenceStatus } from "@/lib/firestoreDataService";
import { toSaveStatus } from "@/lib/saveFeedback";
import { deleteTaskCascade } from "@/features/tasks/taskService";
import { buildTaskChildrenMap, collectTaskDescendantIds } from "@/features/tasks/taskTree";
import type { Task, TaskNote, ConfirmState } from "@/lib/taskTypes";
import { clearTaskDraft, taskPatch, writeTaskDraft } from "@/lib/taskDraft";
import { getCurrentTaskLocation, taskLocationErrorMessage } from "@/lib/taskLocation";
import { extractTasksFromCache } from "@/features/tasks/taskCache";
import { validateTaskParentLink } from "@/lib/taskRelations";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

import {
  AUTOSAVE_DELAY_MS,
  TASK_DRAWER_SNAP_POINTS,
  captureTaskUndoSnapshots,
  noteSnapshot,
  noteSnapshotMatches,
  type TaskNoteSnapshot,
} from "@/components/task-detail/taskDetailUndo";
import { TaskLocationDialog } from "@/components/task-detail/TaskLocationDialog";
import { TaskSourceCards } from "@/components/task-detail/TaskSourceCards";
import { TaskNotesInlineList } from "@/components/task-detail/TaskNotesInlineList";

export type TaskDetailHandle = {
  /** Flushes the current editor state before a parent route is allowed to leave. */
  savePendingChanges: (force?: boolean) => Promise<TaskPersistenceStatus>;
  hasPendingChanges: () => boolean;
  getCurrentTask: () => Task;
  requestClose: () => void;
  handleBackClick: () => void;
};

export const TaskDetail = forwardRef<TaskDetailHandle, {
  task: Task;
  onClose: () => void;
  onChanged: () => void;
  setConfirm: (c: ConfirmState) => void;
  mode?: "sheet" | "page" | "drawer" | "embedded" | "modal";
  allowDelete?: boolean;
  onSave?: () => Promise<void> | void;
  onOpenParentTask?: (parentId: string) => void;
  onBack?: () => void;
  hasBackHistory?: boolean;
}>(function TaskDetail({
  task, onClose, onChanged, setConfirm, mode = "sheet", allowDelete = false, onSave,
  onOpenParentTask, onBack, hasBackHistory,
}, ref) {
  const { user } = useAuth();
  const { i18n } = useTranslation();
  const navigate = useNavigate();
  const isEn = (i18n.language || "fa").startsWith("en");
  const T = (fa: string, en: string) => (isEn ? en : fa);
  const { canEdit, canComment, isOwner } = useShareAccess("task", task.id, task.user_id);
  const isMobile = useIsMobile();

  const [t, setT] = useState(task);
  const [taskNotes, setTaskNotes] = useState<TaskNote[]>([]);
  const [editingNote, setEditingNote] = useState<TaskNote | null>(null);
  const [isAddingNote, setIsAddingNote] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);
  const [snap, setSnap] = useState<number | string>(0.5);
  const [folders, setFolders] = useState<{ id: string; name: string; parent_id: string | null; color: string | null }[]>([]);
  const [tags, setTags] = useState<{ id: string; name: string; color: string | null }[]>([]);
  const [taskTagIds, setTaskTagIds] = useState<string[]>([]);
  const pendingTagChangesRef = useRef(new Set<string>());

  const isScheduled = readSchedule(t).kind !== "none" || !!t.reminder_at || !!t.recurrence_rule;
  const [showSubtasks, setShowSubtasks] = useState(false);
  const [showSteps, setShowSteps] = useState(false);
  const [showAttachments, setShowAttachments] = useState(false);
  const [showNotes, setShowNotes] = useState(false);
  const [subtaskProgress, setSubtaskProgress] = useState({ completed: 0, total: 0 });
  const [loadedSubtasks, setLoadedSubtasks] = useState<Array<{ id: string; title: string; completed: boolean; position: number }>>([]);
  const [tagOpen, setTagOpen] = useState(false);
  // One inline panel under the task header at a time (folder, goal, schedule, plan, priority, tags).
  const [metaPanel, setMetaPanel] = useState<TaskMetaPanel | null>(null);
  const panelSetter = (p: TaskMetaPanel) => (open: boolean) => setMetaPanel((cur) => (open ? p : cur === p ? null : cur));
  const topTagOpen = metaPanel === "tags";
  const setTopTagOpen = panelSetter("tags");
  const folderOpen = metaPanel === "folder";
  const setFolderOpen = panelSetter("folder");
  const [actionMenuOpen, setActionMenuOpen] = useState(false);
  const [focusOpen, setFocusOpen] = useState(false);
  const [showOutcomes, setShowOutcomes] = useState(false);
  const [stepListCount, setStepListCount] = useState(0);
  const [attachmentCount, setAttachmentCount] = useState(0);
  const [linkUrl, setLinkUrl] = useState("");
  const [voiceListening, setVoiceListening] = useState(false);
  const [voiceInstance, setVoiceInstance] = useState<VoiceInput | null>(null);
  const scheduleOpen = metaPanel === "schedule";
  const setScheduleOpen = panelSetter("schedule");
  const [parentOpen, setParentOpen] = useState(false);
  const [parentTitle, setParentTitle] = useState("");
  const [allTasks, setAllTasks] = useState<{ id: string; title: string; parent_id: string | null }[]>([]);
  const [outcomeOpen, setOutcomeOpen] = useState(false);
  const [outcomeCount, setOutcomeCount] = useState(0);
  const [outcomeRefresh, setOutcomeRefresh] = useState(0);
  const [saveState, setSaveState] = useState<"saved" | "dirty" | "saving" | "queued" | "error">("saved");
  const [saveBusy, setSaveBusy] = useState(false);
  const [closePromptOpen, setClosePromptOpen] = useState(false);
  const latestTaskRef = useRef(task);
  const savedTaskRef = useRef(task);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const titleInputRef = useRef<HTMLTextAreaElement | null>(null);
  const conversionRef = useRef<string | null>(null);
  const [convertingDescription, setConvertingDescription] = useState(false);
  const noteEditorIdentity = useRef("");
  noteEditorIdentity.current = `${user?.id ?? ""}:${task.id}`;
  useEffect(() => {
    const identity = `${user?.id ?? ""}:${task.id}`;
    noteEditorIdentity.current = identity;
    conversionRef.current = null;
    setConvertingDescription(false);
    setTaskNotes([]);
    setEditingNote(null);
    setShowNotes(false);
    setIsAddingNote(false);
    return () => { if (noteEditorIdentity.current === identity) noteEditorIdentity.current = ""; };
  }, [user?.id, task.id]);

  // Add menu & Contacts modal states
  const [addLocationOpen, setAddLocationOpen] = useState(false);
  const [locationText, setLocationText] = useState(task.location || "");
  const [locatingTask, setLocatingTask] = useState(false);
  const modules = useModules();


  useEffect(() => {
    let restored = task;
    try {
      const raw = localStorage.getItem(`arshnaz-task-draft:${task.id}`);
      if (raw) {
        const draft = JSON.parse(raw) as { task?: Partial<Task>; description?: string };
        const recovered = draft.task || (typeof draft.description === "string" ? { description: draft.description } : null);
        if (recovered) restored = { ...task, ...recovered, id: task.id };
      }
    } catch { /* corrupted drafts are ignored */ }
    setT(restored);
    setShowSubtasks(false);
    latestTaskRef.current = restored;
    savedTaskRef.current = task;
    setSaveState(Object.keys(taskPatch(restored, task)).length ? "dirty" : "saved");
  }, [task.id]);

  useEffect(() => {
    // A widget route shows an account-scoped cached task first. Adopt the
    // authoritative network refresh only while this editor is clean.
    if (task.id !== latestTaskRef.current.id) return;
    if (Object.keys(taskPatch(latestTaskRef.current, savedTaskRef.current)).length) return;
    savedTaskRef.current = task;
    latestTaskRef.current = task;
    setT(task);
  }, [task]);

  useEffect(() => { latestTaskRef.current = t; }, [t]);

  // Initialize voice input
  useEffect(() => {
    const voice = new VoiceInput({
      onTranscript: (text) => {
        setT(prev => ({ ...prev, title: prev.title ? prev.title.trimEnd() + " " + text : text }));
      },
      onError: (error) => {
        toast.error(error);
      },
      onListeningChange: (isListening) => {
        setVoiceListening(isListening);
      },
    });
    setVoiceInstance(voice);
    return () => {
      voice.stop();
    };
  }, []);

  useEffect(() => {
    if (!user?.id) return;
    let active = true;
    let sequence = 0;
    const refresh = async () => {
      const current = ++sequence;
      const notes = await getTaskNotes(task.id, user.id).catch(() => null);
      if (!active || current !== sequence || !notes) return;
      setTaskNotes(notes);
      if (notes.length) setShowNotes(true);
    };
    const event = `arshnaz:task-notes-refresh:${task.id}`;
    window.addEventListener(event, refresh);
    return () => { active = false; window.removeEventListener(event, refresh); };
  }, [task.id, user?.id]);

  // Auto-reveal sections that already have data so user doesn't need to tap rail icons
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [loadedNotes, tagsRes, subRes, stepListsRes, attachRes, outcomesRes] = await Promise.all([
        getTaskNotes(task.id, user ? user.id : ""),
        firebaseStore.from("task_tags").select("tag_id").eq("task_id", task.id),
        firebaseStore.from("tasks").select("*").eq("parent_id", task.id),
        firebaseStore.from("task_step_lists").select("id", { count: "exact", head: true }).eq("task_id", task.id),
        Promise.all([
          firebaseStore.from("task_attachments").select("id", { count: "exact", head: true }).eq("task_id", task.id).then((r) => r.count || 0, () => 0),
          listAttachments(task.id).then((r) => r.length, () => 0),
        ]).then(([legacyCount, remoteCount]) => ({ count: legacyCount + remoteCount })),
        firebaseStore.from("task_outcomes").select("id", { count: "exact", head: true }).eq("task_id", task.id),
      ]);
      if (cancelled) return;
      setTaskNotes((prev) => {
        const map = new Map<string, TaskNote>();
        for (const n of loadedNotes) map.set(n.id, n);
        for (const p of prev) {
          if (p.task_id !== task.id || p.user_id !== user?.id) continue;
          const loaded = map.get(p.id);
          if (!loaded || (p.updated_at || p.created_at || "") >= (loaded.updated_at || loaded.created_at || "")) map.set(p.id, p);
        }
        return Array.from(map.values()).sort(
          (a, b) => new Date(b.updated_at || b.created_at || 0).getTime() - new Date(a.updated_at || a.created_at || 0).getTime()
        );
      });
      if (loadedNotes.length > 0) setShowNotes(true);
      setTaskTagIds((tagsRes.data || []).map((r: any) => r.tag_id));

      let subs = (subRes.data || []) as Array<{ id: string; title: string; completed: boolean; position: number }>;
      if (user) {
        try {
          const cachedRaw = await cacheGet<unknown>(`tasks:all:${user.id}`);
          const cachedTasks = extractTasksFromCache(cachedRaw);
          if (cachedTasks.length > 0) {
            const cachedMap = new Map(cachedTasks.filter((ct) => ct && ct.parent_id === task.id).map((ct) => [ct.id, ct]));
            if (subs.length > 0) {
              subs = subs.map((s) => {
                const c = cachedMap.get(s.id);
                return c ? { ...s, ...c, completed: Boolean(c.completed), title: c.title || s.title } : s;
              });
            } else {
              subs = Array.from(cachedMap.values()).map((ct, i) => ({
                ...ct,
                id: ct.id,
                title: ct.title || "",
                completed: Boolean(ct.completed),
                position: (ct as any).position ?? i,
              }));
            }
          }
        } catch {}
      }

      if (subs.length > 0) {
        setLoadedSubtasks(subs);
        const done = subs.filter((s) => s.completed).length;
        setSubtaskProgress({ completed: done, total: subs.length });
      }

      if (cancelled) return;

      const stepCount = stepListsRes.count || 0;
      setStepListCount(stepCount);

      const attCount = attachRes.count || 0;
      setAttachmentCount(attCount);

      const outCount = outcomesRes.count || 0;
      setOutcomeCount(outCount);
      if (outCount > 0) setShowOutcomes(true);
    })();
    return () => { cancelled = true; };
  }, [task.id, user?.id]);

  useEffect(() => {
    setFolders([]);
    setTags([]);
    setAllTasks([]);
    if (!user?.id) return;
    let active = true;
    // Use the same live taxonomy as the sidebar. Server orderBy excludes older
    // folders without a position field and must not replace the cache with [].
    const unsubscribeFolders = subscribeFolders(user.id, (items) => {
      if (active) setFolders(items);
    });
    const unsubscribeTags = subscribeTags(user.id, (items) => {
      if (active) setTags(items);
    });
    void cacheGet<unknown>(`tasks:all:${user.id}`).then((raw) => {
      const cached = extractTasksFromCache(raw);
      if (active && cached.length) setAllTasks(cached.map((item) => ({ id: item.id, title: item.title, parent_id: item.parent_id ?? null })));
    });
    if (typeof navigator === "undefined" || navigator.onLine) {
      void firebaseStore.from("tasks").select("id,title,parent_id").order("title").then(({ data, error }) => {
        if (active && !error && data) setAllTasks(data as unknown as typeof allTasks);
      });
    }
    return () => {
      active = false;
      unsubscribeFolders();
      unsubscribeTags();
    };
  }, [user?.id]);

  useEffect(() => {
    if (!t.parent_id) { setParentTitle(""); return; }
    const cachedParent = allTasks.find(x => x.id === t.parent_id);
    if (cachedParent?.title) {
      setParentTitle(cachedParent.title);
    }
    firebaseStore.from("tasks").select("title").eq("id", t.parent_id).maybeSingle().then(({ data }) => {
      if (data?.title) {
        setParentTitle(data.title as string);
      } else if (!cachedParent?.title) {
        setParentTitle("—");
      }
    });
  }, [t.parent_id, allTasks]);

  const parentCandidates = useMemo(() => {
    const id = t.id;
    return allTasks.filter((x) => validateTaskParentLink(allTasks, id, x.id, "parent_id").valid);
  }, [allTasks, t.id]);
  const isParentLinkValid = useCallback((parentId: string | null) =>
    validateTaskParentLink(allTasks, t.id, parentId, "parent_id").valid, [allTasks, t.id]);

  const folderName = (id: string | null): string => {
    if (!id) return T("بدون فولدر", "No folder");
    const f = folders.find(x => x.id === id);
    if (!f) return "—";
    const parent = f.parent_id ? folders.find(x => x.id === f.parent_id) : null;
    return parent ? `${parent.name} / ${f.name}` : f.name;
  };

  const currentFolder = useMemo(() => {
    if (!t.folder_id) return null;
    return folders.find((f) => f.id === t.folder_id) || null;
  }, [t.folder_id, folders]);

  const taskFolderLabel = useMemo(() => {
    if (!t.folder_id) return T("صندوق ورودی", "Inbox");
    if (!currentFolder) return T("پوشه…", "Folder…");
    const parent = currentFolder.parent_id ? folders.find((x) => x.id === currentFolder.parent_id) : null;
    return parent ? `${parent.name} / ${currentFolder.name}` : currentFolder.name;
  }, [t.folder_id, currentFolder, folders, T]);

  const availableGoals = useMemo(() => {
    return getAllKanbanGoals(folders, user?.id);
  }, [folders, user?.id]);

  const currentGoal = useMemo(() => {
    if (!t.kanban_column_id) return null;
    return availableGoals.find((g) => g.id === t.kanban_column_id) || null;
  }, [t.kanban_column_id, availableGoals]);

  const taskGoalLabel = useMemo(() => {
    if (!currentGoal) return T("بدون هدف", "No Goal");
    return `${currentGoal.icon ? currentGoal.icon + " " : ""}${currentGoal.title}`;
  }, [currentGoal, T]);

  const generateId = () => {
    try { return crypto.randomUUID(); } catch { return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`; }
  };

  const toggleTag = async (tagId: string) => {
    if (!user || !canEdit) return;
    if (pendingTagChangesRef.current.has(tagId)) return;
    pendingTagChangesRef.current.add(tagId);
    const userId = user.id;
    const taskId = t.id;
    const identity = noteEditorIdentity.current;
    const action = taskTagIds.includes(tagId) ? "remove" : "add";
    setTaskTagIds((current) => action === "remove"
      ? current.filter((id) => id !== tagId)
      : current.includes(tagId) ? current : [...current, tagId]);

    try {
      const result = await persistTaskTagChange(userId, taskId, tagId, action);
      if (result === "failed") {
        setTaskTagIds((current) => action === "remove"
          ? current.includes(tagId) ? current : [...current, tagId]
          : current.filter((id) => id !== tagId));
        toast.error(T("تغییر تگ ذخیره نشد؛ نمایش به حالت قبلی برگشت", "Tag change was not saved; reverted to its previous state"));
      } else if (result === "queued") {
        toast.info(T("تغییر تگ روی این دستگاه ذخیره شد و بعداً همگام می‌شود", "Tag change saved on this device and will sync later"));
      }
      if (result !== "failed") {
        const applyTagAction = async (nextAction: "add" | "remove") => {
          const reverseResult = await persistTaskTagChange(userId, taskId, tagId, nextAction);
          if (reverseResult === "failed") throw new Error(T("تغییر تگ بازگردانی نشد؛ دوباره تلاش کن", "Tag change could not be restored; try again"));
          if (noteEditorIdentity.current === identity) {
            setTaskTagIds((current) => nextAction === "add"
              ? current.includes(tagId) ? current : [...current, tagId]
              : current.filter((id) => id !== tagId));
          }
        };
        pushUndo({
          label: action === "add" ? T("برچسب اضافه شد", "Tag added") : T("برچسب برداشته شد", "Tag removed"),
          undo: () => applyTagAction(action === "add" ? "remove" : "add"),
          redo: () => applyTagAction(action),
        });
      }
    } finally {
      pendingTagChangesRef.current.delete(tagId);
    }
  };

  const refreshTask = async () => {
    if (typeof navigator !== "undefined" && !navigator.onLine) return;
    try {
      const { data } = await firebaseStore.from("tasks").select("*").eq("id", task.id).single();
      if (data) setT(data as any);
      onChanged();
    } catch {
      // ignore network errors while offline
    }
  };

  const refreshOutcomeCount = async () => {
    try {
      const outcomes = await listTaskOutcomes(task.id);
      setOutcomeCount(outcomes.length);
      if (outcomes.length > 0) setShowOutcomes(true);
      setOutcomeRefresh(n => n + 1);
    } catch {
      // fallback to store count if needed
      try {
        const { count } = await firebaseStore.from("task_outcomes").select("id", { count: "exact", head: true }).eq("task_id", task.id);
        setOutcomeCount(count || 0);
        if ((count || 0) > 0) setShowOutcomes(true);
      } catch {
        // ignore network errors while offline
      }
    }
  };

  const refreshStepListCount = async () => {
    try {
      const { count } = await firebaseStore.from("task_step_lists").select("id", { count: "exact", head: true }).eq("task_id", task.id);
      setStepListCount(count || 0);
      if ((count || 0) > 0) setShowSteps(true);
    } catch {
      // ignore network errors while offline
    }
  };

  const save = useCallback(async (patch: Partial<Task>, force = false, importance?: "replace"): Promise<TaskPersistenceStatus> => {
    if (!canEdit) return "failed";
    if (!force && !Object.keys(patch).length) return "saved";
    const current = latestTaskRef.current;
    const previousSavedTask = savedTaskRef.current;
    const identity = noteEditorIdentity.current;
    const { before: undoBefore, after: undoAfter, fields: undoFields } = captureTaskUndoSnapshots(patch, previousSavedTask);
    if (patch.parent_id !== undefined && !validateTaskParentLink(allTasks, current.id, patch.parent_id, "parent_id").valid) {
      toast.error(isEn ? "This subtask link would create a cycle and was not saved." : "این پیوند زیرتسک باعث چرخه می‌شود و ذخیره نشد.");
      return "failed";
    }
    const next = { ...current, ...patch };
    latestTaskRef.current = next;
    setT(next);
    setSaveState("saving");

    const applyTaskSnapshot = async (snapshot: TaskUndoSnapshot, expected: TaskUndoSnapshot) => {
      if (!user?.id || noteEditorIdentity.current !== identity) throw new Error(isEn ? "Open the same task in the same account to restore" : "برای بازگردانی همان کار را در همان حساب باز کنید");
      if (Object.keys(expected).some(field => !sameUndoValue(latestTaskRef.current[field as keyof Task], expected[field as keyof Task]))) throw new Error(isEn ? "Newer edits must be preserved; recovery was blocked" : "برای حفظ ویرایش تازه، بازگردانی انجام نشد");
      const status = toSaveStatus(await persistTask(user.id, { id: current.id, ...snapshot }, { expectedValues: expected }));
      if (status === "failed") throw new Error(isEn ? "Restore could not be saved; try again" : "بازگردانی ذخیره نشد؛ دوباره تلاش کن");

      if (latestTaskRef.current.id === current.id) {
        const restored = { ...latestTaskRef.current, ...snapshot };
        latestTaskRef.current = restored;
        setT(restored);
        savedTaskRef.current = { ...savedTaskRef.current, ...snapshot };
        if (!Object.keys(taskPatch(latestTaskRef.current, savedTaskRef.current)).length) clearTaskDraft(current.id);
        else writeTaskDraft(restored);
        setSaveState(status);
        try { void Promise.resolve(onChanged()).catch((error) => console.warn("Task refresh after text restore failed:", error)); }
        catch (error) { console.warn("Task refresh after text restore failed:", error); }
      }
    };

    const finish = (state: "saved" | "queued") => {
      savedTaskRef.current = { ...savedTaskRef.current, ...patch };
      if (!Object.keys(taskPatch(latestTaskRef.current, savedTaskRef.current)).length) clearTaskDraft(current.id);
      setSaveState(state);
      const isLatestUndoChange = latestTaskRef.current.id === current.id && undoFields.every((field) => sameUndoValue(latestTaskRef.current[field], undoAfter[field]));
      if (user?.id && undoFields.length > 0 && isLatestUndoChange) {
        const orderedFields = undoFields.slice().sort((left, right) => String(left).localeCompare(String(right)));
        const fieldKey = orderedFields.map(String).join(":");
        const hasTitle = undoFields.includes("title");
        const hasDescription = undoFields.includes("description");
        const fieldLabel = isEn
          ? hasTitle && hasDescription && undoFields.length === 2 ? "task title and description" : hasTitle && undoFields.length === 1 ? "task title" : hasDescription && undoFields.length === 1 ? "task description" : "task changes"
          : hasTitle && hasDescription && undoFields.length === 2 ? "عنوان و شرح تسک" : hasTitle && undoFields.length === 1 ? "عنوان تسک" : hasDescription && undoFields.length === 1 ? "شرح تسک" : "تغییرات تسک";
        const mergeState = { latest: undoAfter };
        pushUndo({
          importance,
          label: isEn ? `Recorded ${fieldLabel} change` : `تغییر ${fieldLabel} ثبت شد`,
          undo: () => applyTaskSnapshot(undoBefore, mergeState.latest),
          redo: () => applyTaskSnapshot(mergeState.latest, undoBefore),
          mergeData: undoAfter,
          onMerge: (latest) => { mergeState.latest = latest as TaskUndoSnapshot; },
        }, { mergeKey: `task:${user.id}:${current.id}:${fieldKey}`, mergeWindowMs: 10000 });
      }
      // Refreshing a parent list is helpful, but must never turn a successful
      // persistence operation into a visible save failure.
      try { void Promise.resolve(onChanged()).catch((error) => console.warn("Task refresh after save failed:", error)); }
      catch (error) { console.warn("Task refresh after save failed:", error); }
    };

    // The Firestore task service is the authoritative path. It writes the
    // local cache first, then persists to /users/{uid}/tasks/{id}; a temporary
    // cloud failure never discards an edit or traps the user in the close prompt.
    if (user) {
      try {
        // Autosave sends only the changed fields (merge write), so edits made on
        // another device to other fields are not overwritten by this editor.
        const result = toSaveStatus(await persistTask(user.id, { id: current.id, ...patch }));
        if (result === "failed") throw new Error("Task could not be saved on this device");
        finish(result);
        return result;
      } catch (error) {
        setSaveState("error");
        throw error;
      }
    }

    try {
      // This is reachable only while the authentication state is temporarily
      // unavailable. Keep the edit locally with explicit owner and base revision
      // so the queue replay and local draft stay attributable and syncable.
      writeTaskDraft(next);
      const ownerId = current.user_id || previousSavedTask.user_id;
      const expectedRevision = previousSavedTask.updated_at || current.updated_at;
      const queued = await enqueueOp({
        table: "tasks",
        op: "update",
        ownerId,
        expectedRevision,
        payload: ownerId ? { ...patch, user_id: ownerId } : patch,
        match: ownerId ? { id: current.id, user_id: ownerId } : { id: current.id },
      });
      if (!queued) throw new Error("Task could not be queued on this device");
      finish("queued");
      return "queued";
    } catch (e) {
      setSaveState("error");
      throw e;
    }
  }, [allTasks, canEdit, isEn, onChanged, user]);

  const pendingPatch = taskPatch(t, savedTaskRef.current);
  const hasPendingChanges = Object.keys(pendingPatch).length > 0;

  const savePendingChanges = useCallback(async (force = false) => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = null;
    const patch = taskPatch(latestTaskRef.current, savedTaskRef.current);
    if (!force && !Object.keys(patch).length) return "saved" as const;
    return save(patch, force);
  }, [save]);

  useEffect(() => {
    if (!canEdit || !hasPendingChanges) return;
    setSaveState("dirty");
    writeTaskDraft(t);
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => { void savePendingChanges().catch(() => undefined); }, AUTOSAVE_DELAY_MS);
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, [canEdit, hasPendingChanges, t, savePendingChanges]);

  useEffect(() => {
    const flushWhenHidden = () => {
      if (document.visibilityState === "hidden") void savePendingChanges();
    };
    const warnBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!Object.keys(taskPatch(latestTaskRef.current, savedTaskRef.current)).length) return;
      event.preventDefault();
      event.returnValue = "";
    };
    document.addEventListener("visibilitychange", flushWhenHidden);
    window.addEventListener("beforeunload", warnBeforeUnload);
    return () => {
      document.removeEventListener("visibilitychange", flushWhenHidden);
      window.removeEventListener("beforeunload", warnBeforeUnload);
    };
  }, [savePendingChanges]);

  const requestClose = useCallback(() => {
    if (hasPendingChanges || saveState === "saving" || saveState === "error") setClosePromptOpen(true);
    else onClose();
  }, [hasPendingChanges, saveState, onClose]);

  const handleSaveClick = useCallback(async () => {
    if (onSave) {
      try {
        setSaveBusy(true);
        await onSave();
      } finally {
        setSaveBusy(false);
      }
    } else {
      try {
        setSaveBusy(true);
        const status = await savePendingChanges(true);
        if (status === "saved") toast.success(T("تغییرات ذخیره شد", "Changes saved"));
        else if (status === "queued") toast.info(T("روی این دستگاه ذخیره شد و با اتصال همگام می‌شود", "Saved on this device and will sync when online"));
      } catch {
        // error already handled in savePendingChanges
      } finally {
        setSaveBusy(false);
      }
    }
  }, [onSave, savePendingChanges, T]);

  const handleBackClick = useCallback(() => {
    if (closePromptOpen) { setClosePromptOpen(false); return; }
    if (actionMenuOpen) { setActionMenuOpen(false); return; }
    if (focusOpen) { setFocusOpen(false); return; }
    if (aiOpen) { setAiOpen(false); return; }
    if (outcomeOpen) { setOutcomeOpen(false); return; }
    if (metaPanel) { setMetaPanel(null); return; }
    if (parentOpen) { setParentOpen(false); return; }
    if (tagOpen) { setTagOpen(false); return; }
    if (editingNote) { setEditingNote(null); return; }
    if (isAddingNote) { setIsAddingNote(false); return; }

    if (hasPendingChanges || saveState === "saving" || saveState === "error") {
      requestClose();
      return;
    }

    if (onBack) {
      onBack();
    } else if (onSave) {
      onClose();
    } else {
      requestClose();
    }
  }, [
    closePromptOpen, actionMenuOpen, focusOpen, aiOpen, outcomeOpen,
    metaPanel, parentOpen, tagOpen, editingNote, isAddingNote,
    hasPendingChanges, saveState, onBack, onSave, onClose, requestClose,
  ]);

  // A full-page creation screen owns its Back/Save buttons. Giving it one
  // awaited save boundary prevents navigation from racing the editor's debounce.
  useImperativeHandle(ref, () => ({
    savePendingChanges,
    hasPendingChanges: () => Object.keys(taskPatch(latestTaskRef.current, savedTaskRef.current)).length > 0,
    getCurrentTask: () => latestTaskRef.current,
    requestClose,
    handleBackClick,
  }), [savePendingChanges, requestClose, handleBackClick]);

  useEffect(() => {
    const request = (e: Event) => {
      e.preventDefault();
      handleBackClick();
    };
    window.addEventListener("arshnaz:request-task-close", request);
    return () => window.removeEventListener("arshnaz:request-task-close", request);
  }, [handleBackClick]);

  const deleteTask = async () => {
    if (!user) return;
    let allTasks: Task[] = [];
    try {
      const cachedRaw = await cacheGet<unknown>(`tasks:all:${user.id}`);
      allTasks = extractTasksFromCache(cachedRaw);
    } catch {}
    const childrenMap = buildTaskChildrenMap(allTasks);
    const descendants = collectTaskDescendantIds(t.id, childrenMap).filter(id => id !== t.id);
    const childCount = descendants.length;

    setConfirm({
      kind: "task",
      id: t.id,
      title: t.title || T("بدون عنوان", "Untitled"),
      childCount,
      onConfirm: async () => {
        // Ask the cascade for its recovery snapshot so deleting from the detail
        // panel offers the same "Recently Deleted" restore as the task list.
        const res = await deleteTaskCascade(user.id, t.id, allTasks, { recoverable: true });
        if (!res.success) {
          toast.error(T("حذف انجام نشد؛ برای تهیه نسخهٔ بازگردانی، به اینترنت وصل شوید و همگام‌سازی را کامل کنید.", "Nothing was deleted. Connect and finish syncing so the recovery snapshot can be verified."));
          return false;
        }
        const recovery = res.recovery;
        const restoreTasks = recovery?.tasks?.length
          ? recovery.tasks
          : allTasks.filter(task => res.deletedIds.includes(task.id));
        const restore = async (): Promise<boolean> => {
          const statuses = await Promise.all(restoreTasks.map(task => persistTask(user.id, task)));
          if (statuses.some(status => status !== "saved" && status !== "queued")) return false;
          try {
            if (recovery?.tagLinks?.length) {
              const { error } = await firebaseStore.from("task_tags").insert(recovery.tagLinks as never);
              if (error) return false;
            }
          } catch { return false; }
          try {
            if (recovery?.knowledgeLinks?.length) {
              const { error } = await firebaseStore.from("task_knowledge_links").insert(recovery.knowledgeLinks as never);
              if (error) return false;
            }
          } catch { return false; }
          try {
            if (recovery?.noteTaskLinks?.length) {
              const { error } = await firebaseStore.from("note_task_links").insert(recovery.noteTaskLinks as never);
              if (error) return false;
            }
          } catch { return false; }
          onChanged();
          return true;
        };
        if (recovery) {
          if (!pushDeletedTask(user.id, t.title || T("بدون عنوان", "Untitled"), recovery)) toast.warning(T("بازگردانی فقط تا ۱۰ دقیقه در همین نشست ممکن است؛ با بارگذاری مجدد از دست می‌رود.", "Recovery is available for 10 minutes in this session only; reloading loses it."));
        } else pushDeleted({ kind: "task", label: t.title || T("بدون عنوان", "Untitled"), restore });
        onClose();
        onChanged();
      },
    });
  };

  const postpone = (days: number) => {
    const workDate = taskWorkDate(t);
    const base = workDate ? parseTaskDueDate(workDate) || new Date() : new Date();
    const next = addDays(base, days);
    const allDay = !workDate || /^\d{4}-\d{2}-\d{2}$/.test(workDate) || (base.getHours() === 23 && base.getMinutes() === 59);
    save(workDatePatch(t, allDay ? getLocalDateString(next) : next.toISOString()));
    setScheduleOpen(false);
    toast(T(`تسک به ${days} روز دیگر موکول شد`, `Task postponed by ${days} day(s)`));
  };

  const toggleCompletion = async () => {
    if (isLeitnerStudyTask(t) && !t.completed) return;
    const nextCompleted = !t.completed;
    if (nextCompleted) {
      playCompletionFeedback();
    }
    if (nextCompleted && isRecurringTask(t) && user?.id) {
      awardTaskWatering(t.title || T("تسک", "Task"), Boolean(t.parent_id));
      const res = await advanceRecurringTask(user.id, t);
      if (res.success && res.patch) {
        setT((prev) => ({ ...prev, ...res.patch }));
        toast.success(
          T(
            `نمونه بعدی به ${res.formattedNextDate} منتقل شد 🔁`,
            `Next instance moved to ${res.formattedNextDate} 🔁`
          )
        );
        onChanged();
        return;
      }
    }
    if (nextCompleted) {
      awardTaskWatering(t.title || T("تسک", "Task"), Boolean(t.parent_id));
    }
    void save({
      completed: nextCompleted,
      status: nextCompleted ? "done" : "todo",
      completed_at: nextCompleted ? new Date().toISOString() : null,
    });
  };

  const openLinkedReview = () => {
    const reviewUrl = getStudyTaskNavigation(t).navUrl;
    if (reviewUrl) navigate(reviewUrl);
  };

  const updateNoteListIfCurrent = (identity: string, updated: TaskNote) => {
    if (noteEditorIdentity.current !== identity) return;
    setTaskNotes((previous) => [updated, ...previous.filter((note) => note.id !== updated.id)]);
  };

  const removeNoteFromListIfCurrent = (identity: string, noteId: string) => {
    if (noteEditorIdentity.current !== identity) return;
    setTaskNotes((previous) => previous.filter((note) => note.id !== noteId));
  };

  const applyNoteSnapshot = async (
    identity: string,
    userId: string,
    taskId: string,
    noteId: string,
    snapshot: TaskNoteSnapshot,
    expected: TaskNoteSnapshot,
  ) => {
    const currentNotes = await getTaskNotes(taskId, userId);
    const currentNote = currentNotes.find((note) => note.id === noteId);
    if (!currentNote || !noteSnapshotMatches(currentNote, expected)) {
      throw new Error(T("این یادداشت بعد از تغییر ذخیره‌شده عوض شده است؛ برای جلوگیری از حذف تغییر تازه، دوباره بارگذاری‌اش کن.", "This note changed after the saved edit. Reload it to avoid overwriting newer content."));
    }
    const updated = await updateTaskNote(userId, noteId, taskId, snapshot, expected);
    updateNoteListIfCurrent(identity, updated);
  };

  const deleteCreatedNoteIfUnchanged = async (
    identity: string,
    userId: string,
    taskId: string,
    noteId: string,
    expected: TaskNoteSnapshot,
  ) => {
    const currentNotes = await getTaskNotes(taskId, userId);
    const currentNote = currentNotes.find((note) => note.id === noteId);
    if (!currentNote) return;
    if (!noteSnapshotMatches(currentNote, expected)) {
      throw new Error(T("این یادداشت بعد از ساخته‌شدن تغییر کرده است و برای حفظ متن تازه حذف نشد.", "This note changed after creation and was kept to preserve the newer content."));
    }
    await deleteTaskNote(userId, noteId, taskId, expected);
    removeNoteFromListIfCurrent(identity, noteId);
  };

  const addNoteCreateUndo = (created: TaskNote) => {
    if (!user?.id) return;
    const userId = user.id;
    const taskId = t.id;
    const identity = noteEditorIdentity.current;
    const snapshot = noteSnapshot(created);
    pushUndo({
      label: T(`نوت «${created.title || "بدون عنوان"}» اضافه شد`, `Note "${created.title || "Untitled"}" created`),
      undo: () => deleteCreatedNoteIfUnchanged(identity, userId, taskId, created.id, snapshot),
      redo: async () => {
        const restored = await createTaskNote(userId, taskId, {
          id: created.id,
          title: created.title,
          content: created.content,
          created_at: created.created_at,
        });
        updateNoteListIfCurrent(identity, restored);
      },
    });
  };

  const addNoteEditUndo = (before: TaskNote, after: TaskNote) => {
    if (!user?.id) return;
    const changedFields = (["title", "content"] as const).filter((field) => before[field] !== after[field]);
    if (!changedFields.length) return;
    const userId = user.id;
    const taskId = t.id;
    const identity = noteEditorIdentity.current;
    const beforeSnapshot = noteSnapshot(before, [...changedFields]);
    const afterSnapshot = noteSnapshot(after, [...changedFields]);
    pushUndo({
      label: T(`نوت «${after.title || "بدون عنوان"}» ویرایش شد`, `Note "${after.title || "Untitled"}" edited`),
      undo: () => applyNoteSnapshot(identity, userId, taskId, after.id, beforeSnapshot, afterSnapshot),
      redo: () => applyNoteSnapshot(identity, userId, taskId, after.id, afterSnapshot, beforeSnapshot),
    });
  };

  const askDelNote = (n: TaskNote) => {
    if (!user || !canEdit) return;
    const identity = noteEditorIdentity.current;
    setConfirm({
      kind: "note",
      id: n.id,
      title: n.title || T("بدون عنوان", "Untitled"),
      onConfirm: async () => {
        try {
          const existingNote = taskNotes.find(x => x.id === n.id) || n;
          await deleteTaskNote(user.id, n.id, t.id);
          if (noteEditorIdentity.current !== identity) return;
          setTaskNotes(prev => prev.filter(x => x.id !== n.id));
          toast.success(T("نوت حذف شد", "Note deleted"));
          pushUndo({
            label: T(`نوت «${existingNote.title || "بدون عنوان"}» حذف شد`, `Note "${existingNote.title || "Untitled"}" deleted`),
            importance: "delete",
            undo: async () => {
              if (noteEditorIdentity.current !== identity) throw new Error(T("برای بازگردانی همان کار را در همان حساب باز کنید", "Open the same task in the same account to restore"));
              const restored = await createTaskNote(user.id, t.id, {
                id: existingNote.id,
                title: existingNote.title,
                content: existingNote.content,
                created_at: existingNote.created_at,
              });
              updateNoteListIfCurrent(identity, restored);
            },
            redo: async () => {
              await deleteTaskNote(user.id, n.id, t.id, noteSnapshot(existingNote));
              removeNoteFromListIfCurrent(identity, n.id);
            },
          });
        } catch (err) {
          if (noteEditorIdentity.current === identity) toast.error(err instanceof Error ? err.message : T("خطا در حذف نوت", "Error deleting note"));
          // Keep the confirmation open so the user can retry an unsaved delete.
          return false;
        }
      },
    });
  };



  // ── Quick chip helpers ──────────────────────────────────────────────
  const formatDue = (iso: string | null) => {
    if (!iso) return null;
    const d = new Date(iso);
    return d.toLocaleDateString(isEn ? "en-US" : "fa-IR", { month: "short", day: "numeric" });
  };

  const priorityMeta = PRIORITY_META[normalizeTaskPriority(t.priority)];
  const recLabel = t.recurrence_rule ? describeRule(t.recurrence_rule, isEn) : null;
  const scheduleLabel = (() => {
    const lang = isEn ? "en" : "fa";
    const due = scheduleLabelOf(readSchedule(t), getTimeSettings(), lang);
    if (due) return recLabel ? `${due} · ${recLabel}` : due;
    if (t.recurrence_rule) return recLabel;
    return null;
  })();
  const handleSubtaskProgress = useCallback((completed: number, total: number) => {
    setSubtaskProgress((current) => current.completed === completed && current.total === total
      ? current : { completed, total });
  }, []);

  const Chip = ({ icon: Icon, children, onClick, onClear, color, disabled, title }: any) => (
    <span
      onClick={disabled ? undefined : onClick}
      title={title}
      className={`inline-flex items-center gap-1.5 px-2.5 h-6 rounded-lg text-[11px] font-medium transition-all duration-150 border ${
        disabled
          ? "text-muted-foreground/50 border-transparent"
          : color
            ? `${color} border-current/20 shadow-2xs`
            : "bg-muted/40 text-foreground/80 hover:bg-muted/80 border-border/50 cursor-pointer shadow-2xs"
      }`}
    >
      {Icon && <Icon className="w-3 h-3 shrink-0" />}
      <span className="truncate max-w-[130px]">{children}</span>
      {onClear && !disabled && (
        <X
          className="w-3 h-3 opacity-60 hover:opacity-100 hover:text-destructive cursor-pointer ms-0.5"
          onClick={(e) => { e.stopPropagation(); onClear(); }}
        />
      )}
    </span>
  );

  // ── Hero (task state + title) ──────────────────────────────────────
  const hero = (
    <div className="group/title flex items-start gap-2 px-1 pb-1">
      <button
        type="button"
        disabled={isLeitnerStudyTask(t) && !t.completed ? false : !canEdit}
        onClick={isLeitnerStudyTask(t) && !t.completed ? openLinkedReview : toggleCompletion}
        className="mt-1 grid h-8 w-8 shrink-0 place-items-center rounded-md disabled:opacity-60"
        aria-label={isLeitnerStudyTask(t) && !t.completed
          ? T("شروع مرور لایتنر", "Open Leitner review")
          : t.completed ? T("بازکردن تسک", "Reopen task") : T("تکمیل تسک", "Complete task")}
        title={isLeitnerStudyTask(t) && !t.completed
          ? T("شروع مرور لایتنر", "Open Leitner review")
          : t.completed ? T("بازکردن تسک", "Reopen task") : T("تکمیل تسک", "Complete task")}
        aria-pressed={Boolean(t.completed)}
        data-testid="task-detail-complete-toggle"
      >
        {isLeitnerStudyTask(t) && !t.completed
          ? <BookOpen className="w-5 h-5" />
          : <span className={`grid h-5 w-5 place-items-center rounded-md border-2 ${t.priority === "urgent" ? "border-red-600 bg-red-600" : t.priority === "high" ? "border-rose-500 bg-rose-500" : t.priority === "medium" ? "border-amber-500 bg-amber-500" : t.priority === "low" ? "border-emerald-500 bg-emerald-500" : "border-muted-foreground/50 bg-muted-foreground"} ${t.completed ? "text-white" : "!bg-transparent"}`}>{t.completed && <Check className="h-4 w-4" />}</span>}
      </button>
      <TaskTitleInput
        ref={titleInputRef}
        value={t.title}
        onChange={(e) => setT({ ...t, title: e.target.value })}
        onBlur={() => save({ title: t.title })}
        readOnly={!canEdit}
        minHeight={36}
        maxHeight={220}
        rows={1}
        dir="auto"
        placeholder={T("عنوان تسک", "Task title")}
        aria-label={T("عنوان تسک", "Task title")}
        data-task-title
        data-testid="task-detail-title"
        className={`flex-1 border-0 bg-transparent px-1 py-1 text-lg md:text-xl font-semibold leading-snug focus-visible:ring-0 focus-visible:bg-transparent placeholder:text-muted-foreground/50 break-words whitespace-pre-wrap ${t.completed ? "text-muted-foreground line-through decoration-1" : "text-foreground"}`}
      />
      <Button
        size="icon"
        variant={voiceListening ? "default" : "ghost"}
        disabled={!canEdit}
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => voiceInstance?.toggle(i18n.language === "en" ? "en-US" : "fa-IR")}
        className={`mt-1 h-8 w-8 shrink-0 ${voiceListening ? "flex bg-destructive text-destructive-foreground hover:bg-destructive/90" : "hidden text-muted-foreground group-focus-within/title:flex"}`}
        title={T("ورودی صوتی", "Voice input")}
        aria-label={T("ورودی صوتی", "Voice input")}
      >
        {voiceListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
      </Button>
    </div>
  );

  const descriptionSection = (
    <section className="mx-1">
      <div data-rich-selection>
        <TaskDescriptionEditor
          taskId={t.id}
          value={t.description || ""}
          onConvertToNote={async () => {
            const current = latestTaskRef.current;
            if (!user?.id || !canEdit || !current.description?.trim() || conversionRef.current) return;
            const identity = noteEditorIdentity.current;
            const source = current.description;
            conversionRef.current = identity;
            setConvertingDescription(true);
            try {
              const moved = await moveDescriptionToNote({
                userId: user.id, taskId: current.id, title: current.title, content: source,
                isCurrent: () => noteEditorIdentity.current === identity && latestTaskRef.current.id === current.id,
                create: data => createTaskNote(user.id, current.id, data),
                onCreated: created => setTaskNotes(previous => [created, ...previous.filter(note => note.id !== created.id)]),
                clear: async () => {
                  // A network refresh can arrive while the note is being saved. Preserve changed source.
                  if (latestTaskRef.current.description !== source) throw new Error(T("متن تغییر کرده؛ یادداشت ساخته شد و متن جدید حفظ شد", "Description changed; the note was created and the new text was kept"));
                  try {
                    const status = await save({ description: "" });
                    if (status === "failed") throw new Error(T("پاک‌کردن متن ذخیره نشد", "Clearing the description was not saved"));
                  } catch (error) {
                    if (noteEditorIdentity.current === identity && latestTaskRef.current.description === "") {
                      const restored = { ...latestTaskRef.current, description: source };
                      latestTaskRef.current = restored;
                      setT(restored);
                      writeTaskDraft(restored);
                    }
                    throw error;
                  }
                },
              });
              if (!moved) return;
              setShowNotes(true);
              toast.success(T("متن به نوت‌های پیوست منتقل شد", "Description moved to attached notes"));
            } catch (error) {
              if (noteEditorIdentity.current === identity) toast.error(error instanceof Error ? error.message : T("تبدیل به نوت انجام نشد", "Could not move to note"));
            } finally {
              if (conversionRef.current === identity) { conversionRef.current = null; setConvertingDescription(false); }
            }
          }}
          onChange={(v) => {
            const next = { ...latestTaskRef.current, description: v };
            latestTaskRef.current = next;
            setT(next);
            writeTaskDraft(next);
          }}
          onSave={async (v) => { await save({ description: v }); }}
          readOnly={!canEdit || convertingDescription}
        />
      </div>
    </section>
  );

  // ── Quick-info chips row (only what's set) ──────────────────────────
  const quickChips = (
    <div className="flex flex-wrap gap-1 px-1 pb-1">
      {t.parent_id && (
        <Chip
          icon={ListTree}
          color="bg-amber-500/10 text-amber-600 dark:text-amber-400"
          onClick={() => {
            void savePendingChanges().then(() => {
              if (onOpenParentTask) {
                onOpenParentTask(t.parent_id!);
              } else {
                navigate(`/app/tasks/${encodeURIComponent(t.parent_id!)}?from=${encodeURIComponent(t.id)}`);
              }
            });
          }}
          onClear={isOwner ? () => save({ parent_id: null }) : undefined}
          disabled={!canEdit}
          title={T("رفتن به تسک مادر", "Go to parent task")}
        >
          {parentTitle || "—"}
        </Chip>
      )}
      {t.source_type && (() => {
        const studyInfo = getStudyTaskNavigation(t);
        if (studyInfo.isStudyTask && !isPathAllowed(studyInfo.navUrl, modules)) return null;
        if (!studyInfo.isStudyTask && !hasModule("mind", modules)) return null;
        if (studyInfo.isStudyTask) {
          const isLeitner = t.source_type === "leitner" || t.source_type === "leitner_folder";
          return (
            <Chip
              icon={isLeitner ? Layers : studyInfo.isMindMap ? Network : t.source_type === "knowledge_folder" ? FolderTree : BookOpen}
              color={
                isLeitner
                  ? "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30 hover:bg-amber-500/25"
                  : studyInfo.isMindMap
                  ? "bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 border-indigo-500/30 hover:bg-indigo-500/25"
                  : "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30 hover:bg-emerald-500/25"
              }
              onClick={() => navigate(studyInfo.navUrl)}
              title={T(studyInfo.actionTextFa, studyInfo.actionTextEn)}
            >
              {T(studyInfo.badgeLabelFa, studyInfo.badgeLabelEn)}
            </Chip>
          );
        }

        return (
          <Chip
            icon={Brain}
            color="bg-purple-500/10 text-purple-700 dark:text-purple-300 border-purple-500/30"
            onClick={() => {
              const route = mindSourceRoute(t);
              if (route) navigate(route);
              else if (t.source_type === "values_goal") navigate("/app/values");
              else navigate("/app/mind");
            }}
            title={T("مشاهده مبدا در ذهن", "View origin in Mind")}
          >
            {t.source_type === "cbt_thought" ? T("ثبت فکر (CBT)", "CBT Thought")
              : t.source_type === "abc_model" ? T("مدل رفتار (ABC)", "ABC Model")
              : t.source_type === "worry_tree" ? T("درخت نگرانی", "Worry Tree")
              : t.source_type === "values_goal" ? T("ارزش‌ها (ACT)", "Values (ACT)")
              : T("ذهن", "Mind")}
          </Chip>
        );
      })()}
    </div>
  );

  // ── Quick-create helpers ────────────────────────────────────────────
  const TAG_COLORS = ["#ef4444", "#f59e0b", "#eab308", "#22c55e", "#06b6d4", "#3b82f6", "#8b5cf6", "#ec4899"];
  const [newFolderName, setNewFolderName] = useState("");
  const [newFolderColor, setNewFolderColor] = useState<string>(TAG_COLORS[5]);
  const [showFolderCreate, setShowFolderCreate] = useState(false);
  const [newTagName, setNewTagName] = useState("");
  const [newTagColor, setNewTagColor] = useState<string>(TAG_COLORS[3]);
  const [showTagCreate, setShowTagCreate] = useState(false);

  const createFolderAndAssign = async () => {
    if (!user || !isOwner || !newFolderName.trim()) return;
    const folderId = generateId();
    const newFolder = { id: folderId, user_id: user.id, name: newFolderName.trim(), color: newFolderColor, parent_id: null };

    if (typeof navigator !== "undefined" && !navigator.onLine) {
      setFolders((f) => [...f, newFolder]);
      setNewFolderName("");
      await enqueueOp({ table: "folders", op: "insert", payload: newFolder });
      await save({ folder_id: folderId });
      toast.success(T("فولدر ساخته شد؛ با اتصال اینترنت همگام می‌شود", "Folder created — will sync when online"));
      return;
    }

    const { data, error } = await firebaseStore
      .from("folders")
      .insert({ user_id: user.id, name: newFolderName.trim(), color: newFolderColor })
      .select().single();
    if (error) return toast.error(error.message);
    setFolders((f) => [...f, data as any]);
    setNewFolderName("");
    await save({ folder_id: (data as any).id });
    toast.success(T("فولدر ساخته شد", "Folder created"));
  };

  const createTagAndAssign = async () => {
    if (!user || !canEdit || !newTagName.trim()) return;
    const tagId = generateId();
    const newTag = { id: tagId, user_id: user.id, name: newTagName.trim(), color: newTagColor };

    if (typeof navigator !== "undefined" && !navigator.onLine) {
      setTags((tg) => [...tg, newTag]);
      setTaskTagIds([...taskTagIds, tagId]);
      await enqueueOp({ table: "tags", op: "insert", payload: newTag });
      await enqueueOp({ table: "task_tags", op: "insert", payload: { task_id: t.id, tag_id: tagId, user_id: user.id } });
      setNewTagName("");
      toast.success(T("تگ ساخته شد؛ با اتصال اینترنت همگام می‌شود", "Tag created — will sync when online"));
      return;
    }

    const { data, error } = await firebaseStore
      .from("tags")
      .insert({ user_id: user.id, name: newTagName.trim(), color: newTagColor })
      .select().single();
    if (error) return toast.error(error.message);
    setTags((tg) => [...tg, data as any]);
    setNewTagName("");
    await firebaseStore.from("task_tags").insert({ task_id: t.id, tag_id: (data as any).id, user_id: user.id });
    setTaskTagIds([...taskTagIds, (data as any).id]);
    toast.success(T("تگ ساخته شد", "Tag created"));
  };

  const attachLink = async () => {
    if (!user || !canEdit || !linkUrl.trim()) return;
    const url = linkUrl.trim();
    const { error } = await firebaseStore.from("task_attachments").insert({
      user_id: user.id,
      task_id: t.id,
      url,
      storage_path: "",
      file_name: url.replace(/^https?:\/\//, "").slice(0, 80),
      mime_type: "text/uri-list",
      kind: "file" as any,
      size_bytes: 0,
    } as any);
    if (error) return toast.error(error.message);
    setLinkUrl("");
    setShowAttachments(true);
    toast.success(T("لینک افزوده شد", "Link added"));
    window.dispatchEvent(new CustomEvent(`arshnaz:attach-refresh:${t.id}`));
  };

  const pickFileType = (accept: string) => {
    setShowAttachments(true);
    setTimeout(() => {
      window.dispatchEvent(new CustomEvent(`arshnaz:attach-pick:${t.id}`, { detail: { accept } }));
    }, 50);
  };

  const topControls = (
    <TaskMetaBar
      t={t}
      canEdit={canEdit}
      isOwner={isOwner}
      isEn={isEn}
      folders={folders}
      folderName={folderName}
      goals={availableGoals}
      panel={metaPanel}
      setPanel={setMetaPanel}
      isScheduled={isScheduled}
      scheduleLabel={scheduleLabel}
      taskTagIds={taskTagIds}
      tags={tags}
      toggleTag={toggleTag}
      createTagAndAssign={createTagAndAssign}
      createFolderAndAssign={createFolderAndAssign}
      save={save}
      postpone={postpone}
      T={T}
      showFolderCreate={showFolderCreate}
      setShowFolderCreate={setShowFolderCreate}
      newFolderName={newFolderName}
      setNewFolderName={setNewFolderName}
      newFolderColor={newFolderColor}
      setNewFolderColor={setNewFolderColor}
      showTagCreate={showTagCreate}
      setShowTagCreate={setShowTagCreate}
      newTagName={newTagName}
      setNewTagName={setNewTagName}
      newTagColor={newTagColor}
      setNewTagColor={setNewTagColor}
      TAG_COLORS={TAG_COLORS}
    />
  );


  // ── Expandable inline blocks (only when toggled) ────────────────────
  const expandables = (
    <div className="space-y-3 px-1">
      {showSubtasks && (
        <TaskSection testid="task-subtasks-section" icon={ListTree} title={T("زیرتسک‌ها", "Subtasks")}
          count={subtaskProgress.total > 0 ? `${subtaskProgress.completed}/${subtaskProgress.total}` : null}
          onClose={() => setShowSubtasks(false)} closeLabel={T("بستن زیرتسک‌ها", "Hide subtasks")}>
          <TaskSubtasksInline
            taskId={t.id}
            initialSubs={loadedSubtasks}
            onProgressChange={handleSubtaskProgress}
            onSubtasksChange={(updatedSubs) => {
              setLoadedSubtasks(updatedSubs);
            }}
            readOnly={!canEdit}
            onOpenSubtask={(id) => {
              void savePendingChanges().then(() => {
                if (onOpenParentTask) {
                  onOpenParentTask(id);
                } else {
                  navigate(`/app/tasks/${encodeURIComponent(id)}?from=${encodeURIComponent(t.id)}`);
                }
              }).catch(() => toast.error(T("ابتدا تغییرات تسک فعلی را ذخیره کن", "Save the current task before opening a subtask")));
            }}
          />
        </TaskSection>
      )}

      {showSteps && (
        <TaskSection testid="task-steps-section" icon={CheckSquare} title={T("چک‌لیست و مرحله‌ها", "Checklists & steps")} count={stepListCount}
          onClose={() => setShowSteps(false)} closeLabel={T("بستن چک‌لیست", "Hide checklists")}>
          <TaskStepLists taskId={t.id} onCountChange={setStepListCount} readOnly={!canEdit} />
        </TaskSection>
      )}

      {showOutcomes && (
        <TaskSection testid="task-outcomes-section" icon={GitBranch} title={T("شاخه‌ها و سناریوها", "Branches & outcomes")} count={outcomeCount}
          actions={canEdit ? <TaskSectionAction icon={Plus} onClick={() => setOutcomeOpen(true)}>{T("مدیریت", "Manage")}</TaskSectionAction> : null}
          onClose={() => setShowOutcomes(false)} closeLabel={T("بستن شاخه‌ها", "Hide outcomes")}>
          <TaskOutcomesInline
            taskId={t.id}
            refreshKey={outcomeRefresh}
            onEdit={() => setOutcomeOpen(true)}
            onCountChange={setOutcomeCount}
          />
        </TaskSection>
      )}

      {showAttachments && (
        <TaskSection testid="task-attachments-section" icon={Paperclip} title={T("پیوست‌ها", "Attachments")} count={attachmentCount}
          onClose={() => setShowAttachments(false)} closeLabel={T("بستن پیوست‌ها", "Hide attachments")}>
          <TaskAttachments taskId={t.id} onCountChange={setAttachmentCount} />
        </TaskSection>
      )}

      {(showNotes || taskNotes.length > 0) && (
        <TaskNotesInlineList
          taskNotes={taskNotes}
          canEdit={canEdit}
          isEn={isEn}
          onStartNewNote={() => { setShowNotes(true); setIsAddingNote(true); }}
          onHideNotes={() => setShowNotes(false)}
          onEditNote={setEditingNote}
          onDeleteNote={askDelNote}
          T={T}
        />
      )}

      {/* Contacts and Knowledge sections omitted in Planning edition */}
    </div>
  );

  const bottomRail = (
    <TaskDetailBottomRail
      t={t}
      canEdit={canEdit}
      canComment={canComment}
      isOwner={isOwner}
      allowDelete={allowDelete}
      showAttachments={showAttachments}
      attachmentCount={attachmentCount}
      pickFileType={pickFileType}
      linkUrl={linkUrl}
      setLinkUrl={setLinkUrl}
      attachLink={attachLink}
      parentOpen={parentOpen}
      setParentOpen={setParentOpen}
      parentCandidates={parentCandidates}
      isParentLinkValid={isParentLinkValid}
      showSubtasks={showSubtasks}
      setShowSubtasks={setShowSubtasks}
      showSteps={showSteps}
      setShowSteps={setShowSteps}
      showOutcomes={showOutcomes}
      setShowOutcomes={setShowOutcomes}
      outcomeCount={outcomeCount}
      setAiOpen={setAiOpen}
      setFocusOpen={setFocusOpen}
      setActionMenuOpen={setActionMenuOpen}
      isActiveLeitnerReview={isLeitnerStudyTask(t) && !t.completed}
      onOpenLeitnerReview={getStudyTaskNavigation(t).navUrl ? openLinkedReview : undefined}
      onToggleCompletion={toggleCompletion}
      onCopyTaskLink={() => void copyTaskLink()}
      onDuplicateTask={() => void duplicateTask()}
      onAddToCalendar={() => void addToAndroidCalendar()}
      onOpenFullPage={mode !== "page" ? () => navigate(`/app/tasks/${t.id}`) : undefined}
      deleteTask={deleteTask}
      save={save}
      T={T}
      onAddNote={() => {
        setShowNotes(true);
        setIsAddingNote(true);
      }}
      onAddLocation={() => {
        setLocationText(t.location || "");
        setAddLocationOpen(true);
      }}

    />
  );

  const body = (
    <div className="task-detail-sections flex flex-col min-h-[40vh] space-y-2 pb-20">
      {hero}
      {topControls}
      {quickChips}
      <TaskSourceCards t={t} modules={modules} canEdit={canEdit} navigate={navigate} save={save} T={T} />
      {/* Unified vertical document flow: note description followed directly by subtasks & checklists */}
      <div className="flex-1 min-w-0 flex flex-col space-y-4">
        <div className="min-w-0">{descriptionSection}</div>
        <div className="min-w-0">{expandables}</div>
      </div>
    </div>
  );

  const addToAndroidCalendar = async () => {
    try {
      const added = await addTaskToAndroidCalendar(t);
      if (added) toast.success(T("رویداد در تقویم Android آماده شد", "Event prepared in Android Calendar"));
    } catch { toast.error(T("بازکردن تقویم ممکن نشد", "Could not open Android Calendar")); }
  };

  const saveLabel = saveState === "saving"
    ? T("در حال ذخیره…", "Saving…")
    : saveState === "dirty"
      ? T("ذخیرهٔ خودکار…", "Autosaving…")
      : saveState === "queued"
        ? T("آفلاین؛ برای همگام‌سازی نگه داشته شد", "Saved offline; waiting to sync")
        : saveState === "error"
          ? T("ذخیره ناموفق", "Save failed")
          : T("ذخیره شد", "Saved");

  const duplicateTask = async () => {
    if (!user || !canEdit) return;
    const toastId = toast.loading(T("در حال کپی کامل تسک…", "Duplicating task with all items…"));
    try {
      const result = await duplicateTaskCascade(user.id, t, {
        newTitle: `${t.title} (${T("کپی", "copy")})`,
      });
      if (!result.success) throw result.error || new Error("Failed to duplicate task");
      toast.success(T("تسک با تمام زیرتسک‌ها، یادداشت‌ها و فایل‌ها کپی شد", "Task duplicated with all subtasks, notes, and files"), { id: toastId });
      onChanged();
    } catch {
      toast.error(T("خطا در کپی تسک", "Failed to duplicate task"), { id: toastId });
    }
  };

  const copyTaskLink = async () => {
    try {
      const url = `${window.location.origin}/app/tasks/${t.id}`;
      await navigator.clipboard.writeText(url);
      toast.success(T("لینک تسک کپی شد", "Task link copied"));
    } catch {
      toast.error(T("کپی نشد", "Could not copy"));
    }
  };

  const saveButton = (
    <SaveStatusButton
      state={saveState}
      busy={saveBusy}
      disabled={!canEdit}
      label={saveLabel}
      onSave={() => void handleSaveClick()}
    />
  );

  const renderTopBar = (opts: { onClose?: () => void; extra?: React.ReactNode }) => (
    <TaskDetailTopBar
      T={T}
      isEn={isEn}
      canEdit={canEdit}
      folderLabel={taskFolderLabel}
      folderColor={currentFolder?.color || undefined}
      hasFolder={Boolean(t.folder_id)}
      goalLabel={currentGoal ? taskGoalLabel : null}
      onFolder={() => setMetaPanel(metaPanel === "folder" ? null : "folder")}
      onGoal={() => setMetaPanel(metaPanel === "goal" ? null : "goal")}
      folderActive={metaPanel === "folder"}
      goalActive={metaPanel === "goal"}
      onBack={onBack || hasBackHistory || mode === "page" ? handleBackClick : undefined}
      onClose={opts.onClose}
      save={saveButton}
      extra={opts.extra}
    />
  );

  return (
    <>
      {actionMenuOpen && (
        <TaskActionSheet
          task={t}
          open={actionMenuOpen}
          onOpenChange={setActionMenuOpen}
          canEdit={canEdit}
          isOwner={isOwner}
          canComment={canComment}
          onComplete={toggleCompletion}
          onDelete={deleteTask}
          onMove={() => setFolderOpen(true)}
          onMakeChild={() => setParentOpen(true)}
          onEdit={() => document.querySelector<HTMLTextAreaElement>("[data-task-title]")?.focus()}
          onPin={() => save({ pinned: !t.pinned })}
          onPomodoro={() => setFocusOpen(true)}
          onPatch={(patch) => save(patch)}
          onRefresh={refreshTask}
          hideDuplicates={true}
        />
      )}
      {focusOpen && (
        <PomodoroSheet task={t} open={focusOpen} onOpenChange={setFocusOpen} />
      )}
      {mode === "embedded" || mode === "modal" ? (
        <div className="w-full h-full flex flex-col bg-card border border-border rounded-lg overflow-hidden">
          <div className="px-2 sm:px-3 py-1 border-b border-border shrink-0">
            {renderTopBar({ onClose: requestClose })}
          </div>
          <div className="flex-1 overflow-y-auto min-h-0 p-2 sm:p-3">
            {body}
          </div>
          <div className="shrink-0 border-t border-border">
            {bottomRail}
          </div>
        </div>
      ) : mode === "page" ? (
        <div className="w-full max-w-3xl mx-auto px-3 sm:px-6 min-h-screen flex flex-col justify-between">
          <div
            className="sticky top-0 z-30 -mx-3 sm:-mx-6 px-3 sm:px-6 py-1 mb-2 bg-background border-b border-border"
            style={{ paddingTop: "max(env(safe-area-inset-top), 0.25rem)" }}
          >
            {renderTopBar({})}
          </div>
          <div className="flex-1 min-h-0">
            {body}
          </div>
          <div className="sticky bottom-0 z-30 -mx-3 sm:-mx-6 border-t border-border bg-background pb-[env(safe-area-inset-bottom)]">
            {bottomRail}
          </div>
        </div>
      ) : mode === "drawer" && isMobile ? (
        <Drawer open={true} onOpenChange={(v) => { if (!v && !editingNote) requestClose(); }} snapPoints={TASK_DRAWER_SNAP_POINTS} activeSnapPoint={snap} setActiveSnapPoint={setSnap} shouldScaleBackground={false} dismissible={!editingNote} handleOnly>
          <DrawerContent interactiveHandle data-no-swipe-nav className={`h-[100dvh] max-h-[100dvh] flex flex-col !mt-0 ${snap === 1 ? "!m-0 !rounded-none" : "min-h-[55vh]"}`} aria-describedby="task-drawer-desc">
            <DrawerHeader className="sr-only">
              <DrawerTitle>{t.title || T("تسک", "Task")}</DrawerTitle>
            </DrawerHeader>
            <div className="px-2 pt-1 border-b border-border shrink-0">
              {renderTopBar({
                onClose: requestClose,
                extra: (
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8 text-muted-foreground"
                    onClick={() => { setSnap(snap === 1 ? 0.5 : 1); }}
                    title={snap === 1 ? T("کوچک‌نمایی", "Collapse") : T("تمام صفحه", "Full screen")}
                    aria-label={snap === 1 ? T("کوچک‌نمایی", "Collapse") : T("تمام صفحه", "Full screen")}
                  >
                    {snap === 1 ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
                  </Button>
                ),
              })}
            </div>
            <div className={`flex-1 overflow-y-auto min-h-0 px-3 pt-2 pb-4 ${snap === 1 ? "" : "max-h-[50vh]"}`}>
              {body}
            </div>
            <div className="shrink-0 pb-[env(safe-area-inset-bottom)] border-t border-border bg-background">
              {bottomRail}
            </div>
            <p id="task-drawer-desc" className="sr-only">{T("جزئیات و ویرایش تسک", "Task details and editing")}</p>
          </DrawerContent>
        </Drawer>
      ) : (
        <Dialog open={true} onOpenChange={(v) => { if (!v && !editingNote) requestClose(); }}>
          <DialogContent
            className="w-[95vw] sm:max-w-2xl md:max-w-3xl max-h-[90vh] h-[85vh] p-0 gap-0 flex flex-col [&>button:last-child]:hidden"
            onFocusOutside={(event) => { if (editingNote) event.preventDefault(); }}
            onInteractOutside={(event) => { if (editingNote) event.preventDefault(); }}
            onPointerDownOutside={(event) => { if (editingNote) event.preventDefault(); }}
          >
            <DialogHeader className="sr-only">
              <DialogTitle>{t.title || T("تسک", "Task")}</DialogTitle>
              <DialogDescription>{T("جزئیات و ویرایش تسک", "Task details and editing")}</DialogDescription>
            </DialogHeader>
            <div className="px-3 py-1 border-b border-border shrink-0">
              {renderTopBar({ onClose: requestClose })}
            </div>
            <div className="flex-1 overflow-y-auto min-h-0 p-3">
              {body}
            </div>
            <div className="shrink-0 border-t border-border">
              {bottomRail}
            </div>
          </DialogContent>
        </Dialog>
      )}

      {aiOpen && (
        <TaskAIPanel
          task={t as any}
          open={aiOpen}
          onOpenChange={setAiOpen}
          onMetaApplied={refreshTask}
          onApplyPatch={patch => save(patch, false, "replace")}
        />
      )}

      {outcomeOpen && (
        <TaskOutcomeSheet
          task={t}
          open={outcomeOpen}
          onOpenChange={(open) => { setOutcomeOpen(open); if (!open) { refreshTask(); refreshOutcomeCount(); } }}
          folders={folders.map((f) => ({ id: f.id, name: f.name }))}
        />
      )}

      <TaskCloseDialog
        taskId={t.id}
        open={closePromptOpen}
        onOpenChange={setClosePromptOpen}
        onClose={onClose}
        savePendingChanges={savePendingChanges}
        T={T}
      />

      <TaskLocationDialog
        open={addLocationOpen}
        onOpenChange={setAddLocationOpen}
        isEn={isEn}
        canEdit={canEdit}
        locationText={locationText}
        setLocationText={setLocationText}
        locatingTask={locatingTask}
        setLocatingTask={setLocatingTask}
        save={save}
        T={T}
      />

      {/* Task Note Editor Dialog / Sheet */}
      {user?.id && (
        <>
          {(editingNote || isAddingNote) && (
            <TaskNoteEditorDialog
              open={!!editingNote || isAddingNote}
              onOpenChange={(open) => {
                if (!open) { setEditingNote(null); setIsAddingNote(false); }
              }}
              userId={user.id}
              taskId={t.id}
              note={editingNote}
              canEdit={canEdit}
              onSaved={(updated) => {
                if (editingNote) addNoteEditUndo(editingNote, updated);
                setTaskNotes((prev) => [updated, ...prev.filter((n) => n.id !== updated.id)]);
                setEditingNote(null);
                setIsAddingNote(false);
              }}
              onDeleted={(noteId) => {
                setTaskNotes((prev) => prev.filter((n) => n.id !== noteId));
                setEditingNote(null);
              }}
              onCreated={(created) => {
                addNoteCreateUndo(created);
                setTaskNotes((prev) => [created, ...prev.filter((n) => n.id !== created.id)]);
                setIsAddingNote(false);
                setShowNotes(true);
              }}
            />
          )}
        </>
      )}
    </>
  );
});
