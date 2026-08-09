import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { GqlJwtAuthGuard, CurrentUser, AuthRoles, RolesGuard } from '@coopenomics/extension-kit';
import type { MonoAccountDomainInterface } from '@coopenomics/innercoop';
import { ChatCoopCalendarApplicationService } from '../services/chatcoop-calendar-application.service';
import {
  ChatCoopCalendarEventDTO,
  ChatCoopCalendarIcsUrlResponseDTO,
  ChatCoopCalendarRoomOptionDTO,
  CreateChatCoopCalendarEventInputDTO,
  UpdateChatCoopCalendarEventInputDTO,
} from '../dto/calendar.dto';

function toEventDto(e: {
  id: string;
  matrixRoomId: string;
  title: string;
  description: string | null;
  startsAt: Date;
  endsAt: Date | null;
  createdByUsername: string;
  icsSequence: number;
  createdAt: Date;
  updatedAt: Date;
}): ChatCoopCalendarEventDTO {
  const dto = new ChatCoopCalendarEventDTO();
  dto.id = e.id;
  dto.matrixRoomId = e.matrixRoomId;
  dto.title = e.title;
  dto.description = e.description;
  dto.startsAt = e.startsAt;
  dto.endsAt = e.endsAt;
  dto.createdByUsername = e.createdByUsername;
  dto.icsSequence = e.icsSequence;
  dto.createdAt = e.createdAt;
  dto.updatedAt = e.updatedAt;
  return dto;
}

@Resolver()
export class ChatCoopCalendarResolver {
  constructor(private readonly calendar: ChatCoopCalendarApplicationService) {}

  @Query(() => [ChatCoopCalendarRoomOptionDTO], {
    name: 'chatcoopListCalendarRooms',
    description: 'Незашифрованные комнаты из реестра ChatCoop для привязки события календаря',
  })
  @UseGuards(GqlJwtAuthGuard, RolesGuard)
  @AuthRoles(['chairman', 'member'])
  async listRooms(): Promise<ChatCoopCalendarRoomOptionDTO[]> {
    const rows = await this.calendar.listPlaintextRoomsForPicker();
    return rows.map((r) => {
      const dto = new ChatCoopCalendarRoomOptionDTO();
      dto.matrixRoomId = r.matrixRoomId;
      dto.displayLabel = r.displayLabel;
      return dto;
    });
  }

  @Query(() => [ChatCoopCalendarEventDTO], {
    name: 'chatcoopListCalendarEvents',
    description: 'Список событий календаря кооператива',
  })
  @UseGuards(GqlJwtAuthGuard, RolesGuard)
  @AuthRoles(['chairman', 'member', 'user'])
  async listEvents(): Promise<ChatCoopCalendarEventDTO[]> {
    const list = await this.calendar.listEvents();
    return list.map(toEventDto);
  }

  @Mutation(() => ChatCoopCalendarEventDTO, {
    name: 'chatcoopCreateCalendarEvent',
    description: 'Создать событие календаря',
  })
  @UseGuards(GqlJwtAuthGuard, RolesGuard)
  @AuthRoles(['chairman', 'member'])
  async create(
    @CurrentUser() user: MonoAccountDomainInterface,
    @Args('data', { type: () => CreateChatCoopCalendarEventInputDTO }) data: CreateChatCoopCalendarEventInputDTO
  ): Promise<ChatCoopCalendarEventDTO> {
    const ev = await this.calendar.createEvent(user.username, {
      matrixRoomId: data.matrixRoomId,
      title: data.title,
      description: data.description ?? null,
      startsAt: data.startsAt,
      endsAt: data.endsAt ?? null,
    });
    return toEventDto(ev);
  }

  @Mutation(() => ChatCoopCalendarEventDTO, {
    name: 'chatcoopUpdateCalendarEvent',
    description: 'Обновить событие календаря',
  })
  @UseGuards(GqlJwtAuthGuard, RolesGuard)
  @AuthRoles(['chairman', 'member'])
  async update(
    @CurrentUser() user: MonoAccountDomainInterface,
    @Args('data', { type: () => UpdateChatCoopCalendarEventInputDTO }) data: UpdateChatCoopCalendarEventInputDTO
  ): Promise<ChatCoopCalendarEventDTO> {
    const ev = await this.calendar.updateEvent({
      id: data.id,
      matrixRoomId: data.matrixRoomId,
      title: data.title,
      description: data.description ?? null,
      startsAt: data.startsAt,
      endsAt: data.endsAt ?? null,
      updatedByUsername: user.username,
    });
    return toEventDto(ev);
  }

  @Mutation(() => Boolean, {
    name: 'chatcoopDeleteCalendarEvent',
    description: 'Удалить событие календаря',
  })
  @UseGuards(GqlJwtAuthGuard, RolesGuard)
  @AuthRoles(['chairman', 'member'])
  async delete(@Args('id') id: string): Promise<boolean> {
    await this.calendar.deleteEvent(id);
    return true;
  }

  @Mutation(() => ChatCoopCalendarIcsUrlResponseDTO, {
    name: 'chatcoopCreateCalendarIcsSubscription',
    description: 'Выдать или обновить персональный URL подписки ICS (секрет в query)',
  })
  @UseGuards(GqlJwtAuthGuard, RolesGuard)
  @AuthRoles(['chairman', 'member', 'user'])
  async createIcs(
    @CurrentUser() user: MonoAccountDomainInterface
  ): Promise<ChatCoopCalendarIcsUrlResponseDTO> {
    const url = await this.calendar.createOrRotatePersonalIcsUrl(user.username);
    const dto = new ChatCoopCalendarIcsUrlResponseDTO();
    dto.icsUrl = url;
    return dto;
  }
}
