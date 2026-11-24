import { describe, expect, it } from 'vitest';

/**
 * Страница общего собрания по праву пайщика (компонент 76, задача A86-3).
 *
 * Признаки считает контроллер; рабочий стол по ним решает, показывать ли
 * бюллетень и подтверждение уведомления, и что сказать пайщику без голоса.
 */
const { canSignNotification, noVoteMessage } = await import('src/entities/Meet/lib/participation');

const meetWith = (participation: Record<string, unknown> | null) => ({ processing: { participation } }) as never;

const base = {
  isTrusteesMeet: true,
  canVote: false,
  canNotify: false,
  branchVoted: false,
  branchTrustee: null,
  branchTrusteeCertificate: null,
};

describe('meet.form.ui — страница собрания по праву пайщика', () => {
  it('собрание пайщиков: бюллетень и подтверждение у всех, пояснения нет', () => {
    const meet = meetWith({ ...base, isTrusteesMeet: false, canVote: true, canNotify: true });
    expect(canSignNotification(meet)).toBe(true);
    expect(noVoteMessage(meet)).toBeNull();
  });

  it('председатель участка на собрании уполномоченных: бюллетень и подтверждение', () => {
    const meet = meetWith({ ...base, canVote: true, canNotify: true, branchTrustee: 'alice' });
    expect(canSignNotification(meet)).toBe(true);
    expect(noVoteMessage(meet)).toBeNull();
  });

  it('рядовой пайщик видит председателя своего участка по ФИО из сертификата', () => {
    const meet = meetWith({
      ...base,
      branchTrustee: 'alice',
      branchTrusteeCertificate: { __typename: 'IndividualCertificate', first_name: 'Анна', last_name: 'Петрова', middle_name: 'Ивановна', username: 'alice' },
    });
    expect(canSignNotification(meet)).toBe(false);
    const message = noVoteMessage(meet);
    expect(message?.key).toBe('meet.meetDetailsVoting.trusteeVotes');
    expect(message?.params.name).toContain('Петрова');
  });

  it('без сертификата председатель назван учётным именем', () => {
    expect(noVoteMessage(meetWith({ ...base, branchTrustee: 'alice' }))).toEqual({
      key: 'meet.meetDetailsVoting.trusteeVotes',
      params: { name: 'alice' },
    });
  });

  it('пайщик без участка — голосуют председатели участков', () => {
    expect(noVoteMessage(meetWith(base))?.key).toBe('meet.meetDetailsVoting.noBranchTrustee');
  });

  it('участок уже проголосовал — пояснение об этом, подтверждение у председателя остаётся', () => {
    const meet = meetWith({ ...base, canNotify: true, branchVoted: true, branchTrustee: 'alice' });
    expect(canSignNotification(meet)).toBe(true);
    expect(noVoteMessage(meet)?.key).toBe('meet.meetDetailsVoting.branchVoted');
  });

  it('без признаков (запрос без входа) страница работает как прежде', () => {
    const meet = meetWith(null);
    expect(canSignNotification(meet)).toBe(true);
    expect(noVoteMessage(meet)).toBeNull();
  });
});
