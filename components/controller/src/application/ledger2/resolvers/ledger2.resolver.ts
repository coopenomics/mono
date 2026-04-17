import { Resolver, Query, Args } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { AuthRoles } from '~/application/auth/decorators/auth.decorator';
import { GqlJwtAuthGuard } from '~/application/auth/guards/graphql-jwt-auth.guard';
import { RolesGuard } from '~/application/auth/guards/roles.guard';
import { Ledger2Service } from '../services/ledger2.service';
import { ValidateJournalInvariantInputDTO } from '../dto/validate-journal-input.dto';
import { ValidateJournalInvariantResultDTO } from '../dto/validate-journal-output.dto';

/**
 * GraphQL резолвер ledger2.
 * Сейчас предоставляет единственный запрос validateJournalInvariant —
 * сверку Dr=Cr по журналу двойных проводок в заданном диапазоне дат.
 */
@Resolver()
export class Ledger2Resolver {
  constructor(private readonly ledger2Service: Ledger2Service) {}

  @Query(() => ValidateJournalInvariantResultDTO, {
    name: 'validateJournalInvariant',
    description:
      'Проверить инвариант Dr=Cr по журналу двойных проводок контракта ledger2 в заданном диапазоне дат. Возвращает суммарные обороты и флаг ok.',
  })
  @UseGuards(GqlJwtAuthGuard, RolesGuard)
  @AuthRoles(['chairman', 'member'])
  async validateJournalInvariant(
    @Args('data', { type: () => ValidateJournalInvariantInputDTO })
    data: ValidateJournalInvariantInputDTO
  ): Promise<ValidateJournalInvariantResultDTO> {
    return this.ledger2Service.validateJournalInvariant(data);
  }
}
