import { Field, InputType } from '@nestjs/graphql';
import { IsNotEmpty, IsString } from 'class-validator';

/**
 * GraphQL Input DTO для получения конфигурации CAPITAL контракта
 */
@InputType('GetCapitalConfigInput')
export class GetCapitalConfigInputDTO {
  @Field(() => String, {
    description: 'Название кооператива',
  })
  @IsNotEmpty({ message: 'Название кооператива не должно быть пустым' })
  @IsString({ message: 'Название кооператива должно быть строкой' })
  coopname!: string;
}
