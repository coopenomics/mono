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
  /**
   * `strict` — обычный текст. `document` — документ со своей вёрсткой:
   * сохраняются `<style>`, таблицы и выравнивание. Показа без очистки нет:
   * html документа собран из данных пайщика.
   */
  profile?: 'strict' | 'document';
}
