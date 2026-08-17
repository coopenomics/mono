/**
 * Документные типы GraphQL, общие для расширений: подписанный документ на вход,
 * сгенерированный документ на выход, опции генерации.
 *
 * Это словарь, которым расширение разговаривает с интерфейсом пайщика о
 * документах. Он одинаков у всех расширений, подписывающих документы, поэтому
 * живёт в каркасе, а не переписывается в каждом. Контракт же общения с ядровым
 * реестром документов — в ортогональном `@coopenomics/innercoop`.
 */
export * from './generated-document.contract';
export * from './generated-document.dto';
export * from './generate-document-options-input.dto';
export * from './signed-digital-document-input.dto';
export * from './lang-type.enum';
export * from './exclude-common-props';
export * from './meta-document-input.dto';
export * from './generate-meta-document-input.dto';
export * from './generate-document-input.dto';
export * from './signed-digital-document.dto';
export * from './document-aggregate.dto';
export * from './signed-document-draft-verification';
