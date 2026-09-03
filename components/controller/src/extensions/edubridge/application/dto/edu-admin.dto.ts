import { Field, ID, InputType, Int, ObjectType } from '@nestjs/graphql';
import { IsArray, IsBoolean, IsEnum, IsOptional, IsString, IsUUID } from 'class-validator';
import { EduAccessCarrier, EduAccessTaskKind, EduAccessTaskStatus, EduConnectorHealth } from '../../domain/enums';
import type { EdubridgeAccessTaskEntity, EdubridgeAdminEntity, EdubridgeConnectorBindingEntity } from '../../infrastructure/entities';
import { EduEnrollmentDTO } from './edu-enrollment.dto';
import { EduLearnerDTO } from './edu-learner.dto';
import './edu-enums.registration';

/** Строка реестра пайщиков приложения. Контакт пайщика — только владельцу (резолвер вырезает по гранту). */
@ObjectType('EduMemberRow')
export class EduMemberRowDTO {
  @Field(() => String, { description: 'Учётное имя пайщика' }) username!: string;
  @Field(() => String, { description: 'ФИО пайщика (у организации — наименование); пусто, если сертификата нет' }) display_name!: string;
  @Field(() => Int, { description: 'Обучающихся' }) learners_count!: number;
  @Field(() => Int, { description: 'Действующих подписок' }) active_enrollments!: number;
  @Field(() => Int, { description: 'Подписок, требующих внимания' }) attention_count!: number;
}

/** Сводная карточка пайщика для администратора. */
@ObjectType('EduMemberCard')
export class EduMemberCardDTO {
  @Field(() => String) username!: string;
  @Field(() => String, { description: 'ФИО пайщика' }) display_name!: string;
  @Field(() => [EduLearnerDTO]) learners!: EduLearnerDTO[];
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

  constructor(t: EdubridgeAccessTaskEntity) {
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

@ObjectType('EduConnectorBinding')
export class EduConnectorBindingDTO {
  @Field(() => EduAccessCarrier) carrier!: EduAccessCarrier;
  @Field(() => Boolean) enabled!: boolean;
  @Field(() => Boolean, { description: 'Ключи площадки заданы (сами ключи наружу не выдаются)' }) configured!: boolean;
  @Field(() => EduConnectorHealth) health!: EduConnectorHealth;
  @Field(() => Date, { nullable: true }) last_check_at!: Date | null;
  @Field(() => String, { nullable: true }) last_check_message!: string | null;

  constructor(b: EdubridgeConnectorBindingEntity, configured: boolean) {
    Object.assign(this, { carrier: b.carrier, enabled: b.enabled, configured, health: b.health, last_check_at: b.last_check_at, last_check_message: b.last_check_message });
  }
}

@InputType('EduSetConnectorEnabledInput')
export class EduSetConnectorEnabledInputDTO {
  @Field(() => EduAccessCarrier) @IsEnum(EduAccessCarrier) carrier!: EduAccessCarrier;
  @Field(() => Boolean) @IsBoolean() enabled!: boolean;
}

@ObjectType('EduAdmin')
export class EduAdminDTO {
  @Field(() => ID) id!: string;
  @Field(() => String) username!: string;
  @Field(() => String, { description: 'ФИО администратора' }) display_name!: string;
  @Field(() => String) appointed_by!: string;
  @Field(() => String, { description: 'ФИО назначившего' }) appointed_by_display_name!: string;
  @Field(() => Date) created_at!: Date;

  constructor(a: EdubridgeAdminEntity, names: { display_name?: string; appointed_by_display_name?: string } = {}) {
    Object.assign(this, {
      id: a.id,
      username: a.username,
      display_name: names.display_name ?? '',
      appointed_by: a.appointed_by,
      appointed_by_display_name: names.appointed_by_display_name ?? '',
      created_at: a.created_at,
    });
  }
}

@InputType('EduAdminInput')
export class EduAdminInputDTO {
  @Field(() => String, { description: 'Учётное имя пайщика' }) @IsString() username!: string;
}

@InputType('EduRetryTaskInput')
export class EduRetryTaskInputDTO {
  @Field(() => ID) @IsUUID() task_id!: string;
}
