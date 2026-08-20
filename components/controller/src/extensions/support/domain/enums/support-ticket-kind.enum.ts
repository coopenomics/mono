import { registerEnumType } from '@nestjs/graphql';

/**
 * Вид обращения пайщика в поддержку.
 */
export enum SupportTicketKind {
  INCIDENT = 'INCIDENT',
  SERVICE_REQUEST = 'SERVICE_REQUEST',
  GOVERNANCE_APPEAL = 'GOVERNANCE_APPEAL',
}

registerEnumType(SupportTicketKind, {
  name: 'SupportTicketKind',
  description: 'Вид обращения пайщика в поддержку.',
  valuesMap: {
    INCIDENT: { description: 'Происшествие — что-то не работает.' },
    SERVICE_REQUEST: { description: 'Запрос на обслуживание — выдать, оформить, разъяснить.' },
    GOVERNANCE_APPEAL: { description: 'Обращение в орган управления кооператива.' },
  },
});
