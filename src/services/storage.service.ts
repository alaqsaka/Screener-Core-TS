import { supabase } from './supabase/client';

export async function uploadBuffer(
  bucket: string,
  prefix: string,
  original: string,
  buffer: Buffer,
  contentType: string
) {
  console.log('uploadBuffer', { bucket, prefix, original, contentType });
  const key = `${prefix}/${Date.now()}-${original}`;
  const { error } = await supabase.storage.from(bucket).upload(key, buffer, {
    contentType,
    upsert: false
  });
  if (error) throw error;
  return key;
}