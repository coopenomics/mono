export type DataRowAlign = 'horizontal' | 'vertical';

export interface DataRowProps {
  label: string;
  value?: string | number | null;
  copyable?: boolean;
  mono?: boolean;
  align?: DataRowAlign;
  hint?: string;
}
