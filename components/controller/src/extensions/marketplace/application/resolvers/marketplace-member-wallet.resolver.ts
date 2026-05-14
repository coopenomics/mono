import { Injectable, NotFoundException, UseGuards } from '@nestjs/common';
import { Query, Resolver } from '@nestjs/graphql';

import config from '~/config/config';
import { GqlJwtAuthGuard } from '~/application/auth/guards/graphql-jwt-auth.guard';
import { WalletService } from '~/application/wallet/services/wallet.service';
import { ProgramType } from '~/domain/wallet/enums/program-type.enum';

import { CurrentMarketplaceMember } from '../decorators/current-marketplace-member.decorator';
import type { IMarketplaceCurrentMember } from '../dto/marketplace-current-member.dto';
import { MarketplaceMemberWalletDTO } from '../dto/marketplace-member-wallet.dto';
import { MarketplaceMembershipGuard } from '../guards/marketplace-membership.guard';

/**
 * Story 1.5: GraphQL endpoint marketplace для чтения кошелька пайщика ЦК.
 *
 * Делегирует чтение в core `WalletService.getProgramWallet` (program_id=1,
 * ProgramType.MAIN); локальной таблицы `marketplace_member_wallet_link` нет —
 * core PG-кеш `ledger2::userwallets` уже консистентен с blockchain.
 *
 * AC PRD говорит про REST `GET /api/wallet/member/<account>` — controller
 * целиком GraphQL, делаем эквивалент `Query marketplaceMemberWallet`.
 * Расхождение зафиксировано как техдолг PRD.
 */
@Resolver()
@Injectable()
export class MarketplaceMemberWalletResolver {
  constructor(private readonly walletService: WalletService) {}

  @Query(() => MarketplaceMemberWalletDTO, {
    name: 'marketplaceMemberWallet',
    description:
      'Кошелёк пайщика (Цифровой кошелёк, program_id=1): available/blocked + membership_contribution',
  })
  @UseGuards(GqlJwtAuthGuard, MarketplaceMembershipGuard)
  async marketplaceMemberWallet(
    @CurrentMarketplaceMember() currentMember: IMarketplaceCurrentMember
  ): Promise<MarketplaceMemberWalletDTO> {
    const coopname = config.coopname;
    const wallet = await this.walletService.getProgramWallet({
      coopname,
      username: currentMember.username,
      program_type: ProgramType.MAIN,
    });

    if (!wallet) {
      // PG-кеш ничего не отдал — пайщик ещё не открывал main wallet через
      // ledger2; повторим запрос после доставки delta (CLAUDE.md запрещает
      // RPC fallback в read-path).
      throw new NotFoundException('Кошелёк пайщика ЦК не найден в локальном кеше');
    }

    return new MarketplaceMemberWalletDTO({
      username: currentMember.username,
      coopname,
      contract: 'wallet',
      available: wallet.available ?? '0',
      blocked: wallet.blocked ?? '0',
      membership_contribution: wallet.membership_contribution ?? '0',
    });
  }
}
