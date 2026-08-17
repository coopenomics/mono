/**
 * Сущности расширения «Чат кооператива»: явная декларация состава таблиц.
 *
 * Раньше TypeORM находил их файловым глобом по `src/extensions/**`. Глоб
 * привязывает расширение к его месту на диске: тот же код, установленный
 * пакетом в `node_modules`, под него не попадает — таблицы не создаются,
 * репозитории не поднимаются, расширение не стартует. Поэтому состав
 * объявляется здесь и попадает в подключение через запись реестра.
 */
import { CalendarEventTypeormEntity } from './infrastructure/entities/calendar-event.typeorm-entity';
import { CalendarIcsSubscriptionTypeormEntity } from './infrastructure/entities/calendar-ics-subscription.typeorm-entity';
import { CallTranscriptionTypeormEntity } from './infrastructure/entities/call-transcription.typeorm-entity';
import { ChatcoopStateTypeormEntity } from './infrastructure/entities/chatcoop-state.typeorm-entity';
import { ManagedMatrixRoomTypeormEntity } from './infrastructure/entities/managed-matrix-room.typeorm-entity';
import { MatrixTokenTypeormEntity } from './infrastructure/entities/matrix-token.typeorm-entity';
import { MatrixUserTypeormEntity } from './infrastructure/entities/matrix-user.typeorm-entity';
import { RoomMessageHistoryTypeormEntity } from './infrastructure/entities/room-message-history.typeorm-entity';
import { TranscriptionSegmentTypeormEntity } from './infrastructure/entities/transcription-segment.typeorm-entity';
import { UnionChatTypeormEntity } from './infrastructure/entities/union-chat.typeorm-entity';

export const chatcoopEntities = [
  CalendarEventTypeormEntity,
  CalendarIcsSubscriptionTypeormEntity,
  CallTranscriptionTypeormEntity,
  ChatcoopStateTypeormEntity,
  ManagedMatrixRoomTypeormEntity,
  MatrixTokenTypeormEntity,
  MatrixUserTypeormEntity,
  RoomMessageHistoryTypeormEntity,
  TranscriptionSegmentTypeormEntity,
  UnionChatTypeormEntity,
];
