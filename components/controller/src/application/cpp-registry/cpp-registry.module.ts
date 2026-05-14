import { Module } from '@nestjs/common';
import { CppRegistryDomainModule } from '~/domain/cpp-registry/cpp-registry-domain.module';
import { CppRegistryResolver } from './resolvers/cpp-registry.resolver';

@Module({
  imports: [CppRegistryDomainModule],
  providers: [CppRegistryResolver],
})
export class CppRegistryModule {}
