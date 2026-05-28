import { Field, Float, InputType, ObjectType, registerEnumType } from '@nestjs/graphql';
import { IsNotEmpty, IsNumber, IsString, Min } from 'class-validator';

/**
 * Тип строки истории Matrix в API (как в @coopenomics/inter — text | audio).
 */
export enum RoomMessageKindGql {
  TEXT = 'TEXT',
  AUDIO = 'AUDIO',
}

registerEnumType(RoomMessageKindGql, {
  name: 'RoomMessageKind',
  description: 'Тип сообщения в истории комнаты Matrix (текст или расшифрованное аудио)',
});

@ObjectType('ChatcoopProjectCommunicationRoom')
export class ChatcoopProjectCommunicationRoomDTO {
  @Field({ description: 'Идентификатор комнаты Matrix' })
  matrixRoomId!: string;

  @Field({ description: 'Подпись для отображения (комната / проект Capital)' })
  displayLabel!: string;
}

/**
 * Тип непроектной комнаты: пайщики, совет или комната секретаря.
 */
export enum NonProjectRoomKindGql {
  MEMBERS = 'MEMBERS',
  COUNCIL = 'COUNCIL',
  SECRETARY = 'SECRETARY',
}

registerEnumType(NonProjectRoomKindGql, {
  name: 'NonProjectRoomKind',
  description: 'Тип комнаты вне проекта: пайщики, совет, комната секретаря',
});

@ObjectType('ChatcoopNonProjectCommunicationRoom')
export class ChatcoopNonProjectCommunicationRoomDTO {
  @Field({ description: 'Идентификатор комнаты Matrix' })
  matrixRoomId!: string;

  @Field({ description: 'Подпись для отображения комнаты' })
  displayLabel!: string;

  @Field(() => NonProjectRoomKindGql, { description: 'Тип комнаты (пайщики / совет / секретарь)' })
  kind!: NonProjectRoomKindGql;
}

@ObjectType('ChatcoopRoomMessageLine')
export class ChatcoopRoomMessageLineDTO {
  @Field(() => Float, { description: 'origin_server_ts из Matrix (мс)' })
  originServerTs!: number;

  @Field({ description: 'Отображаемое имя автора' })
  authorLabel!: string;

  @Field(() => String, { nullable: true, description: 'Логин пайщика в кооперативе, если привязан' })
  coopUsername?: string | null;

  @Field(() => RoomMessageKindGql)
  kind!: RoomMessageKindGql;

  @Field({ description: 'Текст или расшифровка' })
  bodyText!: string;
}

@InputType('GetProjectCommunicationRoomsInput')
export class GetProjectCommunicationRoomsInputDTO {
  @Field({ description: 'Хеш проекта Capital' })
  @IsString()
  @IsNotEmpty()
  projectHash!: string;
}

@InputType('ListUtcDatesWithNewRoomMessagesInput')
export class ListUtcDatesWithNewRoomMessagesInputDTO {
  @Field()
  @IsString()
  @IsNotEmpty()
  matrixRoomId!: string;

  @Field(() => Float, {
    description: 'Нижняя граница origin_server_ts (мс), исключительно: сообщения строго новее',
  })
  @IsNumber()
  @Min(0)
  afterOriginServerTsExclusive!: number;
}

@InputType('GetRoomMessagesForUtcDateInput')
export class GetRoomMessagesForUtcDateInputDTO {
  @Field()
  @IsString()
  @IsNotEmpty()
  matrixRoomId!: string;

  @Field({ description: 'Календарные сутки UTC, формат YYYY-MM-DD' })
  @IsString()
  @IsNotEmpty()
  utcDate!: string;
}

@InputType('GetMaxOriginServerTsForRoomInput')
export class GetMaxOriginServerTsForRoomInputDTO {
  @Field()
  @IsString()
  @IsNotEmpty()
  matrixRoomId!: string;
}
