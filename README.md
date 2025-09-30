# AI-Powered CV & Project Evaluation Service

This project is a backend service that uses AI to automatically evaluate candidate CVs and project reports against a given job description. It's built to be robust and scalable, using a background job queue to handle the intensive AI processing without blocking the API.

## Core Features

-   **Asynchronous by Design:** File uploads are processed by a background worker using a BullMQ job queue with Redis. This means the API stays fast and responsive, even under heavy load.
-   **Intelligent AI Evaluation (RAG):** Instead of just asking an LLM a generic question, the service uses a Retrieval-Augmented Generation (RAG) pipeline. It finds the most relevant parts of the job description and uses that specific context to guide the AI's evaluation, leading to much higher quality and more consistent results.
-   **Robust Error Handling:** The system is built to be resilient.
    -   It automatically retries failed Gemini API calls with an exponential backoff strategy.
    -   It validates inputs, gracefully handling empty files, incorrect file types, and malformed API requests.
    -   The core resilience logic is verified with an automated unit test suite.
-   **Containerized & Easy to Run:** The entire application stack (API, worker, database, Redis) is containerized with Docker, so you can get it up and running with a single command.

## Architecture

The application is broken down into four main services that run in separate Docker containers:

1.  **API Server (`api`):** A Node.js/Express server that exposes the REST API for uploading files and checking job statuses.
2.  **Background Worker (`worker`):** A separate Node.js process that listens for jobs from the queue and performs the actual AI evaluation and scoring.
3.  **Database (`db`):** A PostgreSQL database with the `pgvector` extension to store task data and the vector embeddings for the RAG pipeline.
4.  **Job Queue (`redis`):** A Redis instance that backs the BullMQ job queue, managing communication between the API server and the worker.

## API Endpoints

-   `POST /upload`
    -   Uploads a candidate's documents.
    -   **Form Fields:** `cv` (file), `project_report` (file)
    -   **Returns:** A task ID and `uploaded` status.

-   `POST /evaluate`
    -   Triggers the AI evaluation for a previously uploaded set of documents.
    -   **Body:** `{ "taskId": "task-id-from-upload-endpoint" }`
    -   **Returns:** A confirmation that the job has been `queued`.

-   `GET /result/:id`
    -   Checks the status and result of an evaluation job.
    -   **Returns:** The current job status (`processing`, `completed`, `failed`) and, upon completion, the full evaluation report.

## Testing

The project includes a suite of unit tests for its core error-handling and utility functions. To run the tests:

```bash
npm test
```
