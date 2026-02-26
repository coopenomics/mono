import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { VoteCopyResolver } from './application/resolvers/vote-copy.resolver';
import { VoteCopyEventService } from './application/services/vote-copy-event.service';
import { VoteCopyService } from './domain/services/vote-copy.service';
import { VOTE_COPY_SETTING_REPOSITORY } from './domain/repositories/vote-copy-setting.repository';
import { VoteCopySettingTypeormEntity } from './infrastructure/entities/vote-copy-setting.typeorm-entity';
import { VoteCopySettingTypeormRepository } from './infrastructure/repositories/vote-copy-setting.typeorm-repository';

@Module({
  imports: [
    TypeOrmModule.forFeature([VoteCopySettingTypeormEntity]),
  ],
  providers: [
    VoteCopyResolver,
    VoteCopyEventService,
    VoteCopyService,
    { provide: VOTE_COPY_SETTING_REPOSITORY, useClass: VoteCopySettingTypeormRepository },
  ],
  exports: [VoteCopyService],
})
export class SovietExtensionModule {}
