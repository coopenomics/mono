export interface BaseRadioCardProps {
  /** Текущее значение группы (модель selected) */
  modelValue?: string | number | null;
  /** Значение, представляемое этой карточкой */
  value: string | number;
  /** Заголовок карточки */
  title?: string;
  /** Подзаголовок / описание */
  description?: string;
  /** Дополнительный акцент (например, requirements) — выводится primary-цветом */
  meta?: string;
  /** Имя группы для нативного radio (не обязательно при v-model) */
  name?: string;
  disabled?: boolean;
}
