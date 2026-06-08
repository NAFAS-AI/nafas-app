# 🚀 دليل نشر نَفَس على Vercel

## الخطوات (5 دقائق)

### 1. رفع المشروع على GitHub
```bash
# إنشاء repo جديد باسم nafas-app
git init
git add .
git commit -m "Nafas v7.0 — production ready"
git remote add origin https://github.com/YOUR_USERNAME/nafas-app.git
git push -u origin main
```

### 2. ربط Vercel بـ GitHub
1. افتحي [vercel.com](https://vercel.com)
2. **New Project** → اختاري `nafas-app` repo
3. **Deploy** — سيتعرف على `vercel.json` تلقائياً

### 3. إضافة Environment Variables
في Vercel Dashboard:
1. **Settings** → **Environment Variables**
2. أضيفي:

| Key | Value |
|-----|-------|
| `GEMINI_API_KEY` | `⚠️ أضيفي المفتاح من Google AI Studio — لا تكتبيه هنا` |
| `GEMINI_MODEL` | `gemini-2.5-flash` |
| `ALLOWED_ORIGINS` | `https://nafas-app-blush.vercel.app,https://nafas-app.com` |

3. **Save** → **Redeploy**

### 4. اختبار
```
curl -X POST https://nafas-app-blush.vercel.app/api/gemini \
  -H "Content-Type: application/json" \
  -H "Origin: https://nafas-app-blush.vercel.app" \
  -d '{"contents":[{"role":"user","parts":[{"text":"مرحبا"}]}]}'
```

### 5. ربط الدومين
- **Settings** → **Domains** → أضيفي `nafas-app.com`
- DNS: أضيفي CNAME يشير إلى `cname.vercel-dns.com`

---

## 📁 هيكل المشروع
```
nafas-app/
├── index.html          ← التطبيق (frontend) — 569KB، 20+ ميزة ذكاء
├── manifest.json       ← PWA manifest
├── sw.js              ← Service Worker (offline support)
├── icon-192.png       ← أيقونة PWA صغيرة
├── icon-512.png       ← أيقونة PWA كبيرة
├── vercel.json        ← إعدادات Vercel + Security Headers + CSP
├── package.json       ← بيانات المشروع
├── api/
│   └── gemini.js      ← Secure Proxy (API key server-side) ✅
├── brand/             ← 8 نسخ شعار (PNG + SVG × 4 ألوان)
├── strategy/
│   └── index.html     ← الخطة الاستراتيجية التفاعلية
├── LICENSE            ← حقوق الملكية الفكرية
├── README.md          ← وصف المشروع
└── DEPLOY.md          ← هذا الملف
```

## 🔒 الأمان
- ✅ API Key محفوظ في Vercel Environment Variables فقط
- ✅ لا يوجد أي مفتاح في الكود المصدري
- ✅ Rate Limiting: 20 طلب/دقيقة لكل IP
- ✅ CORS: يقبل فقط من الدومينات المحددة (مع defaults مضمّنة)
- ✅ CSP: Content Security Policy شامل في vercel.json
- ✅ Security Headers: X-Frame-Options, X-Content-Type-Options, Referrer-Policy
- ✅ Permissions-Policy: microphone=(self), geolocation=(self)
- ✅ Input Sanitization: تنظيف المدخلات من XSS
- ✅ Request Tracing: كل طلب له معرّف فريد

> ⚠️ **تنبيه أمني:** لا تكتبي مفاتيح API أبداً في ملفات الكود — استخدمي Environment Variables فقط

---
*© منيرة علي المري 2026 — IP Registration #1614-2026*
