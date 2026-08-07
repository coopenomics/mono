import { registerEnumType } from '@nestjs/graphql';

/**
 * Происхождение проекта CAPITAL:
 * - BLOCKCHAIN — кооперативный, синхронизирован с контрактом
 * - LOCAL — персональный, только PostgreSQL (задачник без публикации в сеть)
 */
export enum ProjectOrigin {
  BLOCKCHAIN = 'blockchain',
  LOCAL = 'local',
}

registerEnumType(ProjectOrigin, {
  name: 'CapitalProjectOrigin',
  description: 'Происхождение проекта: кооперативный (блокчейн) или персональный (локальный)',
});
