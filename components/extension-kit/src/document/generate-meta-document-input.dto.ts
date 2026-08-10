/**
 * Запрос на формирование документа: обязателен только реестр и от кого документ,
 * остальное реестр проставит сам.
 *
 * Переехало из `~/application/document/dto` контроллера вместе с
 * `MetaDocumentInputDTO`. Явные thunk'и — по той же причине: каркас собирается
 * без `emitDecoratorMetadata`.
 */
import { IsOptional, IsString, IsNumber, IsArray, IsInt, IsEnum } from 'class-validator';
import { InputType, Field, Int } from '@nestjs/graphql';
import { LangType } from './lang-type.enum';
import type { Cooperative } from 'cooptypes';

@InputType('GenerateMetaDocumentInput')
export class GenerateMetaDocumentInputDTO implements Cooperative.Document.IGenerate {
  @Field(() => String, { description: 'Название документа', nullable: true })
  @IsOptional()
  @IsString()
  title?: string;

  @Field(() => Int, { description: 'ID документа в реестре' })
  @IsNumber()
  registry_id!: number;

  @Field(() => String, { description: 'Название кооператива, связанное с документом' })
  @IsString()
  coopname!: string;

  @Field(() => String, { description: 'Имя пользователя, создавшего документ' })
  @IsString()
  username!: string;

  @Field(() => String, { description: 'Язык документа', nullable: true })
  @IsOptional()
  @IsEnum(LangType)
  lang?: LangType;

  @Field(() => String, { description: 'Имя генератора, использованного для создания документа', nullable: true })
  @IsOptional()
  @IsString()
  generator?: string;

  @Field(() => String, { description: 'Версия генератора, использованного для создания документа', nullable: true })
  @IsOptional()
  @IsString()
  version?: string;

  @Field(() => String, { description: 'Дата и время создания документа', nullable: true })
  @IsOptional()
  created_at?: string;

  @Field(() => Int, { description: 'Номер блока, на котором был создан документ', nullable: true })
  @IsOptional()
  @IsInt()
  block_num?: number;

  @Field(() => String, { description: 'Часовой пояс, в котором был создан документ', nullable: true })
  @IsOptional()
  @IsString()
  timezone?: string;

  @Field(() => [String], { description: 'Ссылки, связанные с документом', nullable: true })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  links?: string[];
}
