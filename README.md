# التوأم الرقمي لمركز البيانات · Data Center Digital Twin — v2.5

**SRU · ICTD · ITOC** — لوحة متابعة لرفوف مركز البيانات وأجهزتها، تُغذّى من **Google Sheet** عبر **Google Apps Script**، مع صفحة **إعدادات** لتسجيل الرفوف ومحتوى كل رف وبيانات كل جهاز وموقعه.

A rack-and-device dashboard for the data center, fed from a **Google Sheet** through **Google Apps Script**, with a **Settings** page to register racks, rack contents, and each device's data and location.

```
GitHub (index.html: ITOC sign-in screen)
        │  opens
        ▼
Apps Script Web App  (Code.gs + Index.html)  ──►  Google Sheet
   · @sr.edu.sa accounts only                       Settings · Racks · Devices
   · admin / viewer roles                           AllowedUsers · AccessLog · ChangeLog
```

## محتويات الحزمة · Package

| الملف · File | الوظيفة · Purpose |
| --- | --- |
| `apps-script/Code.gs` | الواجهة الخلفية: الجداول، التحقق، الصلاحيات، سجل الدخول والتعديل · Backend: sheets, validation, roles, access and change logs |
| `apps-script/Index.html` | الصفحة الرئيسية وصفحة الإعدادات (عربي/إنجليزي) · Dashboard and Settings page (AR/EN) |
| `apps-script/appsscript.json` | إعدادات النشر (تنفيذ باسم المالك، للنطاق فقط) · Deployment manifest |
| `index.html` | شاشة دخول ITOC تظهر قبل شاشة Google · ITOC sign-in screen shown before Google's login |
| `CHANGELOG.md` | سجل التغييرات · Change record |

## التركيب · Setup (حوالي 10 دقائق · about 10 minutes)

1. أنشئ Google Sheet جديداً باسم «DC Digital Twin Data» · Create a new Google Sheet.
2. من **Extensions → Apps Script** الصق محتوى `Code.gs` في الملف الافتراضي · Paste `Code.gs`.
3. أضف ملف HTML جديداً باسم **`Index`** (من **+ → HTML**) والصق فيه `Index.html` · Add an HTML file named `Index` and paste `Index.html`.
4. من **Project Settings** فعّل «Show appsscript.json» والصق محتوى `appsscript.json` · Paste the manifest.
5. شغّل الدالة **`setup`** مرة واحدة ووافق على الصلاحيات. تُنشئ الجداول الستة وتضيف حسابك مسؤولاً · Run `setup` once and authorize.
6. اختياري: شغّل **`seedSample`** (أو من قائمة DC Digital Twin في الـ Sheet) لتحميل عشرة رفوف تجريبية، ثم احذفها من صفحة الإعدادات عند البدء بالبيانات الحقيقية · Optional sample data.
7. **Deploy → New deployment → Web app**: *Execute as* **Me**، *Who has access* **Anyone within sr.edu.sa** · Deploy.
8. انسخ رابط `/exec` وضعه في `APP_URL` داخل `index.html`، ثم انشر المجلد على GitHub Pages · Put the URL in the landing page.
9. أضف بقية المستخدمين في الجدول **AllowedUsers** (عمود `Role`: `admin` أو `viewer`، وعمود `Active`: `yes`) · Add users.

> عند أي تعديل لاحق على `Code.gs` أو `Index.html`: **Deploy → Manage deployments → Edit → New version** ليبقى الرابط نفسه · After edits, publish a new version of the same deployment.

## صور الرفوف · Rack photos

