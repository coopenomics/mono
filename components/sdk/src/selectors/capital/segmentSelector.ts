import type { MakeAllFieldsRequired } from '../../utils/MakeAllFieldsRequired'
import { type ModelTypes, Selector, type ValueTypes } from '../../zeus/index'
import { baseCapitalSelector } from './baseCapitalSelector'
import { rawResultSelector } from './resultSelector'

// Сырой селектор для сегментов
export const rawSegmentSelector = {
  ...baseCapitalSelector,
  id: true,
  status: true,
  project_hash: true,
  coopname: true,
  username: true,
  display_name: true,
  // Роли участника в проекте
  is_author: true,
  is_creator: true,
  is_coordinator: true,
  is_investor: true,
  is_propertor: true,
  is_contributor: true,
  has_vote: true,
  // Вклады инвестора
  investor_amount: true,
  investor_base: true,
  // Вклады создателя
  creator_base: true,
  creator_bonus: true,
  // Вклады автора
  author_base: true,
  author_bonus: true,
  // Вклады координатора
  coordinator_investments: true,
  coordinator_base: true,
  // Вклады участника
  contributor_bonus: true,
  // Имущественные взносы
  property_base: true,
  // CRPS поля для масштабируемого распределения наград
  last_author_base_reward_per_share: true,
  last_author_bonus_reward_per_share: true,
  last_contributor_reward_per_share: true,
  // Доли в программе и проекте
  capital_contributor_shares: true,
  // Последняя известная сумма инвестиций в проекте для расчета provisional_amount
  last_known_invest_pool: true,
  // Последняя известная сумма базового пула создателей для расчета использования инвестиций
  last_known_creators_base_pool: true,
  // Последняя известная сумма инвестиций координаторов для отслеживания изменений
  last_known_coordinators_investment_pool: true,
  // Финансовые данные для ссуд
  provisional_amount: true,
  debt_amount: true,
  debt_settled: true,
  // Пулы равных премий авторов и прямых премий создателей
  equal_author_bonus: true,
  direct_creator_bonus: true,
  // Результаты голосования по методу Водянова
  voting_bonus: true,
  // Флаг завершения расчета голосования
  is_votes_calculated: true,
  // Общая стоимость сегмента (рассчитывается автоматически)
  total_segment_base_cost: true,
  total_segment_bonus_cost: true,
  total_segment_cost: true,
  value: true,
  is_completed: true,
  intellectual_cost: true,
  share_percent: true,
  available_for_program: true,
  available_for_wallet: true,
  // Контекст проекта: доли участника читаются общим списком по всем проектам
  project_title: true,
  parent_title: true,
  project_status: true,
  has_voted: true,
}

// Валидация типа
const _validate: MakeAllFieldsRequired<ValueTypes['CapitalSegment']> = rawSegmentSelector

// Экспортируемый селектор
export const segmentSelector = Selector('CapitalSegment')(rawSegmentSelector)

// Тип модели
export type segmentModel = ModelTypes['CapitalSegment']
