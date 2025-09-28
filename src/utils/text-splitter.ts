export interface TextSplitterOptions {
  chunkSize: number;
  chunkOverlap: number;
}

/**
 * Splits a long text into smaller, overlapping chunks.
 * @param text The input text to split.
 * @param options Configuration for chunk size and overlap.
 * @returns An array of text chunks.
 */
export function splitText(text: string, options: TextSplitterOptions): string[] {
  const { chunkSize, chunkOverlap } = options;
  if (chunkOverlap >= chunkSize) {
    throw new Error('chunkOverlap must be smaller than chunkSize.');
  }

  const chunks: string[] = [];
  let i = 0;
  while (i < text.length) {
    const end = i + chunkSize;
    chunks.push(text.slice(i, end));
    i += chunkSize - chunkOverlap;
  }

  return chunks;
}
