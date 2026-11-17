# راه‌اندازی و نگهداری فایربیس — ARSHNAZ

آخرین بروزرسانی: ۱۷ نوامبر ۲۰۲۶

## معماری تصمیم‌گرفته‌شده

| لایه | محل | چرا |
|---|---|---|
| وب‌سایت (SPA) | Vercel — `https://arshnaz.vercel.app` | Firebase Hosting نمی‌تواند `/api/*` را به بیرون پروکسی کند؛ انتقال کامل نیازمند Cloud Functions روی پلن Blaze است و سودی ندارد. |
| ورود کاربر | Firebase Auth | ایمیل/رمز و Google هر دو فعال. |
| پایگاه‌داده | Firestore — دیتابیس نام‌دار `ai-studio-smarttasknotes-8c44cce7-d637-4402-9467-7188161b37e5` | دیتابیس پیش‌فرض `(default)` وجود ندارد و نباید ساخته شود. |
| فایل‌ها | Firebase Storage — `gen-lang-client-0845891098.firebasestorage.app` | پیوست‌ها خصوصی و محدود به ۲۵ مگابایت و انواع مجاز. |
| توابع سرور | Vercel Functions — پوشهٔ `api/` | همان‌جا می‌مانند. |

## شناسهٔ پروژه

- Firebase Project: `gen-lang-client-0845891098` (نام نمایشی: Iran1)
- حساب مالک/CLI: `hamed.harami@gmail.com`

## پیکربندی محلی

- `.firebaserc` → پروژهٔ پیش‌فرض را تعیین می‌کند.
- `firebase.json` → بلوک `firestore` به‌صورت آرایه با کلید `database` نوشته شده تا استقرار قوانین روی دیتابیس **نام‌دار** انجام شود، نه پیش‌فرض.

## استقرار قوانین

```bash
npx -y firebase-tools@latest login --no-localhost   # یک‌بار
npx -y firebase-tools@latest deploy --only firestore:rules,storage
```

پس از استقرار همیشه تأیید کنید که release مربوط به همان دیتابیس نام‌دار عوض شده است:

```bash
npx -y firebase-tools@latest --json firestore:databases:list
```

## دامنه‌های مجاز ورود (Authorized domains)

دامنهٔ اصلی سایت **باید** در این فهرست باشد، وگرنه ورود گوگل با خطای `auth/unauthorized-domain` شکست می‌خورد. فهرست فعلی شامل `arshnaz.vercel.app`، `arshiam.vercel.app`، `*.web.app` و `*.firebaseapp.com` است.

تغییر این فهرست از CLI ممکن نیست؛ یا از کنسول (Authentication → Settings → Authorized domains) یا با Identity Toolkit Admin API:

```
PATCH https://identitytoolkit.googleapis.com/admin/v2/projects/gen-lang-client-0845891098/config?updateMask=authorizedDomains
```

## تأیید پس از استقرار (۱۷ نوامبر ۲۰۲۶)

- محتوای release دیتابیس نام‌دار و release فضای ذخیره‌سازی بایت‌به‌بایت با فایل‌های مخزن یکسان شد.
- ۱۲ سناریوی آزمون روی خود قوانین اجرا شد و همه مطابق انتظار بود: ساخت پوشه/نوت/تسک در درخت خودی مجاز، نوشتن کاربر دیگر و ناشناس ممنوع، `module_access` و `user_roles` و `assistant_grants` از سمت کلاینت ممنوع، نوشتن `/_health` سطح‌بالا ممنوع.
- دامنهٔ `arshnaz.vercel.app` در فهرست دامنه‌های مجاز ورود ثبت شد (۳۳ دامنه).

## استقرار سایت (به‌روزرسانی ۱۷ نوامبر ۲۰۲۶)

- Vercel از طریق **GitHub App** به مخزن `hamedharami-hub/arshiam1` وصل است؛ هر push روی `main` یک بیلد تازه می‌سازد و وضعیت آن روی همان کامیت در گیت‌هاب با نام `Vercel` دیده می‌شود:

```bash
gh api repos/hamedharami-hub/arshiam1/commits/<sha>/status
```

- نشانهٔ اتصال، نبودِ webhook در `/hooks` نیست؛ اپ گیت‌هاب جداست.
- نسخهٔ زندهٔ سایت از `https://arshnaz.vercel.app/version.json` خوانده می‌شود (`commit` و `buildTime`).
- ورود ابزار Vercel روی این سرور وجود ندارد؛ استقرار فقط از راه push انجام می‌شود، نه CLI.

## بکاپ خودکار قوانین

`scripts/backup-firebase-rules.sh` نسخهٔ زندهٔ همهٔ releaseهای قوانین (همهٔ دیتابیس‌ها + Storage) را در `backups/firebase-rules/<تاریخ>/` ذخیره می‌کند و هشت نسخهٔ آخر را نگه می‌دارد. یک روتین هفتگی (یکشنبه‌ها ۹:۰۰ صبح به وقت سیدنی) همین اسکریپت را اجرا می‌کند.

## نکته‌های عملیاتی

1. بلوک `hosting` در `firebase.json` عمداً مستقر **نمی‌شود**. اگر روزی `firebase deploy` بدون `--only` اجرا شود، یک نسخهٔ نیمه‌کاره روی `*.web.app` ساخته می‌شود که مسیرهای `/api/*` در آن کار نمی‌کنند.
2. هر دیتابیس نام‌دار release قوانین جداگانه دارد؛ تغییر قوانین یک دیتابیس روی بقیه اثر ندارد.
3. کلید `oAuthClientId` در `frontend/firebase-applet-config.json` با Client ID گوگلِ ثبت‌شده در Firebase یکی نیست. برای ورود وب بی‌اثر است (ورود وب از `authDomain` استفاده می‌کند) اما ورود گوگل در اپ اندروید به همین شناسه وابسته است.
4. بکاپ پیش از هر تغییر قوانین: خروجی `firebase firestore:databases:list` و محتوای release فعلی را ذخیره کنید.
