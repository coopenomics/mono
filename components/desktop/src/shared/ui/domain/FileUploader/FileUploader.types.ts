export type FileUploaderError =
  | { code: 'accept'; file: File; message: string }
  | { code: 'max-size'; file: File; message: string }
  | { code: 'max-files'; message: string };

export interface FileUploaderProps {
  /** Один файл или массив (если `multiple`) */
  modelValue?: File | File[] | null;
  /** Принимаемые типы (MIME или `.ext`), через запятую */
  accept?: string;
  /** Разрешить выбор нескольких файлов */
  multiple?: boolean;
  /** Максимальный размер файла в байтах */
  maxSize?: number;
  /** Максимальное число файлов в `multiple` режиме */
  maxFiles?: number;
  /** Заголовок в зоне drop */
  title?: string;
  /** Подсказка под заголовком */
  hint?: string;
  /** Отключить выбор */
  disabled?: boolean;
}
