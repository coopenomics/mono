export type DocumentPreviewType = 'html' | 'pdf' | 'docx';

export interface DocumentPreviewDoc {
  type: DocumentPreviewType;
  url?: string;
  html?: string;
}

export interface DocumentPreviewProps {
  document: DocumentPreviewDoc;
  loading?: boolean;
  error?: string;
  height?: string | number;
  sanitize?: boolean;
}
