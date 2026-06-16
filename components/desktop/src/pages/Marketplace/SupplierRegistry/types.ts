import type { BaseBadgeVariant } from 'src/shared/ui/base/BaseBadge';

export const SUPPLIER_STATUS_LABEL: Record<string, string> = {
  PENDING: 'На рассмотрении',
  APPROVED: 'Одобрен',
  REJECTED: 'Отклонён',
};

export const SUPPLIER_STATUS_VARIANT: Record<string, BaseBadgeVariant> = {
  PENDING: 'warn',
  APPROVED: 'pos',
  REJECTED: 'neg',
};

export const SUPPLIER_MODEL_LABEL: Record<string, string> = {
  MEMBERSHIP: 'Членская',
  SHARE: 'Боевая',
};
