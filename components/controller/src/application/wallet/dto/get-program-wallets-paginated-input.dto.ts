import { InputType, Field } from '@nestjs/graphql';
import { ProgramWalletFilterInputDTO } from './program-wallet-filter-input.dto';
import { PaginationInputDTO } from '@coopenomics/extension-kit';

/**
 * GraphQL Input DTO для запроса программных кошельков с пагинацией
 */
@InputType('GetProgramWalletsPaginatedInput', {
  description: 'Входные данные для получения программных кошельков с фильтрацией и пагинацией',
})
export class GetProgramWalletsPaginatedInputDTO {
  @Field(() => ProgramWalletFilterInputDTO, {
    description: 'Фильтры для поиска программных кошельков',
    nullable: true,
  })
  filter?: ProgramWalletFilterInputDTO;

  @Field(() => PaginationInputDTO, {
    description: 'Параметры пагинации',
    nullable: true,
  })
  pagination?: PaginationInputDTO;
}
