import { Field, ID, InputType, ObjectType } from '@nestjs/graphql';
import { IsArray, IsDateString, IsEnum, IsOptional, IsString, IsUUID, Length, Matches, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { SignedDigitalDocumentInputDTO } from '@coopenomics/extension-kit';
import { EduAssignmentStatus, EduContributionStatus, EduRidType } from '../../domain/enums';
import type { EdubridgeContributionEntity, EdubridgeTeacherAssignmentEntity, EdubridgeTeacherContractEntity } from '../../infrastructure/entities';
import './edu-enums.registration';

const ASSET_PATTERN = /^\d+\.\d{4} [A-Z]{1,7}$/;

@ObjectType('EduTeacherContract')
export class EduTeacherContractDTO {
  @Field(() => String, { description: 'Хеш договора участия в хозяйственной деятельности' })
  contract_hash!: string;

  @Field(() => String, { description: 'Номер договора' })
  contract_number!: string;

  @Field(() => Date, { description: 'Подписан' })
  signed_at!: Date;

  constructor(e: EdubridgeTeacherContractEntity) {
    this.contract_hash = e.contract_hash;
    this.contract_number = e.contract_number;
    this.signed_at = e.signed_at;
  }
}

@ObjectType('EduAssignment')
export class EduAssignmentDTO {
  @Field(() => ID) id!: string;
  @Field(() => String, { description: 'Преподаватель' }) teacher_username!: string;
  @Field(() => ID, { description: 'Курс' }) course_id!: string;
  @Field(() => String, { description: 'Название курса' }) course_title!: string;
  @Field(() => String, { description: 'Расписание' }) schedule!: string;
  @Field(() => String, { description: 'Ожидаемый результат' }) expected_result!: string;
  @Field(() => String, { description: 'Период сдачи — начало' }) period_from!: string;
  @Field(() => String, { description: 'Период сдачи — конец' }) period_to!: string;
  @Field(() => String, { nullable: true, description: 'Хеш подписанного приложения к договору' }) annex_hash!: string | null;
  @Field(() => EduAssignmentStatus, { description: 'Состояние назначения' }) status!: EduAssignmentStatus;
  @Field(() => Date) created_at!: Date;

  constructor(e: EdubridgeTeacherAssignmentEntity, courseTitle: string) {
    this.id = e.id;
    this.teacher_username = e.teacher_username;
    this.course_id = e.course_id;
    this.course_title = courseTitle;
    this.schedule = e.schedule;
    this.expected_result = e.expected_result;
    this.period_from = e.period_from;
    this.period_to = e.period_to;
    this.annex_hash = e.annex_hash;
    this.status = e.status;
    this.created_at = e.created_at;
  }
}

@InputType('EduAssignmentInput')
export class EduAssignmentInputDTO {
  @Field(() => String, { description: 'Преподаватель (учётное имя)' }) @IsString() teacher_username!: string;
  @Field(() => ID, { description: 'Курс' }) @IsUUID() course_id!: string;
  @Field(() => String, { nullable: true, description: 'Расписание' }) @IsOptional() @IsString() schedule?: string;
  @Field(() => String, { nullable: true, description: 'Ожидаемый результат' }) @IsOptional() @IsString() expected_result?: string;
  @Field(() => String, { description: 'Период сдачи — начало (YYYY-MM-DD)' }) @IsDateString() period_from!: string;
  @Field(() => String, { description: 'Период сдачи — конец (YYYY-MM-DD)' }) @IsDateString() period_to!: string;
}

@InputType('EduSignAnnexInput')
export class EduSignAnnexInputDTO {
  @Field(() => ID, { description: 'Назначение' }) @IsUUID() assignment_id!: string;
  @Field(() => SignedDigitalDocumentInputDTO, { description: 'Подписанное приложение к договору (3007)' })
  @ValidateNested() @Type(() => SignedDigitalDocumentInputDTO) document!: SignedDigitalDocumentInputDTO;
}

@InputType('EduSignContractInput')
export class EduSignContractInputDTO {
  @Field(() => SignedDigitalDocumentInputDTO, { description: 'Подписанный договор участия в хозяйственной деятельности (3006)' })
  @ValidateNested() @Type(() => SignedDigitalDocumentInputDTO) document!: SignedDigitalDocumentInputDTO;
  @Field(() => String, { description: 'Номер договора из подписанного экземпляра' }) @IsString() @Length(1, 32) contract_number!: string;
}

@ObjectType('EduContribution')
export class EduContributionDTO {
  @Field(() => ID) id!: string;
  @Field(() => String, { description: 'Преподаватель' }) teacher_username!: string;
  @Field(() => ID, { description: 'Назначение' }) assignment_id!: string;
  @Field(() => String, { description: 'Ключ взноса в цепи' }) rid_hash!: string;
  @Field(() => EduRidType, { description: 'Тип результата интеллектуальной деятельности' }) rid_type!: EduRidType;
  @Field(() => [String], { description: 'Ссылки на внешние хранилища' }) links!: string[];
  @Field(() => String, { description: 'Описание результата' }) description!: string;
  @Field(() => String, { description: 'Сумма паевого взноса' }) amount!: string;
  @Field(() => EduContributionStatus, { description: 'Состояние' }) status!: EduContributionStatus;
  @Field(() => String, { nullable: true }) statement_hash!: string | null;
  @Field(() => String, { nullable: true }) decision_hash!: string | null;
  @Field(() => String, { nullable: true }) act_hash!: string | null;
  @Field(() => String, { nullable: true, description: 'Причина отклонения' }) decline_reason!: string | null;
  @Field(() => String, { nullable: true, description: 'Номер решения совета' }) council_decision_id!: string | null;
  @Field(() => Date, { nullable: true, description: 'Дата решения' }) decided_at!: Date | null;
  @Field(() => Date) created_at!: Date;

  constructor(e: EdubridgeContributionEntity) {
    Object.assign(this, {
      id: e.id, teacher_username: e.teacher_username, assignment_id: e.assignment_id, rid_hash: e.rid_hash, rid_type: e.rid_type,
      links: e.links ?? [], description: e.description, amount: e.amount, status: e.status, statement_hash: e.statement_hash,
      decision_hash: e.decision_hash, act_hash: e.act_hash, decline_reason: e.decline_reason, council_decision_id: e.council_decision_id,
      decided_at: e.decided_at, created_at: e.created_at,
    });
  }
}

@InputType('EduContributionDraftInput')
export class EduContributionDraftInputDTO {
  @Field(() => ID, { description: 'Назначение' }) @IsUUID() assignment_id!: string;
  @Field(() => EduRidType, { description: 'Тип результата' }) @IsEnum(EduRidType) rid_type!: EduRidType;
  @Field(() => [String], { description: 'Ссылки на внешние хранилища' }) @IsArray() links!: string[];
  @Field(() => String, { nullable: true, description: 'Описание' }) @IsOptional() @IsString() description?: string;
  @Field(() => String, { description: 'Сумма паевого взноса («5000.0000 RUB»)' }) @Matches(ASSET_PATTERN) amount!: string;
}

@InputType('EduSubmitContributionInput')
export class EduSubmitContributionInputDTO {
  @Field(() => ID, { description: 'Взнос (черновик)' }) @IsUUID() contribution_id!: string;
  @Field(() => SignedDigitalDocumentInputDTO, { description: 'Подписанное заявление о паевом взносе РИД (3008)' })
  @ValidateNested() @Type(() => SignedDigitalDocumentInputDTO) document!: SignedDigitalDocumentInputDTO;
}

@InputType('EduSignActInput')
export class EduSignActInputDTO {
  @Field(() => ID, { description: 'Взнос' }) @IsUUID() contribution_id!: string;
  @Field(() => SignedDigitalDocumentInputDTO, { description: 'Подписанный преподавателем акт приёма-передачи (3010)' })
  @ValidateNested() @Type(() => SignedDigitalDocumentInputDTO) document!: SignedDigitalDocumentInputDTO;
}

@InputType('EduAcceptContributionInput')
export class EduAcceptContributionInputDTO {
  @Field(() => ID, { description: 'Взнос' }) @IsUUID() contribution_id!: string;
  @Field(() => SignedDigitalDocumentInputDTO, { description: 'Тот же акт приёма-передачи с подписями преподавателя и председателя' })
  @ValidateNested() @Type(() => SignedDigitalDocumentInputDTO) document!: SignedDigitalDocumentInputDTO;
}

@InputType('EduDeclineContributionInput')
export class EduDeclineContributionInputDTO {
  @Field(() => ID, { description: 'Взнос' }) @IsUUID() contribution_id!: string;
  @Field(() => String, { description: 'Причина' }) @IsString() @Length(1, 2000) reason!: string;
}

/** Расчёт преподавателя: что причитается и где получить. */
@ObjectType('EduTeacherSettlement')
export class EduTeacherSettlementDTO {
  @Field(() => String, { description: 'Принято советом взносов РИД на сумму' }) accepted_total!: string;
  @Field(() => String, { description: 'Доступно в главном паевом кошельке (право требования)' }) available!: string;
  @Field(() => Date, { nullable: true, description: 'Дата последнего принятого взноса' }) last_accepted_at!: Date | null;
}
