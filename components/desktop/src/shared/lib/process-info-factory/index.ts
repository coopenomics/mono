import type {
  IProcessInfoHandler,
  ProcessInfoComponent,
  ProcessInfoHandlersRegistry,
} from '../types/process-info-factory'

/**
 * Фабрика расширений для столбца «Содержание процесса» на столе бухгалтера.
 * Каждое прикладное расширение (marketplace, capital, registrator, …)
 * регистрирует один Vue-компонент на каждый известный ему process_type.
 * Сам стол бухгалтера остаётся source-of-truth по проводкам, кошелькам и
 * документам — дополнительный widget показывает только бизнес-описание
 * операции (кто заказчик, кто поставщик, состав, deep-link на стол расширения).
 */
class ProcessInfoFactory {
  private handlers: ProcessInfoHandlersRegistry = {}

  registerHandler(processType: string, handler: IProcessInfoHandler): void {
    this.handlers[processType] = handler
  }

  getInfoComponent(processType: string): ProcessInfoComponent | undefined {
    return this.handlers[processType]?.infoComponent
  }

  hasHandler(processType: string): boolean {
    return processType in this.handlers
  }

  getRegisteredTypes(): string[] {
    return Object.keys(this.handlers)
  }
}

export const processInfoFactory = new ProcessInfoFactory()
export { ProcessInfoFactory }
export type {
  IProcessInfoHandler,
  ProcessInfoComponent,
  ProcessInfoHandlersRegistry,
} from '../types/process-info-factory'
