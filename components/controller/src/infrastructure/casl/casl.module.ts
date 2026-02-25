import { Global, Module } from '@nestjs/common';
import { CaslAbilityFactory } from './casl-ability.factory';
import { CaslGuard } from './casl.guard';

@Global()
@Module({
  providers: [CaslAbilityFactory, CaslGuard],
  exports: [CaslAbilityFactory, CaslGuard],
})
export class CaslModule {}
