import { Injectable } from '@nestjs/common';
import type { IChatCoopCalendarPort, InnerCalendarEventWindow } from '@coopenomics/innercoop';
import { ChatCoopCalendarApplicationService } from '../../application/services/chatcoop-calendar-application.service';

@Injectable()
export class ChatcoopInnercoopChatCoopCalendarAdapter implements IChatCoopCalendarPort {
  constructor(private readonly calendar: ChatCoopCalendarApplicationService) {}

  async listEventsByProjectHash(input: {
    projectHash: string;
    window?: InnerCalendarEventWindow;
  }) {
    return this.calendar.listEventsForInterPort(input.projectHash, input.window);
  }
}
