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
  /** Этот стол сейчас активен (sticky-баннер сверху + бейдж «Активный») */
  isActive?: boolean;
  /** Страницы стола */
  pages: CommandPalettePage[];
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
}
