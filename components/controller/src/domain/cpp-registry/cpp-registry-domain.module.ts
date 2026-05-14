import { Module } from '@nestjs/common';
import { CppRegistryDomainService } from './services/cpp-registry-domain.service';

@Module({
  imports: [],
  providers: [CppRegistryDomainService],
  exports: [CppRegistryDomainService],
})
export class CppRegistryDomainModule {}
