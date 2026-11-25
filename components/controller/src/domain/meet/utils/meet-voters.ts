/**
 * Кто голосует на общем собрании (компонент 76 «Общее собрание уполномоченных»).
 *
 * Правило повторяет проверки контракта meet (vote, gmnotify) и живёт в ядре в
 * одном месте: по нему контроллер выбирает адресатов оповещений о собрании и
 * сообщает рабочему столу, может ли пайщик голосовать. Расширения получают
 * результат через порт собрания, а не считают сами.
 *
 * Форма собрания закрепляется в записи собрания при одобрении советом. У
 * собраний, одобренных до появления формы, её нет — тогда, как и в контракте,
 * действует флаг кооператива на текущий момент, а состав участков не
 * ограничивается датой.
 */

/** Форма собрания из записи цепи; логические поля узел отдаёт числом или булевым. */
export interface MeetFormData {
  is_branched: boolean | number;
  branches_count: number | string;
  fixed_at: string;
  voted_branches: string[];
}

/** Участок из таблицы участков цепи — поля, по которым считается состав собрания. */
export interface MeetBranchData {
  braname: string;
  trustee: string;
  /** Дата создания; у участков, созданных до появления поля, отсутствует. */
  created_at?: string | null;
}

/** Право пайщика на собрании. */
export interface MeetParticipation {
  /** Собрание уполномоченных — голосуют председатели участков. */
  isTrusteesMeet: boolean;
  /** Пайщик может подать бюллетень (без учёта того, голосовал ли он уже). */
  canVote: boolean;
  /** Пайщик может подтвердить получение уведомления о собрании. */
  canNotify: boolean;
  /** Участок пайщика уже подал голос на этом собрании (в том числе прежним председателем). */
  branchVoted: boolean;
  /** Председатель участка пайщика, голосующий за участок; только для собрания уполномоченных. */
  branchTrustee: string | null;
}

/** Время цепи без зоны (`2026-11-24T09:25:55`) — UTC. */
function chainTime(value: string): number {
  return Date.parse(/[zZ]|[+-]\d\d:\d\d$/.test(value) ? value : `${value}Z`);
}

const asFlag = (value: unknown): boolean => Boolean(Number(value));

/** Собрание уполномоченных: по закреплённой форме, без формы — по флагу кооператива. */
export function isTrusteesMeet(form: MeetFormData | null | undefined, cooperativeIsBranched: boolean): boolean {
  return form ? asFlag(form.is_branched) : cooperativeIsBranched;
}

/**
 * Участки собрания уполномоченных: созданные не позже закрепления формы.
 * Участок без даты создания существовал всегда. Собрание без формы — все участки.
 */
export function meetBranches<T extends MeetBranchData>(form: MeetFormData | null | undefined, branches: T[]): T[] {
  if (!form) return branches;
  const fixedAt = chainTime(form.fixed_at);
  return branches.filter((branch) => !branch.created_at || chainTime(branch.created_at) <= fixedAt);
}

/**
 * Голосующие собрания уполномоченных — председатели участков собрания.
 * Для собрания пайщиков возвращает `null`: голосуют все пайщики.
 */
export function meetVoters(
  form: MeetFormData | null | undefined,
  cooperativeIsBranched: boolean,
  branches: MeetBranchData[]
): string[] | null {
  if (!isTrusteesMeet(form, cooperativeIsBranched)) return null;
  return [...new Set(meetBranches(form, branches).map((branch) => branch.trustee))];
}

/** Право пайщика на собрании: голос, подтверждение уведомления, председатель его участка. */
export function resolveMeetParticipation(input: {
  form: MeetFormData | null | undefined;
  cooperativeIsBranched: boolean;
  branches: MeetBranchData[];
  username: string;
  /** Участок, к которому привязан пайщик; пусто — пайщик без участка. */
  userBraname?: string | null;
}): MeetParticipation {
  const { form, cooperativeIsBranched, branches, username, userBraname } = input;

  if (!isTrusteesMeet(form, cooperativeIsBranched)) {
    return { isTrusteesMeet: false, canVote: true, canNotify: true, branchVoted: false, branchTrustee: null };
  }

  const inMeet = meetBranches(form, branches);
  // Председатель голосует за участок, который возглавляет; привязка пайщика к
  // участку для председателя вторична (контракт ищет участок по председателю).
  const chaired = inMeet.find((branch) => branch.trustee === username) ?? null;
  const own = chaired ?? inMeet.find((branch) => branch.braname === userBraname) ?? null;
  const branchVoted = Boolean(own && form?.voted_branches.includes(own.braname));

  return {
    isTrusteesMeet: true,
    canVote: Boolean(chaired) && !branchVoted,
    canNotify: Boolean(chaired),
    branchVoted,
    branchTrustee: own?.trustee ?? null,
  };
}
