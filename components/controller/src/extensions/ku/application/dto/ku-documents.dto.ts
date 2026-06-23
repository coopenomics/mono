import { Field, InputType, Int, IntersectionType, OmitType } from '@nestjs/graphql';
import { Cooperative } from 'cooptypes';
import { IsArray, IsNotEmpty, IsNumber, IsOptional, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { GenerateMetaDocumentInputDTO } from '~/application/document/dto/generate-meta-document-input.dto';
import { MetaDocumentInputDTO } from '~/application/document/dto/meta-document-input.dto';
import { SignedDigitalDocumentInputDTO } from '~/application/document/dto/signed-digital-document-input.dto';
import type { ExcludeCommonProps } from '~/application/document/types';

// ─────────────────────────────────────────────────────────────────────────────
// Общие вложенные DTO
// ─────────────────────────────────────────────────────────────────────────────

@InputType('KuAgendaQuestionInput', { description: 'Вопрос повестки собрания пайщиков участка' })
export class KuAgendaQuestionInputDTO {
  @Field(() => String, { description: 'Номер вопроса' })
  @IsString()
  @IsNotEmpty()
  number!: string;

  @Field(() => String, { description: 'Заголовок вопроса' })
  @IsString()
  @IsNotEmpty()
  title!: string;

  @Field(() => String, { nullable: true, description: 'Дополнительная информация' })
  @IsOptional()
  @IsString()
  context?: string;

  @Field(() => String, { description: 'Проект решения по вопросу' })
  @IsString()
  @IsNotEmpty()
  decision!: string;
}

@InputType('KuBallotAnswerInput', { description: 'Волеизъявление по вопросу повестки' })
export class KuBallotAnswerInputDTO {
  @Field(() => String, { description: 'ID вопроса' })
  @IsString()
  @IsNotEmpty()
  id!: string;

  @Field(() => String, { description: 'Номер вопроса' })
  @IsString()
  @IsNotEmpty()
  number!: string;

  @Field(() => String, { description: 'Голос (за/против/воздержался)' })
  @IsString()
  @IsNotEmpty()
  vote!: 'for' | 'against' | 'abstained';
}

@InputType('KuBallotQuestionInput', { description: 'Вопрос собрания участка для бюллетеня' })
export class KuBallotQuestionInputDTO {
  @Field(() => String, { description: 'ID вопроса' })
  @IsString()
  @IsNotEmpty()
  id!: string;

  @Field(() => String, { description: 'Номер вопроса' })
  @IsString()
  @IsNotEmpty()
  number!: string;

  @Field(() => String, { description: 'Заголовок вопроса' })
  @IsString()
  @IsNotEmpty()
  title!: string;

  @Field(() => String, { nullable: true, description: 'Дополнительная информация' })
  @IsOptional()
  @IsString()
  context?: string;

  @Field(() => String, { description: 'Проект решения по вопросу' })
  @IsString()
  @IsNotEmpty()
  decision!: string;
}

@InputType('KuProtocolQuestionInput', { description: 'Вопрос протокола с результатами голосования' })
export class KuProtocolQuestionInputDTO {
  @Field(() => String, { description: 'Номер вопроса' })
  @IsString()
  @IsNotEmpty()
  number!: string;

  @Field(() => String, { description: 'Заголовок вопроса' })
  @IsString()
  @IsNotEmpty()
  title!: string;

  @Field(() => String, { nullable: true, description: 'Дополнительная информация' })
  @IsOptional()
  @IsString()
  context?: string;

  @Field(() => String, { description: 'Текст решения по вопросу' })
  @IsString()
  @IsNotEmpty()
  decision!: string;

  @Field(() => String, { description: 'Количество голосов «за»' })
  @IsString()
  counter_votes_for!: string;

  @Field(() => String, { description: 'Количество голосов «против»' })
  @IsString()
  counter_votes_against!: string;

  @Field(() => String, { description: 'Количество голосов «воздержался»' })
  @IsString()
  counter_votes_abstained!: string;

  @Field(() => Number, { description: 'Процент голосов «за»' })
  @IsNumber()
  votes_for_percent!: number;

  @Field(() => Number, { description: 'Процент голосов «против»' })
  @IsNumber()
  votes_against_percent!: number;

  @Field(() => Number, { description: 'Процент голосов «воздержался»' })
  @IsNumber()
  votes_abstained_percent!: number;

  @Field(() => Boolean, { description: 'Принято ли решение по вопросу' })
  is_accepted!: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// 320 — Предложение повестки собрания пайщиков участка
// ─────────────────────────────────────────────────────────────────────────────

type proposalAction = Cooperative.Registry.BranchMeetingProposal.Action;

@InputType('BaseBranchMeetingProposalMetaDocumentInput')
class BaseBranchMeetingProposalMetaDocumentInputDTO implements ExcludeCommonProps<proposalAction> {
  @Field(() => String, { description: 'Тип решения собрания (createbranch | free)' })
  @IsString()
  @IsNotEmpty()
  type!: 'createbranch' | 'free';

  @Field(() => String, { description: 'Хэш решения собрания' })
  @IsString()
  @IsNotEmpty()
  hash!: string;

  @Field(() => String, { nullable: true, description: 'Наименование кооперативного участка' })
  @IsOptional()
  @IsString()
  braname?: string;

  @Field(() => String, { nullable: true, description: 'Адрес привязки кооперативного участка' })
  @IsOptional()
  @IsString()
  address?: string;

  @Field(() => String, { nullable: true, description: 'Кандидат в председатели кооперативного участка' })
  @IsOptional()
  @IsString()
  chairman_candidate?: string;

  @Field(() => [KuAgendaQuestionInputDTO], { description: 'Вопросы повестки' })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => KuAgendaQuestionInputDTO)
  questions!: KuAgendaQuestionInputDTO[];
}

@InputType('BranchMeetingProposalGenerateDocumentInput')
export class BranchMeetingProposalGenerateDocumentInputDTO
  extends IntersectionType(
    BaseBranchMeetingProposalMetaDocumentInputDTO,
    OmitType(GenerateMetaDocumentInputDTO, ['registry_id'] as const)
  )
  implements proposalAction
{
  registry_id!: number;
}

@InputType('BranchMeetingProposalSignedMetaDocumentInput')
export class BranchMeetingProposalSignedMetaDocumentInputDTO extends IntersectionType(
  BaseBranchMeetingProposalMetaDocumentInputDTO,
  MetaDocumentInputDTO
) {}

@InputType('BranchMeetingProposalSignedDocumentInput')
export class BranchMeetingProposalSignedDocumentInputDTO extends SignedDigitalDocumentInputDTO {
  @Field(() => BranchMeetingProposalSignedMetaDocumentInputDTO, {
    description: 'Метаинформация предложения повестки собрания',
  })
  public readonly meta!: BranchMeetingProposalSignedMetaDocumentInputDTO;
}

// ─────────────────────────────────────────────────────────────────────────────
// 322 — Бюллетень голосования на собрании участка
// ─────────────────────────────────────────────────────────────────────────────

type ballotAction = Cooperative.Registry.BranchMeetingBallot.Action;

@InputType('BaseBranchMeetingBallotMetaDocumentInput')
class BaseBranchMeetingBallotMetaDocumentInputDTO implements ExcludeCommonProps<ballotAction> {
  @Field(() => String, { description: 'Хэш решения собрания' })
  @IsString()
  @IsNotEmpty()
  hash!: string;

  @Field(() => [KuBallotAnswerInputDTO], { description: 'Волеизъявления по вопросам повестки' })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => KuBallotAnswerInputDTO)
  answers!: KuBallotAnswerInputDTO[];

  @Field(() => [KuBallotQuestionInputDTO], { description: 'Вопросы повестки собрания' })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => KuBallotQuestionInputDTO)
  questions!: KuBallotQuestionInputDTO[];
}

