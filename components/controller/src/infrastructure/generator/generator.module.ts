// infrastructure/generator/generator.module.ts
import { Global, Module } from '@nestjs/common';
import { GeneratorInfrastructureService } from './generator.service';
import { GENERATOR_PORT } from '~/domain/document/ports/generator.port';
import { ControllerChainDataSource } from './controller-chain-data.source';
import { EffectiveTemplateBlockResolver } from './effective-template-block.resolver';
import { PgFactoryStorage } from './pg-factory-storage';
import { BlockchainModule } from '~/infrastructure/blockchain/blockchain.module';

@Global()
@Module({
  imports: [BlockchainModule],
  providers: [
    EffectiveTemplateBlockResolver,
    PgFactoryStorage,
    ControllerChainDataSource,
    GeneratorInfrastructureService,
    {
      provide: GENERATOR_PORT,
      useClass: GeneratorInfrastructureService,
    },
  ],
  exports: [GeneratorInfrastructureService, GENERATOR_PORT, PgFactoryStorage],
})
export class GeneratorInfrastructureModule {}
