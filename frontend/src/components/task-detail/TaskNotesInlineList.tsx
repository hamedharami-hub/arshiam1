import { Clock, Edit, FileText, Plus, Trash2 } from "lucide-react";
import { BidiText } from "@/components/BidiText";
import { NoteMarkdown } from "@/components/NoteMarkdown";
import { TaskSection, TaskSectionAction } from "@/components/task-detail/TaskSection";
import { Button } from "@/components/ui/button";
import { formatDueLabel } from "@/lib/localeFormat";
import type { TaskNote } from "@/lib/taskTypes";

export function TaskNotesInlineList({
  taskNotes,
  canEdit,
  isEn,
  onStartNewNote,
  onHideNotes,
  onEditNote,
  onDeleteNote,
  T,
}: {
  taskNotes: TaskNote[];
  canEdit: boolean;
  isEn: boolean;
  onStartNewNote: () => void;
  onHideNotes?: () => void;
  onEditNote: (note: TaskNote) => void;
  onDeleteNote: (note: TaskNote) => void;
  T: (fa: string, en: string) => string;
}) {
  return (
    <TaskSection
      testid="task-notes-section"
      icon={FileText}
      title={T("نوت‌ها", "Notes")}
      count={taskNotes.length}
      actions={
        <TaskSectionAction icon={Plus} disabled={!canEdit} onClick={onStartNewNote} data-testid="task-notes-new">
          {T("نوت تازه", "New note")}
        </TaskSectionAction>
      }
      onClose={taskNotes.length === 0 ? onHideNotes : undefined}
      closeLabel={T("بستن نوت‌ها", "Hide notes")}
    >
      <div className="-mx-1 space-y-0.5">
        {taskNotes.map((n) => (
          <div
            key={n.id}
            role="button"
            tabIndex={0}
            className="group cursor-pointer rounded-md px-2 py-2 transition-colors hover:bg-muted/60 focus-visible:bg-muted/60 focus-visible:outline-none"
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              if ((event.target as HTMLElement).closest("a,button")) return;
              onEditNote(n);
            }}
            onKeyDown={(e) => { if (e.key === "Enter") onEditNote(n); }}
            data-testid={`task-note-${n.id}`}
          >
            <div className="flex items-start justify-between gap-2">
              <h4 className="flex-1 truncate text-start text-sm font-medium text-foreground" dir="auto">
                <BidiText text={n.title || T("بدون عنوان", "Untitled")} />
              </h4>
              <div className="flex items-center gap-0.5 shrink-0" onClick={(e) => e.stopPropagation()}>
                {canEdit && (
                  <>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-6 w-6 text-muted-foreground hover:text-foreground rounded-lg"
                      onClick={() => onEditNote(n)}
                      title={T("ویرایش", "Edit")}
                    >
                      <Edit className="w-3 h-3" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-6 w-6 text-destructive/80 hover:text-destructive hover:bg-destructive/10 rounded-lg"
                      onClick={() => onDeleteNote(n)}
                      title={T("حذف", "Delete")}
                    >
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </>
                )}
              </div>
            </div>
            {typeof n.content === "string" && n.content && (
              <div className="mt-1 text-[11px] sm:text-xs text-muted-foreground line-clamp-2 leading-relaxed text-start" dir="auto">
                <NoteMarkdown>{n.content}</NoteMarkdown>
              </div>
            )}
            {n.updated_at && (
              <div className="mt-1.5 flex items-center gap-1 text-[10px] text-muted-foreground/70">
                <Clock className="w-2.5 h-2.5" />
                <span>{formatDueLabel(n.updated_at, n.updated_at, isEn ? "en" : "fa")}</span>
              </div>
            )}
          </div>
        ))}
      </div>
    </TaskSection>
  );
}
