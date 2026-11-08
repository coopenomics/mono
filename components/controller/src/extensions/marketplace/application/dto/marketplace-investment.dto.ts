import { Field, Float, InputType, ObjectType, registerEnumType } from '@nestjs/graphql';
import { Type } from 'class-transformer';
import { IsNotEmpty, IsNumber, IsString, Min, ValidateNested } from 'class-validator';
import { SignedDigitalDocumentInputDTO } from '@coopenomics/extension-kit';
import type { MarketContract } from 'cooptypes';
import {
  MarketplaceInvestHistoryKind,
  MarketplaceInvestPhase,
  MarketplaceInvestPropertyStatus,
  type MarketplaceInvestHistoryEntryView,
  type MarketplaceInvestBranchView,
  type MarketplaceInvestorView,
} from '../services/marketplace-investment.service';

registerEnumType(MarketplaceInvestPhase, {
  name: 'MarketplaceInvestPhase',
  description:
    'Фаза кооперативного участка по паевым взносам инициаторов: взносов нет; взносы есть, возмещения ещё не было; доля инициаторов возмещает взносы; использованное возмещено.',
});

registerEnumType(MarketplaceInvestPropertyStatus, {
  name: 'MarketplaceInvestPropertyStatus',
  description:
    'Этап заявления о паевом взносе имуществом: подано; председатель участка одобрил, вопрос в совете; совет принял решение, вносящий подписывает акт; акт ждёт подписи председателя участка.',
});

registerEnumType(MarketplaceInvestHistoryKind, {
  name: 'MarketplaceInvestHistoryKind',
  description: 'Вид записи истории паевых взносов: взнос деньгами; имущество принято; трансляция в Цифровой Кошелёк; перенос остатка при выходе из кооператива.',
});

/** Перевод суммы в единицах актива в строку для ответа. */
type ToAsset = (units: bigint) => string;

// ── Ответы ───────────────────────────────────────────────────────────────

@ObjectType('MarketplaceInvestAgreement', { description: 'Договор участия в хозяйственной деятельности по программе «Стол заказов».' })
export class MarketplaceInvestAgreementDTO {
  @Field({ description: 'Номер договора.' })
  number!: string;

  @Field({ description: 'Дата подписи.' })
  signed_at!: string;
}

@ObjectType('MarketplaceInvestor', { description: 'Паевые взносы пайщика-инициатора в кооперативный участок.' })
export class MarketplaceInvestorDTO {
  @Field({ description: 'Кооперативный участок.' })
  braname!: string;

  @Field({ description: 'Пайщик-инициатор.' })
  username!: string;

  @Field({ description: 'Возмещение ещё идёт; ложь — использованное возмещено целиком.' })
  active!: boolean;

  @Field({ description: 'Внесено деньгами.' })
  money!: string;

  @Field({ description: 'Внесено имуществом по цене приёма.' })
  property!: string;

  @Field({ description: 'Использовано участком: имущество и израсходованные деньги.' })
  used!: string;

  @Field({ description: 'Возмещено из экономии участка.' })
  returned!: string;

  @Field({ description: 'Уже переведено на главный паевой кошелёк.' })
  claimed!: string;

  @Field({ description: 'Доступно к переводу на главный паевой кошелёк сейчас. Предварительный расчёт; при заявлении сумму считает кооператив.' })
  claimable!: string;

  @Field({ description: 'Деньги, которые участок ещё не израсходовал: запас на месяцы, когда своих средств участка не хватает.' })
  unused!: string;
}

@ObjectType('MarketplaceInvestProperty', { description: 'Заявление о паевом взносе имуществом в кооперативный участок до приёма.' })
export class MarketplaceInvestPropertyDTO {
  @Field({ description: 'Идентификатор паевого взноса имуществом.' })
  hash!: string;

  @Field({ description: 'Вносящий пайщик.' })
  username!: string;

  @Field({ description: 'Цена приёма.' })
  amount!: string;

  @Field({ description: 'Наименование и описание имущества.' })
  description!: string;

  @Field(() => MarketplaceInvestPropertyStatus, { description: 'Этап заявления.' })
  status!: MarketplaceInvestPropertyStatus;
}

@ObjectType('MarketplaceBranchInvestment', { description: 'Паевые взносы инициаторов кооперативного участка и ход их возмещения.' })
export class MarketplaceBranchInvestmentDTO {
  @Field({ description: 'Кооперативный участок.' })
  braname!: string;

