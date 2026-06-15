import { Global, Module } from '@nestjs/common';
import {
  INTER_CHATCOOP_CALENDAR,
  INTER_EXPENSE_CHASSIS,
  INTER_MATRIX_ROOM_MESSAGING,
  INTER_PROJECT_CAPITAL_CLEARANCE,
  INTER_PROJECT_COMMUNICATION_ARTIFACTS,
} from '@coopenomics/inter';
import { ChatCoopPluginModule } from './chatcoop/chatcoop-extension.module';
import { CapitalPluginModule } from './capital/capital-extension.module';
import { ExpensesExtensionModule } from './expenses/expenses-extension.module';
import { ChatcoopInterProjectCommunicationArtifactsAdapter } from './chatcoop/infrastructure/inter/chatcoop-inter-project-communication-artifacts.adapter';
import { ChatcoopInterMatrixRoomMessagingAdapter } from './chatcoop/infrastructure/inter/chatcoop-inter-matrix-room-messaging.adapter';
import { ChatcoopInterChatCoopCalendarAdapter } from './chatcoop/infrastructure/inter/chatcoop-inter-chatcoop-calendar.adapter';
import { CapitalInterProjectCapitalClearanceAdapter } from './capital/infrastructure/inter/capital-inter-project-capital-clearance.adapter';
import { ExpensesInterExpenseChassisAdapter } from './expenses/infrastructure/inter/expenses-inter-expense-chassis.adapter';

/**
 * Глобальная привязка портов @coopenomics/inter к их реализациям-расширениям.
 * Consumer-extension'ы (capital, marketplace, EMP) инжектят токен без знания
 * о конкретной реализации.
 */
@Global()
@Module({
  imports: [CapitalPluginModule, ChatCoopPluginModule, ExpensesExtensionModule],
  providers: [
    {
      provide: INTER_PROJECT_COMMUNICATION_ARTIFACTS,
      useExisting: ChatcoopInterProjectCommunicationArtifactsAdapter,
    },
    {
      provide: INTER_MATRIX_ROOM_MESSAGING,
      useExisting: ChatcoopInterMatrixRoomMessagingAdapter,
    },
    {
      provide: INTER_CHATCOOP_CALENDAR,
      useExisting: ChatcoopInterChatCoopCalendarAdapter,
    },
    {
      provide: INTER_PROJECT_CAPITAL_CLEARANCE,
      useExisting: CapitalInterProjectCapitalClearanceAdapter,
    },
    {
      provide: INTER_EXPENSE_CHASSIS,
      useExisting: ExpensesInterExpenseChassisAdapter,
    },
  ],
  exports: [
    INTER_PROJECT_COMMUNICATION_ARTIFACTS,
    INTER_MATRIX_ROOM_MESSAGING,
    INTER_CHATCOOP_CALENDAR,
    INTER_PROJECT_CAPITAL_CLEARANCE,
    INTER_EXPENSE_CHASSIS,
  ],
})
export class InterCommunicationBridgeModule {}
