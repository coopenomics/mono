export interface CommandPalettePage {
  /** Внутренний идентификатор страницы (route name) */
  name: string;
  /** Отображаемое имя */
  title: string;
  /** Иконка (Material Symbols / FontAwesome name) */
  icon?: string;
  /** Шорткат справа (например «⌘P») */
  shortcut?: string;
}

export interface CommandPaletteWorkspace {
  /** Внутренний идентификатор рабочего стола */
  name: string;
  /** Отображаемое имя стола */
  title: string;
  /** Иконка стола */
  icon: string;
  /** Техническое имя приложения, которому принадлежит стол */
  appName?: string;
  /** Название приложения: заголовок группы и подпись стола */
  appTitle?: string;
  /** Этот стол сейчас активен (отметка в списке + бейдж «Активный») */
  isActive?: boolean;
  /** Страницы стола */
  pages: CommandPalettePage[];
}

/** Команда стола: «Добавить задачу», «Создать предложение». */
export interface CommandPaletteCommand {
  id: string;
  title: string;
  icon: string;
  /** Приложение команды — подпись справа */
  subtitle?: string;
  /** Слова, по которым команда ещё находится */
  keywords?: string[];
  /** Стол команды: в правой колонке она стоит после его страниц */
  workspace?: string;
  /** Клавиши сочетания по порядку: ['N', 'T'] */
  shortcut?: readonly string[];
}

/** Находка единого поиска: пайщик, документ, запись приложения. */
export interface CommandPaletteHit {
  /** Отличает находку от других в той же группе */
  key: string;
  title: string;
  /** Уточнение справа: аккаунт, подписант, номер */
  subtitle?: string;
  /** Значок находки; без него берётся значок группы */
  icon?: string;
}

/** Группа находок одного источника поиска. */
export interface CommandPaletteSearchGroup {
  key: string;
  title: string;
  icon: string;
  /** Источник не успел ответить или упал — поиск по нему неполон */
  incomplete?: boolean;
  hits: CommandPaletteHit[];
}

export interface CommandPaletteProps {
  /** Управляющий v-model — palette открыто/закрыто */
  modelValue: boolean;
  /** Иерархия рабочих столов и их страниц */
  workspaces: CommandPaletteWorkspace[];
  /** Плейсхолдер для поиска */
  placeholder?: string;
  /** Подпись бейджа активного стола (default «Активный») */
  activeLabel?: string;
  /** Команды столов; окно показывает их, когда запрос совпал с названием */
  commands?: CommandPaletteCommand[];
  /** Находки единого поиска по текущему запросу — приходят от владельца окна */
  searchGroups?: CommandPaletteSearchGroup[];
  /** Единый поиск ещё отвечает */
  searching?: boolean;
}