  @Field(() => MarketplaceInvestPhase, { description: 'Фаза участка по паевым взносам.' })
  phase!: MarketplaceInvestPhase;

  @Field({ description: 'Внесено деньгами всего.' })
  money_total!: string;

  @Field({ description: 'Внесено имуществом всего.' })
  property_total!: string;

  @Field({ description: 'Деньги инициаторов, ещё не израсходованные участком.' })
  unused_total!: string;

  @Field({ description: 'Выделено под незакрытые расходы и материальную помощь.' })
  reserved!: string;

  @Field({ description: 'Оплачено из средств инициаторов всего.' })
  spent_total!: string;

  @Field({ description: 'Возмещено инициаторам из экономии участка всего.' })
  repaid_total!: string;

  @Field({ description: 'Осталось возместить инициаторам из использованного.' })
  outstanding!: string;

  @Field(() => [MarketplaceInvestorDTO], { description: 'Инициаторы участка.' })
  investors!: MarketplaceInvestorDTO[];

  @Field(() => [MarketplaceInvestPropertyDTO], { description: 'Заявления на имущество до приёма.' })
  properties!: MarketplaceInvestPropertyDTO[];
}

@ObjectType('MarketplaceInvestHistoryEntry', { description: 'Запись истории паевых взносов пайщика в кооперативные участки.' })
export class MarketplaceInvestHistoryEntryDTO {
  @Field(() => MarketplaceInvestHistoryKind, { description: 'Вид записи.' })
  kind!: MarketplaceInvestHistoryKind;

  @Field({ description: 'Сумма: деньгами, по цене приёма имущества или трансляции.' })
  amount!: string;

  @Field({ description: 'Идентификатор процесса: по нему находится документ в реестре документов.' })
  process_hash!: string;

  @Field(() => Date, { description: 'Когда операция проведена.' })
  created_at!: Date;

  @Field({ description: 'Номер операции учёта.' })
  global_sequence!: string;
}

export function toMarketplaceInvestHistoryEntryDTO(v: MarketplaceInvestHistoryEntryView, toAsset: ToAsset): MarketplaceInvestHistoryEntryDTO {
  return { kind: v.kind, amount: toAsset(v.amount), process_hash: v.process_hash, created_at: v.created_at, global_sequence: v.global_sequence };
}

export function toMarketplaceInvestorDTO(v: MarketplaceInvestorView, toAsset: ToAsset): MarketplaceInvestorDTO {
  return {
    braname: v.braname,
    username: v.username,
    active: v.active,
    money: toAsset(v.money),
    property: toAsset(v.property),
    used: toAsset(v.used),
    returned: toAsset(v.returned),
    claimed: toAsset(v.claimed),
    claimable: toAsset(v.claimable),
    unused: toAsset(v.unused),
  };
}

export function toMarketplaceInvestPropertyDTO(p: MarketContract.Tables.InvProps.IMktInvProp): MarketplaceInvestPropertyDTO {
  return { hash: String(p.hash).toLowerCase(), username: p.username, amount: String(p.amount), description: p.description, status: String(p.status) as MarketplaceInvestPropertyStatus };
}

export function toMarketplaceBranchInvestmentDTO(v: MarketplaceInvestBranchView, toAsset: ToAsset): MarketplaceBranchInvestmentDTO {
  return {
    braname: v.braname,
    phase: v.phase,
    money_total: toAsset(v.money_total),
    property_total: toAsset(v.property_total),
    unused_total: toAsset(v.unused_total),
    reserved: toAsset(v.reserved),
    spent_total: toAsset(v.spent_total),
    repaid_total: toAsset(v.repaid_total),
    outstanding: toAsset(v.outstanding),
    investors: v.investors.map((i) => toMarketplaceInvestorDTO(i, toAsset)),
    properties: v.properties.map(toMarketplaceInvestPropertyDTO),
  };
}

// ── Входы ────────────────────────────────────────────────────────────────

@InputType('MarketplaceSignInvestAgreementInput')
export class MarketplaceSignInvestAgreementInputDTO {
  @Field(() => SignedDigitalDocumentInputDTO, { description: 'Подписанный договор участия в хозяйственной деятельности.' })
  @ValidateNested()
  @Type(() => SignedDigitalDocumentInputDTO)
  agreement!: SignedDigitalDocumentInputDTO;
}

