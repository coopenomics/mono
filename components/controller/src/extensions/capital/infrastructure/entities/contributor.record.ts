import { ContributorStatus } from '../../domain/enums/contributor-status.enum';
import type { ISignedDocument } from '@coopenomics/innercoop';
import { ChainRecord } from '@coopenomics/extension-kit/sync';
import { IssueRecord } from './issue.record';
import { SegmentRecord } from './segment.record';
import { VoteRecord } from './vote.record';

export const EntityName = 'capital_contributors';

export class ContributorRecord extends ChainRecord {
  static getTableName(): string {
    return EntityName;
  }

  id!: number;

  // Поля из блокчейна (contributors.hpp)
  coopname!: string;

  username!: string;

  contributor_hash!: string;

  blockchain_status?: string;

  memo!: string;

  is_external_contract!: boolean;

  contract!: ISignedDocument;

  appendixes!: string[];

  rate_per_hour!: string;

  hours_per_day!: number;

  debt_amount!: string;

  reward_per_share_last!: string;

  contributed_as_investor!: string;

  contributed_as_creator!: string;

  contributed_as_author!: string;

  contributed_as_coordinator!: string;

  contributed_as_contributor!: string;

  contributed_as_propertor!: string;

  created_at!: Date;

  // Поля геймификации
  level!: number;

  energy!: number;

  last_energy_update!: Date;

  // Доменные поля (расширения)
  status!: ContributorStatus;

  // Поля для отображения информации об аккаунте
  display_name!: string; // ФИО или название организации

  about!: string; // Описание участника

  // Поля для отслеживания пути регистрации
  program_key!: string; // Ключ выбранной программы (generation, capitalization)

  blagorost_offer_hash!: string; // Хеш оферты Благорост (если выбран путь Благороста)

  generator_offer_hash!: string; // Хеш оферты Генератор (если выбран путь Генератора)

  generation_contract_hash!: string; // Хеш договора УХД

  storage_agreement_hash!: string; // Хеш соглашения о хранении имущества

  blagorost_agreement_hash!: string; // Хеш соглашения Благорост (может быть заполнен из оферты или из соглашения)

  is_external_blagorost_agreement!: boolean; // Соглашение Благорост предоставлено при импорте (внешний документ)

  // Обратные связи
  issues!: IssueRecord[];

  segments!: SegmentRecord[];

  votes_received!: VoteRecord[]; // Голоса полученные этим участником

  votes_cast!: VoteRecord[]; // Голоса отданные этим участником
}
