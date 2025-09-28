import { pool } from '../db/pool';
import { createEmbedding } from './llm/genai.client';

/**
 * Searches the vector database for the most relevant document chunks.
 * @param queryText The text to search for.
 * @param limit The maximum number of chunks to return.
 * @returns An array of document chunk objects, including their content and similarity score.
 */
export async function searchRelevantChunks(queryText: string, limit: number = 5): Promise<{ content: string, similarity: number }[]> {
  console.log(`[VectorService] Searching for chunks relevant to: "${queryText}"`);

  // 1. Create an embedding for the query text, specifying the query task type.
  const queryEmbedding = await createEmbedding(queryText, "RETRIEVAL_QUERY");

  // 2. Perform the vector similarity search using the cosine distance operator (<=>).
  // The operator returns the distance (0=identical, 2=opposite), so we subtract from 1 to get similarity (1=identical, -1=opposite).
  const searchResult = await pool.query(
    `SELECT content, 1 - (embedding <=> $1) as similarity
     FROM document_chunks
     ORDER BY similarity DESC
     LIMIT $2`,
    [`[${queryEmbedding.join(',')}]`, limit]
  );

  console.log(`[VectorService] Found ${searchResult.rowCount} relevant chunks.`);
  return searchResult.rows;
}
