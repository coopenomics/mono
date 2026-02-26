import { InputType, Field } from '@nestjs/graphql';
import { CycleStatus } from '../../../domain/enums/cycle-status.enum';

/**
 * Input DTO для фильтрации циклов
 */
@InputType('CapitalCycleFilter', {
  description: 'Параметры фильтрации для запросов циклов CAPITAL',
})
export class CycleFilterInputDTO {
  @Field(() => String, {
    nullable: true,
    description: 'Фильтр по названию цикла',
  })
  name?: string;

  @Field(() => CycleStatus, {
    nullable: true,
    description: 'Фильтр по статусу цикла',
  })
  status?: CycleStatus;

  @Field(() => String, {
    nullable: true,
    description: 'Фильтр по дате начала (YYYY-MM-DD)',
  })
  start_date?: string;

  @Field(() => String, {
    nullable: true,
    description: 'Фильтр по дате окончания (YYYY-MM-DD)',
  })
  end_date?: string;

  @Field(() => Boolean, {
    nullable: true,
    description: 'Показать только активные циклы',
  })
  is_active?: boolean;
}
