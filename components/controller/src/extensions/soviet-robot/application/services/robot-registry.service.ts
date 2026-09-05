import { Injectable } from '@nestjs/common';
import { Cooperative } from 'cooptypes';
import { RobotChainService, type AutomatorRow, type BoardRow } from './robot-chain.service';
import { RobotKeyService } from './robot-key.service';

/** Ноль в time_point_sec — «бессрочно». */
const ZERO_TIME = '1970-01-01T00:00:00';

export function isAutomationExpired(row: AutomatorRow, now: Date = new Date()): boolean {
  const raw = String(row.expires_at ?? '');
  if (!raw || raw.startsWith(ZERO_TIME)) return false;
  const at = Date.parse(raw.endsWith('Z') ? raw : `${raw}Z`);
  return Number.isFinite(at) && at <= now.getTime();
}

export interface RobotVoterView {
  member: string;
  permission_name: string;
  has_key: boolean;
  limit: string;
  expires_at: string | null;
}

export interface RobotQuorumView {
  /** Делегировавшие голосующие члены совета, у которых робот держит ключ (председатель не в счёт: он голосует сам). */
  delegated_count: number;
  /** Сколько делегирований нужно роботу, чтобы решение проходило: порог контракта минус голос председателя. */
  required_count: number;
  total_members: number;
  reached: boolean;
}

export interface RobotChairmanView {
  username: string | null;
  delegated: boolean;
  has_key: boolean;
}

export interface RobotDecisionTypeView {
  type: string;
  title: string;
  description: string;
  area: string;
  protocol_registry_id: number | null;
  /** Робот умеет довести этот тип до протокола. */
  serviceable: boolean;
  voters: RobotVoterView[];
  vote_quorum: RobotQuorumView;
  chairman: RobotChairmanView;
  my_vote: boolean;
  my_authorize: boolean;
}

/** Правило кворума контракта: голосов «за» × 100 > состав × 50. */
export function requiredVotes(totalMembers: number): number {
  return Math.floor(totalMembers / 2) + 1;
}

/**
 * Сколько членов совета должны делегировать голос роботу, чтобы решение
 * проходило автоматически. Робот повторяет за председателем, поэтому голос
 * председателя в пороге уже учтён и роботу остаётся добрать остальные.
 */
export function requiredDelegations(totalMembers: number): number {
  return Math.max(0, requiredVotes(totalMembers) - 1);
}

/**
 * Реестр действий автоматизации: что и кто делегировал роботу по каждому
 * типу решения, и достигает ли робот кворума сам. Источник — таблицы цепи,
 * поэтому все члены совета видят одно и то же.
 */
@Injectable()
export class RobotRegistryService {
  constructor(
    private readonly chain: RobotChainService,
    private readonly keys: RobotKeyService
  ) {}

  async getRegistry(coopname: string, viewer?: string): Promise<RobotDecisionTypeView[]> {
    const [automations, board, withKeys] = await Promise.all([
      this.chain.getAutomations(coopname),
      this.chain.getSovietBoard(coopname),
      this.keys.membersWithKeys(coopname),
    ]);
    return this.buildRegistry(automations, board, withKeys, viewer);
  }

  buildRegistry(automations: AutomatorRow[], board: BoardRow | null, withKeys: Set<string>, viewer?: string): RobotDecisionTypeView[] {
    const now = new Date();
    const members = board?.members ?? [];
    const totalMembers = members.length;
    const chairman = members.find((m) => m.position === 'chairman')?.username ?? null;
    const isVoting = (username: string) => members.some((m) => m.username === username && m.is_voting);
    const alive = automations.filter((a) => !isAutomationExpired(a, now));
    const mine = viewer ? alive.find((a) => a.member === viewer) : undefined;

    return Object.values(Cooperative.Document.decisionTypesRegistry).map((info) => {
      // Председатель не повторяет сам за собой: его голос — исходный сигнал, а не голос робота.
      const voters: RobotVoterView[] = alive
        .filter((a) => a.vote_types.includes(info.type) && isVoting(a.member) && a.member !== chairman)
        .map((a) => ({
          member: a.member,
          permission_name: a.permission_name,
          has_key: withKeys.has(a.member),
          limit: String(a.limit),
          expires_at: String(a.expires_at).startsWith(ZERO_TIME) ? null : String(a.expires_at),
        }));
      const delegated = voters.filter((v) => v.has_key).length;
      const chairmanRow = chairman ? alive.find((a) => a.member === chairman && a.authorize_types.includes(info.type)) : undefined;
      const serviceable = info.protocol_registry_id !== undefined;
      return {
        type: info.type,
        title: info.title,
        description: info.description,
        area: info.area,
        protocol_registry_id: info.protocol_registry_id ?? null,
        serviceable,
        voters,
        vote_quorum: {
          delegated_count: delegated,
          required_count: requiredDelegations(totalMembers),
          total_members: totalMembers,
          // Голос председателя даёт первый голос «за», робот добирает остальные.
          reached: totalMembers > 0 && (delegated + 1) * 100 > totalMembers * 50,
        },
        chairman: {
          username: chairman,
          delegated: !!chairmanRow,
          has_key: chairman !== null && withKeys.has(chairman),
        },
        my_vote: !!mine && mine.vote_types.includes(info.type),
        my_authorize: !!mine && mine.authorize_types.includes(info.type),
      };
    });
  }
}
