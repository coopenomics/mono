import { _Common } from 'cooptypes';

/**
 * Очистка текста из редактора переехала в общий пакет: та же проверка нужна на
 * сервере, а две копии правила разошлись бы при первой же правке. Здесь
 * остаётся только имя, к которому привык кабинет.
 */
export const sanitizeEditorMarkdown = _Common.Text.sanitizeEditorMarkdown;
