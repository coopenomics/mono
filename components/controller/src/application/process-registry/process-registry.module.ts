import { Module } from '@nestjs/common';
import { ProcessRegistryDomainModule } from '~/domain/process-registry/process-registry-domain.module';
import { ProcessRegistryResolver } from './resolvers/process-registry.resolver';
import { ProcessSummaryContentService } from './services/process-summary-content.service';
import { CoreRightsModule } from '../rights/core-rights.module';

@Module({
  imports: [CoreRightsModule, ProcessRegistryDomainModule],
  // Общее содержание процессов для стола бухгалтера — запасной вариант реестра processContent.
  providers: [ProcessRegistryResolver, ProcessSummaryContentService],
})
export class ProcessRegistryModule {}
