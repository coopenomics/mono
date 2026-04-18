import { Module } from '@nestjs/common';
import { ProcessRegistryDomainModule } from '~/domain/process-registry/process-registry-domain.module';
import { ProcessRegistryResolver } from './resolvers/process-registry.resolver';

@Module({
  imports: [ProcessRegistryDomainModule],
  providers: [ProcessRegistryResolver],
})
export class ProcessRegistryModule {}
