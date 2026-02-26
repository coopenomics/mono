import { ObjectType, Field, Int, Float } from '@nestjs/graphql';
import { ContributorStatus } from '../../../domain/enums/contributor-status.enum';
import { DocumentAggregateDTO } from '~/application/document/dto/document-aggregate.dto';
import { BaseOutputDTO } from '~/shared/dto/base.dto';
import { ContributorDocumentParametersDTO } from './contributor-document-parameters.dto';
import { ProgramWalletDTO } from '~/application/wallet/dto/program-wallet.dto';

/**
 * GraphQL Output DTO для сущности Contributor
 */
@ObjectType('CapitalContributor', {
  description: 'Участник кооператива в системе CAPITAL',
})
export class ContributorOutputDTO extends BaseOutputDTO {
  @Field(() => Int, {
    description: 'ID в блокчейне',
    nullable: true,
  })
  id?: number;

  @Field(() => ContributorStatus, {
    description: 'Статус участника',
  })
  status!: ContributorStatus;

  @Field(() => String, {
    description: 'Хеш участника',
  })
  contributor_hash!: string;

  @Field(() => String, {
    description: 'Название кооператива',
  })
  coopname!: string;

  @Field(() => String, {
    description: 'Имя пользователя',
  })
  username!: string;

  @Field(() => String, {
    nullable: true,
    description: 'Статус из блокчейна',
  })
  blockchain_status!: string;

  @Field(() => String, {
    nullable: true,
    description: 'Мемо/комментарий',
  })
  memo?: string;

  @Field(() => Boolean, {
    nullable: true,
    description: 'Является ли внешним контрактом',
  })
  is_external_contract!: boolean;

  @Field(() => String, {
    nullable: true,
    description: 'Ставка за час работы',
  })
  rate_per_hour!: string;

  @Field(() => Float, {
    nullable: true,
    description: 'Часов в день',
  })
  hours_per_day!: number;

  @Field(() => String, {
    nullable: true,
    description: 'О себе',
  })
  about?: string;

  @Field(() => String, {
    nullable: true,
    description: 'Сумма долга',
  })
  debt_amount!: string;

  @Field(() => String, {
    nullable: true,
    description: 'Вклад как инвестор',
  })
  contributed_as_investor!: string;

  @Field(() => String, {
    nullable: true,
    description: 'Вклад как исполнитель',
  })
  contributed_as_creator!: string;

  @Field(() => String, {
    nullable: true,
    description: 'Вклад как автор',
  })
  contributed_as_author!: string;

  @Field(() => String, {
    nullable: true,
    description: 'Вклад как координатор',
  })
  contributed_as_coordinator!: string;

  @Field(() => String, {
    nullable: true,
    description: 'Вклад как участник',
  })
  contributed_as_contributor!: string;

  @Field(() => String, {
    nullable: true,
    description: 'Вклад как собственник имущества',
  })
  contributed_as_propertor!: string;

  @Field(() => String, {
    nullable: true,
    description: 'Дата создания',
  })
  created_at!: string;

  @Field(() => Int, {
    nullable: true,
    description: 'Уровень участника',
  })
  level?: number;

  @Field(() => Float, {
    nullable: true,
    description: 'Энергия участника',
  })
  energy?: number;

  @Field(() => String, {
    nullable: true,
    description: 'Последнее обновление энергии',
  })
  last_energy_update?: string;

  @Field(() => DocumentAggregateDTO, {
    description: 'Контракт участника',
    nullable: true,
  })
  contract?: DocumentAggregateDTO | null;

  @Field(() => [String], {
    nullable: true,
    description: 'Приложения к контракту',
  })
  appendixes?: string[];

  @Field(() => String, {
    nullable: true,
    description: 'Отображаемое имя',
  })
  display_name!: string;

  @Field(() => String, {
    nullable: true,
    description: 'Ключ выбранной программы регистрации (generation, capitalization)',
  })
  program_key?: string;

  @Field(() => String, {
    nullable: true,
    description: 'Хеш оферты Благорост',
  })
  blagorost_offer_hash?: string;

  @Field(() => String, {
    nullable: true,
    description: 'Хеш оферты Генератор',
  })
  generator_offer_hash?: string;

  @Field(() => String, {
    nullable: true,
    description: 'Хеш договора УХД',
  })
  generation_contract_hash?: string;

  @Field(() => String, {
    nullable: true,
    description: 'Хеш соглашения о хранении имущества',
  })
  storage_agreement_hash?: string;

  @Field(() => String, {
    nullable: true,
    description: 'Хеш соглашения Благорост',
  })
  blagorost_agreement_hash?: string;

  @Field(() => ContributorDocumentParametersDTO, {
    nullable: true,
    description: 'Параметры документов участника из UData (номера и даты)',
  })
  document_parameters?: ContributorDocumentParametersDTO;

  @Field(() => ProgramWalletDTO, {
    nullable: true,
    description: 'Программный кошелек в программе Main',
  })
  main_wallet?: ProgramWalletDTO | null;

  @Field(() => ProgramWalletDTO, {
    nullable: true,
    description: 'Программный кошелек в программе Generation',
  })
  generation_wallet?: ProgramWalletDTO | null;

  @Field(() => ProgramWalletDTO, {
    nullable: true,
    description: 'Программный кошелек в программе Blagorost',
  })
  blagorost_wallet?: ProgramWalletDTO | null;
}
