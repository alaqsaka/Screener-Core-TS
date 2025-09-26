import dotenv from 'dotenv';
dotenv.config({ path: './.env' });

import request from 'supertest';
import app from '../src/app';

describe('health', () => {
  it('returns ok', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });
});