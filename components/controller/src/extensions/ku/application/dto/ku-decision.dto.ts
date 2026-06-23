import { Field, InputType, Int, ObjectType } from '@nestjs/graphql';
import { GraphQLJSON } from 'graphql-type-json';
import { IsBoolean, IsOptional, IsString } from 'class-validator';
import { KuDecisionType } from '../../domain/enums/ku-decision-type.enum';
import { KuDecisionStatus } from '../../domain/enums/ku-decision-status.enum';
import { DocumentAggregateDTO } from '~/application/document/dto/document-aggregate.dto';
import { AccountType } from '~/application/account/enum/account-type.enum';

@ObjectType('KuDecisionQuestion', { description: 'Вопрос повестки собрания пайщиков кооперативного участка' })
export class KuDecisionQuestionDTO {
  @Field(() => Int, { nullable: true, description: 'Идентификатор вопроса в блокчейне' })
  id?: number;

  @Field(() => Int, { nullable: true, description: 'Идентификатор решения собрания' })
  decision_id?: number;

  @Field(() => Int, { nullable: true, description: 'Порядковый номер вопроса в повестке' })
  number?: number;

  @Field(() => String, { nullable: true, description: 'Заголовок вопроса' })
  title?: string;

  @Field(() => String, { nullable: true, description: 'Проект решения по вопросу' })
  decision?: string;

  @Field(() => String, { nullable: true, description: 'Дополнительная информация по вопросу' })
  context?: string;

  @Field(() => Int, { nullable: true, description: 'Количество голосов «за»' })
  counter_votes_for?: number;

  @Field(() => Int, { nullable: true, description: 'Количество голосов «против»' })
  counter_votes_against?: number;

  @Field(() => Int, { nullable: true, description: 'Количество голосов «воздержался»' })
  counter_votes_abstained?: number;

  @Field(() => [String], { nullable: true, description: 'Проголосовавшие «за»' })
  voters_for?: string[];

  @Field(() => [String], { nullable: true, description: 'Проголосовавшие «против»' })
  voters_against?: string[];

  @Field(() => [String], { nullable: true, description: 'Проголосовавшие «воздержался»' })
  voters_abstained?: string[];
}

@ObjectType('KuMeetingParticipant', { description: 'Участник собрания пайщиков кооперативного участка' })
export class KuMeetingParticipantDTO {
  @Field(() => String, { description: 'Имя аккаунта участника' })
  username!: string;

  @Field(() => String, { description: 'Отображаемое имя участника (ФИО)' })
  display_name!: string;

  @Field(() => AccountType, { description: 'Тип аккаунта участника' })
  account_type!: AccountType;
}

@ObjectType('KuDecision', { description: 'Решение собрания пайщиков кооперативного участка' })
export class KuDecisionDTO {
  @Field(() => String, { description: 'Хэш решения (якорь процесса)' })
  hash!: string;

  @Field(() => Int, { nullable: true, description: 'Идентификатор решения в блокчейне' })
  id?: number;

  @Field(() => String, { nullable: true, description: 'Имя аккаунта кооператива' })
  coopname?: string;

  @Field(() => KuDecisionType, { nullable: true, description: 'Тип решения' })
  type?: KuDecisionType;

  @Field(() => String, { nullable: true, description: 'Инициатор собрания' })
  initiator?: string;

  @Field(() => String, { nullable: true, description: 'Председатель собрания' })
  chairman?: string;

  @Field(() => KuDecisionStatus, { nullable: true, description: 'Статус решения' })
  status?: KuDecisionStatus;

  @Field(() => Boolean, { description: 'Существует ли запись в блокчейне (false — завершено и стёрто)' })
  present!: boolean;

  @Field(() => GraphQLJSON, { nullable: true, description: 'Подписанное предложение повестки' })
  proposal?: object;

  @Field(() => GraphQLJSON, { nullable: true, description: 'Утверждённый протокол собрания' })
  protocol?: object;

  @Field(() => GraphQLJSON, { nullable: true, description: 'Заявление председателя в совет' })
  petition?: object;

  @Field(() => GraphQLJSON, { nullable: true, description: 'Решение совета' })
  authorization?: object;

  @Field(() => DocumentAggregateDTO, {
    nullable: true,
    description: 'Протокол собрания пайщиков с подписью и бюллетенями — для отображения на странице собрания',
  })
  protocol_document?: DocumentAggregateDTO;

  @Field(() => DocumentAggregateDTO, {
    nullable: true,
    description: 'Решение совета об организации кооперативного участка — для отображения на странице собрания',
  })
  authorization_document?: DocumentAggregateDTO;

  @Field(() => String, { nullable: true, description: 'Дата и время открытия голосования' })
  open_at?: string;

  @Field(() => String, { nullable: true, description: 'Дата и время закрытия голосования' })
  close_at?: string;

  @Field(() => Int, { nullable: true, description: 'Количество поданных бюллетеней' })
  signed_ballots?: number;

  @Field(() => String, { nullable: true, description: 'Имя аккаунта кооперативного участка (служебное)' })
  braname?: string;

  @Field(() => String, { nullable: true, description: 'Адрес привязки кооперативного участка' })
  address?: string;

  @Field(() => [String], { nullable: true, description: 'Участники собрания' })
  participants?: string[];

  @Field(() => [KuMeetingParticipantDTO], {
    nullable: true,
    description: 'Участники собрания с отображаемыми именами',
  })
  participants_info?: KuMeetingParticipantDTO[];

  @Field(() => String, { nullable: true, description: 'Дата и время объявления собрания' })
  created_at?: string;

  @Field(() => String, { nullable: true, description: 'Место проведения собрания (видно только пайщикам)' })
  meet_place?: string;

  @Field(() => String, { nullable: true, description: 'Дата и время проведения собрания (видно только пайщикам)' })
  meet_at?: string;

  @Field(() => String, { nullable: true, description: 'Наименование кооперативного участка (видно только пайщикам)' })
  branch_name?: string;

  @Field(() => String, { nullable: true, description: 'Email кооперативного участка (видно только пайщикам)' })
  branch_email?: string;

  @Field(() => String, { nullable: true, description: 'Телефон кооперативного участка (видно только пайщикам)' })
  branch_phone?: string;

  @Field(() => [KuDecisionQuestionDTO], { nullable: true, description: 'Вопросы повестки собрания' })
  questions?: KuDecisionQuestionDTO[];

  @Field(() => Int, { nullable: true, description: 'Номер блока последнего обновления' })
  block_num?: number;
}

@InputType('KuDecisionFilterInput', { description: 'Фильтр решений собраний кооперативных участков' })
export class KuDecisionFilterInputDTO {
  @Field(() => String, { nullable: true, description: 'Имя аккаунта кооператива' })
  @IsOptional()
  @IsString()
  coopname?: string;

  @Field(() => KuDecisionType, { nullable: true, description: 'Тип решения' })
  @IsOptional()
  type?: KuDecisionType;

  @Field(() => KuDecisionStatus, { nullable: true, description: 'Статус решения' })
  @IsOptional()
  status?: KuDecisionStatus;

  @Field(() => String, { nullable: true, description: 'Наименование кооперативного участка' })
  @IsOptional()
  @IsString()
  braname?: string;

  @Field(() => String, { nullable: true, description: 'Инициатор собрания' })
  @IsOptional()
  @IsString()
  initiator?: string;

  @Field(() => Boolean, { nullable: true, description: 'Только записи, существующие в блокчейне' })
  @IsOptional()
  @IsBoolean()
  present?: boolean;
}
