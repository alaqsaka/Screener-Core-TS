import dotenv from 'dotenv';
dotenv.config({ path: './.env' });

import { pool } from '../db/pool';
import { splitText } from '../utils/text-splitter';
import { createEmbedding } from '../services/llm/genai.client';
import { jobDescription, rubricSchema, rubricWeights } from '../config';

const DOCUMENT_TYPE = 'job_briefing';
const CHUNK_SIZE = 1000;
const CHUNK_OVERLAP = 100;

async function main() {
  console.log('Starting indexing process...');
  const client = await pool.connect();

  try {
    // 1. Combine all source documents into a single text block
    const jobDescText = Array.isArray(jobDescription)
      ? jobDescription.map(j => j.text ?? '').join('\n')
      : String(jobDescription ?? '');
    
    const rubricText = `Scoring Rubric Schema: ${JSON.stringify(rubricSchema, null, 2)}\nRubric Weights: ${JSON.stringify(rubricWeights, null, 2)}`;
    const fullText = `Job Description:\n${jobDescText}\n\n---\n\n${rubricText}`;
    console.log(`Combined document text is ${fullText.length} characters long.`);

    // 2. Split the text into chunks
    const chunks = splitText(fullText, { chunkSize: CHUNK_SIZE, chunkOverlap: CHUNK_OVERLAP });
    console.log(`Document split into ${chunks.length} chunks.`);

    // 3. Clear old data and insert new data in a transaction
    await client.query('BEGIN');
    console.log(`Deleting existing chunks for document type: ${DOCUMENT_TYPE}`);
    await client.query('DELETE FROM document_chunks WHERE document_type = $1', [DOCUMENT_TYPE]);

    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      console.log(`Processing chunk ${i + 1} of ${chunks.length}...`);
      
      // 4. Create embedding for the chunk, specifying the task type
      const embedding = await createEmbedding(chunk, "RETRIEVAL_DOCUMENT");

      // 5. Insert chunk and embedding into the database, correctly formatting the vector
      await client.query(
        'INSERT INTO document_chunks (document_type, content, embedding) VALUES ($1, $2, $3)',
        [DOCUMENT_TYPE, chunk, `[${embedding.join(',')}]`]
      );
    }

    await client.query('COMMIT');
    console.log('Successfully indexed all chunks!');

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