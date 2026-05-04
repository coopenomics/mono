import { createHash } from 'node:crypto'

export interface ProjectSeed {
  id: number
  title: string
  parentId: number | null
}

export const ROOT_HASH = '0000000000000000000000000000000000000000000000000000000000000000'

export function projectHash(id: number): string {
  return createHash('sha256').update(`blago:project:${id}`).digest('hex')
}

// Источник: components/blago-cli/_blago/INDEX.md
// 12 проектов + 30 компонентов. id и связи — ровно как в индексе.
// «Проект» и «Компонент» — словарные термины (см. _blago/.../c5-slovar-...md):
// проект = направление работы кооператива, компонент = атомарная задача внутри проекта.
//
// «Кошелёк пайщика» (id=48) — реальный проект кооператива, в индексе _blago/INDEX.md
// его ещё нет, но он существует как направление: контракт лицевых счетов, членские
// взносы, интеграция «кнопка Благорост» в сторонние приложения. Добавлен здесь.
export const PROJECTS: ProjectSeed[] = [
  // === Проекты ===
  { id: 1, parentId: null, title: 'Приложение «Стол Заказов»' },
  { id: 4, parentId: null, title: 'Пропаганда кооперации' },
  { id: 7, parentId: null, title: 'Приложение «Благорост»' },
  { id: 11, parentId: null, title: 'Кооперативный мессенджер «Оп!Кооп»' },
  { id: 13, parentId: null, title: 'Платформа Цифрового Кооператива' },
  { id: 16, parentId: null, title: 'Платформа Каталога Приложений' },
  { id: 17, parentId: null, title: 'Платформа Кооперативной Экономики' },
  { id: 29, parentId: null, title: 'Гранты и финансирование' },
  { id: 33, parentId: null, title: 'Платформа отчётов для ФНС/ФСС' },
  { id: 34, parentId: null, title: 'Платформа Управления' },
  { id: 36, parentId: null, title: 'Платформа образования' },
  { id: 43, parentId: null, title: 'Облачный провайдер' },
  { id: 48, parentId: null, title: 'Кошелёк пайщика' },

  // === Компоненты ===
  { id: 3, parentId: 1, title: 'Минимальный продукт' },
  { id: 8, parentId: 7, title: 'Командный инструмент blago-cli v1' },
  { id: 10, parentId: 7, title: 'Версия 1.1' },
  { id: 12, parentId: 4, title: 'Системный логотип v1' },
  { id: 14, parentId: 13, title: 'Версия 3' },
  { id: 18, parentId: 17, title: 'Консенсус Proof of Authority' },
  { id: 19, parentId: 17, title: 'Версия 1.1' },
  { id: 20, parentId: 4, title: 'Видео по кооперации v1' },
  { id: 21, parentId: 4, title: 'Посты и статьи v1' },
  { id: 22, parentId: 4, title: 'Гость в студии v1' },
  { id: 23, parentId: 4, title: 'Партнёры и Соглашения v1' },
  { id: 24, parentId: 4, title: 'Российский Университет Кооперации v1' },
  { id: 25, parentId: 4, title: 'Международный форум кооперации v1' },
  { id: 26, parentId: 4, title: 'Настольная игра v1' },
  { id: 27, parentId: 4, title: 'Лендинги и посадочные страницы v1' },
  { id: 28, parentId: 4, title: 'Кооператив блогеров v1' },
  { id: 30, parentId: 4, title: 'Концепция (апрель 2026 — апрель 2027)' },
  { id: 31, parentId: 13, title: 'Общие собрания v2' },
  { id: 32, parentId: 17, title: 'Верификатор документов v1' },
  { id: 35, parentId: 13, title: 'Авто-секретарь чатов и звонков' },
  { id: 37, parentId: 36, title: 'MVP' },
  { id: 38, parentId: 36, title: 'Концепция' },
  { id: 39, parentId: 7, title: 'Версия 1.2' },
  { id: 40, parentId: 33, title: 'MVP' },
  { id: 41, parentId: 17, title: 'Универсальный индексер блокчейна (parser v2)' },
  { id: 42, parentId: 13, title: 'Удостоверение пайщика (coopID)' },
  { id: 44, parentId: 43, title: 'MVP' },
  { id: 45, parentId: 13, title: 'Хранилище файлов v1' },
  { id: 46, parentId: 17, title: 'Реестр кооперативных стандартов v1' },
  { id: 47, parentId: 16, title: 'MVP' },
  { id: 49, parentId: 48, title: 'MVP v1' },
]