- من **الإعدادات ← تعديل رف** يمكن إضافة حتى 4 صور حقيقية لكل رف وحذفها. تظهر الصور لكل المستخدمين في تفاصيل الرف بالصفحة الرئيسية، وتُفتح بحجم كامل بالنقر عليها.
- تُحفظ الصور في مجلد **DC Digital Twin Photos** في Drive الخاص بصاحب المشروع، وتُعرض عبر التطبيق فقط (لا روابط عامة)، فتتبع صلاحيات جدول AllowedUsers.
- **بعد أول نشر لهذا الإصدار:** افتح Apps Script وشغّل الدالة `setup` مرة واحدة ووافق على صلاحية Google Drive.
- Up to 4 photos per rack, added in *Settings → edit rack* and shown in the rack details with a full-size viewer. Photos live in a private Drive folder and are served only through the app. After the first deploy of this version, run `setup` once and approve the Drive permission.

## الصلاحيات · Access

| الدور · Role | لوحة المتابعة · Dashboard | الإعدادات · Settings |
| --- | --- | --- |
| `admin` | نعم · yes | نعم، تعديل كامل · full edit |
| `viewer` | نعم · yes | لا تظهر · hidden |

- التحقق يتم في الخادم أيضاً: أي محاولة كتابة من غير مسؤول تُرفض بالخطأ `E_ADMIN` · Writes are enforced server-side.
- `ACCESS_MODE = 'LIST'` (الافتراضي) يسمح فقط لمن في AllowedUsers. `'DOMAIN'` يسمح لأي حساب `@sr.edu.sa` بدور مشاهد · `'LIST'` allows only listed users; `'DOMAIN'` lets any `@sr.edu.sa` account view.
- كل فتح للصفحة يُسجَّل في **AccessLog** (التاريخ، الوقت، البريد، الدور، النتيجة)، وكل تعديل في **ChangeLog** · Every page open and every edit is logged.

## كيف تظهر البيانات في الصفحة الرئيسية · How data reaches the dashboard

| ما تسجله في الإعدادات · You register | ما يظهر · What appears |
| --- | --- |
| الرف: الصف، الموضع، الارتفاع U، سعة الطاقة W، حرارة الدخل | موقع الرف على مخطط القاعة (الصفوف والمواضع من الجدول، بلا حد ثابت) ولونه حسب الطاقة أو الحرارة أو المساحة |
| الجهاز: الرف، بداية الموقع U، الارتفاع U، القدرة W، النوع، الحالة | مخطط الرف (42U وغيره)، جدول الأجهزة، الحمل الكهربائي، المساحة الحرة، ومقترح التركيب |
| الجهاز: الشركة، الطراز، الرقم التسلسلي، رقم الأصل، IP، الجهة المالكة | بطاقة تفاصيل الجهاز، والبحث بأي حقل منها |
| حدود التنبيه | التنبيهات وألوان الرفوف |

- **قواعد الحساب:** يُحتسب الجهاز في الطاقة إذا كانت حالته `Active` أو `Maintenance`، وفي المساحة ما لم يكن `Decommissioned`؛ والجهاز `Planned` يحجز المساحة دون استهلاك. الحمل الكهربائي المعروض مجموع القدرات المسجلة، وليس قراءة حية من وحدات الطاقة.
- **منع الأخطاء:** يرفض الخادم أي جهاز يتجاوز ارتفاع الرف أو يتداخل مع جهاز آخر، ويمنع تصغير رف فيه أجهزة، وتكرار معرّف الرف أو موضعه.
- **التوليد الدفعي:** حدد الصفوف وعدد الرفوف في كل صف لإنشاء الرفوف مرة واحدة (حتى 200 رف).

## التشغيل الآلي · Automation hooks

- الجدول **Racks** هو نقطة التكامل: عمودا `InletTempC` و`ReadingAt` يمكن أن يكتب فيهما سير عمل n8n من نظام المراقبة، فتظهر الحرارة الحية في الصفحة دون تغيير الكود. فعّل بعدها «تأخر القراءة» في الإعدادات لتنبيه القراءات القديمة.
- The `Racks` sheet is the integration point: an n8n workflow can write `InletTempC` and `ReadingAt` straight from the monitoring system.
- يمكن ربط المجلد بالنشر التلقائي من GitHub إلى Apps Script (GitHub Actions + clasp) كما في بقية منصات ICTD · The folder can be wired to the same GitHub → Apps Script auto-deploy used for the other ICTD platforms.