@InputType('BranchMeetingBallotGenerateDocumentInput')
export class BranchMeetingBallotGenerateDocumentInputDTO
  extends IntersectionType(
    BaseBranchMeetingBallotMetaDocumentInputDTO,
    OmitType(GenerateMetaDocumentInputDTO, ['registry_id'] as const)
  )
  implements ballotAction
{
  registry_id!: number;
}

@InputType('BranchMeetingBallotSignedMetaDocumentInput')
export class BranchMeetingBallotSignedMetaDocumentInputDTO extends IntersectionType(
  BaseBranchMeetingBallotMetaDocumentInputDTO,
  MetaDocumentInputDTO
) {}

@InputType('BranchMeetingBallotSignedDocumentInput')
export class BranchMeetingBallotSignedDocumentInputDTO extends SignedDigitalDocumentInputDTO {
  @Field(() => BranchMeetingBallotSignedMetaDocumentInputDTO, {
    description: 'Метаинформация бюллетеня голосования',
  })
  public readonly meta!: BranchMeetingBallotSignedMetaDocumentInputDTO;
}

// ─────────────────────────────────────────────────────────────────────────────
// 323 — Протокол решения собрания пайщиков участка
// ─────────────────────────────────────────────────────────────────────────────

type protocolAction = Cooperative.Registry.BranchMeetingDecision.Action;

