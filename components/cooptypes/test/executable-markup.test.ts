import { describe, expect, it } from 'vitest'
import { _Common } from '../src'

const { hasExecutableMarkup } = _Common.Text

/**
 * Повестка собрания и проект решения уходят в подписываемый документ как есть:
 * опасное отклоняется на входе, вёрстка проходит (решение владельца 25.09.2026,
 * C28-80).
 */
describe('исполняемая разметка в тексте документа', () => {
  it('вёрстка документа проходит: абзацы, таблицы, выделение, стили, ссылки', () => {
    for (const text of [
      'Утвердить годовой отчёт',
      '<p>Утвердить редакцию</p><table><tr><td>1</td></tr></table>',
      '<style>h1{margin:0}</style><h1 style="text-align:center">Положение</h1>',
      '<b>важно</b> <em>пояснение</em> <a href="https://coopenomics.world">ссылка</a>',
      'Сумма < 100 и > 10 — это не разметка',
      'Кнопка onclick в тексте без тега',
      '<meta charset="UTF-8"><p>документ фабрики</p>',
    ])
      expect(hasExecutableMarkup(text), text).toBe(false)
  })

  it('исполняемое отклоняется: скрипты, рамки, обработчики, опасные ссылки, формы', () => {
    for (const text of [
      '<script>alert(1)</script>',
      '<SCRIPT src=x></SCRIPT>',
      '<img src=x onerror=alert(1)>',
      '<div onclick="steal()">текст</div>',
      '<iframe src="https://evil"></iframe>',
      '<object data=x></object>',
      '<embed src=x>',
      '<meta http-equiv="refresh" content="0;url=https://evil">',
      '<link rel=stylesheet href=x>',
      '<base href="https://evil/">',
      '<form action="https://evil"><input></form>',
      '<a href="javascript:alert(1)">клик</a>',
      '<a href=\' vbscript:x\'>клик</a>',
      '<a href="data:text/html;base64,xx">клик</a>',
      '[клик](javascript:alert(1))',
    ])
      expect(hasExecutableMarkup(text), text).toBe(true)
  })

  it('пустое значение — не разметка', () => {
    expect(hasExecutableMarkup('')).toBe(false)
    expect(hasExecutableMarkup(null)).toBe(false)
    expect(hasExecutableMarkup(undefined)).toBe(false)
  })
})