## وضع التجربة · Demo mode

فتح `Index.html` مباشرة في المتصفح (خارج Apps Script) يشغّله بوضع تجريبي: كل الوظائف تعمل وتُحفظ في متصفحك فقط، دون أي اتصال بـ Google Sheet · Opening `Index.html` outside Apps Script runs a browser-only demo.

## حدود معروفة · Known limits

- معرّف الرف لا يتغير بعد إنشائه؛ لتغييره احذف الرف وأعد إنشاءه · A rack ID cannot be renamed after creation.
- حرارة الدخل تُدخل يدوياً حتى ربط الحساسات · Inlet temperature is manual until sensors are connected.
- الشعارات (ITOC وICTD والجامعة) مضمَّنة داخل الصفحتين بصيغة PNG؛ لاستبدالها غيّر وسوم `<img>` في الترويسة · Logos are embedded as PNG data URIs in the header; edit the `<img>` tags to replace them.

## النشر التلقائي · Automatic deployment (GitHub Actions + clasp)

بعد الإعداد لمرة واحدة، أي `push` إلى `main` يغيّر ملفات `apps-script/` يحدّث مشروع Apps Script ونفس النشر تلقائياً، فيبقى رابط `/exec` ثابتاً. لا حاجة للنسخ واللصق أو لخطوة «New version» اليدوية.

After one-time setup, any push to `main` that changes `apps-script/` updates the Apps Script project and the same deployment; the `/exec` URL stays unchanged. No more copy-paste or manual "New version".

### إعداد لمرة واحدة · One-time setup

1. **Apps Script API:** افتح https://script.google.com/home/usersettings وفعّل *Google Apps Script API*.
2. **رفع المستودع:** أنشئ مستودعاً (مثل `ICTSRU/DC-Digital-Twin`) وارفع محتويات هذا المجلد، ثم فعّل GitHub Pages من الفرع `main` (الجذر).
3. **المعرّفات:** من Apps Script ← *Project Settings* انسخ **Script ID**. أما **Deployment ID** فهو الجزء الذي يبدأ بـ `AKfycb…` في رابط `/exec` (أو من *Manage deployments*).
4. **الاعتماد:** على جهازك نفّذ مرة واحدة:
   ```bash
   npm install -g @google/clasp@2
   clasp login            # سجّل بحساب @sr.edu.sa صاحب المشروع
   cat ~/.clasprc.json    # انسخ المحتوى كاملاً
   ```
5. **Secrets:** في GitHub ← *Settings → Secrets and variables → Actions* أضف ثلاثة أسرار:

| Secret | القيمة · Value |
| --- | --- |
| `SCRIPT_ID` | Script ID من الخطوة 3 |
| `DEPLOYMENT_ID` | `AKfycbxhXClSTVQZ-p8VyrjSbJoXZgB7oWIfd6mnRGX5ZfMyn9PkOfJcTdKjvX3pQ6dSI1HNcQ` |
| `CLASPRC_JSON` | محتوى `~/.clasprc.json` كاملاً |

6. **التشغيل:** ادفع أي تعديل على `apps-script/`، أو شغّل *Actions → Deploy Apps Script → Run workflow* للتجربة الأولى.

### ملاحظات · Notes
- ينفّذ المسار فحصاً قبل النشر (وجود الملفات، صحة `appsscript.json`، صحة بناء `Code.gs`) ويطبع رقم الإصدار.
- إذا انتهت صلاحية اعتماد clasp يفشل المسار برسالة مصادقة؛ أعد `clasp login` وحدّث السر `CLASPRC_JSON`.
- لا تضف `.clasprc.json` إلى المستودع (مستثنى في `.gitignore`).
- ما يُنشر تلقائياً هو `apps-script/` فقط؛ `index.html` في الجذر تنشره GitHub Pages.
