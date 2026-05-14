import { Module, Global } from '@nestjs/common';
import { BlockchainService } from './blockchain.service';
import { BlockchainConsumerService } from './blockchain-consumer.service';
import { BlockchainRepeatService } from './services/blockchain-repeat.service';
import { RedisModule } from '../redis/redis.module';
import { EventsInfrastructureModule } from '../events/events.module';
import { VaultInfrastructureModule } from '~/infrastructure/vault/vault-infrastructure.module';
import { VaultDomainModule } from '~/domain/vault/vault-domain.module';
import { BRANCH_BLOCKCHAIN_PORT } from '~/domain/branch/interfaces/branch-blockchain.port';
import { BLOCKCHAIN_PORT } from '~/domain/common/ports/blockchain.port';
import { BranchBlockchainAdapter } from './adapters/branch.adapter';
import { SystemBlockchainAdapter } from './adapters/system.adapter';
import { SYSTEM_BLOCKCHAIN_PORT } from '~/domain/system/interfaces/system-blockchain.port';
import { ACCOUNT_BLOCKCHAIN_PORT } from '~/domain/account/interfaces/account-blockchain.port';
import { AccountBlockchainAdapter } from './adapters/account.adapter';
import { SovietBlockchainAdapter } from './adapters/soviet-blockchain.adapter';
import { SOVIET_BLOCKCHAIN_PORT } from '~/domain/common/ports/soviet-blockchain.port';
import { COOPLACE_BLOCKCHAIN_PORT } from '~/domain/cooplace/interfaces/cooplace-blockchain.port';
import { CooplaceBlockchainAdapter } from './adapters/cooplace-blockchain.adapter';
import { MEET_BLOCKCHAIN_PORT } from '~/domain/meet/ports/meet-blockchain.port';
import { MeetBlockchainAdapter } from './adapters/meet-blockchain.adapter';
import { DomainToBlockchainUtils } from '../../shared/utils/domain-to-blockchain.utils';
import { GatewayBlockchainAdapter } from './adapters/gateway-blockchain.adapter';
import { WALLET_BLOCKCHAIN_PORT } from '~/domain/wallet/ports/wallet-blockchain.port';
import { GATEWAY_BLOCKCHAIN_PORT } from '~/domain/gateway/ports/gateway-blockchain.port';
import { WalletBlockchainAdapter } from './adapters/wallet-blockchain.adapter';
import { LedgerBlockchainAdapter } from './adapters/ledger-blockchain.adapter';
import { LEDGER_BLOCKCHAIN_PORT } from '~/domain/ledger/ports/ledger.port';
import { Ledger2BlockchainAdapter } from './adapters/ledger2-blockchain.adapter';
import { LEDGER2_BLOCKCHAIN_PORT } from '~/domain/ledger2/ports/ledger2-blockchain.port';
import { SovietContractInfoService } from './services/soviet-contract-info.service';
import { WalletContractInfoService } from './services/wallet-contract-info.service';
import { Ledger2ContractInfoService } from './services/ledger2-contract-info.service';

@Global()
@Module({
  imports: [RedisModule, EventsInfrastructureModule, VaultInfrastructureModule, VaultDomainModule],
  providers: [
    BlockchainService,
    BlockchainConsumerService,
    BlockchainRepeatService,
    {
      provide: BLOCKCHAIN_PORT,
      useClass: BlockchainService,
    },
    {
      provide: BRANCH_BLOCKCHAIN_PORT,
      useClass: BranchBlockchainAdapter,
    },
    {
      provide: SYSTEM_BLOCKCHAIN_PORT,
      useClass: SystemBlockchainAdapter,
    },
    // SystemBlockchainAdapter теперь регистрируется здесь для доступа к VAULT_DOMAIN_PORT
    {
      provide: ACCOUNT_BLOCKCHAIN_PORT,
      useClass: AccountBlockchainAdapter,
    },
    {
      provide: SOVIET_BLOCKCHAIN_PORT,
      useClass: SovietBlockchainAdapter,
    },
    {
      provide: COOPLACE_BLOCKCHAIN_PORT,
      useClass: CooplaceBlockchainAdapter,
    },
    {
      provide: MEET_BLOCKCHAIN_PORT,
      useClass: MeetBlockchainAdapter,
    },
    // Провайдеры для gateway
    {
      provide: GATEWAY_BLOCKCHAIN_PORT,
      useClass: GatewayBlockchainAdapter,
    },
    // Провайдеры для wallet
    {
      provide: WALLET_BLOCKCHAIN_PORT,
      useClass: WalletBlockchainAdapter,
    },
    // Провайдеры для ledger
    {
      provide: LEDGER_BLOCKCHAIN_PORT,
      useClass: LedgerBlockchainAdapter,
    },
    // Провайдеры для ledger2 (корректировки председателя — walmove/revert)
    {
      provide: LEDGER2_BLOCKCHAIN_PORT,
      useClass: Ledger2BlockchainAdapter,
    },
    DomainToBlockchainUtils,
    SovietContractInfoService,
    WalletContractInfoService,
    Ledger2ContractInfoService,
  ],
  exports: [
    BlockchainService,
    BlockchainConsumerService,
    BlockchainRepeatService,
    BLOCKCHAIN_PORT,
    BRANCH_BLOCKCHAIN_PORT,
    SYSTEM_BLOCKCHAIN_PORT,
    ACCOUNT_BLOCKCHAIN_PORT,
    SOVIET_BLOCKCHAIN_PORT,
    COOPLACE_BLOCKCHAIN_PORT,
    MEET_BLOCKCHAIN_PORT,
    GATEWAY_BLOCKCHAIN_PORT,
    WALLET_BLOCKCHAIN_PORT,
    LEDGER_BLOCKCHAIN_PORT,
    LEDGER2_BLOCKCHAIN_PORT,
    DomainToBlockchainUtils,
    SovietContractInfoService,
    WalletContractInfoService,
    Ledger2ContractInfoService,
  ],
})
export class BlockchainModule {}
