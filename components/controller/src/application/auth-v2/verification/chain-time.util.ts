/** Chain `time_point_sec` — UTC по определению; добавляем `Z`, если таймзоны в строке нет. */
export function chainTimeToUtcIso(chainTime: string): string {
  const hasTz = /(?:Z|[+-]\d{2}:?\d{2})$/.test(chainTime);
  return new Date(hasTz ? chainTime : `${chainTime}Z`).toISOString();
}
