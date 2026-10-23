/**
 * horizontal — подпись и значение колонками (в узкой карточке складываются столбиком);
 * vertical — значение всегда под подписью;
 * spread — подпись слева, значение прижато к правому краю и стоит в одну строку:
 * для коротких значений (числа, суммы, сроки) в боковых карточках.
 */
export type DataRowAlign = 'horizontal' | 'vertical' | 'spread';

export interface DataRowProps {
  label: string;
  value?: string | number | null;
  copyable?: boolean;
  mono?: boolean;
  align?: DataRowAlign;
  hint?: string;
}
