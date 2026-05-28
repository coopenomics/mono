export type DocumentType = 'docx' | 'pdf' | 'html' | 'txt' | 'image';
export type DocumentStatus = 'draft' | 'signed' | 'rejected' | 'pending';

export interface DocumentRowDoc {
  id?: string;
  type: DocumentType;
  title: string;
  status?: DocumentStatus;
  date?: string;
  author?: string;
  description?: string;
}

export interface DocumentRowProps {
  document: DocumentRowDoc;
  clickable?: boolean;
}
