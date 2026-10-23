import { ProjectPropertyStatus } from '../../domain/enums/project-property-status.enum';
import { ChainRecord } from '@coopenomics/extension-kit/sync';

export const EntityName = 'capital_project_properties';
export class ProjectPropertyRecord extends ChainRecord {
  static getTableName(): string {
    return EntityName;
  }
  id!: number;

  // Поля из блокчейна (project_properties.hpp)
  coopname!: string;

  username!: string;

  blockchain_status!: string;

  project_hash!: string;

  property_hash!: string;

  property_amount!: string;

  property_description!: string;

  created_at!: Date;

  // Доменные поля (расширения)
  status!: ProjectPropertyStatus;
}
