import { Injectable, UseGuards } from '@nestjs/common';
import { Query, Resolver } from '@nestjs/graphql';
import { GqlJwtAuthGuard, platformSettings } from '@coopenomics/extension-kit';
import { CurrentEduMember } from '../decorators/current-edu-member.decorator';
import { RequireEduAccess } from '../decorators/edubridge-access.decorator';
import { EduReturnBalanceDTO } from '../dto/edu-return.dto';
import { EdubridgeAccessGuard } from '../guards/edubridge-access.guard';
import type { IEdubridgeMembership } from '../membership/edubridge-membership.service';
import { EdubridgeReturnService } from '../services/edubridge-return.service';

const coop = () => platformSettings().coopname;

/**
 * Кошелёк программы пайщика. Отдельного выхода из программы нет: остаток
 * возвращается в паевой взнос только при выходе из кооператива, поэтому здесь
 * пайщик лишь видит, сколько у него на кошельке.
 */
@Resolver()
@Injectable()
export class EdubridgeReturnResolver {
  constructor(private readonly returns: EdubridgeReturnService) {}

  @Query(() => EduReturnBalanceDTO, { name: 'edubridgeReturnBalance', description: 'Остаток кошелька программы и сумма, которая вернётся в паевой взнос при выходе из кооператива сегодня' })
  @UseGuards(GqlJwtAuthGuard, EdubridgeAccessGuard)
  @RequireEduAccess('EduReturn', 'read:own')
  async edubridgeReturnBalance(@CurrentEduMember() m: IEdubridgeMembership): Promise<EduReturnBalanceDTO> {
    return new EduReturnBalanceDTO(await this.returns.balance(coop(), m.username as string));
  }
}
