import { InputType, Field } from '@nestjs/graphql';
import { IsString, IsNotEmpty } from 'class-validator';

/**
 * Input для получения статистики заявок
 */
@InputType()
export class GetRequestStatisticsInput {
  @Field({ description: 'Название кооператива' })
  @IsString()
  @IsNotEmpty()
  coopname!: string;
}
