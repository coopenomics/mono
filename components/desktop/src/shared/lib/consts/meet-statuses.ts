import { Zeus } from '@coopenomics/sdk'
import { t } from 'src/shared/i18n';

// Описания расширенных статусов собрания
export const EXTENDED_STATUS_MAP: Record<Zeus.ExtendedMeetStatus, string> = {
  'NONE': t('meet.status.none'),
  'CREATED': t('meet.status.created'),
  'AUTHORIZED': t('meet.status.authorized'),
  'ONRESTART': t('meet.status.onrestart'),
  'PRECLOSED': t('meet.status.preclosed'),
  'CLOSED': t('meet.status.closed'),
  'WAITING_FOR_OPENING': t('meet.status.waitingForOpening'),
  'VOTING_IN_PROGRESS': t('meet.status.votingInProgress'),
  'EXPIRED_NO_QUORUM': t('meet.status.expiredNoQuorum'),
  'VOTING_COMPLETED': t('meet.status.votingCompleted')
}

// Описания базовых статусов собрания
export const BASIC_STATUS_MAP: Record<string, string> = {
  'created': t('meet.basicStatus.created'),
  'authorized': t('meet.basicStatus.authorized'),
  'preclosed': t('meet.basicStatus.preclosed'),
  'closed': t('meet.basicStatus.closed')
}

// Статусы, требующие специальной обработки времени
export const SPECIAL_STATUSES: Zeus.ExtendedMeetStatus[] = [
  Zeus.ExtendedMeetStatus.ONRESTART,
  Zeus.ExtendedMeetStatus.EXPIRED_NO_QUORUM,
  Zeus.ExtendedMeetStatus.CLOSED,
  Zeus.ExtendedMeetStatus.PRECLOSED,
  Zeus.ExtendedMeetStatus.CREATED
]
