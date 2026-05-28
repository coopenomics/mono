export interface BaseCheckboxProps {
  modelValue?: boolean | null;
  label?: string;
  disabled?: boolean;
  /** Стиль для длинных согласий: чекбокс выровнен по началу, label многострочный */
  block?: boolean;
  name?: string;
  id?: string;
}
