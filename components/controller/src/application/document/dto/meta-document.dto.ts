import { IsString, IsNumber, IsArray, IsInt, IsOptional } from 'class-validator';
import { Field, Int, ObjectType } from '@nestjs/graphql';
import type { Cooperative } from 'cooptypes';

@ObjectType('MetaDocument')
export class MetaDocumentDTO implements Cooperative.Document.IMetaDocument {
  @Field({ description: 'Название документа' })
  @IsString()
  title!: string;

  @Field(() => Int, { description: 'ID документа в реестре' })
  @IsNumber()
  registry_id!: number;

  @Field(() => String, { description: 'Язык документа' })
  @IsString()
  lang!: string;

  @Field({ description: 'Имя генератора, использованного для создания документа' })
  @IsString()
  generator!: string;

  @Field({ description: 'Версия генератора, использованного для создания документа' })
  @IsString()
  version!: string;

  @Field({ description: 'Название кооператива, связанное с документом' })
  @IsString()
  coopname!: string;

  @Field({ description: 'Имя пользователя, создавшего документ' })
  @IsString()
  username!: string;

  @Field({ description: 'Дата и время создания документа' })
  @IsString()
  created_at!: string;

  @Field(() => Int, { description: 'Номер блока, на котором был создан документ' })
  @IsInt()
  block_num!: number;

  @Field({ description: 'Часовой пояс, в котором был создан документ' })
  @IsString()
  timezone!: string;

  @Field(() => [String], { description: 'Ссылки, связанные с документом' })
  @IsArray()
  @IsString({ each: true })
  links!: string[];

  @Field(() => String, {
    nullable: true,
    description: 'Версия сборщика документа (major.minor); у документов, собранных до её появления, не задана',
  })
  @IsOptional()
  @IsString()
  builder?: string;
}
