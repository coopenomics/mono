import { InputType, Field } from '@nestjs/graphql';
import { IsString } from 'class-validator';
import { SignedDigitalDocumentInputDTO } from '~/application/document/dto/signed-digital-document-input.dto';

@InputType('AcceptChildOrderInput')
export class AcceptChildOrderInputDTO {
  @Field(() => String, { description: 'Имя аккаунта кооператива' })
  @IsString()
  coopname!: string;

  @Field(() => String, { description: 'Имя аккаунта поставщика' })
  @IsString()
  username!: string;

  @Field(() => String, { description: 'Хэш заявки' })
  @IsString()
  request_hash!: string;

  @Field(() => String, { description: 'КУ поставщика' })
  @IsString()
  supplier_braname!: string;

  @Field(() => SignedDigitalDocumentInputDTO, { description: 'Заявление на конвертацию в кошелёк' })
  convert_out!: SignedDigitalDocumentInputDTO;

  @Field(() => SignedDigitalDocumentInputDTO, { description: 'Заявление на возврат' })
  return_document!: SignedDigitalDocumentInputDTO;
}
