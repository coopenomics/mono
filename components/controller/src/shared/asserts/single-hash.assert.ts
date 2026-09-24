// utils/assertSingleHash.ts
export function assertSingleHash(...hashes: Array<string | undefined>): string {
  const filtered = hashes.filter((h): h is string => !!h).map((h) => h.toUpperCase());
  if (filtered.length === 0) {
    // i18n-ignore: внутренний инвариант согласованности хэша объекта meet, до пайщика не доходит
    throw new Error('Hash для объекта meet не найден');
  }

  const unique = new Set(filtered);
  if (unique.size > 1) {
    // i18n-ignore: внутренний инвариант согласованности хэша объектов на всех стадиях, до пайщика не доходит
    throw new Error('Hash объектов должен быть одинаковым во всех стадиях');
  }

  return filtered[0];
}
