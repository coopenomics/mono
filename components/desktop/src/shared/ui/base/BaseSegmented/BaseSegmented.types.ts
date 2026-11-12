export interface BaseSegmentedOption {
  value: string | number;
  label: string;
}

export interface BaseSegmentedProps {
  /** Выбранное значение. */
  modelValue?: string | number | null;
  /** Варианты — равноправные, в одну дорожку. */
  options: BaseSegmentedOption[];
  /** Подпись группы для экранного диктора, если видимой подписи рядом нет. */
  ariaLabel?: string;
  /** Номер элемента с видимой подписью группы. */
  ariaLabelledby?: string;
  disabled?: boolean;
}
