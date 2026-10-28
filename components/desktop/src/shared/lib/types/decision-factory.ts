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
  /**
   * Уточнение к названию вопроса (опционально). Название вопроса — заголовок
   * шаблона заявления, у разных вопросов одного типа оно совпадает; уточнение
   * встаёт в скобках и отличает вопросы друг от друга в повестке.
   */
  titleDetail?: (agenda: IAgenda) => string | null | undefined
}

/**
 * Реестр обработчиков решений
 */
export type DecisionHandlersRegistry = Record<string, IDecisionHandler>
