import { useMemo } from "react";
import { Check, Clock, Timer } from "lucide-react";
import { cn } from "@/lib/utils";
import { toPersianDigits } from "@/lib/jalali";
import { isDone } from "@/lib/planCascade";
import { readSchedule } from "@/lib/taskSchedule";
import type { Task } from "@/lib/taskTypes";
import type { TimeSettings } from "@/lib/timeHorizon";

export function DayTimelineStrip({
  tasks,
  settings,
  fa,
  onOpen,
  onStartFocus,
}: {
  tasks: Task[];
  settings: TimeSettings;
  fa: boolean;
  onOpen: (task: Task) => void;
  onStartFocus?: (task: Task) => void;
}) {
  const timedItems = useMemo(() => {
    const out: Array<{ task: Task; timeStr: string; sortMinutes: number }> = [];
    for (const task of tasks) {
      if (task.status === "wont_do") continue;
      const sched = readSchedule(task, settings);
      let dateObj: Date | null = null;
      if (sched.kind === "datetime" && sched.at) {
        const parsed = new Date(sched.at);
        if (Number.isFinite(parsed.getTime())) dateObj = parsed;
      } else if (task.due_at && task.is_exact !== false) {
        const parsed = new Date(task.due_at);
        if (Number.isFinite(parsed.getTime())) dateObj = parsed;
      }
      if (!dateObj) continue;
      const hours = dateObj.getHours();
      const minutes = dateObj.getMinutes();
      const rawTime = `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
      out.push({
        task,
        timeStr: fa ? toPersianDigits(rawTime) : rawTime,
        sortMinutes: hours * 60 + minutes,
      });
    }
    return out.sort((a, b) => a.sortMinutes - b.sortMinutes);
  }, [tasks, settings, fa]);

  if (timedItems.length === 0) return null;

  return (
    <section
      className="rounded-xl border border-border/60 bg-card/60 p-2.5 space-y-2"
      data-testid="planning-day-timeline"
      aria-label={fa ? "تایم‌لاین ساعتی امروز" : "Hourly day timeline"}
    >
      <div className="flex items-center justify-between gap-2 px-0.5">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground/90">
          <Clock className="h-3.5 w-3.5 text-primary" />
          <span>{fa ? "تایم‌بلاک‌های ساعتی این روز" : "Time-blocked schedule"}</span>
        </div>
        <span className="text-[11px] tabular-nums text-muted-foreground">
          {fa ? `${toPersianDigits(timedItems.length)} مورد زمان‌دار` : `${timedItems.length} timed`}
        </span>
      </div>
      <div className="flex gap-2 overflow-x-auto pb-1 pt-0.5">
        {timedItems.map(({ task, timeStr }) => {
          const done = isDone(task);
          return (
            <div
              key={task.id}
              className={cn(
                "group flex min-w-[11rem] max-w-[15rem] shrink-0 items-center gap-2 rounded-lg border px-2.5 py-1.5 text-xs transition-colors",
                done
                  ? "border-border/40 bg-muted/30 text-muted-foreground"
                  : "border-primary/20 bg-primary/5 hover:border-primary/40"
              )}
              data-testid={`planning-timeline-item-${task.id}`}
            >
              <span
                dir="ltr"
                className={cn(
                  "shrink-0 rounded-md px-1.5 py-0.5 font-mono text-[11px] font-semibold tabular-nums",
                  done ? "bg-muted text-muted-foreground" : "bg-primary/15 text-primary"
                )}
              >
                {timeStr}
              </span>
              <button
                type="button"
                onClick={() => onOpen(task)}
                className={cn(
                  "min-w-0 flex-1 truncate text-start font-medium",
                  done && "line-through"
                )}
              >
                {task.title || (fa ? "بدون عنوان" : "Untitled")}
              </button>
              {done ? (
                <Check className="h-3.5 w-3.5 shrink-0 text-emerald-500" />
              ) : (
                onStartFocus && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onStartFocus(task);
                    }}
                    className="grid h-6 w-6 shrink-0 place-items-center rounded-md text-muted-foreground hover:bg-primary/15 hover:text-primary"
                    title={fa ? "شروع تمرکز" : "Start focus"}
                    aria-label={fa ? "شروع تمرکز" : "Start focus"}
                    data-testid={`planning-timeline-focus-${task.id}`}
                  >
                    <Timer className="h-3.5 w-3.5" />
                  </button>
                )
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
