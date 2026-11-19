# رانبوک انتشار و برگشت — ARSHNAZ

آخرین بروزرسانی: ۱۷ نوامبر ۲۰۲۶ · پایهٔ انتشار: `5e21a78` (همان کامیتی که الان زنده است)

این سند فقط دربارهٔ سایت و API است. **قوانین Firestore/Storage بخشی از انتشار سایت نیستند** و در هیچ‌کدام از دو دستور زیر جابه‌جا نمی‌شوند.

## خط تولید واقعی (چرا دستورها این شکلی‌اند)

| واقعیت | نتیجه |
|---|---|
| Vercel از طریق GitHub App به `hamedharami-hub/arshiam1` وصل است | هر push روی `main` یک بیلد تولیدی می‌سازد |
| CLI و ورود Vercel روی این سرور وجود ندارد | «انتشار» یعنی push، نه `vercel deploy` |
| نسخهٔ زنده از `https://arshnaz.vercel.app/version.json` خوانده می‌شود | تأیید انتشار = مقایسهٔ `commit` زنده با کامیت push‌شده |
| working tree چیزهای ناتمام دیگری هم دارد (`api/_lib/agentApi.ts` و…) | انتشار فقط از allowlist عبور می‌کند، نه از کل working tree |

بنابراین «انتشار» = کامیت‌کردن **فقط** فایل‌های `scripts/release-files.txt` (اپ) و در صورت تغییر، `scripts/release-tooling.txt` (رانبوک و اسکریپت، در کامیتی جلوتر) + تگ + push روی `main`. «برگشت» = `git revert` آخرین کامیت انتشار + push؛ Vercel از همان سورس قبلی دوباره بیلد می‌کند، قوانین و ابزار انتشار دست‌نخورده می‌مانند.

## دستور انتشار (یک دستور)

```bash
cd /home/ubuntu/projects/arshiam1
./scripts/release.sh deploy --confirm
```

با اجرای کامل تست‌ها (کل فرانت + API)، حدود ۸ تا ۱۰ دقیقه:

```bash
./scripts/release.sh deploy --confirm --full
```

## دستور برگشت (یک دستور)

```bash
cd /home/ubuntu/projects/arshiam1
./scripts/release.sh rollback --confirm
```

برگشت چند کامیت به یک نقطهٔ مشخص:

```bash
./scripts/release.sh rollback --confirm --to 5e21a78
```

برگشت فوری بدون بیلد (از داشبورد Vercel، چون توکن/CLI روی این سرور نیست):

1. `https://vercel.com/hamedharami-hub/arshiam1/deployments`
2. دیپلوی کامیت سالم قبلی را پیدا کنید
3. منوی `...` → **Promote to Production**

`./scripts/release.sh rollback --confirm --instant` همین مسیر را نشان می‌دهد و اگر `VERCEL_TOKEN` و `VERCEL_PROJECT_ID` تنظیم نشده باشند، عمداً کاری نمی‌کند.

## قبل از اجرا (چیزی که باید درست باشد)

```bash
./scripts/release.sh status     # branch، HEAD، origin/main، نسخهٔ زنده، فهرست «می‌رود» و «نمی‌رود»
./scripts/release.sh preview    # dry-run: فایل‌های دقیق و دستورهای مرحله‌به‌مرحله
```

`deploy` در این حالت‌ها **عمداً متوقف می‌شود**:

- شاخه `main` نباشد؛
- `HEAD` محلی با `origin/main` یکی نباشد (کامیت منتشرنشدهٔ کس دیگری را با خود نبرد)؛
- چیزی از قبل در index استیج شده باشد؛
- یکی از فایل‌های allowlist تغییر نکرده باشد (یعنی allowlist با working tree نمی‌خواند)؛
- `firestore.rules` یا `storage.rules` تغییر کرده باشد.

## چه اتفاقی می‌افتد، به ترتیب

1. `git fetch` و بررسی اینکه local `main` = `origin/main` است.
2. بررسی allowlist و دست‌نزدن به قوانین.
3. `npm run typecheck` در `frontend/` و سپس تست‌های همان فایل‌های تغییرکرده (`--full` = کل سوییت + `test:api`).
4. اگر رانبوک/اسکریپت‌ها هم تغییر کرده باشند، اول یک کامیت ابزار (`chore(release): …`) ساخته می‌شود؛ این‌طور برگشت انتشار، خودِ اسکریپت برگشت را پاک نمی‌کند.
5. `git add` فقط روی `scripts/release-files.txt`؛ بعد **اثبات** اینکه مجموعهٔ استیج‌شده بایت‌به‌بایت همان فهرست است (وگرنه index ریست می‌شود و هیچ کامیتی ساخته نمی‌شود).
6. کامیت تغییرهای اپ با پیام انتشار، تگ `release-YYYYMMDD-HHMMSS` (UTC) روی همان کامیت.
7. `git push origin main` و push تگ.
8. ثبت یک رکورد در `backups/releases/` (گیت‌ignore است؛ دفتر محلی انتشار).

