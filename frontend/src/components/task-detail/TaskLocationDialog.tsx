import { Calendar as CalendarIcon, Loader2, Network } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { getCurrentTaskLocation, taskLocationErrorMessage } from "@/lib/taskLocation";
import type { Task } from "@/lib/taskTypes";

export function TaskLocationDialog({
  open,
  onOpenChange,
  isEn,
  canEdit,
  locationText,
  setLocationText,
  locatingTask,
  setLocatingTask,
  save,
  T,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isEn: boolean;
  canEdit: boolean;
  locationText: string;
  setLocationText: (val: string) => void;
  locatingTask: boolean;
  setLocatingTask: (val: boolean) => void;
  save: (patch: Partial<Task>) => Promise<unknown>;
  T: (fa: string, en: string) => string;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent dir={isEn ? "ltr" : "rtl"} className="max-w-md rounded-2xl p-4 sm:p-5">
        <DialogHeader>
          <DialogTitle className="text-start text-base font-bold flex items-center gap-2">
            <CalendarIcon className="w-4 h-4 text-rose-500" />
            {T("موقعیت مکانی تسک", "Task Location")}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <Input
            value={locationText}
            onChange={(e) => setLocationText(e.target.value)}
            placeholder={T("مثلاً: دفتر کار، منزل، شرکت مشتری...", "e.g. Office, Home...")}
            autoFocus
            dir="auto"
            className="text-xs h-9"
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                void save({ location: locationText.trim() || null });
                toast.success(T("موقعیت مکانی ذخیره شد", "Location saved"));
                onOpenChange(false);
              }
            }}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="w-full gap-2"
            disabled={locatingTask}
            onClick={async () => {
              setLocatingTask(true);
              try {
                const current = await getCurrentTaskLocation();
                setLocationText(current.text);
                toast.success(T("موقعیت دستگاه پیدا شد؛ اکنون آن را ذخیره کن.", "Device location found. Save it when ready."));
              } catch (error) {
                toast.error(taskLocationErrorMessage(error, isEn));
              } finally {
                setLocatingTask(false);
              }
            }}
            data-testid="task-detail-current-location"
          >
            {locatingTask ? <Loader2 className="h-4 w-4 animate-spin" /> : <Network className="h-4 w-4" />}
            {T("استفاده از موقعیت فعلی دستگاه", "Use current device location")}
          </Button>
          <div className="flex items-center justify-end gap-2 pt-2 border-t border-border/40">
            <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
              {T("انصراف", "Cancel")}
            </Button>
            <Button
              size="sm"
              onClick={async () => {
                if (!canEdit) return;
                await save({ location: locationText.trim() || null });
                toast.success(T("موقعیت مکانی ذخیره شد", "Location saved"));
                onOpenChange(false);
              }}
            >
              {T("ذخیره موقعیت", "Save Location")}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
