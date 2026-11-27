# คู่มือ Deploy 你好 Nihao ขึ้น Google Cloud Run (Full GCP Suite)

เว็บพร้อมรันบน **Google Cloud Run** และเชื่อมต่อบริการ Google Cloud ครบชุดแล้ว:
- **Vertex AI (Gemini 2.5 Flash)** — ครู AI, บทสนทนา, นิทาน, ตรวจลายมือ
- **Vertex AI (Imagen 3)** — เจนภาพประกอบคำศัพท์ & ปกนิทาน (`/api/ai/imagen`, `/api/ai/story`)
- **Cloud TTS (Chirp 3: HD Voices)** — เสียงจีน/ไทยระดับ HD (`/api/tts`)
- **Cloud Speech-to-Text V2 (Chirp 2)** — ถอดเสียงพูดจีนแม่นยำ + word confidence (`/api/ai/stt`)
- **Cloud Vision API (OCR)** — อ่านป้าย/เมนู/ลายมือจีนเสริม Gemini (`/api/ai/vision`)
- **Cloud Translation API v3** — แปลคำศัพท์เร็วและประหยัด (`/api/ai/translate`)
- **Cloud Storage (GCS)** — แคชไฟล์เสียง TTS และรูป Imagen 3 ไม่ให้เสียเครดิตซ้ำ
- **Cloud Firestore** — เก็บความคืบหน้า, ตารางคะแนน League, Boss Raid
- **Cloud Scheduler** — รีเซ็ตตารางคะแนนรายสัปดาห์ + บอสใหม่อัตโนมัติ (`/api/cron/weekly-reset`)

---

## วิธี Deploy แบบครบชุด (Copy-Paste ทีเดียวจบ)

```bash
# 1. ล็อกอินและตั้ง Project ID
gcloud auth login
export PROJECT_ID="YOUR_PROJECT_ID"
gcloud config set project $PROJECT_ID

# 2. เปิด Google Cloud APIs ทั้งหมดที่ใช้งาน (ครั้งแรกครั้งเดียว)
gcloud services enable \
  run.googleapis.com \
  cloudbuild.googleapis.com \
  aiplatform.googleapis.com \
  texttospeech.googleapis.com \
  speech.googleapis.com \
  vision.googleapis.com \
  translate.googleapis.com \
  storage.googleapis.com \
  firestore.googleapis.com \
  secretmanager.googleapis.com \
  cloudscheduler.googleapis.com

# 3. สร้าง GCS Bucket สำหรับแคชเสียง TTS + รูป Imagen 3 (ประหยัดเครดิต!)
gcloud storage buckets create gs://${PROJECT_ID}-nihao-cache \
  --location=asia-southeast1 \
  --uniform-bucket-level-access

# 4. Deploy ขึ้น Cloud Run (สิงคโปร์ asia-southeast1 — Scale to Zero ประหยัดงบ)
gcloud run deploy nihao-learning \
  --source . \
  --region asia-southeast1 \
  --allow-unauthenticated \
  --min-instances=0 \
  --max-instances=5 \
  --set-env-vars "GOOGLE_GENAI_USE_VERTEXAI=true,GOOGLE_CLOUD_PROJECT=${PROJECT_ID},GOOGLE_CLOUD_LOCATION=us-central1,GCS_CACHE_BUCKET=${PROJECT_ID}-nihao-cache"
```

> **หมายเหตุ IAM:** ให้สิทธิ์ **Vertex AI User (`roles/aiplatform.user`)**, **Storage Object Admin (`roles/storage.objectAdmin`)**, และ **Cloud Datastore User (`roles/datastore.user`)** กับ Service Account ของ Cloud Run

---

## ตั้ง Cloud Scheduler รีเซ็ต League & Boss Raid ทุกวันจันทร์

```bash
SERVICE_URL=$(gcloud run services describe nihao-learning --region asia-southeast1 --format='value(status.url)')

gcloud scheduler jobs create http nihao-weekly-reset \
  --location=asia-southeast1 \
  --schedule="0 0 * * 1" \
  --time-zone="Asia/Bangkok" \
  --uri="${SERVICE_URL}/api/cron/weekly-reset" \
  --http-method=POST
```

---

## วิธีทดสอบบนเครื่อง
```bash
npm run build
npm run start:gcp
# เช็กสุขภาพที่ http://localhost:8080/api/health
# เช็กสถานะบริการ GCP ทั้งหมดที่ http://localhost:8080/api/gcp/capabilities
```

## ทริคคุมงบเครดิตฟรี
1. ตั้ง **Billing Budget Alert** ใน Google Cloud Console → Billing → Budgets & alerts (เตือนที่ 50%, 80%, 100%)
2. ระบบแคชเสียง TTS และรูป Imagen 3 ลง `gs://${PROJECT_ID}-nihao-cache` อัตโนมัติ ทำให้ไม่เสียเครดิตเจนซ้ำ
3. `--min-instances=0` ทำให้ตอนไม่มีคนใช้งานไม่เสียค่าเครื่องเลย

---

## (เสริม) เปิด BigQuery Analytics + Cloud Armor กันบอท
```bash
# สร้าง BigQuery Dataset & Table สำหรับวิเคราะห์การเรียน (ส่งเข้า Looker Studio ได้ฟรี)
bq mk --location=asia-southeast1 ${PROJECT_ID}:nihao_analytics
bq mk --table ${PROJECT_ID}:nihao_analytics.learning_events ts:TIMESTAMP,userId:STRING,eventType:STRING,detail:STRING,score:FLOAT

# สร้าง Cloud Armor Rate-Limit Policy (กันบอทยิง API ผลาญเครดิต: 120 req/min ต่อ IP)
gcloud compute security-policies create nihao-rate-limit --description="Protect Nihao AI APIs"
gcloud compute security-policies rules create 1000 \
  --security-policy=nihao-rate-limit \
  --src-ip-ranges="*" \
  --action=throttle \
  --rate-limit-threshold-count=120 \
  --rate-limit-threshold-interval-sec=60 \
  --conform-action=allow \
  --exceed-action=deny-429 \
  --enforce-on-key=IP
```
