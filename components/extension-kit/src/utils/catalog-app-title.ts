/**
 * Название приложения каталога для показа пайщику: имя пакета без области,
 * с прописной буквы (`@voskhod/demoapp` → «Demoapp»). Манифест с человеческим
 * названием каталог пока не отдаёт; правило одно — для витрины приложений и
 * стола подключения.
 */
export function catalogAppTitle(packageId: string): string {
  const tail = packageId.split('/').pop() ?? packageId;
  return tail.charAt(0).toUpperCase() + tail.slice(1);
}
