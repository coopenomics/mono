import { Field, ID, InputType, Int, ObjectType } from '@nestjs/graphql';
import { IsArray, IsBoolean, IsEnum, IsOptional, IsString, IsUUID, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { EduAccessCarrier, EduAccessTaskKind, EduAccessTaskStatus, EduConnectorHealth } from '../../domain/enums';
import type { EdubridgeAccessTaskRecord, EdubridgeConnectorBindingRecord } from '../../infrastructure/entities';
import { EduEnrollmentDTO } from './edu-enrollment.dto';
import { EduLearnerDTO } from './edu-learner.dto';
import './edu-enums.registration';

/** Строка реестра учеников: пайщик, который оформляет подписки. Контакт — только владельцу (резолвер вырезает по гранту). */
@ObjectType('EduMemberRow')
export class EduMemberRowDTO {
  @Field(() => String, { description: 'Учётное имя пайщика' }) username!: string;
  @Field(() => String, { description: 'ФИО пайщика (у организации — наименование); пусто, если сертификата нет' }) display_name!: string;
  @Field(() => Int, { description: 'Обучающихся' }) learners_count!: number;
  @Field(() => Int, { description: 'Действующих подписок' }) active_enrollments!: number;
  @Field(() => Int, { description: 'Подписок, требующих внимания' }) attention_count!: number;
}

/**
 * Аккаунт обучающегося на площадках — по нашим данным о выдаче доступа.
 * Удалить аккаунт по API площадки не дают: администратор видит, кому доступ
 * уже не нужен, удаляет аккаунт в кабинете школы и отмечает это.
 */
@ObjectType('EduLearnerAccount')
export class EduLearnerAccountDTO {
  @Field(() => ID, { description: 'Обучающийся' }) learner_id!: string;
  @Field(() => [EduAccessCarrier], { description: 'Площадки, на которых обучающемуся выдавался доступ' }) carriers!: EduAccessCarrier[];
  @Field(() => Int, { description: 'Действующих подписок обучающегося' }) active_enrollments!: number;
  @Field(() => Date, { nullable: true, description: 'Когда администратор отметил, что аккаунт удалён с площадки' }) removed_at!: Date | null;
}

/** Сводная карточка пайщика для администратора. */
@ObjectType('EduMemberCard')
export class EduMemberCardDTO {
  @Field(() => String) username!: string;
  @Field(() => String, { description: 'ФИО пайщика' }) display_name!: string;
  @Field(() => [EduLearnerDTO]) learners!: EduLearnerDTO[];
  @Field(() => [EduLearnerAccountDTO], { description: 'Аккаунты обучающихся на площадках' }) learner_accounts!: EduLearnerAccountDTO[];
  @Field(() => [EduEnrollmentDTO]) enrollments!: EduEnrollmentDTO[];
  @Field(() => [EduAccessTaskDTO]) tasks!: EduAccessTaskDTO[];
}

@ObjectType('EduAccessTask')
export class EduAccessTaskDTO {
  @Field(() => ID) id!: string;
  @Field(() => ID) enrollment_id!: string;
  @Field(() => EduAccessTaskKind) kind!: EduAccessTaskKind;
  @Field(() => EduAccessCarrier) carrier!: EduAccessCarrier;
  @Field(() => EduAccessTaskStatus) status!: EduAccessTaskStatus;
  @Field(() => Int) attempts!: number;
  @Field(() => Date) next_attempt_at!: Date;
  @Field(() => String, { nullable: true }) last_error!: string | null;
  @Field(() => String, { nullable: true }) last_result!: string | null;
  @Field(() => Date, { nullable: true }) done_at!: Date | null;
  @Field(() => Date) created_at!: Date;
  @Field(() => Date) updated_at!: Date;

  constructor(t: EdubridgeAccessTaskRecord) {
    Object.assign(this, {
      id: t.id, enrollment_id: t.enrollment_id, kind: t.kind, carrier: t.carrier, status: t.status, attempts: t.attempts,
      next_attempt_at: t.next_attempt_at, last_error: t.last_error, last_result: t.last_result, done_at: t.done_at,
      created_at: t.created_at, updated_at: t.updated_at,
    });
  }
}

@InputType('EduQueueFilterInput')
export class EduQueueFilterInputDTO {
  @Field(() => [EduAccessTaskStatus], { nullable: true, description: 'Состояния задач' })
  @IsOptional() @IsArray() @IsEnum(EduAccessTaskStatus, { each: true })
  statuses?: EduAccessTaskStatus[];
}

/** Поле подключения площадки: что вводит владелец и задано ли уже. Значений наружу нет. */
@ObjectType('EduConnectorCredentialField')
export class EduConnectorCredentialFieldDTO {
  @Field(() => String) key!: string;
  @Field(() => String) label!: string;
  @Field(() => Boolean, { description: 'Секрет: вводится как пароль' }) secret!: boolean;
  @Field(() => String, { nullable: true }) note?: string;
  @Field(() => Boolean, { description: 'Значение уже задано' }) is_set!: boolean;
}

@ObjectType('EduConnectorBinding')
export class EduConnectorBindingDTO {
  @Field(() => EduAccessCarrier) carrier!: EduAccessCarrier;
  @Field(() => Boolean) enabled!: boolean;
  @Field(() => Boolean, { description: 'Все поля подключения заданы (сами ключи наружу не выдаются)' }) configured!: boolean;
  @Field(() => [EduConnectorCredentialFieldDTO], { description: 'Поля подключения площадки и отметки «задано»' }) credential_fields!: EduConnectorCredentialFieldDTO[];
  @Field(() => EduConnectorHealth) health!: EduConnectorHealth;
  @Field(() => Date, { nullable: true }) last_check_at!: Date | null;
  @Field(() => String, { nullable: true }) last_check_message!: string | null;

  constructor(b: EdubridgeConnectorBindingRecord, configured: boolean, credential_fields: EduConnectorCredentialFieldDTO[] = []) {
    Object.assign(this, {
      carrier: b.carrier,
      enabled: b.enabled,
      configured,
      credential_fields,
      health: b.health,
      last_check_at: b.last_check_at,
      last_check_message: b.last_check_message,
    });
  }
}

@InputType('EduConnectorCredentialInput')
export class EduConnectorCredentialInputDTO {
  @Field(() => String) @IsString() key!: string;
  @Field(() => String, { description: 'Пустое значение оставляет прежнее' }) @IsString() value!: string;
}

@InputType('EduSetConnectorCredentialsInput')
export class EduSetConnectorCredentialsInputDTO {
  @Field(() => EduAccessCarrier) @IsEnum(EduAccessCarrier) carrier!: EduAccessCarrier;
  @Field(() => [EduConnectorCredentialInputDTO]) @IsArray() @ValidateNested({ each: true }) @Type(() => EduConnectorCredentialInputDTO) values!: EduConnectorCredentialInputDTO[];
}

@InputType('EduSetConnectorEnabledInput')
export class EduSetConnectorEnabledInputDTO {
  @Field(() => EduAccessCarrier) @IsEnum(EduAccessCarrier) carrier!: EduAccessCarrier;
  @Field(() => Boolean) @IsBoolean() enabled!: boolean;
}

@InputType('EduRetryEnrollmentCloseInput')
export class EduRetryEnrollmentCloseInputDTO {
  @Field(() => ID, { description: 'Подписка' }) @IsUUID() enrollment_id!: string;
}

@InputType('EduMarkLearnerRemovedInput')
export class EduMarkLearnerRemovedInputDTO {
  @Field(() => ID, { description: 'Обучающийся' }) @IsUUID() learner_id!: string;
}

@InputType('EduRetryTaskInput')
export class EduRetryTaskInputDTO {
  @Field(() => ID) @IsUUID() task_id!: string;
}
