import { lazy, Suspense, useEffect, useRef } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate, useNavigate, useLocation } from "react-router-dom";
import { App as CapApp } from "@capacitor/app";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/hooks/useAuth";
import ProtectedRoute from "@/components/ProtectedRoute";
import ErrorBoundary from "@/components/ErrorBoundary";
import { installUndoShortcuts } from "@/lib/undoStack";
import { toast } from "sonner";
import { ThemeProvider } from "next-themes";
import { getStoredTheme, getBaseTheme } from "@/lib/theme";
import { nativeRoute } from "@/lib/nativeRoutes";
import { LANGUAGE_STORAGE_KEY } from "@/i18n";

export const PWA_UPDATE_TOAST_ID = "pwa-update-available";

export function usePwaUpdateToast() {
  useEffect(() => {
    const onUpdate = () => {
      let lang = document.documentElement.lang || "fa";
      try { lang = localStorage.getItem(LANGUAGE_STORAGE_KEY) || lang; } catch { /* ignore */ }
      const isEn = lang.startsWith("en");
      toast(isEn ? "A new version is ready" : "نسخه‌ی جدید برنامه آماده است", {
        id: PWA_UPDATE_TOAST_ID,
        description: isEn
          ? "Refresh to get the latest features."
          : "برای دریافت امکانات جدید، برنامه را به‌روزرسانی کن.",
        duration: Infinity,
        closeButton: true,
        action: {
          label: isEn ? "Update" : "به‌روزرسانی",
          onClick: () => {
            const apply = (window as any).__applyPwaUpdate;
            if (typeof apply === "function") apply();
            else window.location.reload();
          },
        },
      });
    };
    window.addEventListener("pwa-update-available", onUpdate);
    return () => window.removeEventListener("pwa-update-available", onUpdate);
  }, []);
}

// Entry-critical routes eager so first paint isn't gated on a chunk
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import AuthCallback from "./pages/AuthCallback";

