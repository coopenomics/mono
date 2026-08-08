/**
 * Читает File и возвращает его содержимое в base64 БЕЗ data-URL префикса
 * (`data:<mime>;base64,`). Тот же контракт ожидают marketplace-мутации
 * загрузки изображений (фото гарантийного возврата, изображения offer'а):
 * backend декодирует через `Buffer.from(base64, 'base64')`.
 */
export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const value = reader.result;
      if (typeof value !== 'string') {
        reject(new Error('Не удалось прочитать файл'));
        return;
      }
      const commaAt = value.indexOf(',');
      resolve(commaAt === -1 ? value : value.slice(commaAt + 1));
    };
    reader.onerror = () => reject(reader.error ?? new Error('Ошибка чтения файла'));
    reader.readAsDataURL(file);
  });
}
