import { InputType, Field, IntersectionType, OmitType } from '@nestjs/graphql';
import { IsString } from 'class-validator';
import { Cooperative } from 'cooptypes';
import { SignedDigitalDocumentInputDTO, MetaDocumentInputDTO, GenerateMetaDocumentInputDTO } from '@coopenomics/extension-kit';

// утилита для выборки повторяющихся параметров из базовых интерфейсов
type ExcludeCommonProps<T> = Omit<T, 'coopname' | 'username' | 'registry_id'>;

// интерфейс параметров для генерации
type action = Cooperative.Registry.ReturnByMoney.Action;

@InputType(`BaseReturnByMoneyMetaDocumentInput`)
class BaseReturnByMoneyMetaDocumentInputDTO implements ExcludeCommonProps<action> {
  @Field({ description: 'ID платежного метода' })
  @IsString()
  method_id!: string;

  @Field({ description: 'Количество средств к возврату' })
  @IsString()
  quantity!: string;

  @Field({ description: 'Валюта' })
  @IsString()
  currency!: string;

  @Field({ description: 'Хеш платежа для связи с withdraw' })
  @IsString()
  payment_hash!: string;
}

@InputType(`ReturnByMoneyGenerateDocumentInput`)
export class ReturnByMoneyGenerateDocumentInputDTO extends IntersectionType(
  BaseReturnByMoneyMetaDocumentInputDTO,
  OmitType(GenerateMetaDocumentInputDTO, ['registry_id'] as const)
) {
  registry_id!: number;
}

@InputType(`ReturnByMoneySignedMetaDocumentInput`)
export class ReturnByMoneySignedMetaDocumentInputDTO extends IntersectionType(
  BaseReturnByMoneyMetaDocumentInputDTO,
  MetaDocumentInputDTO
) {}

@InputType(`ReturnByMoneySignedDocumentInput`)
export class ReturnByMoneySignedDocumentInputDTO extends SignedDigitalDocumentInputDTO {
  @Field(() => ReturnByMoneySignedMetaDocumentInputDTO, {
    description: 'Метаинформация для документа заявления на возврат паевого взноса денежными средствами',
  })
  public readonly meta!: ReturnByMoneySignedMetaDocumentInputDTO;
}