@InputType('BaseBranchMeetingDecisionMetaDocumentInput')
class BaseBranchMeetingDecisionMetaDocumentInputDTO implements ExcludeCommonProps<protocolAction> {
  @Field(() => String, { description: 'Хэш решения собрания' })
  @IsString()
  @IsNotEmpty()
  hash!: string;

  @Field(() => String, { description: 'Номер протокола' })
  @IsString()
  @IsNotEmpty()
  protocol_number!: string;

  @Field(() => String, { description: 'Имя аккаунта (username) председателя собрания' })
  @IsString()
  @IsNotEmpty()
  chairman!: string;

  @Field(() => String, { description: 'Дата и время открытия собрания' })
  @IsString()
  @IsNotEmpty()
  open_at_datetime!: string;

  @Field(() => String, { description: 'Дата и время закрытия собрания' })
  @IsString()
  @IsNotEmpty()
  close_at_datetime!: string;

  @Field(() => Number, { description: 'Кворум собрания, %' })
  @IsNumber()
  current_quorum_percent!: number;

  @Field(() => [KuProtocolQuestionInputDTO], { description: 'Вопросы повестки с результатами голосования' })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => KuProtocolQuestionInputDTO)
  questions!: KuProtocolQuestionInputDTO[];
}

@InputType('BranchMeetingDecisionGenerateDocumentInput')
export class BranchMeetingDecisionGenerateDocumentInputDTO
  extends IntersectionType(
    BaseBranchMeetingDecisionMetaDocumentInputDTO,
    OmitType(GenerateMetaDocumentInputDTO, ['registry_id'] as const)
  )
  implements protocolAction
{
  registry_id!: number;
}

@InputType('BranchMeetingDecisionSignedMetaDocumentInput')
export class BranchMeetingDecisionSignedMetaDocumentInputDTO extends IntersectionType(
  BaseBranchMeetingDecisionMetaDocumentInputDTO,
  MetaDocumentInputDTO
) {}

@InputType('BranchMeetingDecisionSignedDocumentInput')
export class BranchMeetingDecisionSignedDocumentInputDTO extends SignedDigitalDocumentInputDTO {
  @Field(() => BranchMeetingDecisionSignedMetaDocumentInputDTO, {
    description: 'Метаинформация протокола решения собрания',
  })
  public readonly meta!: BranchMeetingDecisionSignedMetaDocumentInputDTO;
}

// ─────────────────────────────────────────────────────────────────────────────
// 324 — Заявление председателя собрания в совет об учреждении участка
// ─────────────────────────────────────────────────────────────────────────────

type petitionAction = Cooperative.Registry.BranchEstablishmentPetition.Action;

@InputType('BaseBranchEstablishmentPetitionMetaDocumentInput')
class BaseBranchEstablishmentPetitionMetaDocumentInputDTO implements ExcludeCommonProps<petitionAction> {
  @Field(() => String, { description: 'Хэш решения собрания' })
  @IsString()
  @IsNotEmpty()
  hash!: string;

  @Field(() => String, { description: 'Наименование кооперативного участка' })
  @IsString()
  @IsNotEmpty()
  branch_name!: string;

  @Field(() => String, { description: 'Имя аккаунта (username) избранного председателя кооперативного участка' })
  @IsString()
  @IsNotEmpty()
  chairman!: string;

  @Field(() => String, { description: 'Адрес привязки кооперативного участка' })
  @IsString()
  @IsNotEmpty()
  address!: string;
}

@InputType('BranchEstablishmentPetitionGenerateDocumentInput')
export class BranchEstablishmentPetitionGenerateDocumentInputDTO
  extends IntersectionType(
    BaseBranchEstablishmentPetitionMetaDocumentInputDTO,
    OmitType(GenerateMetaDocumentInputDTO, ['registry_id'] as const)
  )
  implements petitionAction
{
  registry_id!: number;
}

