export interface BaseSelectOption {
  value: string | number;
  label: string;
  disabled?: boolean;
}

export interface BaseSelectProps {
  modelValue?: string | number | null;
  options: BaseSelectOption[];
  label?: string;
  placeholder?: string;
  hint?: string;
  error?: string;
  disabled?: boolean;
  required?: boolean;
  name?: string;
  id?: string;
}
