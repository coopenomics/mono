import type { IGenerate, IMetaDocument } from '../../document'

export const registry_id = 1012

// Модель действия для генерации
export interface Action extends IGenerate {
  registry_id: number
}

export type Meta = IMetaDocument & Action

// Модель данных документа
export interface Model {
  meta: IMetaDocument
}

export const title = 'Заявление о расходе программы'
export const description = 'Форма заявления председателя кооператива на расход средств программы (вне аллокации в проект)'
export const context = '<div class="digital-document"><div style="text-align: center"><h2>ЗАЯВЛЕНИЕ О РАСХОДЕ ПРОГРАММЫ</h2></div><p>Подпись: Иван Иванович</p></div>'

export const translations = {}
export const exampleData = {}
