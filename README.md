# Asynchronous Job Evaluation API
This backend evaluates a candidate’s CV and project report asynchronously. It queues a job, runs an LLM-driven pipeline in a worker, and exposes a result endpoint.

## Core Features
- Asynchronous job processing (BullMQ + Redis).
- File upload + text extraction (pdf-parse, mammoth).
- LLM chaining (Gemini via @google/genai): extract → score CV → evaluate project → refine.
- Aggregation with rubric weights (cv_match_rate 0–100, project_score 0–10).
- Validation (Ajv) and retries/backoff with jitter.

## End-to-End Process Flow
1. Upload Files: POST /upload with cv and/or project_report.
2. Task Creation: server stores files, extracts text, creates task, returns taskId.
3. Start Evaluation: client calls POST /evaluate with only taskId. The worker loads Job Description and Rubric from src/config.
4. Queueing: API enqueues the job and returns jobId.
5. Worker Processing: extracts → scores CV → evaluates project → refines summary, computes aggregates, persists results.
6. Result Retrieval: GET /result/:taskId returns status or final result.

## API Endpoints
### Health
GET /health
- 200: { "ok": true, "message": "hello world!" }

### 1) Upload Documents
POST /upload (multipart/form-data)
- Fields: cv, project_report (pdf/docx/txt)
- 201 example:
{
  "id": "task-uuid",
  "status": "uploaded",
  "files": [{ "role": "cv", "filename": "...", "mimetype": "application/pdf" }]
}

### 2) Start Evaluation
POST /evaluate (application/json)
- Body:
{
  "taskId": "REPLACE_WITH_TASK_ID"
}
- 200:
{ "id": "bullmq-job-id", "status": "queued" }

### 3) Get Evaluation Result
GET /result/:taskId
- Pending:
{ "id": "task-uuid", "status": "queued" }
- Completed:
{
  "id": "task-uuid",
  "status": "completed",
  "result": {
    "cv_match_rate": 85.5,
    "cv_feedback": "...",
    "project_score": 9.2,
    "project_feedback": "...",
    "overall_summary": "..."
  }
}

## Configuration
- Job Description: src/config/job_description.json
- Rubric schema (requested output fields): src/config/rubric.schema.json
- Rubric weights for aggregation: rubric.json

## Running Locally (macOS)
- Start infra (Postgres, Redis) as per your local setup.
- Install deps: npm install
- Run API: npm run dev
- Run worker (separate terminal): npm run worker

## Status and Next Steps
- Implemented: upload, queue, worker pipeline, LLM prompts + orchestration, Ajv validation, backoff, scoring, local JD/rubric config.
- Pending: Vector DB & RAG (retrieve top-K contexts), job progress updates, tests (unit/integration), CI workflow, README polishing for deployment.