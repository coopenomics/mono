import { ProgramPropertyStatus } from '../../domain/enums/program-property-status.enum';
import type { ISignedDocument } from '@coopenomics/innercoop';
import { ChainRecord } from '@coopenomics/extension-kit/sync';

export const EntityName = 'capital_program_properties';
export class ProgramPropertyRecord extends ChainRecord {
  static getTableName(): string {
    return EntityName;
  }
  id!: number;

  // Поля из блокчейна (program_properties.hpp)
  coopname!: string;

  username!: string;

  blockchain_status!: string;

  property_hash!: string;

  property_amount!: string;

  property_description!: string;

  statement!: ISignedDocument;

  authorization!: ISignedDocument;

  act!: ISignedDocument;

  created_at!: Date;

  // Доменные поля (расширения)
  status!: ProgramPropertyStatus;
}
