// Типы вынесены из SFC: tsc не читает содержимое .vue, и реэкспорт типа из index.ts ломается.

export interface InlineSelectMenuOption {
  value: string;
  label: string;
  icon: string;
  iconColor: string;
  iconSize?: string;
}