@InputType('BranchEstablishmentPetitionSignedMetaDocumentInput')
export class BranchEstablishmentPetitionSignedMetaDocumentInputDTO extends IntersectionType(
  BaseBranchEstablishmentPetitionMetaDocumentInputDTO,
  MetaDocumentInputDTO
) {}

@InputType('BranchEstablishmentPetitionSignedDocumentInput')
export class BranchEstablishmentPetitionSignedDocumentInputDTO extends SignedDigitalDocumentInputDTO {
  @Field(() => BranchEstablishmentPetitionSignedMetaDocumentInputDTO, {
    description: 'Метаинформация заявления в совет об учреждении участка',
  })
  public readonly meta!: BranchEstablishmentPetitionSignedMetaDocumentInputDTO;
}

// ─────────────────────────────────────────────────────────────────────────────
// 325 — Решение совета об учреждении кооперативного участка
// ─────────────────────────────────────────────────────────────────────────────

type establishmentDecisionAction = Cooperative.Registry.BranchEstablishmentSovietDecision.Action;

@InputType('BaseBranchEstablishmentDecisionMetaDocumentInput')
class BaseBranchEstablishmentDecisionMetaDocumentInputDTO implements ExcludeCommonProps<establishmentDecisionAction> {
  @Field(() => Int, { description: 'Идентификатор решения совета' })
  @IsNumber()
  decision_id!: number;

  @Field(() => String, { description: 'Наименование кооперативного участка' })
  @IsString()
  @IsNotEmpty()
  branch_name!: string;

  @Field(() => String, { description: 'Адрес привязки кооперативного участка' })
  @IsString()
  @IsNotEmpty()
  address!: string;

  @Field(() => String, { description: 'Имя аккаунта (username) избранного председателя кооперативного участка' })
  @IsString()
  @IsNotEmpty()
  chairman!: string;
}

