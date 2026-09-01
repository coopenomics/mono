import { Inject, Injectable } from '@nestjs/common';
import { AbilityBuilder, createMongoAbility } from '@casl/ability';
import {
  AccessRuleEffect,
  ACCESS_RULES_REPOSITORY,
  type AccessRuleRecord,
  type IAccessRulesRepository,
} from '~/domain/auth-v2/ports/access-rules.port';
import {
  CAPABILITY_SETS_REPOSITORY,
  type ICapabilitySetsRepository,
} from '~/domain/auth-v2/ports/capability-sets.port';
import type { AppAbility, CoopAction, CoopSubject } from './ability.types';
import { mapUserRoleToCoreRoles } from './core-roles';

/** Пайщик, для которого собирается Ability (минимум из JWT-сессии). */
export interface IAbilitySubjectUser {
  username: string;
  role?: string | null;
}

/**
 * CASL-авторизация (Эпик 6). Layer 1 (Story 6.1) — статическая матрица «роль→
 * возможности». Layer 2 (Story 6.2) — декларативные `access_rules` из coop_domain_db,
 * мерджатся поверх статики. Матрица аддитивна: Chairman наследует Member, Member — User.
 *
 * Ownership self-субъектов (свой Certificate/Session/RecoveryStrategy) вшит в условие
 * `{ owner: username }` прямо в Ability — реальный CASL (в отличие от marketplace
 * `canAccess`, где ownership проверял resolver). DB-зависимые политики — Layer 3 (Story 6.3).
 */
@Injectable()
export class AbilityFactory {
  constructor(
    @Inject(ACCESS_RULES_REPOSITORY)
    private readonly accessRules: IAccessRulesRepository,
    @Inject(CAPABILITY_SETS_REPOSITORY)
    private readonly capabilitySets: ICapabilitySetsRepository,
  ) {}

  /**
   * Синхронная сборка: Layer 1 static + merge переданных `access_rules` (Layer 2).
   * Чистая (без IO) — `accessRules` инжектится вызывающим, что делает merge тестируемым.
   */
  createForParticipant(user: IAbilitySubjectUser, accessRules: AccessRuleRecord[] = []): AppAbility {
    const coreRoles = mapUserRoleToCoreRoles(user.role);
    const { can, cannot, build } = new AbilityBuilder<AppAbility>(createMongoAbility);
    const owner = { owner: user.username };

    // --- Layer 1: статическая матрица ---
    // User — любой пайщик: полный контроль над собственными сущностями.
    if (coreRoles.includes('User')) {
      can('read', 'Certificate', owner);
      can(['read', 'update'], 'Session', owner);
      can('manage', 'RecoveryStrategy', owner); // вкл. настройки 2FA
    }

    // Member — член совета: read-only надзор + роль второго подписанта critical-action.
    if (coreRoles.includes('Member')) {
      can('read', 'Participant');
      can('read', 'VerificationRule');
      can('read', 'CriticalAction');
      can('read', 'AuditEvent');
      can('confirm', 'CriticalAction'); // второй подписант (Story 6.8)
    }

    // Chairman — председатель: write-модерация + инициация critical-action.
    if (coreRoles.includes('Chairman')) {
      can('manage', 'VerificationRule');
      can('manage', 'CoopSettings');
      can('update', 'Participant'); // назначение ролей (Story 6.6)
      can('create', 'Capability'); // выдача точечных capabilities (Story 6.7)
      can('manage', 'CapabilitySet'); // назначение наборов возможностей (Story 6.11)
      can('create', 'CriticalAction'); // инициатор; финал — только 2 подписи (Story 6.8)
    }

    // --- Layer 2: access_rules. allow — первыми, deny — последними, чтобы deny
    // перекрывал любой предыдущий allow (CASL берёт последнее матчащее правило). ---
    const apply = (rule: AccessRuleRecord, kind: 'allow' | 'deny'): void => {
      const action = rule.action as CoopAction;
      const subject = rule.resourceType as CoopSubject;
      const fn = kind === 'allow' ? can : cannot;
      if (rule.conditions) {
        fn(action, subject, rule.conditions);
      }
      else {
        fn(action, subject);
      }
    };
    for (const rule of accessRules) {
      if (rule.effect === AccessRuleEffect.Allow) {
        apply(rule, 'allow');
      }
    }
    for (const rule of accessRules) {
      if (rule.effect === AccessRuleEffect.Deny) {
        apply(rule, 'deny');
      }
    }

    return build();
  }

  /**
   * Полная сборка Ability пайщика: читает `access_rules` (Layer 2) из БД и мерджит
   * поверх Layer 1. Это «AbilityFactory читает access_rules» из AC. Свежие правила
   * видит при каждой сборке (= новый логин/пересборка); активные сессии инвалидируются
   * через Redis pub/sub (publisher Story 6.2, подписчик Story 6.4).
   */
  async createForParticipantWithRules(user: IAbilitySubjectUser): Promise<AppAbility> {
    const coreRoles = mapUserRoleToCoreRoles(user.role);
    // Источники правил L2 объединяются в один список (allow-first/deny-last делает
    // createForParticipant): (1) core-роли + персональные гранты пайщика; (2) правила
    // назначенных пайщику наборов возможностей (Story 6.11). Движок — один (CASL).
    const setKeys = await this.capabilitySets.listActiveSetKeys(user.username);
    const [principalRules, setRules] = await Promise.all([
      this.accessRules.findForPrincipal(coreRoles, user.username),
      this.accessRules.findForCapabilitySets(setKeys),
    ]);
    return this.createForParticipant(user, [...principalRules, ...setRules]);
  }
}
