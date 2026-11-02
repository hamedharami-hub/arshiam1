import type { ReactNode } from "react";
import { addDays } from "date-fns";
import { CheckCircle2, CheckSquare, Loader2, Plus, RefreshCw } from "lucide-react";
import { DndContext, type DragEndEvent, DragOverlay, type DragStartEvent, closestCenter } from "@/components/TaskDnDHelpers";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { EmptyState } from "@/components/EmptyState";
import PullToRefresh from "@/components/gestures/PullToRefresh";
import { QuickAddTask } from "@/components/QuickAddTask";
import { SmartListProfileBar } from "@/components/SmartListProfileBar";
import { TaskFilterSheet, type TaskFilters } from "@/components/TaskFilterSheet";
import { VirtualTaskList } from "@/components/VirtualTaskList";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { setShowCompletedTasks } from "@/lib/completedTaskVisibility";
import { getLocalDateString } from "@/lib/taskDate";
import { saveTaskListSort } from "@/lib/taskListSort";
import type { Task } from "@/lib/taskTypes";
import { TaskDueDateGroups, type TaskGroup } from "./TaskDueDateGroups";
import type { TasksViewScope } from "./taskScopeFilter";

export function TasksListViewSection({
  scope,
  scopeId,
  scopeKey,
  folderName,
  filters,
  setFilters,
  filterSheetOpen,
  setFilterSheetOpen,
  showProfileBar,
  folderTopLevel,
  groupedTasks,
  sensors,
  activeDragId,
  setActiveDragId,
  onDragEnd,
  hasLoadError,
  loadErrorMessage,
  isReady,
  effectiveAllTasks,
  taskMap,
  renderTaskItem,
  load,
  isEn,
  T,
}: {
  scope: TasksViewScope;
  scopeId?: string;
  scopeKey: string;
  folderName: string | null;
  filters: TaskFilters;
  setFilters: (next: TaskFilters) => void;
  filterSheetOpen: boolean;
  setFilterSheetOpen: (open: boolean) => void;
  showProfileBar: boolean;
  folderTopLevel: Task[];
  groupedTasks: TaskGroup[] | null;
  sensors: ReturnType<typeof import("@/components/TaskDnDHelpers").useSensors>;
  activeDragId: string | null;
  setActiveDragId: (id: string | null) => void;
  onDragEnd: (e: DragEndEvent) => void;
  hasLoadError: boolean;
  loadErrorMessage: string | null;
  isReady: boolean;
  effectiveAllTasks: Task[];
  taskMap: Map<string, Task>;
  renderTaskItem: (t: Task, depth?: number) => ReactNode;
  load: () => Promise<void>;
  isEn: boolean;
  T: (fa: string, en: string) => string;
}) {
  const isEmpty = groupedTasks ? groupedTasks.length === 0 : folderTopLevel.length === 0;
  const sortableItems = groupedTasks
    ? groupedTasks.flatMap((g) => g.tasks.map((t) => t.id))
    : folderTopLevel.map((t) => t.id);

  return (
    <PullToRefresh onRefresh={load}>
      <div className="sticky top-0 z-20 py-1.5 -mx-1 px-1 mb-2" style={{ background: "var(--page-surface, hsl(var(--background)))" }}>
        <QuickAddTask
          defaults={{
            folder_id: scope === "folder" ? scopeId || null : null,
            work_date: scope === "today"
              ? getLocalDateString()
              : scope === "tomorrow"
                ? getLocalDateString(addDays(new Date(), 1))
                : scope === "next7"
                  ? getLocalDateString(addDays(new Date(), 1))
                  : null,
            tag_id: scope === "tag" ? scopeId || null : null,
          }}
          placeholder={
            scope === "folder" && folderName
              ? T(`افزودن تسک به «${folderName}»`, `Add task to "${folderName}"`)
              : scope === "today"
                ? T("افزودن تسک به «امروز»", 'Add task to "Today"')
                : scope === "tomorrow"
                  ? T("افزودن تسک به «فردا»", 'Add task to "Tomorrow"')
                  : scope === "inbox"
                    ? T("افزودن تسک به «اینباکس»", 'Add task to "Inbox"')
                    : undefined
          }
          collapsedExtra={showProfileBar ? (
            <SmartListProfileBar
              filters={filters}
              onChangeFilters={(next) => {
                if (next.show_completed !== filters.show_completed) setShowCompletedTasks(next.show_completed);
                if (JSON.stringify([next.sort_primary, next.sort_secondary]) !== JSON.stringify([filters.sort_primary, filters.sort_secondary])) saveTaskListSort(scopeKey, next);
                setFilters(next);
              }}
              isEn={isEn}
            />
          ) : undefined}
          chipsTrailing={
            <div className="flex items-center gap-1">
              <Button
                variant={filters.show_completed ? "secondary" : "ghost"}
                size="icon"
                onClick={() => setShowCompletedTasks(!filters.show_completed)}
                className="h-10 w-10 rounded-md"
                aria-pressed={filters.show_completed}
                title={filters.show_completed ? T("مخفی‌سازی تسک‌های انجام‌شده", "Hide completed tasks") : T("نمایش تسک‌های انجام‌شده", "Show completed tasks")}
                data-testid="tasks-toggle-completed"
              >
                <CheckCircle2 className={`w-4 h-4 ${filters.show_completed ? "text-success" : "text-muted-foreground"}`} />
              </Button>
              <TaskFilterSheet
                filters={filters}
                open={filterSheetOpen}
                onOpenChange={setFilterSheetOpen}
                onChange={(next) => {
                  if (next.show_completed !== filters.show_completed) setShowCompletedTasks(next.show_completed);
                  if (JSON.stringify([next.sort_primary, next.sort_secondary]) !== JSON.stringify([filters.sort_primary, filters.sort_secondary])) saveTaskListSort(scopeKey, next);
                  setFilters(next);
                }}
              />
            </div>
          }
          onCreated={() => load()}
        />
      </div>

      {folderTopLevel.length > 0 && (
        <div className="text-xs font-medium text-muted-foreground mb-2 px-1">
          {`${folderTopLevel.length} ${T("تسک", "tasks")}`}
        </div>
      )}

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={(e: DragStartEvent) => setActiveDragId(String(e.active.id))}
        onDragEnd={onDragEnd}
        onDragCancel={() => setActiveDragId(null)}
      >
        <div className="space-y-1 mt-1">
          {isEmpty && hasLoadError ? (
            <div role="status" className="my-3 flex flex-col items-center gap-3 rounded-xl border border-destructive/20 bg-destructive/5 px-4 py-8 text-center">
              <p className="max-w-md text-sm text-muted-foreground">{loadErrorMessage}</p>
              <Button type="button" variant="outline" size="sm" onClick={() => void load()}>
                <RefreshCw className="me-2 h-4 w-4" />{T("دوباره تلاش کن", "Try again")}
              </Button>
            </div>
          ) : isEmpty && !isReady ? (
            <div aria-busy="true" className="my-3 flex min-h-28 items-center justify-center gap-2 rounded-xl border border-border/60 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />{T("در حال بارگذاری کارها…", "Loading tasks…")}
            </div>
          ) : isEmpty && (
            <EmptyState
              icon={CheckSquare}
              title={
                scope === "today"
                  ? T("همه کارهای امروز انجام شده یا هنوز تسکی ثبت نشده!", "All tasks for today completed or none yet!")
                  : T("هیچ تسکی در این لیست نیست", "No tasks in this list")
              }
              description={
                scope === "today"
                  ? T("می‌تونی یک تسک جدید اضافه کنی و روزت رو با انگیزه برنامه‌ریزی کنی ✨", "You can add a new task and plan your day with intention ✨")
                  : T("برای شروع، یک تسک جدید ثبت کن تا کارهات رو منظم دنبال کنی.", "Add a task to start tracking your progress.")
              }
              action={{
                label: T("افزودن تسک جدید", "Add new task"),
                icon: Plus,
                onClick: () => {
                  window.dispatchEvent(new Event("lov:open-quick-capture"));
                },
              }}
              className="my-3"
            />
          )}
          <SortableContext items={sortableItems} strategy={verticalListSortingStrategy}>
            {groupedTasks ? (
              <TaskDueDateGroups groupedTasks={groupedTasks} renderTaskItem={renderTaskItem} />
            ) : (
              <VirtualTaskList
                itemIds={folderTopLevel.map((t) => t.id)}
                renderItem={(id) => {
                  const t = taskMap.get(id);
                  if (!t) return null;
                  return renderTaskItem(t);
                }}
              />
            )}
          </SortableContext>
        </div>
        <DragOverlay>
          {activeDragId ? (
            <Card className="p-3 shadow-lg opacity-90">
              <p className="text-sm font-medium">
                {effectiveAllTasks.find((x) => x.id === activeDragId)?.title || "..."}
              </p>
            </Card>
          ) : null}
        </DragOverlay>
      </DndContext>
    </PullToRefresh>
  );
}
