/**
 * Итоги голосований для текста документа: решения совета, общие собрания,
 * вопросы повестки (шаг 2 фабрики v2). Чистые функции над уже прочитанными
 * данными; чтение голосов и строк собрания — в слое источников.
 */
import type { Cooperative, Interfaces, MeetContract } from 'cooptypes'
import type { IDecisionVotes } from '../Sources'
import { formatDateTime } from '../Utils'
import { splitCreatedAt } from '../Utils/documentCreatedAt'

/**
 * Решение совета по голосам из действий цепи. Заседание совета заочное:
 * повестку получают все члены совета, и все они участвуют в заседании. Кто не
 * проголосовал, записан воздержавшимся, поэтому участников столько же,
 * сколько членов совета, и кворум составляет 100 %.
 */
export function decisionData(votes: IDecisionVotes, totalMembers: number, decision_id: number, created_at: string, timezone: string): Cooperative.Document.IDecisionData {
  const { votes_for, votes_against } = votes
  const total_voters = votes_for + votes_against
  const votes_abstained = totalMembers - total_voters
  const participants = total_voters + votes_abstained
  const voters_percent: number = Number.parseFloat((participants / totalMembers * 100).toFixed(0))

  const { date, time } = splitCreatedAt(created_at, timezone)

  return {
    id: decision_id,
    date,
    time,
    votes_for,
    votes_against,
    votes_abstained,
    voters_percent,
  }
}

/**
 * Решение общего собрания: кворум берётся из собрания, а голоса «за» и
 * «против» лежат в каждом вопросе отдельно, поэтому здесь они нулевые.
 */
export function generalMeetingDecisionData(meet: Interfaces.Meet.IMeet, created_at: string, timezone: string): Cooperative.Document.IDecisionData {
  const { date, time } = splitCreatedAt(created_at, timezone)

  return {
    id: Number(meet.id),
    date,
    time,
    votes_for: 0,
    votes_against: 0,
    votes_abstained: 0,
    voters_percent: Number(meet.current_quorum_percent),
  }
}

/** Строка собрания с датами для человека и именами председателя и секретаря. */
export function extendMeet(meet: MeetContract.Tables.Meets.IOutput, presiderFullName: string, secretaryFullName: string): Cooperative.Model.IMeetExtended {
  return {
    ...meet,
    current_quorum_percent: Number(Number(meet.current_quorum_percent).toFixed(1)),
    close_at_datetime: formatDateTime(meet.close_at),
    open_at_datetime: formatDateTime(meet.open_at),
    presider_full_name: presiderFullName,
    secretary_full_name: secretaryFullName,
  }
}

/** Вопросы собрания с итогами: доли голосов и признак принятия (больше половины «за»). */
export function extendQuestions(questions: MeetContract.Tables.Questions.IOutput[]): Cooperative.Model.IQuestionExtended[] {
  return questions.map((question) => {
    const votesFor = Number(question.counter_votes_for)
    const votesAgainst = Number(question.counter_votes_against)
    const votesAbstained = Number(question.counter_votes_abstained)
    const votesTotal = votesFor + votesAgainst + votesAbstained

    // Без голосов все доли нулевые: деления на ноль нет.
    const percent = (value: number): number => (votesTotal === 0 ? 0 : Math.round((value / votesTotal) * 100))

    return {
      ...question,
      votes_total: votesTotal,
      votes_for_percent: percent(votesFor),
      votes_against_percent: percent(votesAgainst),
      votes_abstained_percent: percent(votesAbstained),
      is_accepted: votesTotal > 0 && votesFor > votesTotal / 2,
    } as Cooperative.Model.IQuestionExtended
  })
}

/** Как пайщик проголосовал по вопросу; не найден ни в одном списке — воздержался. */
export function userVote(question: MeetContract.Tables.Questions.IOutput, username: string): 'for' | 'against' | 'abstained' {
  if (question.voters_for && question.voters_for.includes(username))
    return 'for'
  if (question.voters_against && question.voters_against.includes(username))
    return 'against'
  return 'abstained'
}
