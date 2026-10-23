import { Module } from '@nestjs/common';
import {
  ExtensionAuthModule,
  ExtensionFederationModule,
  HealthController,
  loadExtensionConfig,
} from '@coopenomics/extension-sdk';
import { HelloResolver } from './hello.resolver';

const cfg = loadExtensionConfig();

@Module({
  imports: [
    ExtensionFederationModule.forRoot(),
    ExtensionAuthModule.forRoot({ secret: cfg.jwtSecret }),
  ],
  controllers: [HealthController],
  providers: [HelloResolver],
})
export class AppModule {}
