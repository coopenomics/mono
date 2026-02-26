import { Global, Module } from '@nestjs/common';
import { ExtensionLoaderService } from './extension-loader.service';

@Global()
@Module({
  providers: [ExtensionLoaderService],
  exports: [ExtensionLoaderService],
})
export class ExtensionLoaderModule {}
