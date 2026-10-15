import type { BaseBadgeVariant } from 'src/shared/ui/base/BaseBadge';
import { t } from 'src/shared/i18n';

export const SUPPLIER_STATUS_LABEL: Record<string, string> = {
  PENDING: t('marketplace.supplierStatus.pending'),
  APPROVED: t('marketplace.supplierStatus.approved'),
  REJECTED: t('marketplace.supplierStatus.rejected'),
};

export const SUPPLIER_STATUS_VARIANT: Record<string, BaseBadgeVariant> = {
  PENDING: 'warn',
  APPROVED: 'pos',
  REJECTED: 'neg',
};

export const SUPPLIER_MODEL_LABEL: Record<string, string> = {
  MEMBERSHIP: t('marketplace.supplierStatus.membership'),
  SHARE: t('marketplace.supplierStatus.share'),
};
