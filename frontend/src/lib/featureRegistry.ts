import type { LucideIcon } from "lucide-react";
import {
  BarChart3,
  Calendar,
  CalendarDays,
  Compass,
  FilePlus,
  FileText,
  Filter,
  Hourglass,
  Inbox,
  LayoutGrid,
  ListPlus,
  Settings,
  Share2,
  Shield,
  Sun,
  Timer,
} from "lucide-react";
import { isPathAllowed, type ModuleId, type ModulesState } from "./appModules";

export type FeatureCenter =
  | "today"
  | "library"
  | "goals-life"
  | "insights-tools"
  | "connections"
  | "account";

export type FeatureEntry = {
  to: string;
  nameFa: string;
  nameEn: string;
  keywordsFa: string;
  keywordsEn: string;
  center: FeatureCenter;
  icon: LucideIcon;
  moduleKey?: ModuleId;
  order: number;
};

export const FEATURE_CENTERS: { id: FeatureCenter; labelFa: string; labelEn: string }[] = [
  { id: "today", labelFa: "امروز و برنامه‌ریزی", labelEn: "Today & Planning" },
  { id: "library", labelFa: "یادداشت‌ها", labelEn: "Notes" },
  { id: "goals-life", labelFa: "ارزش‌ها و اهداف", labelEn: "Values & Goals" },
  { id: "insights-tools", labelFa: "آمار و عملکرد", labelEn: "Insights & Stats" },
  { id: "connections", labelFa: "اشتراک‌گذاری", labelEn: "Sharing" },
  { id: "account", labelFa: "حساب و تنظیمات", labelEn: "Account & Settings" },
];

