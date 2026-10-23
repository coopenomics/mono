import { Zeus } from '@coopenomics/sdk';
import type { IGroup } from '../../entities/Group';
import { t } from '../../i18n';

/** Состояние группы словами: набор открыт, идёт, завершена, отменена. */
export function groupStateOf(g: IGroup): { label: string; variant: 'pos' | 'neutral' | 'warn' } {
  if (g.status === Zeus.EduGroupStatus.CLOSED) return { label: t('edubridge.courseGroups.state.closed'), variant: 'neutral' };
  if (g.status === Zeus.EduGroupStatus.CANCELLED) return { label: t('edubridge.courseGroups.state.cancelled'), variant: 'neutral' };
  return g.enrollment_open ? { label: t('edubridge.courseGroups.state.enrolling'), variant: 'pos' } : { label: t('edubridge.courseGroups.state.running'), variant: 'warn' };
}
