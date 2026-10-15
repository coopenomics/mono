import { ProjectStatus } from '../../domain/enums/project-status.enum';
import { ProjectPriority } from '../../domain/enums/project-priority.enum';
import { ProjectOrigin } from '../../domain/enums/project-origin.enum';
import { IProjectDomainInterfaceBlockchainData } from '../../domain/interfaces/project-blockchain.interface';
import { IssueRecord } from './issue.record';
import { StoryRecord } from './story.record';
import { ChainRecord } from '@coopenomics/extension-kit/sync';

export const EntityName = 'capital_projects';
export class ProjectRecord extends ChainRecord {
  static getTableName(): string {
    return EntityName;
  }
  id!: number | null;

  // Поля из блокчейна (projects.hpp)
  coopname!: string;

  project_hash!: string;

  parent_hash!: string;

  blockchain_status!: string;

  is_opened!: boolean;

  is_planed!: boolean;

  is_authorized!: boolean;

  master!: string;

  title!: string;

  description!: string;

  invite!: string;

  data!: string;

  meta!: string;

  authorization!: IProjectDomainInterfaceBlockchainData['authorization'];

  counts!: IProjectDomainInterfaceBlockchainData['counts'];

  plan!: IProjectDomainInterfaceBlockchainData['plan'];

  fact!: IProjectDomainInterfaceBlockchainData['fact'];

  crps!: IProjectDomainInterfaceBlockchainData['crps'];

  voting!: IProjectDomainInterfaceBlockchainData['voting'];

  created_at!: Date;

  // Доменные поля (расширения)
  status!: ProjectStatus;

  /** Приоритет проекта/компонента (только БД, в блокчейн не пишется). */
  priority!: ProjectPriority;

  /** Редакция содержимого (см. capital_content_revisions); 0 — снимков ещё нет. */
  content_rev!: number;

  prefix!: string;

  issue_counter!: number;

  voting_deadline!: Date | null;

  matrix_room_id!: string | null;

  /** Matrix: id сообщений об анонсе компонента (без закрепа). */
  matrix_component_announcement_events?: { matrix_room_id: string; event_id: string }[] | null;

  /** URL репозитория Git (github.com), опрос маркеров коммитов — PRD §6.2.1. */
  development_repository_url!: string | null;

  /** blockchain — кооперативный; local — персональный (только PG) */
  origin!: ProjectOrigin;

  /** Владелец персонального проекта (= master для LOCAL) */
  local_owner!: string | null;

  // Связи
  issues!: IssueRecord[];

  stories!: StoryRecord[];
}
