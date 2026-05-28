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
}
