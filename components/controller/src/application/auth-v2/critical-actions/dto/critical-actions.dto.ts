import { Field, InputType, Int, ObjectType, registerEnumType } from '@nestjs/graphql';
import GraphQLJSON from 'graphql-type-json';
import { CriticalActionStatus, CriticalActionType } from '~/domain/auth-v2/ports/pending-critical-actions.port';
import { ForceRecoveryConsentVia } from '../../force-recovery/force-recovery.service';

/**
 * GraphQL-контракт критических действий совета (Фаза 2 миграции REST→GraphQL/SDK):
 * multi-party critical actions (Story 6.8), audit-trail (6.10), manual key-revoke (4.7),
 * force-recovery председателем (6.9). Зеркало доменных типов auth-v2, поля — snake_case
 * по канону GraphQL этого репозитория; резолвер маппит camelCase сервисов в snake_case.
 *
 * Зачем GraphQL, а не REST: единый типизированный фасад фронта — @coopenomics/sdk
 * (Zeus). Авторизация — тот же субстрат Эпика 6 (`@CheckAbility` + `AuthorizationGuard`,
 * уже GraphQL-aware). Magic-link `:token`-эндпоинты (согласие пайщика, one-click из
 * письма) остаются REST — клик без SDK-контекста.
 */

registerEnumType(CriticalActionType, {
  name: 'CriticalActionType',
  description: 'Тип критического действия совета',
});

registerEnumType(CriticalActionStatus, {
  name: 'CriticalActionStatus',
  description: 'Состояние критического действия',
});

registerEnumType(ForceRecoveryConsentVia, {
  name: 'ForceRecoveryConsentVia',
  description: 'Чем подтверждено принудительное восстановление: согласием пайщика или решением собрания',
});

/** Одно подтверждение критического действия: кто и когда. */
@ObjectType('CriticalActionConfirmation')
export class CriticalActionConfirmationDTO {
  @Field(() => String, { description: 'Кто подтвердил (имя аккаунта)' })
  by!: string;

  @Field(() => String, { description: 'Когда подтвердил (ISO)' })
  at!: string;
}

/** Pending-запись критического действия (ждёт кворума подтверждений в окне ≤24ч). */
@ObjectType('PendingCriticalAction')
export class PendingCriticalActionDTO {
  @Field(() => String, { description: 'Идентификатор критического действия' })
  id!: string;

  @Field(() => CriticalActionType, { description: 'Тип действия' })
  action_type!: CriticalActionType;

  @Field(() => String, { description: 'Инициатор (председатель)' })
  actor_id!: string;

  @Field(() => String, { description: 'Кого/что затрагивает действие' })
  target_id!: string;

  @Field(() => GraphQLJSON, { description: 'Содержимое действия (зависит от типа)' })
  payload!: Record<string, unknown>;

  @Field(() => CriticalActionStatus, { description: 'Состояние действия' })
  status!: CriticalActionStatus;

  @Field(() => [CriticalActionConfirmationDTO], { description: 'Накопленные подтверждения' })
  confirmations!: CriticalActionConfirmationDTO[];

  @Field(() => String, { description: 'Момент инициации (ISO)' })
  created_at!: string;

  @Field(() => String, { description: 'Крайний срок подтверждения (ISO)' })
  expires_at!: string;

  @Field(() => String, { nullable: true, description: 'Момент финализации (ISO); пусто, пока не финализировано' })
  finalized_at!: string | null;
}

/** Запись audit-trail критического действия: полная атрибуция для контролирующего органа. */
@ObjectType('CriticalActionAuditEntry')
export class CriticalActionAuditEntryDTO {
  @Field(() => String, { description: 'Идентификатор критического действия' })
  id!: string;

  @Field(() => CriticalActionType, { description: 'Тип действия' })
  action_type!: CriticalActionType;

  @Field(() => String, { description: 'Кого/что затрагивает действие' })
  target_id!: string;

  @Field(() => CriticalActionStatus, { description: 'Состояние действия' })
  status!: CriticalActionStatus;

  @Field(() => String, { description: 'Момент инициации (ISO)' })
  created_at!: string;

  @Field(() => String, { nullable: true, description: 'Момент финализации (ISO); пусто, пока не финализировано' })
  finalized_at!: string | null;

  @Field(() => String, { description: 'Инициатор (председатель)' })
  initiator_id!: string;

  @Field(() => String, { nullable: true, description: 'Момент первой подписи инициатора (ISO)' })
  initiated_at!: string | null;

  @Field(() => [CriticalActionConfirmationDTO], { description: 'Подтверждающие совета (≠ инициатор) со своими timestamp' })
  confirmer_ids!: CriticalActionConfirmationDTO[];

  @Field(() => String, { description: 'SHA-256 от payload — гарантия неподменяемости содержимого' })
  payload_hash!: string;
}

/** Результат отзыва ключа пайщика председателем. */
@ObjectType('RevokeKeyResult')
export class RevokeKeyResultDTO {
  @Field(() => String, { description: 'Статус операции' })
  status!: string;

  @Field(() => String, { description: 'Пайщик, чей ключ отозван' })
  target_id!: string;

  @Field(() => Int, { description: 'Сколько активных сессий пайщика отозвано' })
  sessions_revoked!: number;

  @Field(() => Boolean, { description: 'Пайщик обязан пройти recovery для получения нового ключа' })
  must_recover!: boolean;
}

/** Результат авторизации принудительного восстановления председателем. */
@ObjectType('ForceRecoveryAuthorization')
export class ForceRecoveryAuthorizationDTO {
  @Field(() => Boolean, { description: 'Восстановление авторизовано' })
  authorized!: boolean;

  @Field(() => ForceRecoveryConsentVia, { description: 'Чем подтверждено восстановление' })
  consent_via!: ForceRecoveryConsentVia;

  @Field(() => String, { description: 'Кто инициировал (председатель)' })
  triggered_by!: string;
}

/** Вход на инициацию критического действия. */
@InputType('InitiateCriticalActionInput')
export class InitiateCriticalActionInputDTO {
  @Field(() => CriticalActionType, { description: 'Тип критического действия' })
  action_type!: CriticalActionType;

  @Field(() => String, { description: 'Кого/что затрагивает действие' })
  target_id!: string;

  @Field(() => GraphQLJSON, { nullable: true, description: 'Содержимое действия (зависит от типа)' })
  payload?: Record<string, unknown> | null;
}

/** Вход на отзыв ключа пайщика. */
@InputType('RevokeParticipantKeyInput')
export class RevokeParticipantKeyInputDTO {
  @Field(() => String, { description: 'Пайщик, чей ключ отзывается' })
  target_id!: string;

  @Field(() => String, { description: 'Обоснование отзыва' })
  reason!: string;
}

/** Вход на запрос согласия пайщика на принудительное восстановление. */
@InputType('RequestForceRecoveryConsentInput')
export class RequestForceRecoveryConsentInputDTO {
  @Field(() => String, { description: 'Пайщик, для которого запрашивается согласие' })
  target_id!: string;
}

/** Вход на авторизацию принудительного восстановления председателем. */
@InputType('AuthorizeForceRecoveryInput')
export class AuthorizeForceRecoveryInputDTO {
  @Field(() => String, { description: 'Пайщик, для которого авторизуется восстановление' })
  target_id!: string;

  @Field(() => String, { nullable: true, description: 'Идентификатор транзакции решения собрания (если основание — собрание)' })
  assembly_decision_tx_id?: string | null;

  @Field(() => String, { nullable: true, description: 'Идентификатор связанного критического действия' })
  critical_action_id?: string | null;
}
