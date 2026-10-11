import type { Component } from 'vue'
import type { IAgenda } from 'src/entities/Agenda/model'

/**
 * Интерфейс данных для генерации документа решения
 */
export interface IGenerateDecisionData {
  decision_id: number
  username: string
  row: IAgenda
}

/**
 * Функция генерации документа решения
 */
export type GenerateDecisionHandler = (data: IGenerateDecisionData) => Promise<any>

/**
 * Общий способ генерации для решения без собственного обработчика: получает
 * ещё и тип решения. Возвращает `null`, если тип ему неизвестен.
 */
export type GenerateDecisionFallback = (decisionType: string, data: IGenerateDecisionData) => Promise<any | null>

/**
 * Компонент для отображения дополнительной информации по решению
 */
export type DecisionInfoComponent = Component<{ agenda: IAgenda }>

/**
 * Описание обработчика решения
 */
export interface IDecisionHandler {
  /** Функция генерации документа */
  generateHandler: GenerateDecisionHandler
  /** Компонент для дополнительной информации (опционально) */
  infoComponent?: DecisionInfoComponent
}

/**
 * Реестр обработчиков решений
 */
export type DecisionHandlersRegistry = Record<string, IDecisionHandler>
