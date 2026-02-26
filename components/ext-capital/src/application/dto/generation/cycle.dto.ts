import { ObjectType, Field } from '@nestjs/graphql';
import { CycleStatus } from '../../../domain/enums/cycle-status.enum';
import { BaseOutputDTO } from '~/shared/dto/base.dto';

/**
 * GraphQL Output DTO для сущности Cycle
 */
@ObjectType('CapitalCycle', {
  description: 'Цикл разработки в системе CAPITAL',
})
export class CycleOutputDTO extends BaseOutputDTO {
  @Field(() => String, {
    description: 'Название цикла',
  })
  name!: string;

  @Field(() => Date, {
    description: 'Дата начала',
  })
  start_date!: Date;

  @Field(() => Date, {
    description: 'Дата окончания',
  })
  end_date!: Date;

  @Field(() => CycleStatus, {
    description: 'Статус цикла',
  })
  status!: CycleStatus;
}
