import { BookOpen, Brain, ExternalLink, FolderTree, Layers, Network } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { hasModule, isPathAllowed } from "@/lib/appModules";
import { mindSourceRoute } from "@/lib/taskFromMind";
import { getStudyTaskNavigation } from "@/lib/taskStudyService";
import type { Task } from "@/lib/taskTypes";

export function TaskSourceCards({
  t,
  modules,
  canEdit,
  navigate,
  save,
  T,
}: {
  t: Task;
  modules: ReturnType<typeof import("@/lib/appModules").useModules>;
  canEdit: boolean;
  navigate: (path: string) => void;
  save: (patch: Partial<Task>) => Promise<unknown>;
  T: (fa: string, en: string) => string;
}) {
  const studyInfo = getStudyTaskNavigation(t);
  const isLeitnerTask = t.source_type === "leitner" || t.source_type === "leitner_folder";

  return (
    <>
      {studyInfo.isStudyTask && isPathAllowed(studyInfo.navUrl, modules) && (
        <Card
          className={`p-3.5 mx-1 rounded-2xl space-y-2.5 ${
            isLeitnerTask
              ? "border-amber-500/30 bg-amber-500/5"
              : studyInfo.isMindMap
              ? "border-indigo-500/30 bg-indigo-500/5"
              : "border-emerald-500/30 bg-emerald-500/5"
          }`}
        >
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div
              className={`flex items-center gap-2 text-xs font-semibold ${
                isLeitnerTask
                  ? "text-amber-600 dark:text-amber-400"
                  : studyInfo.isMindMap
                  ? "text-indigo-600 dark:text-indigo-400"
                  : "text-emerald-600 dark:text-emerald-400"
              }`}
            >
              {isLeitnerTask ? (
                <Layers className="w-4 h-4 shrink-0" />
              ) : studyInfo.isMindMap ? (
                <Network className="w-4 h-4 shrink-0" />
              ) : t.source_type === "knowledge_folder" ? (
                <FolderTree className="w-4 h-4 shrink-0" />
              ) : (
                <BookOpen className="w-4 h-4 shrink-0" />
              )}
              <span>
                {isLeitnerTask
                  ? T("تسک مرور کارت‌های لایتنر", "Leitner Flashcard Review Task")
                  : studyInfo.isMindMap
                  ? T("تسک مرور نقشه ذهنی (مرکزیت این شاخه)", "Mind Map Review Task (Centered on this Branch)")
                  : t.source_type === "knowledge_folder"
                  ? T("تسک مطالعه شاخه در پایگاه دانش", "Knowledge Branch Study Task")
                  : T("تسک مطالعه درس در پایگاه دانش", "Knowledge Lesson Study Task")}
              </span>
            </div>

            <Button
              size="sm"
              className={`h-7 px-3 text-xs rounded-xl font-semibold gap-1.5 shadow-xs cursor-pointer ${
                isLeitnerTask
                  ? "bg-amber-600 hover:bg-amber-700 text-white"
                  : studyInfo.isMindMap
                  ? "bg-indigo-600 hover:bg-indigo-700 text-white"
                  : "bg-emerald-600 hover:bg-emerald-700 text-white"
              }`}
              onClick={() => navigate(studyInfo.navUrl)}
            >
              <span>{T(studyInfo.actionTextFa, studyInfo.actionTextEn)}</span>
              <ExternalLink className="w-3.5 h-3.5 rtl:rotate-180" />
            </Button>
          </div>

          <p className="text-[11px] text-muted-foreground leading-relaxed">
            {studyInfo.isMindMap
              ? T(
                  "با کلیک روی این دکمه، نقشه مفهومی با مرکزیت دقیق این شاخه به عنوان ریشه باز می‌شود.",
                  "Clicking this button opens the visual mind map centered directly on this branch as the root."
                )
              : T(
                  "با کلیک روی این دکمه، مستقیماً وارد پایگاه دانش شده و این شاخه یا درس برای شما باز می‌شود.",
                  "Clicking this button opens the knowledge base directly to this branch or lesson."
                )}
          </p>
        </Card>
      )}

      {t.source_type && hasModule("mind", modules) && (
        <Card className="p-3.5 mx-1 rounded-2xl border-purple-500/30 bg-purple-500/5 space-y-2.5">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2 text-xs font-semibold text-purple-600 dark:text-purple-400">
              <Brain className="w-4 h-4 shrink-0" />
              <span>
                {t.source_type === "cbt_thought" && T("اقدام برخاسته از ثبت فکر (CBT)", "Action from CBT Thought")}
                {t.source_type === "abc_model" && T("اقدام برخاسته از مدل رفتار (ABC)", "Action from ABC Model")}
                {t.source_type === "worry_tree" && T("اقدام حل مسئله (درخت نگرانی)", "Problem-solving Action (Worry Tree)")}
                {t.source_type === "values_goal" && T("اقدام مبتنی بر ارزش‌ها (ACT)", "Values-based Action (ACT)")}
              </span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              data-testid="task-origin-mind-chip"
              className="h-6 px-2 text-[11px] text-purple-600 dark:text-purple-400 hover:bg-purple-500/10"
              onClick={() => {
                const route = mindSourceRoute(t);
                if (route) navigate(route);
                else if (t.source_type === "values_goal") navigate("/app/values");
                else navigate("/app/mind");
              }}
            >
              <span>{T("مشاهده در ذهن", "View in Mind")}</span>
              <ExternalLink className="w-3 h-3 ms-1" />
            </Button>
          </div>

          <div className="pt-2 border-t border-purple-500/20 text-xs">
            <div className="text-muted-foreground mb-1.5 font-medium">
              {T("این اقدام چقدر به آرامش یا شفافیت ذهنت کمک کرد؟", "How much did this action help your clarity or calm?")}
            </div>
            <div className="flex items-center gap-1.5 flex-wrap">
              {[
                { key: "helpful", label: T("خیلی مفید بود", "Very helpful"), color: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30" },
                { key: "somewhat", label: T("تا حدی", "Somewhat"), color: "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30" },
                { key: "not_helpful", label: T("کمکی نکرد", "Not helpful"), color: "bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/30" },
              ].map((opt) => {
                const isSelected = t.outcome_review?.helpful === opt.key;
                return (
                  <button
                    key={opt.key}
                    type="button"
                    disabled={!canEdit}
                    onClick={() => {
                      const nextReview = {
                        helpful: opt.key as any,
                        created_at: t.outcome_review?.created_at || new Date().toISOString(),
                        note: t.outcome_review?.note || "",
                      };
                      void save({ outcome_review: nextReview });
                    }}
                    className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition ${
                      isSelected
                        ? `${opt.color} ring-1 ring-current shadow-xs font-semibold`
                        : "bg-background/60 hover:bg-background text-muted-foreground border-border/60"
                    }`}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </div>
        </Card>
      )}
    </>
  );
}
