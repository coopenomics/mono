import { Zeus } from '@coopenomics/sdk';
import { t } from '../../i18n';

/**
 * Получение текста статуса сегмента
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export const getSegmentStatusLabel = (status: string, isCompleted = false, segment?: any) => {
  // Если сегмент завершен, показываем специальный статус
  if (isCompleted) {
    return t('capital.segment.status.completed');
  }
  switch (status) {
    case Zeus.SegmentStatus.GENERATION:
      return t('capital.segment.status.generation');
    case Zeus.SegmentStatus.READY:
      return t('capital.segment.status.ready');
    case Zeus.SegmentStatus.STATEMENT:
      return t('capital.segment.status.statement');
    case Zeus.SegmentStatus.APPROVED:
      return t('capital.segment.status.approved');
    case Zeus.SegmentStatus.AUTHORIZED:
      return t('capital.segment.status.authorized');
    case Zeus.SegmentStatus.ACT1:
      return t('capital.segment.status.act1');
    case Zeus.SegmentStatus.CONTRIBUTED:
      return t('capital.segment.status.contributed');
    case Zeus.SegmentStatus.FINALIZED:
      return t('capital.segment.status.finalized');
    default:
      return t('capital.segment.status.unknown');
  }
};

/**
 * Короткая подпись статуса — для бейджа в строке списка.
 *
 * Единственный источник подписей: и стол «Результаты», и список участников
 * компонента показывают одну и ту же долю, и расхождение в словах читается как
 * расхождение в состоянии.
 */
export const getSegmentShortStatus = (segment: {
  status: string;
  is_completed?: boolean;
}): string => {
  if (segment.is_completed) return t('capital.segment.statusShort.completed');
  switch (segment.status) {
    case Zeus.SegmentStatus.GENERATION:
      return t('capital.segment.statusShort.generation');
    case Zeus.SegmentStatus.READY:
      return t('capital.segment.statusShort.ready');
    case Zeus.SegmentStatus.STATEMENT:
      return t('capital.segment.statusShort.statement');
    case Zeus.SegmentStatus.APPROVED:
      return t('capital.segment.statusShort.approved');
    case Zeus.SegmentStatus.AUTHORIZED:
      return t('capital.segment.statusShort.authorized');
    case Zeus.SegmentStatus.ACT1:
      return t('capital.segment.statusShort.act1');
    case Zeus.SegmentStatus.CONTRIBUTED:
      return t('capital.segment.statusShort.contributed');
    case Zeus.SegmentStatus.FINALIZED:
      return t('capital.segment.statusShort.finalized');
    default:
      return getSegmentStatusLabel(segment.status, segment.is_completed);
  }
};

/**
 * Вариант бейджа под статус доли
 */
export const getSegmentStatusVariant = (segment: {
  status: string;
  is_completed?: boolean;
}): 'pos' | 'info' | 'warn' | 'neutral' => {
  if (segment.is_completed) return 'pos';
  switch (segment.status) {
    case Zeus.SegmentStatus.GENERATION:
      return 'warn';
    case Zeus.SegmentStatus.READY:
    case Zeus.SegmentStatus.STATEMENT:
    case Zeus.SegmentStatus.APPROVED:
    case Zeus.SegmentStatus.AUTHORIZED:
    case Zeus.SegmentStatus.ACT1:
      return 'info';
    case Zeus.SegmentStatus.CONTRIBUTED:
    case Zeus.SegmentStatus.FINALIZED:
      return 'pos';
    default:
      return 'neutral';
  }
};

/** Что требуется от пайщика по его собственной доле прямо сейчас */
export type SegmentOwnerAction = 'vote' | 'push_result' | 'sign_act' | 'receive' | 'none';

/**
 * Действие, которого доля ждёт от своего владельца.
 *
 * Порядок разбора повторяет ход процесса: сначала голосование (пока проект на
 * голосовании, доля ещё не рассчитана), затем внесение результата, подпись акта
 * и получение доли. Пункты, где ход за председателем или советом
 * (`statement`, `approved`, `act1`), для пайщика — ожидание, а не действие.
 */
type SegmentActionSource = {
  status: string;
  is_completed?: boolean;
  has_vote?: boolean;
  has_voted?: boolean;
  voting_completed?: boolean;
  is_votes_calculated?: boolean;
  project_status?: string | null;
};

/**
 * Голос участника ещё ждут.
 *
 * Голосование бывает закрыто и без записи о голосе: когда распределять не между
 * кем, цепь засчитывает голоса сразу. Звать голосовать в таком компоненте
 * некуда — форма распределения там пустая.
 */
const isVoteRequired = (segment: SegmentActionSource): boolean =>
  segment.project_status === Zeus.ProjectStatus.VOTING &&
  !!segment.has_vote &&
  !segment.has_voted &&
  !segment.voting_completed;

export const getSegmentOwnerAction = (segment: SegmentActionSource): SegmentOwnerAction => {
  if (segment.is_completed) return 'none';
  if (isVoteRequired(segment)) return 'vote';

  switch (segment.status) {
    case Zeus.SegmentStatus.READY:
      // Пока голоса участника не разнесены по долям, вносить результат рано
      return segment.has_vote && segment.is_votes_calculated === false
        ? 'none'
        : 'push_result';
    case Zeus.SegmentStatus.AUTHORIZED:
      return 'sign_act';
    case Zeus.SegmentStatus.CONTRIBUTED:
      return 'receive';
    default:
      return 'none';
  }
};

/**
 * Доля проходит приёмку: работа по компоненту закончена, а доля ещё не получена.
 *
 * Пока компонент в работе, доля пересчитывается на каждый коммит и от пайщика
 * ничего не ждут — на вкладке «На приёмке» такой строке делать нечего. Отсчёт
 * идёт от статуса проекта: приёмка начинается голосованием. Собственный статус
 * доли учитывается на случай, когда заявление уже подано.
 */
export const isSegmentOnAcceptance = (segment: {
  status: string;
  is_completed?: boolean;
  project_status?: string | null;
}): boolean => {
  if (segment.is_completed) return false;
  if (
    segment.status === Zeus.SegmentStatus.FINALIZED ||
    segment.status === Zeus.SegmentStatus.SKIPPED
  ) {
    return false;
  }

  const acceptanceStarted =
    segment.project_status === Zeus.ProjectStatus.VOTING ||
    segment.project_status === Zeus.ProjectStatus.RESULT ||
    segment.project_status === Zeus.ProjectStatus.FINALIZED;

  return acceptanceStarted || segment.status !== Zeus.SegmentStatus.GENERATION;
};

/**
 * Проверка, является ли сегмент чистым инвестором
 * Чистый инвестор - участник только с ролью инвестора, без других ролей
 */
export const isPureInvestor = (segment: any): boolean => {
  return segment.is_investor &&
         !segment.is_creator &&
         !segment.is_author &&
         !segment.is_coordinator &&
         !segment.is_propertor &&
         segment.is_contributor;
};
