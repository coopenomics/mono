import { Field, InputType } from '@nestjs/graphql';
import { IsNotEmpty, IsString } from 'class-validator';

@InputType('MarketplaceListIssuancesByBranameInput')
export class MarketplaceListIssuancesByBranameInputDTO {
  @Field(() => String, { description: 'Кооперативный участок выдачи.' })
  @IsString()
  @IsNotEmpty()
  public readonly delivery_braname!: string;
}

/**
 * Ручное объявление готовности к выдаче оператором КУ («Объявить выдачу» на
 * столе ПВЗ). Не подпись и не on-chain действие — только сигнал заказчику
 * «приходите заберите» до его прихода.
 */
