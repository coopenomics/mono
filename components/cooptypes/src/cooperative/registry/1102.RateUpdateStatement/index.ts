import type { IGenerate, IMetaDocument } from '../../document'

export const registry_id = 1102

// Модель действия для генерации
export interface Action extends IGenerate {
  registry_id: number
}

export type Meta = IMetaDocument & Action

// Модель данных документа
export interface Model {
  meta: IMetaDocument
}

export const title = 'Заявление об обновлении ставки часа'
export const description = 'Форма заявления пайщика на обновление утверждённой ставки часа в рамках проекта'
export const context = '<div class="digital-document"><div style="text-align: center"><h2>ЗАЯВЛЕНИЕ ОБ ОБНОВЛЕНИИ СТАВКИ</h2></div><p>Подпись: Иван Иванович</p></div>'

export const translations = {}
export const exampleData = {}
