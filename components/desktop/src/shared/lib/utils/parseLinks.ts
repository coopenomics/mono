/**
 * Экранирование перед разметкой: в текст вопроса повестки, описание собрания и
 * прочие поля люди пишут что угодно, а результат этой функции показывается как
 * разметка. Без экранирования угловые скобки из текста стали бы тегами —
 * и достаточно одного председателя (или того, кто получил его доступ), чтобы
 * страница собрания выполняла чужой скрипт у каждого пайщика.
 */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

// Преобразует ссылки вида @https://... или https://... или http://... в интерактивные <a>
export function parseLinks(text = ''): string {
  if (!text) return ''
  return escapeHtml(text)
    .replace(/@?(https?:\/\/[^\s]+)/g, (match, url) => {
      const cleanUrl = url.startsWith('http') ? url : url.slice(1)
      return `<a href="${cleanUrl}" target="_blank" rel="noopener noreferrer">${cleanUrl}</a>`
    })
    .replace(/\n/g, '<br>')
}