@InputType('BranchEstablishmentDecisionGenerateDocumentInput')
export class BranchEstablishmentDecisionGenerateDocumentInputDTO
  extends IntersectionType(
    BaseBranchEstablishmentDecisionMetaDocumentInputDTO,
    OmitType(GenerateMetaDocumentInputDTO, ['registry_id'] as const)
  )
  implements establishmentDecisionAction
{
  registry_id!: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// 326 — Заявление о приёме доверенным лицом участка
// ─────────────────────────────────────────────────────────────────────────────

type trustedStatementAction = Cooperative.Registry.BranchTrustedStatement.Action;

@InputType('BaseBranchTrustedStatementMetaDocumentInput')
class BaseBranchTrustedStatementMetaDocumentInputDTO implements ExcludeCommonProps<trustedStatementAction> {
  @Field(() => String, { description: 'Хэш заявки доверенного' })
  @IsString()
  @IsNotEmpty()
  hash!: string;

  @Field(() => String, { description: 'Наименование кооперативного участка' })
  @IsString()
  @IsNotEmpty()
  braname!: string;
}

@InputType('BranchTrustedStatementGenerateDocumentInput')
export class BranchTrustedStatementGenerateDocumentInputDTO
  extends IntersectionType(
    BaseBranchTrustedStatementMetaDocumentInputDTO,
    OmitType(GenerateMetaDocumentInputDTO, ['registry_id'] as const)
  )
  implements trustedStatementAction
{
  registry_id!: number;
}

@InputType('BranchTrustedStatementSignedMetaDocumentInput')
export class BranchTrustedStatementSignedMetaDocumentInputDTO extends IntersectionType(
  BaseBranchTrustedStatementMetaDocumentInputDTO,
  MetaDocumentInputDTO
) {}

@InputType('BranchTrustedStatementSignedDocumentInput')
export class BranchTrustedStatementSignedDocumentInputDTO extends SignedDigitalDocumentInputDTO {
  @Field(() => BranchTrustedStatementSignedMetaDocumentInputDTO, {
    description: 'Метаинформация заявления доверенного лица',
  })
  public readonly meta!: BranchTrustedStatementSignedMetaDocumentInputDTO;
}

// ─────────────────────────────────────────────────────────────────────────────
// 327 — Договор о полной индивидуальной материальной ответственности доверенного лица
// ─────────────────────────────────────────────────────────────────────────────

type trustedLiabilityAction = Cooperative.Registry.BranchTrustedLiabilityAgreement.Action;

@InputType('BaseBranchTrustedLiabilityAgreementMetaDocumentInput')
class BaseBranchTrustedLiabilityAgreementMetaDocumentInputDTO implements ExcludeCommonProps<trustedLiabilityAction> {
  @Field(() => String, { description: 'Хэш заявки доверенного' })
  @IsString()
  @IsNotEmpty()
  hash!: string;

  @Field(() => String, { description: 'Наименование кооперативного участка' })
  @IsString()
  @IsNotEmpty()
  branch_name!: string;

  @Field(() => String, { description: 'Имя аккаунта (username) председателя кооперативного участка' })
  @IsString()
  @IsNotEmpty()
  trustee!: string;
}

@InputType('BranchTrustedLiabilityAgreementGenerateDocumentInput')
export class BranchTrustedLiabilityAgreementGenerateDocumentInputDTO
  extends IntersectionType(
    BaseBranchTrustedLiabilityAgreementMetaDocumentInputDTO,
    OmitType(GenerateMetaDocumentInputDTO, ['registry_id'] as const)
  )
  implements trustedLiabilityAction
{
  registry_id!: number;
}

@InputType('BranchTrustedLiabilityAgreementSignedMetaDocumentInput')
export class BranchTrustedLiabilityAgreementSignedMetaDocumentInputDTO extends IntersectionType(
  BaseBranchTrustedLiabilityAgreementMetaDocumentInputDTO,
  MetaDocumentInputDTO
) {}

@InputType('BranchTrustedLiabilityAgreementSignedDocumentInput')
export class BranchTrustedLiabilityAgreementSignedDocumentInputDTO extends SignedDigitalDocumentInputDTO {
  @Field(() => BranchTrustedLiabilityAgreementSignedMetaDocumentInputDTO, {
    description: 'Метаинформация договора материальной ответственности доверенного лица',
  })
  public readonly meta!: BranchTrustedLiabilityAgreementSignedMetaDocumentInputDTO;
}

// ─────────────────────────────────────────────────────────────────────────────
// 328 — Договор о полной индивидуальной материальной ответственности председателя участка
// ─────────────────────────────────────────────────────────────────────────────

type trusteeLiabilityAction = Cooperative.Registry.BranchTrusteeLiabilityAgreement.Action;

@InputType('BaseBranchTrusteeLiabilityAgreementMetaDocumentInput')
class BaseBranchTrusteeLiabilityAgreementMetaDocumentInputDTO implements ExcludeCommonProps<trusteeLiabilityAction> {
  @Field(() => String, { description: 'Якорь процесса учреждения участка' })
  @IsString()
  @IsNotEmpty()
  hash!: string;

  @Field(() => String, { description: 'Наименование кооперативного участка' })
  @IsString()
  @IsNotEmpty()
  branch_name!: string;
}

@InputType('BranchTrusteeLiabilityAgreementGenerateDocumentInput')
export class BranchTrusteeLiabilityAgreementGenerateDocumentInputDTO
  extends IntersectionType(
    BaseBranchTrusteeLiabilityAgreementMetaDocumentInputDTO,
    OmitType(GenerateMetaDocumentInputDTO, ['registry_id'] as const)
  )
  implements trusteeLiabilityAction
{
  registry_id!: number;
}

@InputType('BranchTrusteeLiabilityAgreementSignedMetaDocumentInput')
export class BranchTrusteeLiabilityAgreementSignedMetaDocumentInputDTO extends IntersectionType(
  BaseBranchTrusteeLiabilityAgreementMetaDocumentInputDTO,
  MetaDocumentInputDTO
) {}

@InputType('BranchTrusteeLiabilityAgreementSignedDocumentInput')
export class BranchTrusteeLiabilityAgreementSignedDocumentInputDTO extends SignedDigitalDocumentInputDTO {
  @Field(() => BranchTrusteeLiabilityAgreementSignedMetaDocumentInputDTO, {
    description: 'Метаинформация договора материальной ответственности председателя участка',
  })
  public readonly meta!: BranchTrusteeLiabilityAgreementSignedMetaDocumentInputDTO;
}

// ─────────────────────────────────────────────────────────────────────────────
// 329 — Доверенность председателю кооперативного участка
// ─────────────────────────────────────────────────────────────────────────────

type trusteePowerOfAttorneyAction = Cooperative.Registry.BranchTrusteePowerOfAttorney.Action;

@InputType('BaseBranchTrusteePowerOfAttorneyMetaDocumentInput')
class BaseBranchTrusteePowerOfAttorneyMetaDocumentInputDTO implements ExcludeCommonProps<trusteePowerOfAttorneyAction> {
  @Field(() => String, { description: 'Якорь процесса учреждения участка' })
  @IsString()
  @IsNotEmpty()
  hash!: string;

  @Field(() => String, { description: 'Наименование кооперативного участка' })
  @IsString()
  @IsNotEmpty()
  branch_name!: string;

  @Field(() => String, { description: 'Адрес привязки кооперативного участка' })
  @IsString()
  @IsNotEmpty()
  branch_address!: string;
}

@InputType('BranchTrusteePowerOfAttorneyGenerateDocumentInput')
export class BranchTrusteePowerOfAttorneyGenerateDocumentInputDTO
  extends IntersectionType(
    BaseBranchTrusteePowerOfAttorneyMetaDocumentInputDTO,
    OmitType(GenerateMetaDocumentInputDTO, ['registry_id'] as const)
  )
  implements trusteePowerOfAttorneyAction
{
  registry_id!: number;
}

@InputType('BranchTrusteePowerOfAttorneySignedMetaDocumentInput')
export class BranchTrusteePowerOfAttorneySignedMetaDocumentInputDTO extends IntersectionType(
  BaseBranchTrusteePowerOfAttorneyMetaDocumentInputDTO,
  MetaDocumentInputDTO
) {}

@InputType('BranchTrusteePowerOfAttorneySignedDocumentInput')
export class BranchTrusteePowerOfAttorneySignedDocumentInputDTO extends SignedDigitalDocumentInputDTO {
  @Field(() => BranchTrusteePowerOfAttorneySignedMetaDocumentInputDTO, {
    description: 'Метаинформация доверенности председателю участка',
  })
  public readonly meta!: BranchTrusteePowerOfAttorneySignedMetaDocumentInputDTO;
}

// ─────────────────────────────────────────────────────────────────────────────
// 330 — Доверенность доверенному лицу кооперативного участка
// ─────────────────────────────────────────────────────────────────────────────

type trustedPowerOfAttorneyAction = Cooperative.Registry.BranchTrustedPowerOfAttorney.Action;

@InputType('BaseBranchTrustedPowerOfAttorneyMetaDocumentInput')
class BaseBranchTrustedPowerOfAttorneyMetaDocumentInputDTO implements ExcludeCommonProps<trustedPowerOfAttorneyAction> {
  @Field(() => String, { description: 'Хэш заявки доверенного' })
  @IsString()
  @IsNotEmpty()
  hash!: string;

  @Field(() => String, { description: 'Наименование кооперативного участка' })
  @IsString()
  @IsNotEmpty()
  branch_name!: string;

  @Field(() => String, { description: 'Имя аккаунта (username) председателя кооперативного участка' })
  @IsString()
  @IsNotEmpty()
  trustee!: string;
}

@InputType('BranchTrustedPowerOfAttorneyGenerateDocumentInput')
export class BranchTrustedPowerOfAttorneyGenerateDocumentInputDTO
  extends IntersectionType(
    BaseBranchTrustedPowerOfAttorneyMetaDocumentInputDTO,
    OmitType(GenerateMetaDocumentInputDTO, ['registry_id'] as const)
  )
  implements trustedPowerOfAttorneyAction
{
  registry_id!: number;
}

@InputType('BranchTrustedPowerOfAttorneySignedMetaDocumentInput')
export class BranchTrustedPowerOfAttorneySignedMetaDocumentInputDTO extends IntersectionType(
  BaseBranchTrustedPowerOfAttorneyMetaDocumentInputDTO,
  MetaDocumentInputDTO
) {}

@InputType('BranchTrustedPowerOfAttorneySignedDocumentInput')
export class BranchTrustedPowerOfAttorneySignedDocumentInputDTO extends SignedDigitalDocumentInputDTO {
  @Field(() => BranchTrustedPowerOfAttorneySignedMetaDocumentInputDTO, {
    description: 'Метаинформация доверенности доверенному лицу участка',
  })
  public readonly meta!: BranchTrustedPowerOfAttorneySignedMetaDocumentInputDTO;
}
