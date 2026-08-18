import { ObjectType, Field, Int } from '@nestjs/graphql';
import { IsString, IsBoolean, IsNumber } from 'class-validator';
import { GeneratedDocumentDTO } from '@coopenomics/extension-kit';
import type { IGeneratedRegistrationDocument } from '~/domain/registration/interfaces/registration-documents.interface';

@ObjectType('GeneratedRegistrationDocument')
export class GeneratedRegistrationDocumentDTO {
  @Field({ description: 'Идентификатор соглашения (wallet_agreement, signature_agreement и т.д.)' })
  @IsString()
  id!: string;

  @Field({ description: 'Тип соглашения для блокчейна' })
  @IsString()
  agreement_type!: string;

  @Field({ description: 'Название документа' })
  @IsString()
  title!: string;

  @Field({ description: 'Текст для галочки на фронтенде' })
  @IsString()
  checkbox_text!: string;

  @Field({ description: 'Текст ссылки для открытия диалога чтения' })
  @IsString()
  link_text!: string;

  @Field(() => GeneratedDocumentDTO, { description: 'Сгенерированный документ' })
  document!: GeneratedDocumentDTO;

  @Field({ description: 'Нужно ли отправлять в блокчейн как agreement' })
  @IsBoolean()
  is_blockchain_agreement!: boolean;

  @Field({ description: 'Нужно ли линковать в заявление' })
  @IsBoolean()
  link_to_statement!: boolean;

  @Field(() => Int, { description: 'Порядок отображения' })
  @IsNumber()
  order!: number;

  constructor(data?: IGeneratedRegistrationDocument) {
    if (data) {
      this.id = data.id;
      this.agreement_type = data.agreement_type;
      this.title = data.title;
      this.checkbox_text = data.checkbox_text;
      this.link_text = data.link_text;
      this.document = new GeneratedDocumentDTO(data.document);
      this.is_blockchain_agreement = data.is_blockchain_agreement;
      this.link_to_statement = data.link_to_statement;
      this.order = data.order;
    }
  }
}
