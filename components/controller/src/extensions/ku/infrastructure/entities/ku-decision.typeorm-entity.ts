import { ChainRecord } from '@coopenomics/extension-kit/sync';

export const EntityName = 'ku_decisions';

export class KuDecisionTypeormEntity extends ChainRecord {
  static getTableName(): string {
    return EntityName;
  }

  id!: number;

  // Поля из блокчейна (table_branch_decisions.hpp)
  hash!: string;

  coopname!: string;

  type!: string;

  initiator!: string;

  chairman!: string;

  proposal!: object;

  protocol!: object;

  petition!: object;

  liability!: object;

  authority!: object;

  authorization!: object;

  open_at!: Date;

  close_at!: Date;

  signed_ballots!: number;

  braname!: string;

  address!: string;

  participants!: string[];

  created_at!: Date;

  // Приватные данные собрания — только БД, в блокчейн не публикуются
  meet_place!: string | null;

  meet_at!: Date | null;

  branch_name!: string | null;

  branch_email!: string | null;

  branch_phone!: string | null;

  cancelled!: boolean;

  // напоминание участникам за час до собрания уже отправлено
  meet_reminder_sent!: boolean;
}
