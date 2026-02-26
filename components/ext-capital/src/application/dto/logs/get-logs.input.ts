import { InputType, Field } from '@nestjs/graphql';
import { LogFilterInputDTO } from './log-filter.input';
import { PaginationInputDTO } from '~/application/common/dto/pagination.dto';

/**
 * GraphQL Input DTO для запроса логов с пагинацией
 */
@InputType('GetCapitalLogsInput', {
  description: 'Входные данные для получения логов событий с фильтрацией и пагинацией',
})
export class GetLogsInputDTO {
  @Field(() => LogFilterInputDTO, {
    description: 'Фильтры для поиска логов',
    nullable: true,
  })
  filter?: LogFilterInputDTO;

  @Field(() => PaginationInputDTO, {
    description: 'Параметры пагинации',
    nullable: true,
  })
  pagination?: PaginationInputDTO;
}
