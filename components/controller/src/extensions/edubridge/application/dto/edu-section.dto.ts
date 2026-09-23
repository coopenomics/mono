import { Field, ID, InputType, Int, ObjectType } from '@nestjs/graphql';
import { IsArray, IsBoolean, IsOptional, IsString, IsUUID, Length } from 'class-validator';
import type { EdubridgeLevelEntity, EdubridgeSectionEntity } from '../../infrastructure/entities';

@ObjectType('EduLevel')
export class EduLevelDTO {
  @Field(() => ID) id!: string;
  @Field(() => ID, { description: 'Раздел уровня' }) section_id!: string;
  @Field(() => String, { description: 'Уровень внутри раздела: «7 класс», «Ступень 1»' }) title!: string;
  @Field(() => Int, { description: 'Место уровня в последовательности раздела: меньше — раньше' }) sort_order!: number;
  @Field(() => Boolean, { description: 'В архиве: не предлагается новым курсам и в каталоге' }) archived!: boolean;

  constructor(e: EdubridgeLevelEntity) {
    this.id = e.id;
    this.section_id = e.section_id;
    this.title = e.title;
    this.sort_order = e.sort_order;
    this.archived = e.archived;
  }
}

@ObjectType('EduSection')
export class EduSectionDTO {
  @Field(() => ID) id!: string;
  @Field(() => String, { description: 'Раздел каталога — область знаний: «Математика», «Духовные практики»' }) title!: string;
  @Field(() => Int, { description: 'Порядок раздела: меньше — выше' }) sort_order!: number;
  @Field(() => Boolean, { description: 'В архиве: не предлагается новым курсам и в каталоге' }) archived!: boolean;
  @Field(() => [EduLevelDTO], { description: 'Уровни раздела в их последовательности' }) levels!: EduLevelDTO[];

  constructor(e: EdubridgeSectionEntity, levels: EdubridgeLevelEntity[]) {
    this.id = e.id;
    this.title = e.title;
    this.sort_order = e.sort_order;
    this.archived = e.archived;
    this.levels = levels.map((l) => new EduLevelDTO(l));
  }
}

@InputType('EduSectionsFilterInput')
export class EduSectionsFilterInputDTO {
  @Field(() => Boolean, { nullable: true, description: 'Показать и архивные — для страницы управления справочником' })
  @IsOptional()
  @IsBoolean()
  include_archived?: boolean;

  @Field(() => Boolean, { nullable: true, description: 'Только разделы и уровни, по которым есть опубликованные курсы, — для фильтров каталога' })
  @IsOptional()
  @IsBoolean()
  only_with_courses?: boolean;
}

@InputType('EduSaveSectionInput')
export class EduSaveSectionInputDTO {
  @Field(() => ID, { nullable: true, description: 'Раздел, который переименовать; пусто — новый раздел' })
  @IsOptional()
  @IsUUID()
  id?: string;

  @Field(() => String, { description: 'Название раздела' })
  @IsString()
  @Length(1, 120)
  title!: string;
}

@InputType('EduSaveLevelInput')
export class EduSaveLevelInputDTO {
  @Field(() => ID, { nullable: true, description: 'Уровень, который переименовать; пусто — новый уровень' })
  @IsOptional()
  @IsUUID()
  id?: string;

  @Field(() => ID, { description: 'Раздел уровня' })
  @IsUUID()
  section_id!: string;

  @Field(() => String, { description: 'Название уровня' })
  @IsString()
  @Length(1, 60)
  title!: string;
}

@InputType('EduReorderInput')
export class EduReorderInputDTO {
  @Field(() => ID, { nullable: true, description: 'Раздел, чьи уровни упорядочиваются; для разделов — пусто' })
  @IsOptional()
  @IsUUID()
  section_id?: string;

  @Field(() => [ID], { description: 'Идентификаторы в новом порядке' })
  @IsArray()
  @IsUUID('all', { each: true })
  ids!: string[];
}

@InputType('EduArchiveInput')
export class EduArchiveInputDTO {
  @Field(() => ID) @IsUUID() id!: string;

  @Field(() => Boolean, { description: 'true — убрать в архив, false — вернуть' })
  @IsBoolean()
  archived!: boolean;
}
