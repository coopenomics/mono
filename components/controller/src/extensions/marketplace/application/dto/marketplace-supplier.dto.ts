import { Field, ObjectType, registerEnumType } from '@nestjs/graphql';
import {
  MarketplaceSupplierModel,
  MarketplaceSupplierStatus,
} from '../../domain/entities/marketplace-supplier.types';
import type { MarketplaceSupplierDomainEntity } from '../../domain/entities/marketplace-supplier.entity';

registerEnumType(MarketplaceSupplierModel, {
  name: 'MarketplaceSupplierModel',
  description: 'Модель работы поставщика: членская или боевая (паевая)',
});

registerEnumType(MarketplaceSupplierStatus, {
  name: 'MarketplaceSupplierStatus',
  description: 'Статус поставщика в реестре: на рассмотрении, одобрен, отклонён',
});

@ObjectType('MarketplaceSupplier')
export class MarketplaceSupplierDTO {
  @Field(() => String, { description: 'Идентификатор записи реестра' })
  public readonly id!: string;

  @Field(() => String, { description: 'Кооператив' })
  public readonly coopname!: string;

  @Field(() => String, { description: 'Аккаунт поставщика' })
  public readonly member_account!: string;

  @Field(() => MarketplaceSupplierModel, { description: 'Модель работы поставщика' })
  public readonly model!: MarketplaceSupplierModel;

  @Field(() => MarketplaceSupplierStatus, { description: 'Статус допуска поставщика' })
  public readonly status!: MarketplaceSupplierStatus;

  @Field(() => String, { nullable: true, description: 'Номер договора с поставщиком' })
  public readonly contract_number!: string | null;

  @Field(() => String, { nullable: true, description: 'Дата заключения договора' })
  public readonly contract_date!: string | null;

  @Field(() => String, { nullable: true, description: 'Ссылка на документ договора' })
  public readonly contract_document_url!: string | null;

  @Field(() => String, { nullable: true, description: 'Кто подал/добавил запись' })
  public readonly requested_by!: string | null;

  @Field(() => Date, { description: 'Когда подана заявка / создана запись' })
  public readonly requested_at!: Date;

  @Field(() => String, { nullable: true, description: 'Кто рассмотрел заявку (председатель)' })
  public readonly reviewed_by!: string | null;

  @Field(() => Date, { nullable: true, description: 'Когда заявка рассмотрена' })
  public readonly reviewed_at!: Date | null;

  static fromDomain(e: MarketplaceSupplierDomainEntity): MarketplaceSupplierDTO {
    const dto = new MarketplaceSupplierDTO();
    Object.assign(dto, {
      id: e.id,
      coopname: e.coopname,
      member_account: e.member_account,
      model: e.model,
      status: e.status,
      contract_number: e.contract_number,
      contract_date: e.contract_date,
      contract_document_url: e.contract_document_url,
      requested_by: e.requested_by,
      requested_at: e.requested_at,
      reviewed_by: e.reviewed_by,
      reviewed_at: e.reviewed_at,
    });
    return dto;
  }
}
