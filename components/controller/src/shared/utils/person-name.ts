/** ФИО одной строкой; отсутствующие части пропускаем. */
export function personFullName(data: {
  last_name?: string | null;
  first_name?: string | null;
  middle_name?: string | null;
}): string {
  return [data.last_name, data.first_name, data.middle_name].filter(Boolean).join(' ');
}
