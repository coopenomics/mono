import { Module } from '@nestjs/common';
import { NovuAdapter } from './novu.adapter';
import { NOTIFICATION_PORT } from '~/domain/notification/interfaces/notification.port';

@Module({
  providers: [
    {
      provide: NOTIFICATION_PORT,
      useClass: NovuAdapter,
    },
  ],
  exports: [NOTIFICATION_PORT],
})
export class NovuModule {}
