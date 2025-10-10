import dotenv from 'dotenv';
dotenv.config({ path: './.env' });

import { pool } from '../db/pool';
import { splitText } from '../utils/text-splitter';
import { createEmbedding } from '../services/llm/genai.client';
import { jobDescription, rubricSchema, rubricWeights, caseStudyBrief } from '../config';
import { PoolClient } from 'pg';

const CHUNK_SIZE = 1000;
const CHUNK_OVERLAP = 100;

async function indexDocument(client: PoolClient, documentType: string, text: string) {
  // 1. Split the text into chunks
  const chunks = splitText(text, { chunkSize: CHUNK_SIZE, chunkOverlap: CHUNK_OVERLAP });
  console.log(`Document ${documentType} split into ${chunks.length} chunks.`);

  // 2. Clear old data and insert new data
  console.log(`Deleting existing chunks for document type: ${documentType}`);
  await client.query('DELETE FROM document_chunks WHERE document_type = $1', [documentType]);

  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    console.log(`Processing chunk ${i + 1} of ${chunks.length} for ${documentType}...`);
    
    // 3. Create embedding for the chunk
    const embedding = await createEmbedding(chunk, "RETRIEVAL_DOCUMENT");

    // 4. Insert chunk and embedding into the database
    await client.query(
      'INSERT INTO document_chunks (document_type, content, embedding) VALUES ($1, $2, $3)',
      [documentType, chunk, `[${embedding.join(',')}]`]
    );
  }
  console.log(`Successfully indexed all chunks for ${documentType}!`);
}

async function main() {
  console.log('Starting indexing process...');
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Index Job Briefing
    const jobDescText = Array.isArray(jobDescription)
      ? jobDescription.map(j => j.text ?? '').join('\n')
      : String(jobDescription ?? '');
    const rubricText = `Scoring Rubric Schema: ${JSON.stringify(rubricSchema, null, 2)}Rubric Weights: ${JSON.stringify(rubricWeights, null, 2)}`;
    const jobBriefingText = `Job Description:\n${jobDescText}\n\n---\n\n${rubricText}`;
    await indexDocument(client, 'job_briefing', jobBriefingText);

    // Index Case Study Brief
    await indexDocument(client, 'case_study_brief', caseStudyBrief);

    await client.query('COMMIT');
    console.log('Successfully indexed all documents!');

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('An error occurred during indexing:', err);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch(err => {
  console.error('Failed to complete indexing script.', err);
  process.exit(1);
});