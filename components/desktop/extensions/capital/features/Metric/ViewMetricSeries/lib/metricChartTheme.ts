/** Читает CSS-токен с documentElement (только клиент). */
export function cssToken(name: string, fallback: string): string {
  if (typeof document === 'undefined') return fallback;
  const value = getComputedStyle(document.documentElement)
    .getPropertyValue(name)
    .trim();
  return value || fallback;
}

export function metricChartPalette() {
  return {
    primary: cssToken('--p-primary', '#0f766e'),
    ink: cssToken('--p-ink', '#09090b'),
    ink2: cssToken('--p-ink-2', 'rgba(9, 9, 11, 0.58)'),
    ink3: cssToken('--p-ink-3', 'rgba(9, 9, 11, 0.40)'),
    line: cssToken('--p-line-1', 'rgba(9, 9, 11, 0.10)'),
    surface2: cssToken('--p-surface-2', '#f7f7f8'),
    warn: cssToken('--p-warn', '#b45309'),
    pos: cssToken('--p-pos', '#15803d'),
    neg: cssToken('--p-neg', '#b91c1c'),
  };
}
