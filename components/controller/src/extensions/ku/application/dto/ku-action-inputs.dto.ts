import { Field, InputType, Int } from '@nestjs/graphql';
import { IsArray, IsNotEmpty, IsNumber, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { KuDecisionType } from '../../domain/enums/ku-decision-type.enum';
import type {
  ApproveKuTrustedInputDomainInterface,
  CancelKuDecisionInputDomainInterface,
  CloseKuDecisionInputDomainInterface,
  CreateKuDecisionInputDomainInterface,
  DeclineKuTrustedInputDomainInterface,
  ExecKuDecisionInputDomainInterface,
  JoinKuDecisionInputDomainInterface,
  KuAgendaPointInputDomainInterface,
  KuVoteItemInputDomainInterface,
  RequestKuTrustedInputDomainInterface,
  StartKuDecisionInputDomainInterface,
  VoteOnKuDecisionInputDomainInterface,
} from '../../domain/interfaces/ku-action-inputs.interface';
import {
  BranchTrusteeLiabilityAgreementSignedDocumentInputDTO,
  BranchEstablishmentPetitionSignedDocumentInputDTO,
  BranchTrustedLiabilityAgreementSignedDocumentInputDTO,
  BranchTrusteePowerOfAttorneySignedDocumentInputDTO,
  BranchTrustedPowerOfAttorneySignedDocumentInputDTO,
  BranchMeetingBallotSignedDocumentInputDTO,
  BranchMeetingDecisionSignedDocumentInputDTO,
  BranchMeetingJoinStatementSignedDocumentInputDTO,
  BranchMeetingProposalSignedDocumentInputDTO,
} from './ku-documents.dto';

@InputType('KuAgendaPointInput', { description: 'Пункт повестки собрания пайщиков участка' })
export class KuAgendaPointInputDTO implements KuAgendaPointInputDomainInterface {
  @Field(() => String, { description: 'Заголовок вопроса' })
  @IsString()
  @IsNotEmpty()
  title!: string;

  @Field(() => String, { description: 'Проект решения по вопросу' })
  @IsString()
  @IsNotEmpty()
  decision!: string;

  @Field(() => String, { description: 'Дополнительная информация по вопросу', defaultValue: '' })
  @IsString()
  context!: string;
}

@InputType('CreateKuDecisionInput', { description: 'Объявление собрания пайщиков кооперативного участка' })
export class CreateKuDecisionInputDTO implements CreateKuDecisionInputDomainInterface {
  @Field(() => String, { description: 'Имя аккаунта кооператива' })
  @IsString()
  @IsNotEmpty()
  coopname!: string;

  @Field(() => String, { description: 'Хэш решения собрания (якорь процесса)' })
  @IsString()
  @IsNotEmpty()
  hash!: string;

  @Field(() => KuDecisionType, { description: 'Тип решения собрания' })
  type!: KuDecisionType;

  @Field(() => String, { description: 'Инициатор собрания' })
  @IsString()
  @IsNotEmpty()
  initiator!: string;

  @Field(() => String, {
    description: 'Имя аккаунта будущего кооперативного участка (для учреждения)',
    defaultValue: '',
  })
  @IsString()
  braname!: string;

  @Field(() => [KuAgendaPointInputDTO], { description: 'Повестка собрания' })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => KuAgendaPointInputDTO)
  agenda!: KuAgendaPointInputDTO[];

  @Field(() => BranchMeetingProposalSignedDocumentInputDTO, { description: 'Подписанное предложение повестки' })
  @ValidateNested()
  @Type(() => BranchMeetingProposalSignedDocumentInputDTO)
  proposal!: BranchMeetingProposalSignedDocumentInputDTO;

  @Field(() => String, { description: 'Место проведения собрания (видно только пайщикам кооператива)' })
  @IsString()
  @IsNotEmpty()
  meet_place!: string;

  @Field(() => String, { description: 'Дата и время проведения собрания (ISO)' })
  @IsString()
  @IsNotEmpty()
  meet_at!: string;
}

@InputType('JoinKuDecisionInput', { description: 'Присоединение пайщика к собранию участка' })
export class JoinKuDecisionInputDTO implements JoinKuDecisionInputDomainInterface {
  @Field(() => String, { description: 'Имя аккаунта кооператива' })
  @IsString()
  @IsNotEmpty()
  coopname!: string;

  @Field(() => String, { description: 'Хэш решения собрания' })
  @IsString()
  @IsNotEmpty()
  hash!: string;

  @Field(() => String, { description: 'Пайщик, присоединяющийся к собранию' })
  @IsString()
  @IsNotEmpty()
  username!: string;

  @Field(() => BranchMeetingJoinStatementSignedDocumentInputDTO, {
    description: 'Подписанное заявление о присоединении',
  })
  @ValidateNested()
  @Type(() => BranchMeetingJoinStatementSignedDocumentInputDTO)
  statement!: BranchMeetingJoinStatementSignedDocumentInputDTO;
}

