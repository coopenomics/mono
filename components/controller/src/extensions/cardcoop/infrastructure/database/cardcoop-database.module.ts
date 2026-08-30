import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { cardcoopEntities } from '../../cardcoop.entities';

@Module({
  imports: [TypeOrmModule.forFeature(cardcoopEntities)],
  exports: [TypeOrmModule],
})
export class CardcoopDatabaseModule {}
