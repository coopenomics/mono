export interface AuthSplitStep {
  key: string;
  label: string;
}

export interface AuthSplitProps {
  /** Мелкая надпись над заголовком панели (название кооператива). */
  eyebrow?: string;
  /** Заголовок тёмной панели («Вступление в пайщики», «С возвращением»). */
  title: string;
  /** Абзац под заголовком панели. */
  lead?: string;
  /** Цитата в панели — для экранов без списка шагов. */
  quote?: string;
  /** Список шагов в панели; на узком экране сворачивается в полосу прогресса. */
  steps?: AuthSplitStep[];
  /** Ключ текущего шага. */
  activeKey?: string;
  /** Ключи пройденных шагов. */
  completedKeys?: string[];
  /** Мелкая надпись над заголовком рабочей области («Шаг 1 из 7», «Вход»). */
  stepEyebrow?: string;
  /** Заголовок рабочей области. */
  heading?: string;
  /** Подпись под заголовком рабочей области. */
  text?: string;
  /** Ширина формы: sm — 440px, md — 560px, lg — 720px. */
  size?: 'sm' | 'md' | 'lg';
}
