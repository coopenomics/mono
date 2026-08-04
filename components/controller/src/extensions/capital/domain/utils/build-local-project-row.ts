import { EMPTY_HASH } from '~/shared/utils/constants';
import { ProjectOrigin } from '../enums/project-origin.enum';
import { ProjectStatus } from '../enums/project-status.enum';
import { IssueIdGenerationService } from '../services/issue-id-generation.service';
import {
  EMPTY_PROJECT_COUNTS,
  EMPTY_PROJECT_CRPS,
  EMPTY_PROJECT_FACT,
  EMPTY_PROJECT_PLAN,
  EMPTY_PROJECT_VOTING,
} from './empty-project-blockchain-pools';

export type CreateLocalProjectPayload = {
  coopname: string;
  project_hash: string;
  parent_hash?: string;
  title: string;
  description?: string;
  invite?: string;
  meta?: string;
  data?: string;
  master: string;
};

/** Пустой каркас полей проекта для локальной записи (без блокчейна). */
export function buildLocalProjectRow(input: CreateLocalProjectPayload) {
  const project_hash = input.project_hash.toLowerCase();
  const parent_hash = (input.parent_hash || EMPTY_HASH).toLowerCase();
  const now = new Date();

  return {
    coopname: input.coopname,
    project_hash,
    parent_hash,
    blockchain_status: ProjectStatus.ACTIVE,
    is_opened: true,
    is_planed: false,
    is_authorized: false,
    master: input.master,
    title: input.title,
    description: input.description ?? '',
    invite: input.invite ?? '',
    data: input.data ?? '',
    meta: input.meta ?? '{}',
    authorization: null,
    counts: { ...EMPTY_PROJECT_COUNTS },
    plan: { ...EMPTY_PROJECT_PLAN },
    fact: { ...EMPTY_PROJECT_FACT },
    crps: { ...EMPTY_PROJECT_CRPS },
    voting: {
      ...EMPTY_PROJECT_VOTING,
      amounts: { ...EMPTY_PROJECT_VOTING.amounts },
    },
    created_at: now.toISOString(),
    status: ProjectStatus.ACTIVE,
    prefix: IssueIdGenerationService.generateProjectPrefix(project_hash),
    issue_counter: 0,
    voting_deadline: null,
    matrix_room_id: null,
    matrix_component_announcement_events: null,
    development_repository_url: null,
    present: true,
    origin: ProjectOrigin.LOCAL,
    local_owner: input.master,
    block_num: 0,
  };
}
