import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { edubridgeEntities } from '../../edubridge.entities';

/** Репозитории таблиц расширения на общем подключении ядра. */
@Module({
  imports: [TypeOrmModule.forFeature([...edubridgeEntities])],
  exports: [TypeOrmModule],
})
export class EdubridgeDatabaseModule {}
