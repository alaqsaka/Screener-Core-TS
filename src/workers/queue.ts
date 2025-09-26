// src/workers/queue.ts
import dotenv from 'dotenv';
dotenv.config({ path: './.env' });

import { Queue } from 'bullmq';
import IORedis from 'ioredis';

export const connection = new IORedis(process.env.REDIS_URL || 'redis://localhost:6379', {
  maxRetriesPerRequest: null
});

export const evaluationQueue = new Queue('evaluation', { connection });