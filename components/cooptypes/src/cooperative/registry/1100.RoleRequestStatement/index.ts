import type { IGenerate, IMetaDocument } from '../../document'

export const registry_id = 1100

// Модель действия для генерации
export interface Action extends IGenerate {
  registry_id: number
}

export type Meta = IMetaDocument & Action

// Модель данных документа
export interface Model {
  meta: IMetaDocument
}

export const title = 'Заявление о получении допуска L2'
export const description = 'Форма заявления пайщика на получение допуска L2 (мастер компонента, соавтор, исполнитель) с указанием желаемой ставки часа и часов в день'
export const context = '<div class="digital-document"><div style="text-align: center"><h2>ЗАЯВЛЕНИЕ О ПОЛУЧЕНИИ ДОПУСКА L2</h2></div><p>Подпись: Иван Иванович</p></div>'

export const translations = {}
export const exampleData = {}
