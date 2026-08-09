import { Field, InputType } from '@nestjs/graphql';
import { IsString, ValidateNested, IsNumber, IsArray, ArrayMinSize, IsObject } from 'class-validator';
import { Type } from 'class-transformer';
import type { Cooperative } from 'cooptypes';
import type { ISignatureInfoDomainInterface, ISignedDocumentDomainInterface } from '@coopenomics/innercoop';
import { GraphQLJSON } from 'graphql-type-json';

@InputType('SignatureInfoInput')
export class SignatureInfoDTO implements ISignatureInfoDomainInterface {
  @Field(() => Number, { description: 'Идентификатор номера подписи' })
  @IsNumber()
  public readonly id!: number;

  @Field(() => String, { description: 'Аккаунт подписавшего' })
  @IsString()
  public readonly signer!: string;

  @Field(() => String, { description: 'Публичный ключ' })
  @IsString()
  public readonly public_key!: string;

  @Field(() => String, { description: 'Подпись хэша' })
  @IsString()
  public readonly signature!: string;

  @Field(() => String, { description: 'Время подписания' })
  @IsString()
  public readonly signed_at!: string;

  @Field(() => String, { description: 'Подписанный хэш' })
  @IsString()
  public readonly signed_hash!: string;

  @Field(() => String, { description: 'Мета-данные подписи' })
  @IsString()
  public readonly meta!: string;
}

@InputType('SignedDigitalDocumentInput')
export class SignedDigitalDocumentInputDTO implements ISignedDocumentDomainInterface {
  @Field(() => String, { description: 'Версия стандарта документа' })
  @IsString()
  public readonly version!: string;

  @Field(() => String, { description: 'Общий хэш (doc_hash + meta_hash)' })
  @IsString()
  public readonly hash!: string;

  @Field(() => String, { description: 'Хэш содержимого документа' })
  @IsString()
  public readonly doc_hash!: string;

  @Field(() => String, { description: 'Хэш мета-данных' })
  @IsString()
  public readonly meta_hash!: string;

  @Field(() => GraphQLJSON, { description: 'Метаинформация документа' })
  public readonly meta!: any;

  @Field(() => [SignatureInfoDTO], { description: 'Вектор подписей' })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => SignatureInfoDTO)
  public readonly signatures!: SignatureInfoDTO[];

  constructor(data: SignedDigitalDocumentInputDTO) {
    Object.assign(this, data);
  }

  /**
   * Преобразует подписанный документ DTO в формат IChainDocument для блокчейна
   */
  toDocument(): Cooperative.Document.IChainDocument2 {
    return {
      version: this.version,
      hash: this.hash,
      doc_hash: this.doc_hash,
      meta_hash: this.meta_hash,
      meta: JSON.stringify(this.meta),
      signatures: this.signatures,
    };
  }
}
