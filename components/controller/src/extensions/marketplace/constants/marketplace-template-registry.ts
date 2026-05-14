/**
 * `document_registry_id` template'ов оферт «Стола заказов» в платформенном
 * document registry (наполняется Story 1.7 как one-time platform setup).
 *
 * MVP-fallback (FR43a): пара (Положение ЦПП, Оферта присоединения к ЦПП) —
 * захардкоженный template из document factory, без UI конструктора ЦПП в
 * admin-столе. Пока Story 1.7 не выполнена, ID = 0 → post-install hook
 * расширения marketplace не пишет запись в `coop_cpp_registry` и оставляет
 * warn-лог.
 *
 * После Story 1.7 — заменить 0 на реальный `document_registry_id` template'а
 * (либо вынести в config / cooptypes-registry, как `Cooperative.Registry.*`
 * в Благоросте).
 */
export const MARKETPLACE_OFFER_TEMPLATE_REGISTRY_ID = 0;
