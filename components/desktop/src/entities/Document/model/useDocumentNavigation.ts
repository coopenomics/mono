import { useRoute, useRouter } from 'vue-router';

/**
 * Навигация к отдельной странице документа (`DocumentDetailsPage`) по hash.
 *
 * Используется и из реестра (клик по карточке), и из глобального поиска.
 * Страница сама загружает документ — работает и прямой переход по ссылке
 * (deep-link). Имя detail-маршрута выводим из текущего раздела: `documents`
 * (совет) → `document-details`, `user-documents` (пайщик) →
 * `user-document-details` — по аналогии с карточкой собрания meet-details.
 */
export function useDocumentNavigation() {
  const route = useRoute();
  const router = useRouter();

  function openDocument(hash: string): void {
    if (!hash) return;
    const coopname = route.params.coopname as string;
    const name = route.name === 'user-documents' ? 'user-document-details' : 'document-details';
    void router.push({ name, params: { coopname, hash } });
  }

  return { openDocument };
}
