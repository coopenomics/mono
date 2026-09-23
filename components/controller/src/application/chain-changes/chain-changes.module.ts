import { Module } from '@nestjs/common';
import { ChainChangesResolver } from './resolvers/chain-changes.resolver';

/**
 * Подписка столов на ленту изменений цепи. Издатель (`ChainChangesService`)
 * живёт в глобальном модуле цепи рядом с потребителем — здесь только выдача.
 */
@Module({
  providers: [ChainChangesResolver],
})
export class ChainChangesModule {}
