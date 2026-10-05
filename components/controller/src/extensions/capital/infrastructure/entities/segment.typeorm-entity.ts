import { SegmentStatus } from '../../domain/enums/segment-status.enum';
import { ChainRecord } from '@coopenomics/extension-kit/sync';
import { ContributorTypeormEntity } from './contributor.typeorm-entity';
import { ResultTypeormEntity } from './result.typeorm-entity';
import { ProjectTypeormEntity } from './project.typeorm-entity';

export const EntityName = 'capital_segments';
// Составной индекс для быстрого поиска
export class SegmentTypeormEntity extends ChainRecord {
  static getTableName(): string {
    return EntityName;
  }

  id?: number;

  // Поля из блокчейна (segments.hpp)
  project_hash!: string;

  coopname!: string;

  username!: string;

  // Связь с участником для получения display_name
  contributor?: ContributorTypeormEntity;

  // Связь с результатом (заполняется вручную в репозитории)
  // Результат связывается по username и project_hash, выбирается с максимальным id
  result?: ResultTypeormEntity;

  // Связь с проектом (для получения статуса проекта)
  project?: ProjectTypeormEntity;

  // Проект, в который входит компонент (заполняется в репозитории пакетно)
  parent_title?: string;
  parent_hash?: string;

  // Отдан ли голос участником в этом проекте (заполняется в репозитории пакетно)
  has_voted?: boolean;

  // Закрыто ли голосование по проекту (заполняется в репозитории пакетно)
  voting_completed?: boolean;

  // Роли участника в проекте
  is_author!: boolean;

  is_creator!: boolean;

  is_coordinator!: boolean;

  is_investor!: boolean;

  is_propertor!: boolean;

  is_contributor!: boolean;

  has_vote!: boolean;

  // Вклады инвестора
  investor_amount?: string;

  investor_base?: string;

  // Вклады создателя
  creator_base?: string;

  creator_bonus?: string;

  // Вклады автора
  author_base?: string;

  author_bonus?: string;

  // Вклады координатора
  coordinator_investments?: string;

  coordinator_base?: string;

  // Вклады участника
  contributor_bonus?: string;

  // Имущественные взносы
  property_base?: string;

  // CRPS поля для масштабируемого распределения наград
  last_author_base_reward_per_share!: number;

  last_author_bonus_reward_per_share!: number;

  last_contributor_reward_per_share!: number;

  // Доли в программе и проекте
  capital_contributor_shares?: string;

  // Последняя известная сумма инвестиций в проекте для расчета provisional_amount
  last_known_invest_pool?: string;

  // Последняя известная сумма базового пула создателей для расчета использования инвестиций
  last_known_creators_base_pool?: string;

  // Последняя известная сумма инвестиций координаторов для отслеживания изменений
  last_known_coordinators_investment_pool?: string;

  // Финансовые данные для ссуд
  provisional_amount?: string;

  debt_amount?: string;

  debt_settled?: string;

  // Пулы равных премий авторов и прямых премий создателей
  equal_author_bonus?: string;

  direct_creator_bonus?: string;

  // Результаты голосования по методу Водянова
  voting_bonus?: string;

  is_votes_calculated!: boolean;

  // Общая стоимость сегмента (рассчитывается автоматически)
  total_segment_base_cost?: string;

  total_segment_bonus_cost?: string;

  total_segment_cost?: string;

  // Интеллектуальная собственность и доли
  intellectual_cost?: string;

  share_percent!: number;

  // Доменные поля (расширения)
  status!: SegmentStatus;

  is_completed!: boolean;

  // Доступная сумма для конвертации в программу
  available_for_program?: string;

  // Доступная сумма для конвертации в кошелек
  available_for_wallet?: string;
}
