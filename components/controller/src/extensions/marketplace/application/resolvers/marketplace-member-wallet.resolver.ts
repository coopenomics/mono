import { Inject, Injectable, UseGuards } from '@nestjs/common';
import { Query, Resolver } from '@nestjs/graphql';
import { Ledger2 } from 'cooptypes';

import { GqlJwtAuthGuard, platformSettings } from '@coopenomics/extension-kit';

import { CurrentMarketplaceMember } from '../decorators/current-marketplace-member.decorator';
import type { IMarketplaceCurrentMember } from '../dto/marketplace-current-member.dto';
import {
  MarketplaceMemberWalletDTO,
  MarketplaceWalletEntryDTO,
} from '../dto/marketplace-member-wallet.dto';
import { MarketplaceMembershipGuard } from '../guards/marketplace-membership.guard';
import { USER_WALLET_PORT, type IUserWalletPort } from '@coopenomics/innercoop';

/**
 * Релевантные стол-заказам USER_SHARED-кошельки по стандарту marketplace
 * (`marketplace/p.mkt.supply.standard.yaml`, секция «wallets»). Порядок
 * соответствует пути паевого взноса: `w.wal.share` (Цифровой кошелёк) →
 * `w.mkt.order` (паевой резерв под заказ) → `w.mkt.share` (свободный паевой
 * Стола заказов: остатки, источник заказов из остатка и доплат, вывод обратно).
 *
 * `label` — UX-метка в формате `<тип взноса> | <программа>`. Не та же что
 * `human_name` из cooptypes (там длинное юр.описание); этот label короткий,
 * для panel/list.
 */
const MARKETPLACE_RELEVANT_WALLETS: ReadonlyArray<{
  name: string;
  program_id: number;
  label: string;
}> = [
  { name: 'w.wal.share', program_id: 1, label: 'Паевой | Цифровой Кошелёк' },
  { name: 'w.mkt.order', program_id: 2, label: 'Паевой резерв под заказы | Стол Заказов' },
  { name: 'w.mkt.share', program_id: 2, label: 'Свободный паевой | Стол Заказов' },
];

/**
 * Story 1.5 (review-fix 2026-05-14): GraphQL endpoint marketplace для
 * чтения кошельков пайщика «как есть» — без сворачивания share+member и
 * без переименования в old-style `available/blocked/membership_contribution`.
 *
 * Возвращает массив USER_SHARED-кошельков, релевантных столу заказов;
 * каждый со своим `name` (eosio::name), `human_name`, `program_id`,
 * `available`/`blocked`. Если L3-запись ещё не создана (пайщик не
 * двигал средства через данный кошелёк) — возвращаем `0/0` — это
 * рабочее состояние, а не ошибка (RPC fallback запрещён ADR-011).
 *
 * Источник: `IUserWalletPort.findByUsername` (PG-кеш
 * `ledger2::userwallets`). `WalletService.getProgramWallet` сворачивает
 * split-кошельки ЦК и неприменим для UX, требующего видеть каждый
 * кошелёк отдельно (review @dacom-dark-sun, PR #380).
 */
@Resolver()
@Injectable()
export class MarketplaceMemberWalletResolver {
  constructor(
    @Inject(USER_WALLET_PORT)
    private readonly userWalletRepository: IUserWalletPort
  ) {}

  @Query(() => MarketplaceMemberWalletDTO, {
    name: 'marketplaceMemberWallet',
    description:
      'Кошельки пайщика в Столе заказов: паевой Цифрового кошелька, паевой резерв под заказы и свободный паевой Стола заказов.',
  })
  @UseGuards(GqlJwtAuthGuard, MarketplaceMembershipGuard)
  async marketplaceMemberWallet(
    @CurrentMarketplaceMember() currentMember: IMarketplaceCurrentMember
  ): Promise<MarketplaceMemberWalletDTO> {
    const coopname = platformSettings().coopname;
    const rows = await this.userWalletRepository.findByUsername(coopname, currentMember.username);

    const wallets = MARKETPLACE_RELEVANT_WALLETS.map((target) => {
      const row = rows.find((r) => r.wallet_name === target.name);
      return new MarketplaceWalletEntryDTO({
        name: target.name,
        human_name: Ledger2.getWalletHumanName(target.name as `${string}.${string}.${string}`) ?? target.name,
        program_id: target.program_id,
        label: target.label,
        kind: 'USER_SHARED',
        available: row?.available ?? '0',
        blocked: row?.blocked ?? '0',
      });
    });

    return new MarketplaceMemberWalletDTO({
      username: currentMember.username,
      coopname,
      wallets,
    });
  }
}
