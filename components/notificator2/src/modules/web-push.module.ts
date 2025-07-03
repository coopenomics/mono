import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { WebPushService } from '../services/web-push.service';
import { NovuWebPushService } from '../services/novu-webpush.service';
import { CleanupService } from '../services/cleanup.service';
import { PushController } from '../controllers/push.controller';
import { NovuWebhookController } from '../controllers/novu-webhook.controller';
import { PushSubscription } from '../entities/push-subscription.entity';
import { NovuService } from '../services/novu.service';

@Module({
  imports: [
    ConfigModule,
    TypeOrmModule.forFeature([PushSubscription]),
  ],
  controllers: [PushController, NovuWebhookController],
  providers: [WebPushService, NovuWebPushService, NovuService, CleanupService],
  exports: [WebPushService, NovuWebPushService],
})
export class WebPushModule {} 