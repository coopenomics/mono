import type { IGenerate, IMetaDocument } from '../../document'

export const registry_id = 1101

// Модель действия для генерации
export interface Action extends IGenerate {
  registry_id: number
}

export type Meta = IMetaDocument & Action

// Модель данных документа
export interface Model {
  meta: IMetaDocument
}

export const title = 'Приглашение мастера на L2-допуск'
export const description = 'Форма приглашения мастером компонента пайщика на L2-допуск (соавтор, исполнитель)'
export const context = '<div class="digital-document"><div style="text-align: center"><h2>ПРИГЛАШЕНИЕ НА L2-ДОПУСК</h2></div><p>Подпись: Иван Иванович</p></div>'

export const translations = {}
export const exampleData = {}
