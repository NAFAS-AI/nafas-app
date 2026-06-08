# 🚀 دليل نشر نَفَس على Vercel

## الخطوات (5 دقائق)

### 1. رفع المشروع على GitHub
```bash
# إنشاء repo جديد باسم nafas-app
git init
git add .
git commit -m "Nafas v4.0 — production ready"
git remote add origin https://github.com/YOUR_USERNAME/nafas-app.git
git push -u origin main
```

### 2. ربط Vercel بـ GitHub
1. افتحي [vercel.com](https://vercel.com)
2. **New Project** → اختاري `nafas-app` repo
3. **Deploy** — سيتعرف على `vercel.json` تلقائياً

### 3. إضافة Environment Variable
في Vercel Dashboard:
1. **Settings** → **Environment Variables**
2. أضيفي:

| Key | Value |
|-----|-------|
| `GEMINI_API_KEY` | `⚠️ أضيفي المفتاح من Google AI Studio — لا تكتبيه هنا` |
| `GEMINI_MODEL` | `gemini-2.5-flash` |
| `ALLOWED_ORIGINS` | `https://nafas-app.com` |

3. **Save** → **Redeploy**

### 4. اختبار
```
curl -X POST https://YOUR-DOMAIN/api/gemini \
  -H "Content-Type: application/json" \
  -d '{"contents":[{"role":"user","parts":[{"text":"مرحبا"}]}]}'
```

### 5. ربط الدومين
- **Settings** → **Domains** → أضيفي `nafas-app.com`

---

## 📁 هيكل المشروع
```
nafas-app/
├── index.html          ← التطبيق (frontend)
├── manifest.json       ← PWA manifest
├── sw.js              ← Service Worker
├── vercel.json        ← إعدادات Vercel
├── api/
│   └── gemini.js      ← Proxy (API key server-side) ✅
└── DEPLOY.md          ← هذا الملف
```

## 🔒 الأمان
- ✅ API Key محفوظ في Vercel Environment Variables فقط
- ✅ لا يوجد أي مفتاح في الكود المصدري
- ✅ Rate Limiting: 20 طلب/دقيقة لكل IP
- ✅ CORS: يقبل فقط من الدومين المحدد
- ✅ CSP: Content Security Policy في الـ HTML

> ⚠️ **تنبيه أمني:** لا تكتبي مفاتيح API أبداً في ملفات الكود — استخدمي Environment Variables فقط

---
*© منيرة علي المري 2026*
