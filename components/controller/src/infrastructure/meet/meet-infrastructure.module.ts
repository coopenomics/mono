import { Module } from '@nestjs/common';
import { MeetDataAdapter } from './meet-data.adapter';
import { MeetDomainModule } from '~/domain/meet/meet-domain.module';
import { BlockchainModule } from '../blockchain/blockchain.module';
import { DocumentDomainModule } from '~/domain/document/document.module';
import { MEET_PORT } from '@coopenomics/innercoop';

@Module({
  imports: [MeetDomainModule, BlockchainModule, DocumentDomainModule],
  providers: [
    MeetDataAdapter,
    {
      provide: MEET_PORT,
      useClass: MeetDataAdapter,
    },
  ],
  exports: [MeetDataAdapter, MEET_PORT],
})
export class MeetInfrastructureModule {}
