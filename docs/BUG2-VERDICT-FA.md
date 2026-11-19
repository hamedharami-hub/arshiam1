# حکم باگ ۲ — «+» در فولدر

تاریخ: ۱۷ نوامبر ۲۰۲۶ · پایه: `5e21a78` · وضعیت: **بازتولید شد و اصلاح شد**
روش: build محلی (`vite build --mode development` با `NODE_ENV=development`) روی `:3000`، شبیه‌ساز Firebase (`demo-arshnaz`, Auth :9099, Firestore :8085) با همان `firestore.rules` مخزن، مرورگر واقعی Chrome.

## حکم

دو نقص واقعی پشت این شکایت بود؛ هر دو بازتولید و رفع شدند:

1. **تسک در فولدر ثبت نمی‌شد:** «+» شناور فرم کامل را با `folder_id` باز می‌کرد، ولی اولین نوشتن فقط عنوان را می‌فرستاد؛ سند بدون `folder_id` در Inbox ساخته می‌شد.
2. **تسک بعد از خروج از صفحه پاک می‌شد:** اگر کاربر بعد از تایپ عنوان از صفحه بیرون می‌رفت، پاک‌سازی «پیش‌نویس خالی» با یک snapshot قدیمی مقایسه می‌کرد که عنوانش هنوز خالی بود و همان تسک تازه را حذف می‌کرد. این دقیقاً حس «ثبت نمی‌شود» را می‌سازد.

مسیر جعبهٔ افزودن سریع (inline) از ابتدا سالم بود و دست نخورد.

## بازتولید گام‌به‌گام (قبل از اصلاح)

1. ساخت فولدر `QA Plus Folder` با حساب تازه.
2. رفتن به همان فولدر و انتخاب نمای کانبان.
3. کلیک روی دکمهٔ شناور «+» با عنوان `ایجاد تسک جدید (فرم کامل)`.
4. مقصد: `/app/new/task?kanban_goal_id=ada8081b-…&folder_id=0d71c5f3-…` و breadcrumb فرم، `QA Plus Folder` را نشان می‌دهد.
5. تایپ عنوان `D fab full form` و انتظار برای «Saved».

نتیجه در Firestore شبیه‌ساز:

```
users/<uid>/tasks/d6f544c7-…  fields = ['id', 'title', 'updated_at', 'user_id']
```

یعنی `folder_id`، `kanban_column_id`، `status` و `work_date` هیچ‌کدام نوشته نشدند. شمارندهٔ کنار فولدر روی **۲** ماند و «Inbox» شد **۱**.

## ریشهٔ علت (زنجیرهٔ کد)

1. صفحهٔ تسک تازه، فولدر را از query در draft می‌گذارد: `NewTaskView.tsx:77-103` — `folder_id: parentId ? null : folderId`.
2. `TaskDetail` همان draft را «قبلاً ذخیره‌شده» فرض می‌کند: `savedTaskRef = useRef(task)` و در mount `savedTaskRef.current = task` (`TaskDetail.tsx:190-191`, `:231-232`).
3. autosave فقط تفاوت را می‌فرستد: `pendingPatch = taskPatch(t, savedTaskRef.current)` — برای تسک تازه تنها فیلد تغییریافته `title` است.
4. همان تفاوت merge می‌شود: `persistTask(user.id, { id, ...patch })` و `persistTask` فقط `{...normalizedTask, user_id, updated_at}` را می‌نویسد (`lib/firestoreDataService.ts:331-347`).
5. جدا از آن، پاک‌سازی خروج در `NewTaskView` با `draftRef` کار می‌کرد که فقط snapshot لحظهٔ mount است؛ عنوان تایپ‌شده در آن نمی‌آمد، پس تسکِ ذخیره‌شده «خالی» دیده و حذف می‌شد.

## اصلاح (اعمال شد)

- `TaskDetail` prop تازهٔ `createPayload` گرفت: اولین نوشتنِ یک تسک تازه، کل context صفحه (فولدر، هدف، وضعیت، روز/ساعت، user_id، timestamps) را با ویرایش‌های کاربر ادغام می‌کند؛ نوشتن‌های بعدی مثل قبل فقط diff می‌مانند تا ویرایش هم‌زمان دستگاه دیگر از بین نرود. (`createdOnceRef`)
- `TaskDetail` prop اختیاری `onTaskChange` گرفت و `NewTaskView` با آن `draftRef` را از آخرین وضعیت واقعی ادیتور به‌روز می‌کند؛ حالا پاک‌سازی خروج فقط تسکی را حذف می‌کند که واقعاً عنوان خالی دارد.
- مسیر inline (`QuickAddTask`) هیچ تغییری نکرد.

## تست‌ها

فایل تازهٔ `frontend/src/pages/NewTaskView.folderContext.test.tsx` مسیر «+» شناور را واقعاً اجرا می‌کند (route + NewTaskView + TaskDetail + autosave):

| تست | روی کد قبل از اصلاح | بعد از اصلاح |
|---|---|---|
| نوشتن `folder_id` + `work_date` + `status` در اولین ذخیره | ❌ `expected { id, title }` | ✅ |
| زنده‌ماندن تسک بعد از خروج از صفحه | ❌ `deleteTask` یک بار صدا زده شد | ✅ |
| حذف واقعی تسکی که عنوانش پاک شده | — | ✅ |

اعداد شمارنده هم از همان تابع واقعی سایدبار (`computeSidebarCounts`) آمده‌اند: قبل `0`، بعد `1` برای `folder:<id>`.

## اثر روی این انتشار

این اصلاح داخل allowlist انتشار است (`scripts/release-files.txt`)، پس انتشار بعدی هم مسیر فرم کامل و هم مسیر inline را سالم می‌برد.
