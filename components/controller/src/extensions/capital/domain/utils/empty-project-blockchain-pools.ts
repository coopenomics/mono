import type { IProjectDomainInterfaceBlockchainData } from '../interfaces/project-blockchain.interface';

const ZERO = '0.0000 AXON';

export type ProjectCounts = IProjectDomainInterfaceBlockchainData['counts'];
export type ProjectPlan = IProjectDomainInterfaceBlockchainData['plan'];
export type ProjectFact = IProjectDomainInterfaceBlockchainData['fact'];
export type ProjectCrps = IProjectDomainInterfaceBlockchainData['crps'];
export type ProjectVoting = IProjectDomainInterfaceBlockchainData['voting'];

/** Нулевые счётчики — GraphQL CapitalProjectCountsData (все non-null). */
export const EMPTY_PROJECT_COUNTS: ProjectCounts = {
  total_unique_participants: 0,
  total_authors: 0,
  total_coordinators: 0,
  total_creators: 0,
  total_investors: 0,
  total_propertors: 0,
  total_contributors: 0,
  total_commits: 0,
  total_converted_segments: 0,
};

/** Нулевой план — GraphQL CapitalProjectPlanPool. */
export const EMPTY_PROJECT_PLAN: ProjectPlan = {
  hour_cost: ZERO,
  creators_hours: 0,
  return_base_percent: 0,
  use_invest_percent: 0,
  creators_base_pool: ZERO,
  authors_base_pool: ZERO,
  coordinators_base_pool: ZERO,
  creators_bonus_pool: ZERO,
  authors_bonus_pool: ZERO,
  contributors_bonus_pool: ZERO,
  target_expense_pool: ZERO,
  invest_pool: ZERO,
  coordinators_investment_pool: ZERO,
  program_invest_pool: ZERO,
  total_received_investments: ZERO,
  total_generation_pool: ZERO,
  total: ZERO,
  total_with_investments: ZERO,
};

/** Нулевой факт — GraphQL CapitalProjectFactPool (+ blockchain total_used_for_compensation). */
export const EMPTY_PROJECT_FACT: ProjectFact = {
  hour_cost: ZERO,
  creators_hours: 0,
  return_base_percent: 0,
  use_invest_percent: 0,
  creators_base_pool: ZERO,
  authors_base_pool: ZERO,
  coordinators_base_pool: ZERO,
  property_base_pool: ZERO,
  creators_bonus_pool: ZERO,
  authors_bonus_pool: ZERO,
  contributors_bonus_pool: ZERO,
  target_expense_pool: ZERO,
  accumulated_expense_pool: ZERO,
  used_expense_pool: ZERO,
  invest_pool: ZERO,
  coordinators_investment_pool: ZERO,
  program_invest_pool: ZERO,
  total_received_investments: ZERO,
  total_returned_investments: ZERO,
  total_used_for_compensation: ZERO,
  total_generation_pool: ZERO,
  total_contribution: ZERO,
  total: ZERO,
  total_used_investments: ZERO,
  total_with_investments: ZERO,
};

/** Нулевой CRPS — GraphQL CapitalProjectCrpsData. */
export const EMPTY_PROJECT_CRPS: ProjectCrps = {
  total_capital_contributors_shares: ZERO,
  author_base_cumulative_reward_per_share: 0,
  author_bonus_cumulative_reward_per_share: 0,
  contributor_cumulative_reward_per_share: 0,
};

/** Нулевое голосование — GraphQL CapitalProjectVotingData. */
export const EMPTY_PROJECT_VOTING: ProjectVoting = {
  total_voters: 0,
  votes_received: 0,
  authors_voting_percent: 0,
  creators_voting_percent: 0,
  voting_deadline: '',
  amounts: {
    authors_equal_spread: ZERO,
    creators_direct_spread: ZERO,
    authors_bonuses_on_voting: ZERO,
    creators_bonuses_on_voting: ZERO,
    total_voting_pool: ZERO,
    active_voting_amount: ZERO,
    equal_voting_amount: ZERO,
    authors_equal_per_author: ZERO,
  },
};

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

/** LOCAL/legacy: JSONB мог быть `{}` или частичным — добиваем non-null поля для GraphQL. */
export function normalizeProjectCounts(value: unknown): ProjectCounts {
  if (!isPlainObject(value)) return { ...EMPTY_PROJECT_COUNTS };
  return { ...EMPTY_PROJECT_COUNTS, ...(value as Partial<ProjectCounts>) };
}

export function normalizeProjectPlan(value: unknown): ProjectPlan {
  if (!isPlainObject(value)) return { ...EMPTY_PROJECT_PLAN };
  return { ...EMPTY_PROJECT_PLAN, ...(value as Partial<ProjectPlan>) };
}

export function normalizeProjectFact(value: unknown): ProjectFact {
  if (!isPlainObject(value)) return { ...EMPTY_PROJECT_FACT };
  return { ...EMPTY_PROJECT_FACT, ...(value as Partial<ProjectFact>) };
}

export function normalizeProjectCrps(value: unknown): ProjectCrps {
  if (!isPlainObject(value)) return { ...EMPTY_PROJECT_CRPS };
  return {
    ...EMPTY_PROJECT_CRPS,
    ...(value as Partial<ProjectCrps>),
    total_capital_contributors_shares:
      (value as Partial<ProjectCrps>).total_capital_contributors_shares ?? ZERO,
  };
}

export function normalizeProjectVoting(value: unknown): ProjectVoting {
  if (!isPlainObject(value)) {
    return { ...EMPTY_PROJECT_VOTING, amounts: { ...EMPTY_PROJECT_VOTING.amounts } };
  }
  const amounts = isPlainObject(value.amounts) ? value.amounts : {};
  return {
    ...EMPTY_PROJECT_VOTING,
    ...(value as Partial<ProjectVoting>),
    voting_deadline:
      (value as Partial<ProjectVoting>).voting_deadline != null
        ? String((value as Partial<ProjectVoting>).voting_deadline)
        : '',
    amounts: {
      ...EMPTY_PROJECT_VOTING.amounts,
      ...(amounts as unknown as ProjectVoting['amounts']),
    },
  };
}
