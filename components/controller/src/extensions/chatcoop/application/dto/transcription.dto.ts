import { Field, ObjectType, InputType, Int, Float, registerEnumType, GraphQLISODateTime } from '@nestjs/graphql';
import { IsString, IsOptional, IsInt, Min, Max, IsUUID } from 'class-validator';
import { TranscriptionStatus } from '../../domain/entities/call-transcription.entity';

// Регистрируем enum для GraphQL
registerEnumType(TranscriptionStatus, {
  name: 'TranscriptionStatus',
  description: 'Статус транскрипции звонка',
});

// DTO ответа — сегмент транскрипции
@ObjectType('TranscriptionSegment')
export class TranscriptionSegmentResponseDTO {
  @Field()
  id!: string;

  @Field({ description: 'Канонический Matrix user id (@localpart:server)' })
  speakerIdentity!: string;

  @Field({ description: 'Отображаемое имя из Synapse (displayname)' })
  speakerName!: string;

  @Field()
  text!: string;

  @Field(() => Float)
  startOffset!: number;

  @Field(() => Float)
  endOffset!: number;

  @Field()
  createdAt!: Date;
}

// DTO ответа — транскрипция звонка (список)
@ObjectType('CallTranscription')
export class CallTranscriptionResponseDTO {
  @Field()
  id!: string;

  @Field()
  roomId!: string;

  @Field()
  matrixRoomId!: string;

  @Field()
  roomName!: string;

  @Field()
  startedAt!: Date;

  @Field(() => GraphQLISODateTime, { nullable: true })
  endedAt?: Date | null;

  @Field(() => [String], {
    description:
      'Отображаемые имена участников (Synapse displayname); в БД хранятся канонические Matrix user id',
  })
  participants!: string[];

  @Field(() => TranscriptionStatus)
  status!: TranscriptionStatus;

  @Field({ description: 'Пользовательская заметка о содержании звонка' })
  memo!: string;

  @Field()
  createdAt!: Date;

  @Field()
  updatedAt!: Date;
}

// DTO ответа — транскрипция с сегментами (детализация)
@ObjectType('CallTranscriptionWithSegments')
export class CallTranscriptionWithSegmentsDTO {
  @Field(() => CallTranscriptionResponseDTO)
  transcription!: CallTranscriptionResponseDTO;

  @Field(() => [TranscriptionSegmentResponseDTO])
  segments!: TranscriptionSegmentResponseDTO[];
}

// DTO входных данных — запрос списка транскрипций
@InputType('GetTranscriptionsInput')
export class GetTranscriptionsInputDTO {
  @Field(() => Int, { nullable: true, defaultValue: 20 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;

  @Field(() => Int, { nullable: true, defaultValue: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  offset?: number;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  matrixRoomId?: string;
}

// DTO входных данных — запрос конкретной транскрипции
@InputType('GetTranscriptionInput')
export class GetTranscriptionInputDTO {
  @Field()
  @IsString()
  id!: string;
}

/** Обновление пользовательской заметки к транскрипции */
@InputType('UpdateCallTranscriptionMemoInput')
export class UpdateCallTranscriptionMemoInputDTO {
  @Field()
  @IsUUID('4')
  id!: string;

  @Field({ description: 'Текст заметки' })
  @IsString()
  memo!: string;
}
