import { Field, InputType } from '@nestjs/graphql';
import { IsNotEmpty, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { SignedDigitalDocumentInputDTO } from '@coopenomics/extension-kit';

/** Подпись пайщиком акта приёма-передачи имущества — первая подпись. */
@InputType('SignProgramPropertyActInput')
export class SignProgramPropertyActInputDTO {
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

  @Field(() => SignedDigitalDocumentInputDTO, { description: 'Акт приёма-передачи, подписанный пайщиком' })
  @ValidateNested()
  @Type(() => SignedDigitalDocumentInputDTO)
  act!: SignedDigitalDocumentInputDTO;
}