@InputType('StartKuDecisionInput', { description: 'Открытие голосования на собрании участка' })
export class StartKuDecisionInputDTO implements StartKuDecisionInputDomainInterface {
  @Field(() => String, { description: 'Имя аккаунта кооператива' })
  @IsString()
  @IsNotEmpty()
  coopname!: string;

  @Field(() => String, { description: 'Хэш решения собрания' })
  @IsString()
  @IsNotEmpty()
  hash!: string;

  @Field(() => String, { description: 'Избираемый председатель кооперативного участка из числа присоединившихся участников' })
  @IsString()
  @IsNotEmpty()
  chairman!: string;

  @Field(() => String, { description: 'Адрес привязки кооперативного участка (для учреждения)', defaultValue: '' })
  @IsString()
  address!: string;

  @Field(() => String, {
    description: 'Наименование кооперативного участка (видно только пайщикам кооператива)',
    defaultValue: '',
  })
  @IsString()
  branch_name!: string;

  @Field(() => String, {
    description: 'Email кооперативного участка (видно только пайщикам кооператива)',
    defaultValue: '',
  })
  @IsString()
  branch_email!: string;

  @Field(() => String, {
    description: 'Телефон кооперативного участка (видно только пайщикам кооператива)',
    defaultValue: '',
  })
  @IsString()
  branch_phone!: string;

  @Field(() => [KuAgendaPointInputDTO], {
    description: 'Дополнительные вопросы повестки, внесённые на собрании',
    defaultValue: [],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => KuAgendaPointInputDTO)
  agenda!: KuAgendaPointInputDTO[];
}

@InputType('KuVoteItemInput', { description: 'Волеизъявление по вопросу повестки собрания участка' })
export class KuVoteItemInputDTO implements KuVoteItemInputDomainInterface {
  @Field(() => Int, { description: 'Идентификатор вопроса повестки' })
  @IsNumber()
  question_id!: number;

  @Field(() => String, { description: 'Голос по вопросу (for | against | abstained)' })
  @IsString()
  @IsNotEmpty()
  vote!: string;
}

@InputType('VoteOnKuDecisionInput', { description: 'Подача бюллетеня на собрании участка' })
export class VoteOnKuDecisionInputDTO implements VoteOnKuDecisionInputDomainInterface {
  @Field(() => String, { description: 'Имя аккаунта кооператива' })
  @IsString()
  @IsNotEmpty()
  coopname!: string;

  @Field(() => String, { description: 'Хэш решения собрания' })
  @IsString()
  @IsNotEmpty()
  hash!: string;

  @Field(() => String, { description: 'Голосующий участник собрания' })
  @IsString()
  @IsNotEmpty()
  username!: string;

  @Field(() => BranchMeetingBallotSignedDocumentInputDTO, { description: 'Подписанный бюллетень' })
  @ValidateNested()
  @Type(() => BranchMeetingBallotSignedDocumentInputDTO)
  ballot!: BranchMeetingBallotSignedDocumentInputDTO;

  @Field(() => [KuVoteItemInputDTO], { description: 'Волеизъявления по вопросам повестки' })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => KuVoteItemInputDTO)
  votes!: KuVoteItemInputDTO[];
}

@InputType('CloseKuDecisionInput', { description: 'Закрытие голосования и утверждение протокола собрания участка' })
export class CloseKuDecisionInputDTO implements CloseKuDecisionInputDomainInterface {
  @Field(() => String, { description: 'Имя аккаунта кооператива' })
  @IsString()
  @IsNotEmpty()
  coopname!: string;

  @Field(() => String, { description: 'Хэш решения собрания' })
  @IsString()
  @IsNotEmpty()
  hash!: string;

  @Field(() => BranchMeetingDecisionSignedDocumentInputDTO, {
    description: 'Протокол собрания, утверждённый подписью председателя',
  })
  @ValidateNested()
  @Type(() => BranchMeetingDecisionSignedDocumentInputDTO)
  protocol!: BranchMeetingDecisionSignedDocumentInputDTO;
}

@InputType('ExecKuDecisionInput', { description: 'Направление заявления председателя собрания в совет' })
export class ExecKuDecisionInputDTO implements ExecKuDecisionInputDomainInterface {
  @Field(() => String, { description: 'Имя аккаунта кооператива' })
  @IsString()
  @IsNotEmpty()
  coopname!: string;

  @Field(() => String, { description: 'Хэш решения собрания' })
  @IsString()
  @IsNotEmpty()
  hash!: string;

  @Field(() => BranchEstablishmentPetitionSignedDocumentInputDTO, {
    description: 'Подписанное заявление председателя в совет',
  })
  @ValidateNested()
  @Type(() => BranchEstablishmentPetitionSignedDocumentInputDTO)
  petition!: BranchEstablishmentPetitionSignedDocumentInputDTO;