export const FEATURES: FeatureEntry[] = [
  // ── Today & Planning ──────────────────────────────────────────────────────
  {
    to: "/app/today",
    nameFa: "امروز",
    nameEn: "Today",
    keywordsFa: "امروز کارهای امروز داشبورد",
    keywordsEn: "today dashboard tasks",
    center: "today",
    icon: CalendarDays,
    order: 10,
  },
  {
    to: "/app/inbox",
    nameFa: "اینباکس",
    nameEn: "Inbox",
    keywordsFa: "اینباکس ورودی صندوق ورودی",
    keywordsEn: "inbox capture",
    center: "today",
    icon: Inbox,
    order: 20,
  },
  {
    to: "/app/planning",
    nameFa: "برنامه‌ریزی",
    nameEn: "Planning",
    keywordsFa: "برنامه‌ریزی برنامه روز هفته ماه فصل سال",
    keywordsEn: "planning plan day week month quarter year",
    center: "today",
    icon: Hourglass,
    order: 30,
  },
  {
    to: "/app/calendar",
    nameFa: "تقویم",
    nameEn: "Calendar",
    keywordsFa: "تقویم برنامه شمسی میلادی",
    keywordsEn: "calendar schedule jalali gregorian",
    center: "today",
    icon: Calendar,
    order: 40,
  },
  {
    to: "/app/tomorrow",
    nameFa: "فردا",
    nameEn: "Tomorrow",
    keywordsFa: "فردا کارهای فردا",
    keywordsEn: "tomorrow",
    center: "today",
    icon: Sun,
    order: 50,
  },
  {
    to: "/app/next7",
    nameFa: "هفت روز آینده",
    nameEn: "Next 7 Days",
    keywordsFa: "هفت روز آینده هفته",
    keywordsEn: "next 7 days week upcoming",
    center: "today",
    icon: CalendarDays,
    order: 60,
  },
  {
    to: "/app/smart",
    nameFa: "لیست‌های هوشمند",
    nameEn: "Smart Lists",
    keywordsFa: "لیست هوشمند فیلتر",
    keywordsEn: "smart lists filter",
    center: "today",
    icon: Filter,
    order: 70,
  },
  {
    to: "/app/pomodoro",
    nameFa: "پومودورو",
    nameEn: "Pomodoro",
    keywordsFa: "پومودورو تمرکز زمان‌سنج فوکوس",
    keywordsEn: "pomodoro focus timer",
    center: "today",
    icon: Timer,
    order: 80,
  },

  // ── Notes ─────────────────────────────────────────────────────────────────
  {
    to: "/app/notes",
    nameFa: "نوت‌ها",
    nameEn: "Notes",
    keywordsFa: "نوت یادداشت‌ها یادداشت",
    keywordsEn: "notes note",
    center: "library",
    icon: FileText,
    order: 110,
  },

  // ── Values & Goals ────────────────────────────────────────────────────────
  {
    to: "/app/values",
    nameFa: "ارزش‌ها و اهداف",
    nameEn: "Values & Goals",
    keywordsFa: "ارزشها اهداف ارزش هدف ارزشها و اهداف",
    keywordsEn: "values goals purpose direction",
    center: "goals-life",
    icon: Compass,
    order: 210,
  },

  // ── Insights & Tools ──────────────────────────────────────────────────────
  {
    to: "/app/stats",
    nameFa: "آمار و عملکرد",
    nameEn: "Stats & Summary",
    keywordsFa: "آمار خلاصه عملکرد گزارش",
    keywordsEn: "stats summary statistics report",
    center: "insights-tools",
    icon: BarChart3,
    order: 310,
  },
  {
    to: "/app/widgets",
    nameFa: "ویجت‌ها",
    nameEn: "Widgets",
    keywordsFa: "ویجت ویجتها ابزارک",
    keywordsEn: "widgets",
    center: "insights-tools",
    icon: LayoutGrid,
    order: 320,
  },

  // ── Connections ───────────────────────────────────────────────────────────
  {
    to: "/app/shared",
    nameFa: "اشتراک‌شده با من",
    nameEn: "Shared with Me",
    keywordsFa: "اشتراک اشتراک‌گذاری اشتراک‌شده",
    keywordsEn: "shared with me sharing",
    center: "connections",
    icon: Share2,
    order: 410,
  },

  // ── Account & Settings ────────────────────────────────────────────────────
  {
    to: "/app/settings",
    nameFa: "تنظیمات و پشتیبان‌گیری",
    nameEn: "Settings & Backup",
    keywordsFa: "تنظیمات بکاپ پشتیبان‌گیری همگام‌سازی",
    keywordsEn: "settings backup sync firestore",
    center: "account",
    icon: Settings,
    order: 510,
  },
  {
    to: "/app/admin",
    nameFa: "پنل مدیریت",
    nameEn: "Admin Panel",
    keywordsFa: "مدیریت پنل مدیریت ادمین",
    keywordsEn: "admin panel management",
    center: "account",
    icon: Shield,
    order: 520,
  },
  {
    to: "/app/new/task",
    nameFa: "تسک جدید",
    nameEn: "New Task",
    keywordsFa: "تسک جدید ایجاد تسک افزودن تسک",
    keywordsEn: "new task add task create",
    center: "account",
    icon: ListPlus,
    order: 530,
  },
  {
    to: "/app/new/note",
    nameFa: "نوت جدید",
    nameEn: "New Note",
    keywordsFa: "نوت جدید ایجاد نوت یادداشت جدید",
    keywordsEn: "new note add note create",
    center: "account",
    icon: FilePlus,
    order: 540,
  },
];

export function getFeatureLabel(feature: FeatureEntry, isEn: boolean): string {
  return isEn ? feature.nameEn : feature.nameFa;
}

export function featureSearchText(feature: FeatureEntry): string {
  return [feature.nameFa, feature.nameEn, feature.keywordsFa, feature.keywordsEn, feature.to].join(" ");
}

export function findFeature(to: string): FeatureEntry | undefined {
  return FEATURES.find((feature) => feature.to === to);
}

export function getFeatureNavigation(to: string) {
  const feature = findFeature(to);
  if (!feature) throw new Error(`Unregistered navigation feature: ${to}`);
  return { url: feature.to, label: feature.nameFa, icon: feature.icon };
}

export function isFeatureAvailable(feature: FeatureEntry, modules: ModulesState, isAdmin = modules.isAdmin): boolean {
  return (feature.to !== "/app/admin" || isAdmin) && isPathAllowed(feature.to, modules);
}
