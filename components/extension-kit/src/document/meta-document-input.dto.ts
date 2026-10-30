/**
 * Метаданные документа на вход: к какому реестру относится, кем и для кого
 * сформирован.
 *
 * Переехало из `~/application/document/dto` контроллера: этого пути за
 * пределами монолита нет, а форму документа заполняет каждое расширение,
 * подписывающее документы.
 *
 * У каждого поля явный thunk `@Field(() => T)`: каркас собирается esbuild'ом
 * без `emitDecoratorMetadata`, и `@Field({ description })` дал бы поле без типа.
 */
import { IsString, IsNumber, IsArray, IsInt, IsEnum, IsOptional } from 'class-validator';
import { InputType, Field, Int } from '@nestjs/graphql';
import { LangType } from './lang-type.enum';
import type { IMetaDocument } from '@coopenomics/docs-templates';

@InputType('MetaDocumentInput')
export class MetaDocumentInputDTO implements IMetaDocument {
  @Field(() => String, { description: 'Название документа' })
  @IsString()
  title!: string;

  @Field(() => Int, { description: 'ID документа в реестре' })
  @IsNumber()
  registry_id!: number;

  @Field(() => String, { description: 'Язык документа' })
  @IsEnum(LangType)
  lang!: LangType;

  @Field(() => String, { description: 'Имя генератора, использованного для создания документа' })
  @IsString()
  generator!: string;

  @Field(() => String, { description: 'Версия генератора, использованного для создания документа' })
  @IsString()
  version!: string;

  @Field(() => String, { description: 'Название кооператива, связанное с документом' })
  @IsString()
  coopname!: string;

  @Field(() => String, { description: 'Имя пользователя, создавшего документ' })
  @IsString()
  username!: string;

  @Field(() => String, { description: 'Дата и время создания документа' })
  @IsString()
  created_at!: string;

  @Field(() => Int, { description: 'Номер блока, на котором был создан документ' })
  @IsInt()
  block_num!: number;

  @Field(() => String, { description: 'Часовой пояс, в котором был создан документ' })
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
