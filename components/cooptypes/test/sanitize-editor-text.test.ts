import { describe, expect, it } from 'vitest'
import { _Common } from '../src'

/**
 * Очистка текста из редактора: описание проекта или задачи, приглашение,
 * краткое содержание звонка. До 17.09.2026 правило жило только в браузере, а
 * мутация принимала что угодно — запрос напрямую в API клал в базу
 * произвольную разметку, и она попадала в собираемые документы.
 *
 * Правило намеренно мягкое: описание живёт вперемешку с разметкой, таблицами и
 * схемами, вырезать их значило бы испортить уже написанное. Поэтому здесь
 * проверяется и то, что уходит исполняемое, и то, что остальное остаётся.
 */
const clean = _Common.Text.sanitizeEditorMarkdown

describe('очистка текста из редактора', () => {
  it('скрипт вырезается', () => {
    expect(clean('Описание<script>fetch("/steal")</script> проекта')).toBe('Описание проекта')
  })

  it('обработчик события у тега снимается, сам тег остаётся', () => {
    expect(clean('<img src="/logo.png" onerror="alert(1)">')).toBe('<img src="/logo.png">')
  })

  it('ссылка со схемой javascript обезвреживается', () => {
    expect(clean('[нажми](javascript:alert(1))')).toBe('[нажми](unsafe:alert(1))')
  })

  it('встраиваемая рамка вырезается', () => {
    expect(clean('до<iframe src="https://зло"></iframe>после')).toBe('допосле')
  })

  it('обычная разметка описания сохраняется', () => {
    const text = '# Проект\n\nТаблица:\n\n| а | б |\n|---|---|\n| 1 | 2 |\n\n<div class="note">Заметка</div>'
    expect(clean(text)).toBe(text)
  })

  it('схема BPMN в описании не портится', () => {
    const xml = '<?xml version="1.0"?>\n<bpmn:definitions id="d1"><bpmn:process id="p1" isExecutable="false"/></bpmn:definitions>'
    expect(clean(xml)).toBe(xml)
  })

  it('пример кода внутри блока остаётся как введён', () => {
    const text = 'Пример:\n\n```html\n<script>alert(1)</script>\n```\n'
    expect(clean(text)).toBe(text)
  })

  it('пустое значение возвращается как есть', () => {
    expect(clean('')).toBe('')
  })
})
