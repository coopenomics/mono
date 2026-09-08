import { Field, Float, InputType, ObjectType, registerEnumType } from '@nestjs/graphql';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { DocumentAggregateDTO } from '@coopenomics/extension-kit';
import { MarketplaceReturnClaimDecisionEntryDTO, MarketplaceReturnClaimPhotoDTO } from './marketplace-return-claim.dto';
import { MarketplaceUnitOfMeasureEnum } from './marketplace-offer.dto';

/**
 * Гарантийная претензия поставщику (компонент 68, задача 99D-13) — то, что
 * поставщик видит в разделе «Гарантийные возвраты» своего стола.
 */
export enum MarketplaceSupplierClaimStatusEnum {
  PENDING = 'PENDING',
  ADMITTED = 'ADMITTED',
  REFUSED = 'REFUSED',
}

registerEnumType(MarketplaceSupplierClaimStatusEnum, {
  name: 'MarketplaceSupplierClaimStatus',
  description:
    'Состояние гарантийной претензии поставщику: ожидает ответа, признана (долг к удержанию из выплат), отклонена (основание для иска).',
});

@InputType('MarketplaceAdmitSupplierClaimInput')
export class MarketplaceAdmitSupplierClaimInputDTO {
  @Field(() => String, { description: 'Идентификатор претензии.' })
  @IsString()
  @IsNotEmpty()
  public readonly claim_id!: string;
}

@InputType('MarketplaceRefuseSupplierClaimInput')
export class MarketplaceRefuseSupplierClaimInputDTO {
  @Field(() => String, { description: 'Идентификатор претензии.' })
  @IsString()
  @IsNotEmpty()
  public readonly claim_id!: string;

  @Field(() => String, { description: 'Почему поставщик не признаёт претензию (до 500 символов).' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  public readonly reason!: string;
}

@ObjectType('MarketplaceSupplierClaim', {
  description: 'Гарантийная претензия поставщику по имуществу, возвращённому пайщиком и принятому обратно кооперативом.',
})
export class MarketplaceSupplierClaimDTO {
  @Field(() => String) public readonly id!: string;
  @Field() public readonly coopname!: string;
  @Field({ description: 'Хэш претензии в блокчейне — нитка процесса претензии.' })
  public readonly claim_hash!: string;
  @Field({ description: 'Заявление на гарантийный возврат, из которого выросла претензия.' })
  public readonly return_claim_id!: string;
  @Field() public readonly order_id!: string;
  @Field() public readonly order_hash!: string;
  @Field() public readonly supplier_account!: string;
  @Field() public readonly orderer_account!: string;
  @Field(() => String, { nullable: true, description: 'ФИО заказчика, вернувшего имущество.' })
  public readonly orderer_name!: string | null;
  @Field({ description: 'Кооперативный участок, где принято имущество и где его можно забрать.' })
  public readonly delivery_braname!: string;
  @Field(() => String, { nullable: true, description: 'Название кооперативного участка.' })
  public readonly delivery_branch_name!: string | null;
  @Field(() => String, { nullable: true, description: 'Наименование товара.' })
  public readonly product_name!: string | null;
  @Field(() => MarketplaceUnitOfMeasureEnum, { nullable: true, description: 'Базовая единица измерения товара.' })
  public readonly unit_of_measure!: MarketplaceUnitOfMeasureEnum | null;
  @Field(() => Float, { nullable: true, description: 'Размер упаковки; 0 или пусто — отпуск по мере.' })
  public readonly package_size!: number | null;
  @Field(() => Float, { description: 'Возвращённое количество в базовых единицах.' })
  public readonly actual_quantity!: number;
  @Field({ description: 'Сумма претензии — стоимость возвращённого имущества.' })
  public readonly amount!: string;
  @Field({ description: 'Причина обращения пайщика из рекламации.' })
  public readonly reason_text!: string;
  @Field({ description: 'Результат осмотра имущества оператором участка.' })
  public readonly inspection_result!: string;
  @Field(() => [MarketplaceReturnClaimPhotoDTO], { description: 'Фотографии из рекламации пайщика.' })
  public readonly photos!: MarketplaceReturnClaimPhotoDTO[];
  @Field(() => DocumentAggregateDTO, {
    nullable: true,
    description: 'Рекламация пайщика с двумя подписями — пайщика и оператора участка, принявшего имущество.',
  })
  public readonly reclamation!: DocumentAggregateDTO | null;
  @Field(() => MarketplaceSupplierClaimStatusEnum)
  public readonly status!: MarketplaceSupplierClaimStatusEnum;
  @Field({ description: 'Момент решения совета об отмене сделки — с него претензия выставлена.' })
  public readonly issued_at!: Date;
  @Field(() => Date, { nullable: true, description: 'Момент ответа поставщика или автоприёма.' })
  public readonly decided_at!: Date | null;
  @Field(() => String, { nullable: true, description: 'Причина отказа поставщика.' })
  public readonly refuse_reason!: string | null;
  @Field({ description: 'Претензия признана автоматически по истечении срока ответа.' })
  public readonly auto_admitted!: boolean;
  @Field(() => Date, {
    nullable: true,
    description: 'Когда претензия будет признана автоматически, если автоприём включён и ответа нет.',
  })
  public readonly auto_admit_at!: Date | null;
  @Field(() => [MarketplaceReturnClaimDecisionEntryDTO], {
    description: 'Пройденные шаги гарантийного возврата: рассмотрение, приём имущества, решение совета.',
  })
  public readonly history!: MarketplaceReturnClaimDecisionEntryDTO[];
  @Field(() => Date) public readonly created_at!: Date;
  @Field(() => Date) public readonly updated_at!: Date;
}

@ObjectType('MarketplaceSupplierClaimSummary', {
  description: 'Сводка гарантийных претензий поставщика по кошелькам: признанный долг к удержанию и отказанные суммы.',
})
export class MarketplaceSupplierClaimSummaryDTO {
  @Field({ description: 'Признанный гарантийный долг, ещё не удержанный из выплат.' })
  public readonly admitted_debt!: string;
  @Field({ description: 'Сумма претензий, по которым поставщик отказал — потенциальный иск.' })
  public readonly refused_total!: string;
  @Field({ description: 'Сумма претензий, ожидающих ответа поставщика.' })
  public readonly pending_total!: string;
  @Field({ description: 'Символ валюты.' })
  public readonly symbol!: string;
}

@ObjectType('MarketplaceSupplierClaimResult')
export class MarketplaceSupplierClaimResultDTO {
  @Field(() => MarketplaceSupplierClaimDTO) public readonly claim!: MarketplaceSupplierClaimDTO;
  @Field({ description: 'Хэш транзакции ответа поставщика.' }) public readonly tx_hash!: string;
}