// Lazy-load core planning & productivity views
const AppLayout = lazy(() => import("@/layouts/AppLayout"));
const NotFound = lazy(() => import("./pages/NotFound.tsx"));
const TasksView = lazy(() => import("./pages/TasksView"));
const TodayDashboardView = lazy(() => import("./pages/TodayDashboardView"));
const PlanningView = lazy(() => import("./pages/PlanningView"));
const CalendarView = lazy(() => import("./pages/CalendarView"));
const PomodoroView = lazy(() => import("./pages/PomodoroView"));
const NotesView = lazy(() => import("./pages/NotesView"));
const ValuesGoalsView = lazy(() => import("./pages/ValuesGoalsView"));
const StatsView = lazy(() => import("./pages/StatsView"));
const SettingsView = lazy(() => import("./pages/SettingsView"));
const ChatGPTConnectView = lazy(() => import("./pages/ChatGPTConnectView"));
const NewTaskView = lazy(() => import("./pages/NewTaskView"));
const NewNoteView = lazy(() => import("./pages/NewNoteView"));
const TaskDetailView = lazy(() => import("./pages/TaskDetailView"));
const AdminView = lazy(() => import("./pages/AdminView"));
const SharedWithMeView = lazy(() => import("./pages/SharedWithMeView"));
const ShareTargetView = lazy(() => import("./pages/ShareTargetView"));
const WidgetsView = lazy(() => import("./pages/WidgetsView"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      gcTime: 5 * 60_000,
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

const RouteFallback = () => {
  const isEn =
    typeof document !== "undefined" && Boolean(document.documentElement.lang?.startsWith("en"));
  return (
    <div
      className="flex min-h-screen items-center justify-center bg-background"
      role="status"
      aria-live="polite"
    >
      <span className="h-8 w-8 animate-spin rounded-full border-[3px] border-muted border-t-primary" />
      <span className="sr-only">{isEn ? "Loading…" : "در حال بارگذاری…"}</span>
    </div>
  );
};

export function CapacitorUrlHandler() {
  const navigate = useNavigate();
  const location = useLocation();

  const routeGenerationRef = useRef(0);
  const initialLaunchConsumedRef = useRef(false);
  const programmaticTargetRef = useRef<string | null>(null);
  const currentRouteRef = useRef<string>(location.pathname + location.search);
  const lastHandledUrlRef = useRef<{ url: string; time: number }>({ url: "", time: 0 });

  useEffect(() => {
    const currentLoc = location.pathname + location.search;
    if (programmaticTargetRef.current === currentLoc) {
      programmaticTargetRef.current = null;
    } else {
      const prevLoc = currentRouteRef.current;
      const isInitialRootTransition =
        (prevLoc === "/" || prevLoc === "/index.html") &&
        (currentLoc.startsWith("/app/") || currentLoc === "/auth");

      if (!isInitialRootTransition) {
        routeGenerationRef.current++;
        initialLaunchConsumedRef.current = true;
      }
    }
    currentRouteRef.current = currentLoc;
  }, [location.pathname, location.search]);

  useEffect(() => {
    const isNative =
      typeof window !== "undefined" &&
      Boolean(
        (window as any).Capacitor?.isNativePlatform?.() ||
        (window as any).Capacitor?.isNative ||
        window.location.protocol === "capacitor:"
      );

    if (!isNative) return;

    let disposed = false;

    const onPopState = () => {
      routeGenerationRef.current++;
      initialLaunchConsumedRef.current = true;
    };
    window.addEventListener("popstate", onPopState);

    const navigateForUrl = (rawUrl: string, isFromLaunch = false) => {
      if (!rawUrl || disposed) return;

      if (isFromLaunch) {
        if (initialLaunchConsumedRef.current) return;
        initialLaunchConsumedRef.current = true;
      }

      const now = Date.now();
      if (
        rawUrl === lastHandledUrlRef.current.url &&
        now - lastHandledUrlRef.current.time < 800
      ) {
        return;
      }
      lastHandledUrlRef.current = { url: rawUrl, time: now };

      const targetGeneration = ++routeGenerationRef.current;

      void import("@/lib/firebase")
        .then(({ auth }) => auth.authStateReady().then(() => {
          if (disposed || targetGeneration !== routeGenerationRef.current) return;

          const path = nativeRoute(rawUrl, auth.currentUser?.uid);
          if (!path || disposed || targetGeneration !== routeGenerationRef.current) return;

          if (currentRouteRef.current === path) return;

          programmaticTargetRef.current = path;
          navigate(path);
        }))
        .catch(() => {});
    };

    let handle: any = null;
    try {
      const onDispatchUrl = (event: { url?: string } | null | undefined) => {
        if (event?.url) {
          navigateForUrl(event.url, false);
        }
      };
      (window as any).__arshnazDispatchUrl = onDispatchUrl;

      if (typeof (window as any).__arshnazPendingUrl === "string") {
        const pending = (window as any).__arshnazPendingUrl;
        delete (window as any).__arshnazPendingUrl;
        navigateForUrl(pending, true);
      }

      CapApp.addListener("appUrlOpen", (event) => {
        if (event?.url) navigateForUrl(event.url, false);
      })
        .then((h) => {
          handle = h;
          if (disposed) { void h.remove(); return; }
          return CapApp.getLaunchUrl().then((launch) => {
            if (launch?.url && !initialLaunchConsumedRef.current && !disposed) {
              navigateForUrl(launch.url, true);
            }
          });
        })
        .catch((e) => console.warn("Capacitor widget route notice:", e));
    } catch (e) {
      console.warn("Capacitor appUrlOpen error:", e);
    }

    return () => {
      disposed = true;
      window.removeEventListener("popstate", onPopState);
      delete (window as any).__arshnazDispatchUrl;
      try {
        handle?.remove?.();
      } catch {}
    };
  }, [navigate]);

  return null;
}

const App = () => {
  useEffect(() => {
    try {
      installUndoShortcuts();
    } catch {}
  }, []);

  usePwaUpdateToast();

  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider
          attribute="class"
          defaultTheme={getBaseTheme(getStoredTheme() || "paper-light")}
          storageKey="__arshnaz_base_theme"
          enableSystem
        >
          <TooltipProvider>
            <Toaster />
            <Sonner />
            <BrowserRouter>
              <CapacitorUrlHandler />
              <AuthProvider>
                <Suspense fallback={<RouteFallback />}>
                  <Routes>
                    <Route path="/" element={<Index />} />
                    <Route path="/index.html" element={<Index />} />
                    <Route path="/auth" element={<Auth />} />
                    <Route path="/auth/callback" element={<AuthCallback />} />
                    {/* Root shortcut aliases */}
                    <Route path="/today" element={<Navigate to="/app/today" replace />} />
                    <Route path="/inbox" element={<Navigate to="/app/inbox" replace />} />
                    <Route path="/planning" element={<Navigate to="/app/planning" replace />} />
                    <Route path="/pomodoro" element={<Navigate to="/app/pomodoro" replace />} />
                    <Route path="/notes" element={<Navigate to="/app/notes" replace />} />
                    <Route path="/habits" element={<Navigate to="/app/today" replace />} />
                    <Route path="/calendar" element={<Navigate to="/app/calendar" replace />} />
                    <Route path="/settings" element={<Navigate to="/app/settings" replace />} />
                    <Route path="/new-task" element={<Navigate to="/app/new/task" replace />} />
                    <Route path="/new/task" element={<Navigate to="/app/new/task" replace />} />
                    <Route path="/new-note" element={<Navigate to="/app/new/note" replace />} />
                    <Route path="/new/note" element={<Navigate to="/app/new/note" replace />} />
                    {/* Legacy root redirects */}
                    <Route path="/garden" element={<Navigate to="/app/today" replace />} />
                    <Route path="/checkin" element={<Navigate to="/app/today" replace />} />
                    <Route path="/contacts" element={<Navigate to="/app/today" replace />} />
                    <Route path="/knowledge" element={<Navigate to="/app/notes" replace />} />
                    <Route path="/interactive-study" element={<Navigate to="/app/notes" replace />} />
                    <Route path="/life-architect" element={<Navigate to="/app/planning" replace />} />
                    <Route path="/crisis" element={<Navigate to="/app/today" replace />} />
                    <Route path="/sos" element={<Navigate to="/app/today" replace />} />

                    <Route
                      path="/app"
                      element={
                        <ProtectedRoute>
                          <ErrorBoundary>
                            <AppLayout />
                          </ErrorBoundary>
                        </ProtectedRoute>
                      }
                    >
                      <Route index element={<Navigate to="today" replace />} />

                      {/* Core Planning & Tasks */}
                      <Route path="today" element={<TodayDashboardView />} />
                      <Route path="inbox" element={<TasksView scope="inbox" />} />
                      <Route path="tomorrow" element={<TasksView scope="tomorrow" />} />
                      <Route path="next7" element={<TasksView scope="next7" />} />
                      <Route path="smart" element={<TasksView scope="smart" />} />
                      <Route path="folder/:id" element={<TasksView scope="folder" />} />
                      <Route path="tag/:id" element={<TasksView scope="tag" />} />
                      <Route path="planning" element={<PlanningView />} />
                      <Route path="buckets" element={<Navigate to="/app/planning" replace />} />
                      <Route path="kanban" element={<Navigate to="/app/today" replace />} />
                      <Route path="habits" element={<Navigate to="/app/today" replace />} />
                      <Route path="calendar" element={<CalendarView />} />
                      <Route path="pomodoro" element={<PomodoroView />} />
                      <Route path="notes" element={<NotesView />} />
                      <Route path="values" element={<ValuesGoalsView />} />
                      <Route path="stats" element={<StatsView />} />

                      {/* Task & Note Creation / Details / Sharing / Settings */}
                      <Route path="new/task" element={<NewTaskView />} />
                      <Route path="new-task" element={<Navigate to="/app/new/task" replace />} />
                      <Route path="new/note" element={<NewNoteView />} />
                      <Route path="new-note" element={<Navigate to="/app/new/note" replace />} />
                      <Route path="tasks/:id" element={<TaskDetailView />} />
                      <Route path="shared" element={<SharedWithMeView />} />
                      <Route path="share-target" element={<ShareTargetView />} />
                      <Route path="widgets" element={<WidgetsView />} />
                      <Route path="widget/:id" element={<WidgetsView />} />
                      <Route path="connect/chatgpt" element={<ChatGPTConnectView />} />
                      <Route path="settings" element={<SettingsView />} />
                      <Route path="admin" element={<AdminView />} />

                      {/* Safe redirects for retired modules */}
                      <Route path="life-architect" element={<Navigate to="/app/planning" replace />} />
                      <Route path="diary" element={<Navigate to="/app/notes" replace />} />
                      <Route path="garden" element={<Navigate to="/app/today" replace />} />
                      <Route path="contacts" element={<Navigate to="/app/today" replace />} />
                      <Route path="knowledge" element={<Navigate to="/app/notes" replace />} />
                      <Route path="knowledge-mindmap" element={<Navigate to="/app/notes" replace />} />
                      <Route path="interactive-study" element={<Navigate to="/app/notes" replace />} />
                      <Route path="continue" element={<Navigate to="/app/notes" replace />} />
                      <Route path="recall" element={<Navigate to="/app/notes" replace />} />
                      <Route path="tools" element={<Navigate to="/app/today" replace />} />
                      <Route path="rewrite-article" element={<Navigate to="/app/notes" replace />} />
                      <Route path="mind/*" element={<Navigate to="/app/today" replace />} />
                      <Route path="self/*" element={<Navigate to="/app/today" replace />} />
                      <Route path="checkin" element={<Navigate to="/app/today" replace />} />
                      <Route path="thoughts" element={<Navigate to="/app/today" replace />} />
                      <Route path="abc" element={<Navigate to="/app/today" replace />} />
                      <Route path="calm" element={<Navigate to="/app/today" replace />} />
                      <Route path="breathing" element={<Navigate to="/app/today" replace />} />
                      <Route path="sleep" element={<Navigate to="/app/today" replace />} />
                      <Route path="screener/*" element={<Navigate to="/app/today" replace />} />
                      <Route path="worry" element={<Navigate to="/app/today" replace />} />
                      <Route path="cycle" element={<Navigate to="/app/calendar" replace />} />
                      <Route path="crisis" element={<Navigate to="/app/today" replace />} />
                      <Route path="sos" element={<Navigate to="/app/today" replace />} />
                      <Route path="about-me" element={<Navigate to="/app/settings" replace />} />
                    </Route>
                    <Route path="*" element={<NotFound />} />
                  </Routes>
                </Suspense>
              </AuthProvider>
            </BrowserRouter>
          </TooltipProvider>
        </ThemeProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
};

export default App;