  @Field(() => BranchTrusteeLiabilityAgreementSignedDocumentInputDTO, {
    description: 'Подписанный председателем участка договор о полной материальной ответственности (идёт в пакете в совет)',
  })
  @ValidateNested()
  @Type(() => BranchTrusteeLiabilityAgreementSignedDocumentInputDTO)
  liability!: BranchTrusteeLiabilityAgreementSignedDocumentInputDTO;

  @Field(() => BranchTrusteePowerOfAttorneySignedDocumentInputDTO, {
    description: 'Подписанная председателем участка доверенность председателю участка (идёт в пакете в совет)',
  })
  @ValidateNested()
  @Type(() => BranchTrusteePowerOfAttorneySignedDocumentInputDTO)
  authority!: BranchTrusteePowerOfAttorneySignedDocumentInputDTO;
}

@InputType('CancelKuDecisionInput', { description: 'Отмена собрания пайщиков участка' })
export class CancelKuDecisionInputDTO implements CancelKuDecisionInputDomainInterface {
  @Field(() => String, { description: 'Имя аккаунта кооператива' })
  @IsString()
  @IsNotEmpty()
  coopname!: string;

  @Field(() => String, { description: 'Хэш решения собрания' })
  @IsString()
  @IsNotEmpty()
  hash!: string;

  @Field(() => String, { description: 'Причина отмены' })
  @IsString()
  @IsNotEmpty()
  reason!: string;
}

@InputType('RequestKuTrustedInput', { description: 'Заявка на приём доверенным лицом кооперативного участка' })
export class RequestKuTrustedInputDTO implements RequestKuTrustedInputDomainInterface {
  @Field(() => String, { description: 'Имя аккаунта кооператива' })
  @IsString()
  @IsNotEmpty()
  coopname!: string;

  @Field(() => String, { description: 'Имя аккаунта кооперативного участка' })
  @IsString()
  @IsNotEmpty()
  braname!: string;

  @Field(() => String, { description: 'Пайщик-заявитель' })
  @IsString()
  @IsNotEmpty()
  username!: string;

  @Field(() => String, { description: 'Хэш заявки' })
  @IsString()
  @IsNotEmpty()
  hash!: string;

  @Field(() => BranchTrustedLiabilityAgreementSignedDocumentInputDTO, {
    description: 'Подписанный договор о полной материальной ответственности доверенного лица',
  })
  @ValidateNested()
  @Type(() => BranchTrustedLiabilityAgreementSignedDocumentInputDTO)
  application!: BranchTrustedLiabilityAgreementSignedDocumentInputDTO;

  @Field(() => BranchTrustedPowerOfAttorneySignedDocumentInputDTO, {
    description: 'Подписанная доверенным лицом доверенность доверенному лицу/оператору участка',
  })
  @ValidateNested()
  @Type(() => BranchTrustedPowerOfAttorneySignedDocumentInputDTO)
  authority!: BranchTrustedPowerOfAttorneySignedDocumentInputDTO;
}

@InputType('ApproveKuTrustedInput', { description: 'Одобрение заявки доверенного встречной подписью председателя участка' })
export class ApproveKuTrustedInputDTO implements ApproveKuTrustedInputDomainInterface {
  @Field(() => String, { description: 'Имя аккаунта кооператива' })
  @IsString()
  @IsNotEmpty()
  coopname!: string;

  @Field(() => String, { description: 'Хэш заявки' })
  @IsString()
  @IsNotEmpty()
  hash!: string;

  @Field(() => BranchTrustedLiabilityAgreementSignedDocumentInputDTO, {
    description: 'Договор материальной ответственности со встречной подписью председателя участка',
  })
  @ValidateNested()
  @Type(() => BranchTrustedLiabilityAgreementSignedDocumentInputDTO)
  countersigned!: BranchTrustedLiabilityAgreementSignedDocumentInputDTO;

  @Field(() => BranchTrustedPowerOfAttorneySignedDocumentInputDTO, {
    description: 'Доверенность доверенному лицу со встречной подписью председателя участка',
  })
  @ValidateNested()
  @Type(() => BranchTrustedPowerOfAttorneySignedDocumentInputDTO)
  countersigned_authority!: BranchTrustedPowerOfAttorneySignedDocumentInputDTO;
}

@InputType('DeclineKuTrustedInput', { description: 'Отклонение заявки доверенного лица' })
export class DeclineKuTrustedInputDTO implements DeclineKuTrustedInputDomainInterface {
  @Field(() => String, { description: 'Имя аккаунта кооператива' })
  @IsString()
  @IsNotEmpty()
  coopname!: string;

  @Field(() => String, { description: 'Хэш заявки' })
  @IsString()
  @IsNotEmpty()
  hash!: string;

  @Field(() => String, { description: 'Причина отклонения' })
  @IsString()
  @IsNotEmpty()
  reason!: string;
}
