/** Файл, подготовленный к загрузке через GraphQL: содержимое и его отпечаток. */
export interface FileUploadPayload {
  content_base64: string;
  mime_type: string;
  size_bytes: number;
  checksum_sha256: string;
  original_filename: string;
}

/**
 * Готовит файл к загрузке: base64 без data-URL префикса плюс SHA-256, по
 * которому сервер убеждается, что содержимое доехало целым. Тот же набор полей
 * ждут все загрузки контура — чеки об оплате, файлы расходов, снимки сверки
 * личности.
 */
export async function readFileForUpload(file: File): Promise<FileUploadPayload> {
  const buffer = await file.arrayBuffer();
  return {
    content_base64: toBase64(buffer),
    mime_type: file.type,
    size_bytes: file.size,
    checksum_sha256: await sha256Hex(buffer),
    original_filename: file.name,
  };
}

async function sha256Hex(buffer: ArrayBuffer): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', buffer);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function toBase64(buffer: ArrayBuffer): string {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < bytes.length; i += 1) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}
