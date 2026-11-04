export interface MenuSelectOption {
  value: string | number;
  label: string;
}

export interface MenuSelectButtonProps {
  /** Выбранное значение. */
  modelValue: string | number;
  /** Варианты меню по порядку. */
  options: MenuSelectOption[];
  /** Material-значок слева от подписи. */
  icon?: string;
}
