import { Field, InputType } from '@nestjs/graphql';
import { validationMessage } from '@coopenomics/extension-kit';
import { IsNotEmpty, IsString } from 'class-validator';

/**
 * GraphQL Input DTO для получения конфигурации CAPITAL контракта
 */
@InputType('GetCapitalConfigInput')
export class GetCapitalConfigInputDTO {
  @Field(() => String, {
    description: 'Название кооператива',
  })
  @IsNotEmpty({ message: validationMessage('capital.getConfigInput.coopname.required') })
  @IsString({ message: validationMessage('capital.getConfigInput.coopname.string') })
  coopname!: string;
}
