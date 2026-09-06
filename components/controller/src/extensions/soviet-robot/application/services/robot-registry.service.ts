import { Inject, Injectable } from '@nestjs/common';
import { EXTENSION_CONFIG_PORT, type IExtensionConfigPort } from '@coopenomics/innercoop';
import { Cooperative } from 'cooptypes';
import { RobotChainService, type AutomatorRow, type BoardRow } from './robot-chain.service';
import { RobotKeyService } from './robot-key.service';
import { RobotVoteMode } from '../../domain/enums/robot-vote-mode.enum';

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
  mode: RobotVoteMode;
  /** За кем повторяет — в режиме повтора. */
  follow: string | null;
  limit: string;
  expires_at: string | null;
}

/** Сколько голосов придёт вслед за одним ведомым. */
export interface RobotFollowGroupView {
  follow: string;
  count: number;
}

export interface RobotQuorumView {
  /** Голоса, которые робот подаёт сразу: режим «сразу» с ключом у робота. */
  delegated_count: number;
  /** Голоса, которые придут вслед за ведомыми: режим повтора с ключом, по ведомым. */
  follow_groups: RobotFollowGroupView[];
  /** Сколько голосов «за» нужно по правилу контракта: больше половины состава. */
  required_count: number;
  total_members: number;
  /** Кворум набирается голосами «сразу», без чьего-либо участия. */
  reached: boolean;
  /** Кворум набирается, если все ведомые проголосуют «за». */
  reachable: boolean;
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
  protocol_registry_id: number;
  voters: RobotVoterView[];
  vote_quorum: RobotQuorumView;
  chairman: RobotChairmanView;
  /** Правила, которые не сработают: замкнутый круг, ведомый без права голоса. */
  warnings: string[];
  my_vote: boolean;
  my_mode: RobotVoteMode | null;
  my_follow: string | null;
  my_authorize: boolean;
}

/** Правило кворума контракта: голосов «за» × 100 > состав × 50. */
export function requiredVotes(totalMembers: number): number {
  return Math.floor(totalMembers / 2) + 1;
}

/** За кем член совета повторяет по этому типу; null — не повторяет. */
export function followOf(row: AutomatorRow, type: string): string | null {
  const rule = (row.follow_rules ?? []).find((r) => String(r.decision_type) === type);
  return rule ? String(rule.follow) : null;
}

/**
 * Замкнутые круги повтора по типу: A как B, B как A (и длиннее). В таком круге
 * никто не проголосует первым — правило не сработает, пока кто-то из круга не
 * проголосует вручную.
 */