بعد از آن Vercel خودش بیلد می‌کند. **انتشار را فرض نکنید، بسنجید:**

```bash
./scripts/release.sh verify          # commit زنده باید برابر HEAD محلی باشد
gh api repos/hamedharami-hub/arshiam1/commits/<sha>/status
```

سیگنال‌های دستی روی `https://arshnaz.vercel.app` پس از سبز شدن بیلد:

1. `Ctrl+K` روی یک حساب با داده: نتیجه باید زیر یک ثانیه بیاید (نه ۶ ثانیه).
2. داخل یک پوشه، «+ Add task» (ردیف بالای فهرست): تسک ساخته شود، شمارندهٔ پوشه بالا برود، بعد از reload هم بماند.
3. داخل همان پوشه، دکمهٔ شناور «+» → فرم کامل: عنوان را بنویسید و از صفحه بیرون بیایید؛ تسک باید **در همان پوشه** (نه Inbox) بماند و بعد از reload هم باشد.
3. یک تسک: روز/ساعت را انتخاب کنید، بعد تکرار را بزنید، ذخیره کنید — روز و ساعت باید بمانند.

## اگر خراب شد

| نشانه | کار |
|---|---|
| بیلد Vercel قرمز شد | چیزی منتشر نشده؛ نسخهٔ قبلی در حال سرو است. لاگ بیلد را بخوانید و کامیت را اصلاح/برگشت کنید. |
| بیلد سبز، اما رفتار غلط | `./scripts/release.sh rollback --confirm` |
| سایت ۵۰۰/سفید می‌دهد و باید فوری برگردد | Instant Rollback از داشبورد (بالا) |
| revert تعارض خورد | اسکریپت `git revert --abort` می‌زند و push نمی‌کند؛ دستی حل کنید یا بازهٔ کوچک‌تری بدهید (`--to`) |
| revert می‌خواست `firestore.rules` را عوض کند | اسکریپت `reset --hard` می‌زند و متوقف می‌شود؛ قوانین هرگز با برگشت سایت جابه‌جا نمی‌شوند |

## دامنهٔ این نسخه

**می‌رود (allowlist):**

- `frontend/src/lib/firestoreLive.ts`، `frontend/src/lib/firebaseStore.ts`، `frontend/src/components/CommandPalette.tsx` — مسیر خواندن سریع جست‌وجو (باگ ۱) و تست‌هایشان.
- `frontend/src/components/QuickAddTask.tsx` + `frontend/src/lib/taskScheduleAdapters.test.ts` — حفظ روز/ساعت هنگام انتخاب تکرار (باگ ۳).
- `frontend/src/components/QuickAddTask.test.tsx` — تست یکپارچهٔ «+» داخل پوشه (مسیر inline، بدون تغییر).
- `frontend/src/components/TaskDetail.tsx` + `frontend/src/pages/NewTaskView.tsx` + `frontend/src/pages/NewTaskView.folderContext.test.tsx` — رفع باگ ۲ برای «+» شناور/فرم کامل (جزئیات: `docs/BUG2-VERDICT-FA.md`).
- ابزار انتشار (`docs/RELEASE-RUNBOOK-FA.md`، `docs/BUG2-VERDICT-FA.md`، `scripts/release.sh`، `scripts/release-files.txt`، `scripts/release-tooling.txt`) در کامیت جدا و جلوتر از تغییرهای اپ می‌رود.

**نمی‌رود (عمداً، دست‌نخورده در working tree می‌ماند):**

- `api/_lib/agentApi.ts`، `api/_lib/assistantAccess.ts`، `api/_lib/response.ts`، `api/agentSchema.test.ts`، `api/agentApi.habits.test.ts` — کار ناتمام Agent API که مال این تغییرها نیست و بازبینی نشده.
- `frontend/public/agent-openapi.json`، `frontend/src/pages/settings/AssistantAccessSettings.tsx` — همان مجموعه.

اگر روزی خواستید آن‌ها هم منتشر شوند، اول باید جداگانه بازبینی و تست شوند و بعد به `scripts/release-files.txt` اضافه شوند؛ انتشار بعدی خودکار آن‌ها را با خود نمی‌برد.

## قوانین (بدون تغییر)

```bash
# فقط وقتی جداگانه و آگاهانه تصمیم گرفتید:
npx -y firebase-tools@latest deploy --only firestore:rules,storage
```

هیچ‌کدام از `deploy`/`rollback` بالا این کار را نمی‌کند، حتی اگر فایل قوانین در working tree تغییر کرده باشد (در آن حالت deploy عمداً متوقف می‌شود).
