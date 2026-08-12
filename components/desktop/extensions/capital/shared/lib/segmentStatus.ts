import { Zeus } from '@coopenomics/sdk';

/**
 * Получение текста статуса сегмента
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export const getSegmentStatusLabel = (status: string, isCompleted = false, segment?: any) => {
  // Если сегмент завершен, показываем специальный статус
  if (isCompleted) {
    return 'Сегмент получен';
  }
  switch (status) {
    case Zeus.SegmentStatus.GENERATION:
      return 'Стоимость доли уточняется по мере учёта работ по компоненту';
    case Zeus.SegmentStatus.READY:
      return 'Можно вносить результат интеллектуальной деятельности';
    case Zeus.SegmentStatus.STATEMENT:
      return 'Заявление на предварительном рассмотрении председателя';
    case Zeus.SegmentStatus.APPROVED:
      return 'Одобрено председателем, ожидается решение совета о приёме';
    case Zeus.SegmentStatus.AUTHORIZED:
      return 'Получено решение совета, ожидаем подпись пайщика на акте приёма-передачи доли в объекте авторских прав';
    case Zeus.SegmentStatus.ACT1:
      return 'Акт приёма-передачи подписан пайщиком, ожидаем подпись председателя';
    case Zeus.SegmentStatus.CONTRIBUTED:
      return 'Результат интеллектуальной деятельности принят';
    case Zeus.SegmentStatus.FINALIZED:
      return 'Доля в объекте авторских прав получена';
    default:
      return 'Неизвестный статус';
  }
};

/**
 * Короткая подпись статуса — для бейджа в строке списка
 */
export const getSegmentShortStatus = (segment: {
  status: string;
  is_completed?: boolean;
}): string => {
  if (segment.is_completed) return 'Получен';
  switch (segment.status) {
    case Zeus.SegmentStatus.GENERATION:
      return 'Стоимость уточняется';
    case Zeus.SegmentStatus.READY:
      return 'Можно вносить';
    case Zeus.SegmentStatus.STATEMENT:
      return 'У председателя';
    case Zeus.SegmentStatus.APPROVED:
      return 'У совета';
    case Zeus.SegmentStatus.AUTHORIZED:
      return 'Ждёт подписи пайщика';
    case Zeus.SegmentStatus.ACT1:
      return 'Ждёт председателя';
    case Zeus.SegmentStatus.CONTRIBUTED:
      return 'Принят';
    case Zeus.SegmentStatus.FINALIZED:
      return 'Завершён';
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

/** Что показывает бейдж строки: одно состояние, а не набор пометок */
export interface SegmentBadge {
  label: string;
  variant: 'pos' | 'info' | 'warn' | 'neutral';
  hint: string;
}

const OWNER_ACTION_BADGE: Record<
  Exclude<SegmentOwnerAction, 'none'>,
  { label: string; hint: string }
> = {
  vote: {
    label: 'Требуется голос',
    hint: 'Распределите голосующую сумму между остальными участниками компонента',
  },
  push_result: {
    label: 'Внести результат',
    hint: 'Подайте заявление о внесении результата интеллектуальной деятельности',
  },
  sign_act: {
    label: 'Нужна подпись',
    hint: 'Совет принял решение — подпишите акт приёма-передачи доли',
  },
  receive: {
    label: 'Можно получить',
    hint: 'Результат принят — получите долю в объекте авторских прав',
  },
};

/**
 * Бейдж строки: когда ход за пайщиком, показывается требуемое действие, иначе —
 * состояние процесса. Две пометки рядом («стоимость уточняется» и «требуется
 * голос») пайщику ничего не добавляют: ему нужно знать одно — его ход или нет.
 */
export const getSegmentBadge = (
  segment: Parameters<typeof getSegmentOwnerAction>[0] & { is_completed?: boolean },
  isOwn = true,
): SegmentBadge => {
  const action = isOwn ? getSegmentOwnerAction(segment) : 'none';

  if (action !== 'none') {
    const badge = OWNER_ACTION_BADGE[action];
    return { label: badge.label, variant: 'warn', hint: badge.hint };
  }

  return {
    label: getSegmentShortStatus(segment),
    variant: getSegmentStatusVariant(segment),
    hint: getSegmentStatusLabel(segment.status, segment.is_completed),
  };
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
