export interface BaseFormProps {
  /** Состояние «занято» — блокирует submit и применяется к кнопкам */
  loading?: boolean;
  /** Текст сводной ошибки (не привязанной к полю) */
  error?: string;
}
