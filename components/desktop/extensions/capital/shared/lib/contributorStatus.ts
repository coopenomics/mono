import { Zeus } from '@coopenomics/sdk';
import { t } from '../../i18n';

/**
 * Получение цвета статуса участника
 */
export const getContributorStatusColor = (status: string) => {
  switch (status) {
    case Zeus.ContributorStatus.ACTIVE:
      return 'positive';
    case Zeus.ContributorStatus.APPROVED:
      return 'blue';
    case Zeus.ContributorStatus.PENDING:
      return 'orange';
    case Zeus.ContributorStatus.INACTIVE:
      return 'warning';
    case Zeus.ContributorStatus.UNDEFINED:
      return 'grey';
    case Zeus.ContributorStatus.IMPORT:
      return 'orange';
    default:
    return 'grey';
  }
};

/**
 * Получение текста статуса участника
 */
export const getContributorStatusLabel = (status: string) => {
  switch (status) {
    case Zeus.ContributorStatus.IMPORT:
      return t('capital.contributor.status.import');
    case Zeus.ContributorStatus.ACTIVE:
      return t('capital.contributor.status.active');
    case Zeus.ContributorStatus.APPROVED:
      return t('capital.contributor.status.approved');
    case Zeus.ContributorStatus.PENDING:
      return t('capital.contributor.status.pending');
    case Zeus.ContributorStatus.INACTIVE:
      return t('capital.contributor.status.inactive');
    case Zeus.ContributorStatus.UNDEFINED:
      return t('capital.contributor.status.undefined');
    default:
      return status;
  }
};

/**
 * Получение иконки статуса участника для отображения в виде кругляшка
 */
export const getContributorStatusIcon = (status: string) => {
  switch (status) {
    case Zeus.ContributorStatus.PENDING:
    case 'pending':
      return 'fa-solid fa-pause';
    case Zeus.ContributorStatus.ACTIVE:
    case 'active':
      return 'fa-solid fa-play';
    case Zeus.ContributorStatus.APPROVED:
      return 'fa-solid fa-check';
    case Zeus.ContributorStatus.INACTIVE:
      return 'fa-solid fa-pause-circle';
    case Zeus.ContributorStatus.UNDEFINED:
    case 'cancelled':
    default:
      return 'fa-regular fa-circle';
  }
};

/**
 * Получение цвета кругляшка статуса участника
 */
export const getContributorStatusDotColor = (status: string) => {
  switch (status) {
    case Zeus.ContributorStatus.ACTIVE:
      return 'green';
    case Zeus.ContributorStatus.APPROVED:
      return 'blue';
    case Zeus.ContributorStatus.PENDING:
      return 'orange';
    case Zeus.ContributorStatus.INACTIVE:
      return 'yellow';
    case Zeus.ContributorStatus.UNDEFINED:
    default:
      return 'grey';
  }
};
