import { registerEnumType } from '@nestjs/graphql';
// Статусы проектного имущественного взноса синхронизированные с блокчейн контрактом
export enum ProjectPropertyStatus {
  CREATED = 'created', // Имущественный взнос создан
  UNDEFINED = 'undefined', // Статус не определен
}

registerEnumType(ProjectPropertyStatus, {
  name: 'ProjectPropertyStatus',
  description: 'Статус проектного имущественного взноса в системе CAPITAL',
});
