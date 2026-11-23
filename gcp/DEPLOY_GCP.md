# คู่มือ Deploy 你好 Nihao ขึ้น Google Cloud Run

เว็บพร้อมรันบน **Google Cloud Run** แล้ว รองรับทั้ง **Vertex AI (ระดับ Enterprise / Billing องค์กร)** และ **Gemini API Key**

## วิธีที่ 1: Deploy ด้วยคำสั่งเดียว (ใช้ Vertex AI — แนะนำ)
```bash
# 1. ล็อกอินและตั้ง Project ID ของคุณ
gcloud auth login
gcloud config set project YOUR_PROJECT_ID

# 2. เปิด API ที่จำเป็น (ครั้งแรกครั้งเดียว)
gcloud services enable run.googleapis.com cloudbuild.googleapis.com aiplatform.googleapis.com

# 3. Deploy ขึ้น Cloud Run (สิงคโปร์ asia-southeast1 — เร็วสุดสำหรับไทย)
gcloud run deploy nihao-learning \
  --source . \
  --region asia-southeast1 \
  --allow-unauthenticated \
  --set-env-vars "GOOGLE_GENAI_USE_VERTEXAI=true,GOOGLE_CLOUD_PROJECT=YOUR_PROJECT_ID,GOOGLE_CLOUD_LOCATION=us-central1"
```

> หมายเหตุ: อย่าลืมให้สิทธิ์ **Vertex AI User (`roles/aiplatform.user`)** กับ Service Account ของ Cloud Run ใน IAM

## วิธีที่ 2: Deploy ด้วย Gemini API Key
```bash
gcloud run deploy nihao-learning \
  --source . \
  --region asia-southeast1 \
  --allow-unauthenticated \
  --set-env-vars "GEMINI_API_KEY=YOUR_API_KEY"
```

## วิธีที่ 3: Auto-Deploy จาก GitHub (Cloud Build Trigger)
- เชื่อม GitHub repo นี้ใน **Google Cloud Console → Cloud Build → Triggers**
- เลือกไฟล์คอนฟิก `cloudbuild.yaml` ที่มีอยู่แล้วในโปรเจกต์
- ทุกครั้งที่ `git push` ขึ้น `master` จะ build และ deploy ขึ้น Cloud Run อัตโนมัติ

## ทดสอบรันโหมด GCP บนเครื่อง
```bash
npm run build
npm run start:gcp
# เปิด http://localhost:8080/ และเช็กสุขภาพที่ http://localhost:8080/api/health
```
