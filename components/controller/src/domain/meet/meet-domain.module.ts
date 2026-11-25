import { Module } from '@nestjs/common';
import { MeetVotersDomainService } from './services/meet-voters-domain.service';

// Порты цепи участков и аккаунтов раздаёт глобальный BlockchainModule.
@Module({
  imports: [],
  providers: [MeetVotersDomainService],
  exports: [MeetVotersDomainService],
})
export class MeetDomainModule {}
