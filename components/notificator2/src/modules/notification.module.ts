import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { NovuService } from '../services/novu.service';
import { NotificationController } from './notification.controller';

@Module({
  imports: [ConfigModule],
  controllers: [NotificationController],
  providers: [NovuService],
  exports: [NovuService],
})
export class NotificationModule {}
