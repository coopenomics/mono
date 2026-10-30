import { Field, InputType } from '@nestjs/graphql';
import { IsNotEmpty, IsString } from 'class-validator';

/**
 * Сборка акта приёма-передачи по взносу: позицию имущества сервер берёт из
 * заявления, номер решения — из протокола совета.
 */
@InputType('GenerateProgramPropertyActInput')
export class GenerateProgramPropertyActInputDTO {
  @Field(() => String, { description: 'Имя аккаунта кооператива' })
  @IsString()
  @IsNotEmpty()
  coopname!: string;

  @Field(() => String, { description: 'Имя пайщика, передающего имущество' })
  @IsString()
  @IsNotEmpty()
  username!: string;

  @Field(() => String, { description: 'Идентификатор паевого взноса имуществом' })
  @IsString()
  @IsNotEmpty()
  property_hash!: string;
}
