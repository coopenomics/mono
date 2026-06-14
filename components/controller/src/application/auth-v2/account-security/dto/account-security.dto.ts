import { Field, InputType, Int, ObjectType, registerEnumType } from '@nestjs/graphql';
import { RecoveryStrategy } from '~/domain/auth-v2/recovery-strategy/recovery-strategy.types';

/**
 * GraphQL-контракт самообслуживания безопасности аккаунта пайщика (Фаза 2 миграции
 * REST→GraphQL/SDK): активные сессии (Story 3.7), второй фактор (3.6), стратегия
 * восстановления (3.5), сигнал «Это не я» (3.10). Зеркало доменных типов auth-v2,
 * поля — snake_case по канону GraphQL этого репозитория; резолвер маппит camelCase
 * сервисов в snake_case этих DTO.
 *
 * Зачем GraphQL, а не REST: единый типизированный фасад фронта — @coopenomics/sdk
 * (Zeus). Нового способа взаимодействия с бэкендом наружу не появляется; bearer
 * живёт только в SDK. Транспорт (IP, refresh-токен текущей сессии) — через
 * request-meta декораторы, не как GraphQL-переменные.
 */

registerEnumType(RecoveryStrategy, {
  name: 'RecoveryStrategy',
  description: 'Разрешённый канал восстановления доступа пайщика (активен ровно один)',
});

/** Активная сессия пайщика — устройство, с которого выполнен вход. */
@ObjectType('AccountSession')
export class AccountSessionDTO {
  @Field(() => String, { description: 'Идентификатор сессии (для точечного завершения)' })
  id!: string;

  @Field(() => String, { description: 'Устройство входа (User-Agent); заглушка, если метаданные не сохранялись' })
  device!: string;

  @Field(() => String, { description: 'IP входа; заглушка, если метаданные не сохранялись' })
  ip!: string;

  @Field(() => String, { description: 'Время создания сессии (ISO)' })
  created_at!: string;

  @Field(() => String, { description: 'Последняя зафиксированная активность (ISO)' })
  last_seen_at!: string;

  @Field(() => Boolean, { description: 'Текущая сессия (с которой выполнен запрос)' })
  current!: boolean;
}

/** Результат массового завершения сессий. */
@ObjectType('RevokedSessionsResult')
export class RevokedSessionsResultDTO {
  @Field(() => Int, { description: 'Сколько активных сессий завершено' })
  revoked!: number;
}

/** Вызов на подключение второго фактора: данные для ручного ввода и QR. */
@ObjectType('TwoFactorEnrollment')
export class TwoFactorEnrollmentDTO {
  @Field(() => String, { description: 'Base32-секрет для ручного ввода в приложение-аутентификатор' })
  secret!: string;

  @Field(() => String, { description: 'otpauth://-URI для QR-кода' })
  otpauth_uri!: string;
}

/** Вход на завершение конкретной сессии. */
@InputType('RevokeSessionInput')
export class RevokeSessionInputDTO {
  @Field(() => String, { description: 'Идентификатор завершаемой сессии' })
  session_id!: string;
}

/** Вход на операции второго фактора, требующие TOTP-кода (активация/отключение). */
@InputType('TwoFactorCodeInput')
export class TwoFactorCodeInputDTO {
  @Field(() => String, { description: 'Одноразовый код из приложения-аутентификатора' })
  code!: string;
}

/** Вход на смену стратегии восстановления (требует step-up второго фактора). */
@InputType('SetRecoveryStrategyInput')
export class SetRecoveryStrategyInputDTO {
  @Field(() => RecoveryStrategy, { description: 'Новая стратегия восстановления' })
  strategy!: RecoveryStrategy;

  @Field(() => String, { description: 'TOTP-код для подтверждения смены (step-up)' })
  code!: string;
}

/** Вход на сигнал «Это не я» из настроек ЛК. */
@InputType('ReportNotMeInput')
export class ReportNotMeInputDTO {
  @Field(() => String, { nullable: true, description: 'Идентификатор подозрительной сессии (опционально, из настроек)' })
  session_id?: string | null;
}
