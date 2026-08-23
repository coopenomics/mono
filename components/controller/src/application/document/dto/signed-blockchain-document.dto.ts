import { Field, ObjectType } from '@nestjs/graphql';
import { IsString, IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import type { Cooperative } from 'cooptypes';
import { SignatureInfoDTO } from '@coopenomics/extension-kit';

@ObjectType('SignedBlockchainDocument')
export class SignedBlockchainDocumentDTO implements Cooperative.Document.IChainDocument2 {
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

  @Field(() => String, { description: 'Метаинформация документа (в формате JSON-строки)' })
  @IsString()
  public readonly meta!: string;

  @Field(() => [SignatureInfoDTO], { description: 'Вектор подписей' })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SignatureInfoDTO)
  public readonly signatures!: SignatureInfoDTO[];

  constructor(data?: SignedBlockchainDocumentDTO) {
    if (!data) return;

    Object.assign(this, data);
  }
}
