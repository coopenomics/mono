export interface DetailsDrawerProps {
  /** Управляющий v-model — drawer открыт/закрыт */
  modelValue: boolean;
  /** Заголовок в шапке */
  title?: string;
  /** Ширина side-sheet (px). На xs игнорируется — fullscreen. */
  width?: number;
  /** Показывать кнопку «×» */
  closable?: boolean;
  /** Закрывать при клике вне (по backdrop). По умолчанию `true`. */
  clickOutsideClose?: boolean;
  /**
   * Тело без внутренних отступов: содержимое само держит поля и встаёт
   * вплотную к краям панели (редактор, холст диаграммы). По умолчанию `false`.
   */
  flush?: boolean;
}
