import { Controller, Get, Logger } from '@nestjs/common';
import { NovuService } from '../services/novu.service';

@Controller('notifications')
export class NotificationController {
  private readonly logger = new Logger(NotificationController.name);

  constructor(private readonly novuService: NovuService) {}

  @Get('health')
  async getHealth() {
    const isHealthy = await this.novuService.getHealth();
    return { 
      status: isHealthy ? 'ok' : 'error', 
      timestamp: new Date().toISOString(),
      service: 'notificator'
    };
  }
}
