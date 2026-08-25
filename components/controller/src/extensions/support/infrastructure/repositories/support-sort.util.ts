import { BadRequestException } from '@nestjs/common';

/**
 * Проверка поля сортировки против белого списка.
 *
 * Живёт здесь, а не в каждом репозитории, по двум причинам. Первая — обычная:
 * проверка одна и та же в двух местах (обращения и лента), а повторённое
 * условие расходится. Вторая важнее: тип исключения.
 *
 * Неизвестное поле сортировки — ошибка клиента, а не сервера. Голый `Error`
 * уходит наружу пятисотой: фильтр исключений оставляет таким ошибкам
 * `INTERNAL_SERVER_ERROR`, и клиент видит «внутренняя ошибка» там, где сам
 * передал недопустимое значение. `BadRequestException` даёт 400 и внятный
 * текст.
 *
 * **Известное ограничение, которое здесь не чинится.** Тем же голым `Error`
 * отвечает `PaginationUtils.validatePaginationOptions` из
 * `@coopenomics/extension-kit` на отрицательную страницу, предел больше тысячи
 * и неизвестное направление сортировки. Это общий код платформы: правка задела
 * бы все расширения сразу, поэтому вынесена вопросом, а не сделана здесь.
 */
export function assertSortFieldAllowed(
  sortBy: string | undefined,
  allowedFields: ReadonlyArray<string>,
  subject: string
): void {
  if (!sortBy || allowedFields.includes(sortBy)) return;

  throw new BadRequestException(
    `Сортировка (${subject}) по полю "${sortBy}" не поддерживается. Допустимые поля: ${allowedFields.join(', ')}`
  );
}
