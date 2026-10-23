import { UseGuards } from '@nestjs/common';
import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import {
  GqlJwtAuthGuard,
  PaginationInputDTO,
  RequireRight,
  RightsGuard,
  createPaginationResult,
  type PaginationResult,
} from '@coopenomics/extension-kit';
import { ShareTransferService } from '../services/share-transfer.service';
import { TransferShareInputDTO } from '../dto/share_transfer/transfer-share-input.dto';
import { ShareTransferStateDTO, ShareTransferStateInputDTO } from '../dto/share_transfer/share-transfer-state.dto';
import { ShareTransferDTO } from '../dto/share_transfer/share-transfer.dto';
import { ShareTransferFilterInputDTO } from '../dto/share_transfer/share-transfer-filter.input';

const paginatedShareTransfersResult = createPaginationResult(ShareTransferDTO, 'PaginatedCapitalShareTransfers');

/**
 * Трансляция паевого взноса из Благороста в Цифровой Кошелёк. Операции
 * открыты председателю и пайщикам с ролью «Трансляция паевого взноса»; пайщик
 * действует и видит историю только на своё имя.
 */
@Resolver()
@UseGuards(GqlJwtAuthGuard, RightsGuard)
export class ShareTransferResolver {
  constructor(private readonly shareTransfers: ShareTransferService) {}

  @Query(() => ShareTransferStateDTO, {
    name: 'capitalShareTransferState',
    description: 'Паевой взнос пайщика на кошельке Благороста, доступный для трансляции в Цифровой Кошелёк',
  })
  @RequireRight('ShareTransfer', ['read:own', 'read'], { owner: 'data.username' })
  getState(@Args('data', { type: () => ShareTransferStateInputDTO }) data: ShareTransferStateInputDTO): Promise<ShareTransferStateDTO> {
    return this.shareTransfers.state(data.username);
  }

  @Query(() => paginatedShareTransfersResult, {
    name: 'capitalShareTransfers',
    description: 'История трансляций паевого взноса из Благороста в Цифровой Кошелёк',
  })
  @RequireRight('ShareTransfer', ['read:own', 'read'], { owner: 'filter.username' })
  list(
    @Args('filter', { type: () => ShareTransferFilterInputDTO, nullable: true }) filter?: ShareTransferFilterInputDTO,
    @Args('options', { type: () => PaginationInputDTO, nullable: true }) options?: PaginationInputDTO
  ): Promise<PaginationResult<ShareTransferDTO>> {
    return this.shareTransfers.list(filter?.username, options);
  }

  @Mutation(() => ShareTransferStateDTO, {
    name: 'capitalTransferShare',
    description: 'Транслировать паевой взнос из Благороста в Цифровой Кошелёк по подписанному заявлению',
  })
  @RequireRight('ShareTransfer', 'create:own', { owner: 'data.username' })
  transfer(@Args('data', { type: () => TransferShareInputDTO }) data: TransferShareInputDTO): Promise<ShareTransferStateDTO> {
    return this.shareTransfers.transfer(data);
  }
}
