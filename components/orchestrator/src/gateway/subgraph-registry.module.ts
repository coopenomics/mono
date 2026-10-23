/**
 * @fileoverview Модуль доступа к subgraph registry.
 *
 * Выделен из {@link GatewayModule}, потому что `GraphQLModule.forRootAsync`
 * резолвит inject-токены в СОБСТВЕННОМ модульном контексте: провайдеры
 * родительского модуля там не видны, видны только экспорты из `imports`
 * async-опций. Поэтому всё, что нужно фабрике gateway (registry-сервис,
 * refresh-мост), должно жить в отдельном импортируемом модуле.
 */
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SubgraphRegistryEntity } from './subgraph-registry.entity';
import { SubgraphRegistryService } from './subgraph-registry.service';
import { SupergraphRefreshService } from './supergraph-refresh.service';

@Module({
  imports: [TypeOrmModule.forFeature([SubgraphRegistryEntity])],
  providers: [SubgraphRegistryService, SupergraphRefreshService],
  exports: [SubgraphRegistryService, SupergraphRefreshService, TypeOrmModule],
})
export class SubgraphRegistryModule {}