export function followCycles(followBy: Map<string, string>): string[][] {
  const cycles: string[][] = [];
  const seen = new Set<string>();
  for (const start of followBy.keys()) {
    if (seen.has(start)) continue;
    const path: string[] = [];
    let current: string | undefined = start;
    while (current && followBy.has(current) && !path.includes(current) && !seen.has(current)) {
      path.push(current);
      current = followBy.get(current);
    }
    if (current && path.includes(current)) cycles.push(path.slice(path.indexOf(current)));
    path.forEach((m) => seen.add(m));
  }
  return cycles;
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
    private readonly keys: RobotKeyService,
    @Inject(EXTENSION_CONFIG_PORT) private readonly extensions: IExtensionConfigPort
  ) {}

  async getRegistry(coopname: string, viewer?: string): Promise<RobotDecisionTypeView[]> {
    const [automations, board, withKeys, types] = await Promise.all([
      this.chain.getAutomations(coopname),
      this.chain.getSovietBoard(coopname),
      this.keys.membersWithKeys(coopname),
      this.availableTypes(),
    ]);
    return this.buildRegistry(automations, board, withKeys, viewer, types);
  }

  /**
   * Решения, которые бывают у этого кооператива: ядровые плюс те, чьё
   * расширение установлено. Настройка расширения читается портом — установка
   * соседа напрямую из базы не проверяется.
   */
  private async availableTypes(): Promise<Cooperative.Document.IDecisionTypeInfo[]> {
    const names = Cooperative.Document.decisionTypeExtensions();
    const installed = await Promise.all(
      names.map(async (name) => ((await this.extensions.get(name)) === null ? null : name))
    );
    return Cooperative.Document.decisionTypesForExtensions(installed.filter((name): name is string => name !== null));
  }

  buildRegistry(
    automations: AutomatorRow[],
    board: BoardRow | null,
    withKeys: Set<string>,
    viewer?: string,
    types: Cooperative.Document.IDecisionTypeInfo[] = Object.values(Cooperative.Document.decisionTypesRegistry)
  ): RobotDecisionTypeView[] {
    const now = new Date();
    const members = board?.members ?? [];
    const totalMembers = members.length;
    const chairman = members.find((m) => m.position === 'chairman')?.username ?? null;
    const isVoting = (username: string) => members.some((m) => m.username === username && m.is_voting);
    const alive = automations.filter((a) => !isAutomationExpired(a, now));
    const mine = viewer ? alive.find((a) => a.member === viewer) : undefined;

    return types.map((info) => {
      const voters = this.votersOf(alive, info.type, isVoting, withKeys);
      const chairmanRow = chairman ? alive.find((a) => a.member === chairman && a.authorize_types.includes(info.type)) : undefined;
      const myFollow = mine ? followOf(mine, info.type) : null;
      const myAuto = !!mine && mine.vote_types.includes(info.type);
      return {
        type: info.type,
        title: info.title,
        description: info.description,
        protocol_registry_id: info.protocol_registry_id,
        voters,
        vote_quorum: this.quorumOf(voters, totalMembers, isVoting),
        chairman: {
          username: chairman,
          delegated: !!chairmanRow,
          has_key: chairman !== null && withKeys.has(chairman),
        },
        warnings: this.warningsOf(voters, isVoting),
        my_vote: myAuto || myFollow !== null,
        my_mode: myAuto ? RobotVoteMode.AUTO : myFollow ? RobotVoteMode.FOLLOW : null,
        my_follow: myFollow,
        my_authorize: !!mine && mine.authorize_types.includes(info.type),
      };
    });
  }

  /** Кто делегировал голос по типу — сразу или повтором — среди голосующих членов совета. */
  private votersOf(alive: AutomatorRow[], type: string, isVoting: (u: string) => boolean, withKeys: Set<string>): RobotVoterView[] {
    return alive
      .filter((a) => isVoting(a.member) && (a.vote_types.includes(type) || followOf(a, type) !== null))
      .map((a) => {
        const follow = a.vote_types.includes(type) ? null : followOf(a, type);
        return {
          member: a.member,
          permission_name: a.permission_name,
          has_key: withKeys.has(a.member),
          mode: follow ? RobotVoteMode.FOLLOW : RobotVoteMode.AUTO,
          follow,
          limit: String(a.limit),
          expires_at: String(a.expires_at).startsWith(ZERO_TIME) ? null : String(a.expires_at),
        };
      });
  }

  /**
   * Кворум: гарантированные голоса «сразу» и голоса вслед за ведомыми; в счёт идут
   * только те, у кого ключ у робота. Достижимость считает и голоса самих ведомых:
   * повтор срабатывает после их голоса «за», а этот голос уже лежит в цепи.
   */
  private quorumOf(voters: RobotVoterView[], totalMembers: number, isVoting: (u: string) => boolean): RobotQuorumView {
    const withKey = voters.filter((v) => v.has_key);
    const delegated = withKey.filter((v) => v.mode === RobotVoteMode.AUTO).length;
    const groups = new Map<string, number>();
    for (const v of withKey) {
      if (v.follow) groups.set(v.follow, (groups.get(v.follow) ?? 0) + 1);
    }
    const potential = new Set<string>(withKey.map((v) => v.member));
    for (const followed of groups.keys()) {
      if (isVoting(followed)) potential.add(followed);
    }
    const enough = (votes: number) => totalMembers > 0 && votes * 100 > totalMembers * 50;
    return {
      delegated_count: delegated,
      follow_groups: [...groups.entries()].map(([follow, count]) => ({ follow, count })),
      required_count: requiredVotes(totalMembers),
      total_members: totalMembers,
      reached: enough(delegated),
      reachable: enough(potential.size),
    };
  }

  /** Правила повтора, которые не сработают, — человеческим языком. */
  private warningsOf(voters: RobotVoterView[], isVoting: (u: string) => boolean): string[] {
    const warnings: string[] = [];
    const followBy = new Map<string, string>();
    for (const v of voters) {
      if (!v.follow) continue;
      followBy.set(v.member, v.follow);
      if (!isVoting(v.follow)) warnings.push(`${v.member} повторяет за ${v.follow}, у которого нет права голоса`);
    }
    for (const cycle of followCycles(followBy)) {
      warnings.push(`${cycle.join(', ')} повторяют друг за другом — никто не проголосует первым`);
    }
    return warnings;
  }
}
