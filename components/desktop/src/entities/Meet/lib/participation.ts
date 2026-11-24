import type { IMeet } from '../types';
import { getNameFromCertificate } from 'src/shared/lib/utils/getNameFromCertificate';

/**
 * Право пайщика на общем собрании (компонент 76 «Общее собрание уполномоченных»).
 *
 * Признаки считает контроллер по форме собрания из цепи — рабочий стол их только
 * читает. Без признаков (запрос без входа, старый ответ) экран ведёт себя как до
 * появления формы собрания: бюллетень и подтверждение уведомления доступны.
 */
type Participation = NonNullable<NonNullable<IMeet['processing']>['participation']>;

export function meetParticipation(meet: IMeet | null | undefined): Participation | null {
  return meet?.processing?.participation ?? null;
}

/** Показывать ли подтверждение получения уведомления. */
export function canSignNotification(meet: IMeet | null | undefined): boolean {
  return meetParticipation(meet)?.canNotify ?? true;
}

/**
 * Пояснение пайщику без права голоса вместо бюллетеня: ключ перевода и параметры.
 * Пусто — пайщик голосует, страница показывает бюллетень.
 * Участок уже проголосовал — об этом; иначе — кто голосует за участок.
 */
export function noVoteMessage(meet: IMeet | null | undefined): { key: string; params: Record<string, string> } | null {
  const value = meetParticipation(meet);
  if (!value || value.canVote) return null;
  if (value.branchVoted) return { key: 'meet.meetDetailsVoting.branchVoted', params: {} };
  const name = getNameFromCertificate(value.branchTrusteeCertificate as never) || value.branchTrustee;
  return name
    ? { key: 'meet.meetDetailsVoting.trusteeVotes', params: { name } }
    : { key: 'meet.meetDetailsVoting.noBranchTrustee', params: {} };
}
