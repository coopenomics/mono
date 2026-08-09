import { Global, Module } from '@nestjs/common';
import {
  CHATCOOP_CALENDAR_PORT,
  EXPENSE_CHASSIS_PORT,
  LEDGER2_HISTORY_PORT,
  MATRIX_ROOM_MESSAGING_PORT,
  PROJECT_CAPITAL_CLEARANCE_PORT,
  PROJECT_COMMUNICATION_ARTIFACTS_PORT,
} from '@coopenomics/innercoop';
import { ChatCoopExtensionModule } from './chatcoop/chatcoop-extension.module';
import { CapitalExtensionModule } from './capital/capital-extension.module';
import { ExpensesExtensionModule } from './expenses/expenses-extension.module';
import { Ledger2Module } from '~/application/ledger2/ledger2.module';
import { ChatcoopInnercoopProjectCommunicationArtifactsAdapter } from './chatcoop/infrastructure/innercoop/chatcoop-innercoop-project-communication-artifacts.adapter';
import { ChatcoopInnercoopMatrixRoomMessagingAdapter } from './chatcoop/infrastructure/innercoop/chatcoop-innercoop-matrix-room-messaging.adapter';
import { ChatcoopInnercoopChatCoopCalendarAdapter } from './chatcoop/infrastructure/innercoop/chatcoop-innercoop-chatcoop-calendar.adapter';
import { CapitalInnercoopProjectCapitalClearanceAdapter } from './capital/infrastructure/innercoop/capital-innercoop-project-capital-clearance.adapter';
import { ExpensesInnercoopExpenseChassisAdapter } from './expenses/infrastructure/innercoop/expenses-innercoop-expense-chassis.adapter';
import { Ledger2InnercoopHistoryAdapter } from '~/application/ledger2/infrastructure/innercoop/ledger2-innercoop-history.adapter';

/**
 * Глобальная привязка портов @coopenomics/innercoop к их реализациям-расширениям.
 * Consumer-extension'ы (capital, marketplace, EMP) инжектят токен без знания
 * о конкретной реализации.
 *
 * Единственный легитимный способ обратиться из расширения к чужому
 * сервису/ядру — через порт отсюда. Прямой импорт сервиса другого
 * расширения (или ядрового модуля вроде `Ledger2Service`) в consumer-коде —
 * архитектурное нарушение; если контракта ещё нет — сперва добавить порт
 * в `@coopenomics/innercoop`, потом реализацию/биндинг здесь.
 */
@Global()
@Module({
  imports: [CapitalExtensionModule, ChatCoopExtensionModule, ExpensesExtensionModule, Ledger2Module],
  providers: [
    {
      provide: PROJECT_COMMUNICATION_ARTIFACTS_PORT,
      useExisting: ChatcoopInnercoopProjectCommunicationArtifactsAdapter,
    },
    {
      provide: MATRIX_ROOM_MESSAGING_PORT,
      useExisting: ChatcoopInnercoopMatrixRoomMessagingAdapter,
    },
    {
      provide: CHATCOOP_CALENDAR_PORT,
      useExisting: ChatcoopInnercoopChatCoopCalendarAdapter,
    },
    {
      provide: PROJECT_CAPITAL_CLEARANCE_PORT,
      useExisting: CapitalInnercoopProjectCapitalClearanceAdapter,
    },
    {
      provide: EXPENSE_CHASSIS_PORT,
      useExisting: ExpensesInnercoopExpenseChassisAdapter,
    },
    {
      provide: LEDGER2_HISTORY_PORT,
      useExisting: Ledger2InnercoopHistoryAdapter,
    },
  ],
  exports: [
    PROJECT_COMMUNICATION_ARTIFACTS_PORT,
    MATRIX_ROOM_MESSAGING_PORT,
    CHATCOOP_CALENDAR_PORT,
    PROJECT_CAPITAL_CLEARANCE_PORT,
    EXPENSE_CHASSIS_PORT,
    LEDGER2_HISTORY_PORT,
  ],
})
export class InnercoopBridgeModule {}
