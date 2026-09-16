import type { DecisionHandlersRegistry, IDecisionHandler, IGenerateDecisionData } from '../types/decision-factory'

/**
 * Фабрика обработчиков решений
 * Позволяет расширениям регистрировать свои обработчики для различных типов решений
 */
class DecisionFactory {
  private handlers: DecisionHandlersRegistry = {}

  /**
   * Регистрирует обработчик для типа решения
   * @param decisionType - тип решения (ключ из decisionTypesRegistry)
   * @param handler - обработчик решения
   */
  registerHandler(decisionType: string, handler: IDecisionHandler): void {
    this.handlers[decisionType] = handler
  }

  /**
   * Получает обработчик для типа решения
   * @param decisionType - тип решения
   * @returns обработчик или undefined если не найден
   */
  getHandler(decisionType: string): IDecisionHandler | undefined {
    return this.handlers[decisionType]
  }

  /**
   * Проверяет, зарегистрирован ли обработчик для типа решения
   * @param decisionType - тип решения
   * @returns true если обработчик зарегистрирован
   */
  hasHandler(decisionType: string): boolean {
    return decisionType in this.handlers
  }

  /**
   * Генерирует документ решения используя зарегистрированный обработчик
   * @param decisionType - тип решения
   * @param data - данные для генерации
   * @returns сгенерированный документ
   * @throws Error если обработчик не найден или произошла ошибка генерации
   */
  async generateDocument(decisionType: string, data: IGenerateDecisionData): Promise<any> {
    const handler = this.getHandler(decisionType)

    if (!handler) {
      throw new Error(`Не найден обработчик для типа решения: ${decisionType}`)
    }

    try {
      return await handler.generateHandler(data)
    } catch (error) {
      console.error(`Ошибка при генерации документа решения типа ${decisionType}:`, error)
      throw new Error(`Ошибка при генерации документа решения: ${error instanceof Error ? error.message : 'Неизвестная ошибка'}`)
    }
  }

  /**
   * Получает компонент дополнительной информации для типа решения
   * @param decisionType - тип решения
   * @returns компонент или undefined если не задан
   */
  getInfoComponent(decisionType: string): IDecisionHandler['infoComponent'] {
    const handler = this.getHandler(decisionType)
    return handler?.infoComponent
  }

  /**
   * Получает список всех зарегистрированных типов решений
   * @returns массив типов решений
   */
  getRegisteredTypes(): string[] {
    return Object.keys(this.handlers)
  }
}

// Глобальный экземпляр фабрики
export const decisionFactory = new DecisionFactory()

export { DecisionFactory }
export type { DecisionHandlersRegistry, IDecisionHandler, IGenerateDecisionData }
