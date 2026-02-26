import { InputType, Field } from '@nestjs/graphql';
import { SegmentStatus } from '../../../domain/enums/segment-status.enum';

/**
 * Input DTO для фильтрации сегментов
 */
@InputType('CapitalSegmentFilter', {
  description: 'Параметры фильтрации для запросов сегментов CAPITAL',
})
export class SegmentFilterInputDTO {
  @Field(() => String, {
    nullable: true,
    description: 'Фильтр по названию кооператива',
  })
  coopname?: string;

  @Field(() => String, {
    nullable: true,
    description: 'Фильтр по имени пользователя',
  })
  username?: string;

  @Field(() => String, {
    nullable: true,
    description: 'Фильтр по хешу проекта',
  })
  project_hash?: string;

  @Field(() => SegmentStatus, {
    nullable: true,
    description: 'Фильтр по статусу сегмента',
  })
  status?: SegmentStatus;

  @Field(() => Boolean, {
    nullable: true,
    description: 'Фильтр по роли автора',
  })
  is_author?: boolean;

  @Field(() => Boolean, {
    nullable: true,
    description: 'Фильтр по роли создателя',
  })
  is_creator?: boolean;

  @Field(() => Boolean, {
    nullable: true,
    description: 'Фильтр по роли координатора',
  })
  is_coordinator?: boolean;

  @Field(() => Boolean, {
    nullable: true,
    description: 'Фильтр по роли инвестора',
  })
  is_investor?: boolean;

  @Field(() => Boolean, {
    nullable: true,
    description: 'Фильтр по роли пропертора',
  })
  is_propertor?: boolean;

  @Field(() => Boolean, {
    nullable: true,
    description: 'Фильтр по роли участника',
  })
  is_contributor?: boolean;

  @Field(() => Boolean, {
    nullable: true,
    description: 'Фильтр по наличию права голоса',
  })
  has_vote?: boolean;

  @Field(() => String, {
    nullable: true,
    description: 'Фильтр по parent_hash проекта (для фильтрации по проектам верхнего уровня передайте пустой хэш)',
  })
  parent_hash?: string;
}
