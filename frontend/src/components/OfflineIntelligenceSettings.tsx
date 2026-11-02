import { useCallback, useState } from "react";
import { Bot, Cpu, Sparkles } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import {
  loadOfflineModelSettings,
  saveOfflineModelSettings,
} from "@/lib/offlineModels";

export function OfflineIntelligenceSettings({ isEn }: { isEn: boolean }) {
  const [settings, setSettings] = useState(() => loadOfflineModelSettings());

  const persist = useCallback((next: typeof settings) => {
    setSettings(next);
    saveOfflineModelSettings(next);
  }, []);

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-primary/20 bg-primary/[0.04] p-4 text-xs leading-6 text-muted-foreground space-y-2">
        <div className="flex items-center gap-2 text-foreground font-bold">
          <Cpu className="w-4 h-4 text-primary shrink-0" />
          {isEn ? "Private offline planning assistant (0 MB)" : "دستیار برنامه‌ریزی آفلاین و فوری (۰ مگابایت)"}
        </div>
        <p>
          {isEn
            ? "Uses built-in deterministic NLP logic to extract dates, times, priorities, and subtasks offline without downloading heavy language or speech models."
            : "بدون نیاز به دانلود مدل‌های سنگین، متن طبیعی را به تسک تبدیل می‌کند، تاریخ و اولویت را تشخیص می‌دهد و زیرتسک‌های اجرایی پیشنهاد می‌کند."}
        </p>
      </div>

      <div className="flex items-center justify-between gap-4 rounded-xl border border-border/60 p-3.5">
        <div className="space-y-1">
          <div className="flex items-center gap-2 font-medium text-sm">
            <Bot className="w-4 h-4 text-primary" />
            {isEn ? "Enable offline task & note assistant" : "فعال‌سازی دستیار آفلاین تسک و یادداشت"}
          </div>
          <p className="text-xs text-muted-foreground leading-6">
            {isEn
              ? "Automatically parses tasks, breaks down steps, and formats notes when you are offline or have no API key set."
              : "هنگام قطع اینترنت یا نبود کلید API، تسک‌ها را تجزیه و به مراحل کوچک‌تر تقسیم می‌کند."}
          </p>
        </div>
        <Switch
          checked={settings.assistantEnabled}
          onCheckedChange={(assistantEnabled) => persist({ ...settings, assistantEnabled })}
        />
      </div>

      {settings.assistantEnabled && (
        <div className="rounded-lg border border-primary/20 bg-muted/40 p-3.5 space-y-1.5 text-xs leading-6 text-muted-foreground">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-foreground font-medium">
              <Sparkles className="w-3.5 h-3.5 text-amber-500" />
              {isEn ? "Built-in smart logic" : "منطق هوشمند داخلی"}
            </div>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary font-mono font-bold">
              {isEn ? "Instant · 0 MB" : "فوری · ۰ مگابایت"}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
