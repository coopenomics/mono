import { Field, InputType } from '@nestjs/graphql';
import { IsNumber, IsString, Matches, ValidateNested } from 'class-validator';
import { ReturnByAssetStatementSignedDocumentInputDTO } from '../../document/documents-dto/return-by-asset-statement-document.dto';
import { ASSET_REGEX } from '~/types/shared';
@InputType('CreateChildOrderInput')
export class CreateChildOrderInputDTO {
  @Field({ description: 'Имя кооператива' })
  @IsString()
  coopname!: string;

  @Field({ description: 'Имя пользователя, инициирующего или обновляющего заявку' })
  @IsString()
  username!: string;

  @Field(() => Number, { description: 'Идентификатор родительской заявки' })
  @IsNumber()
  parent_id!: number;

  @Field(() => Number, { description: 'Идентификатор программы' })
  @IsNumber()
  program_id!: number;

  @Field(() => Number, { description: 'Количество частей (штук) товара или услуги' })
  @IsNumber()
  units!: number;

  @Field({ description: 'Цена за единицу (штуку) товара или результата услуги в формате "10.0000 RUB"' })
  @Matches(ASSET_REGEX, {
    message: 'Формат должен быть "10.0000 RUB" (число с четырьмя десятичными знаками + символ валюты)',
  })
  unit_cost!: string;

  @Field(() => Number, { description: 'Время жизни продукта, заявляемое поставщиком (в секундах)' })
  @IsNumber()
  product_lifecycle_secs!: number;

  @Field({ description: 'Дополнительные данные, специфичные для заявки' })
  @IsString()
  data!: string;

  @Field({ description: 'Метаданные о заявке' })
  @IsString()
  meta!: string;

  @Field(() => ReturnByAssetStatementSignedDocumentInputDTO, {
    description: 'Подписанное заявление на возврат паевого взноса имуществом от Заказчика',
  })
  @ValidateNested()
  document!: ReturnByAssetStatementSignedDocumentInputDTO;

  //TODO тут должен быть еще один документ, подтверждающий передачу денег со счёта кошелька?
}