@InputType('MarketplaceInvestStatementInput')
export class MarketplaceInvestStatementInputDTO {
  @Field({ description: 'Кооперативный участок.' })
  @IsString()
  @IsNotEmpty()
  braname!: string;

  @Field(() => Float, { description: 'Сумма паевого взноса деньгами.' })
  @IsNumber()
  @Min(0.0001)
  amount!: number;
}

@InputType('MarketplaceInvestMoneyInput')
export class MarketplaceInvestMoneyInputDTO extends MarketplaceInvestStatementInputDTO {
  @Field({ description: 'Идентификатор паевого взноса из подписанного заявления.' })
  @IsString()
  @IsNotEmpty()
  invest_hash!: string;

  @Field(() => SignedDigitalDocumentInputDTO, { description: 'Подписанное заявление о трансляции паевого взноса в договор участия.' })
  @ValidateNested()
  @Type(() => SignedDigitalDocumentInputDTO)
  statement!: SignedDigitalDocumentInputDTO;
}

@InputType('MarketplaceInvestPropertyStatementInput')
export class MarketplaceInvestPropertyStatementInputDTO {
  @Field({ description: 'Кооперативный участок.' })
  @IsString()
  @IsNotEmpty()
  braname!: string;

  @Field({ description: 'Наименование имущества.' })
  @IsString()
  @IsNotEmpty()
  property_name!: string;

  @Field({ description: 'Описание, характеристики и состояние.' })
  @IsString()
  @IsNotEmpty()
  property_description!: string;

  @Field({ description: 'Количество.' })
  @IsString()
  @IsNotEmpty()
  property_quantity!: string;

  @Field({ description: 'Единица измерения.' })
  @IsString()
  @IsNotEmpty()
  property_unit!: string;

  @Field(() => Float, { description: 'Цена приёма.' })
  @IsNumber()
  @Min(0.0001)
  amount!: number;
}

@InputType('MarketplaceCreateInvestPropertyInput')
export class MarketplaceCreateInvestPropertyInputDTO extends MarketplaceInvestPropertyStatementInputDTO {
  @Field({ description: 'Идентификатор паевого взноса имуществом из подписанного заявления.' })
  @IsString()
  @IsNotEmpty()
  property_hash!: string;

  @Field(() => SignedDigitalDocumentInputDTO, { description: 'Подписанное заявление о паевом взносе имуществом.' })
  @ValidateNested()
  @Type(() => SignedDigitalDocumentInputDTO)
  statement!: SignedDigitalDocumentInputDTO;
}

@InputType('MarketplaceInvestPropertyRefInput')
export class MarketplaceInvestPropertyRefInputDTO {
  @Field({ description: 'Кооперативный участок.' })
  @IsString()
  @IsNotEmpty()
  braname!: string;

  @Field({ description: 'Идентификатор паевого взноса имуществом.' })
  @IsString()
  @IsNotEmpty()
  property_hash!: string;
}

@InputType('MarketplaceSignInvestPropertyInput')
export class MarketplaceSignInvestPropertyInputDTO extends MarketplaceInvestPropertyRefInputDTO {
  @Field(() => SignedDigitalDocumentInputDTO, { description: 'Подписанный документ: одобрение заявления или акт приёма-передачи.' })
  @ValidateNested()
  @Type(() => SignedDigitalDocumentInputDTO)
  document!: SignedDigitalDocumentInputDTO;
}

@InputType('MarketplaceDeclineInvestPropertyInput')
export class MarketplaceDeclineInvestPropertyInputDTO extends MarketplaceInvestPropertyRefInputDTO {
  @Field({ description: 'Причина отказа.' })
  @IsString()
  @IsNotEmpty()
  reason!: string;
}

@InputType('MarketplaceClaimInvestmentInput')
export class MarketplaceClaimInvestmentInputDTO {
  @Field({ description: 'Кооперативный участок.' })
  @IsString()
  @IsNotEmpty()
  braname!: string;

  @Field({ description: 'Идентификатор заявления из подписанного документа.' })
  @IsString()
  @IsNotEmpty()
  claim_hash!: string;

  @Field(() => SignedDigitalDocumentInputDTO, { description: 'Подписанное заявление о трансляции средств на главный паевой кошелёк.' })
  @ValidateNested()
  @Type(() => SignedDigitalDocumentInputDTO)
  statement!: SignedDigitalDocumentInputDTO;
}
