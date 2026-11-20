#pragma once

/**
 * @brief Пересчёт мажоритарной системы управления кооператива (флаг is_branched).
 *
 * Кооператив управляется через кооперативные участки, когда выполнены оба
 * условия: участков не меньше MIN_BRANCHES_COUNT и активных пайщиков не меньше
 * MIN_BRANCHED_PARTICIPANTS_COUNT (слово владельца 18.11.2026: три участка при
 * малом числе пайщиков систему не включают). Проверка мягкая: действие не
 * отклоняется, флаг только приводится к условиям. Тестовая сборка порога
 * пайщиков не имеет (0) — на стенде система включается по числу участков.
 *
 * Регистратор вызывает пересчёт при каждом изменении счётчика активных
 * пайщиков (приём, блокировка, разблокировка, исключение) и по сигналу
 * контракта участков (enabranches/disbranches) при изменении числа участков.
 */
template <typename Index, typename Iterator>
inline void sync_branched(Index &cooperatives, Iterator coop_itr) {
  if (coop_itr == cooperatives.end() || !coop_itr->is_cooperative) return;

  const uint64_t participants =
    coop_itr->active_participants_count.has_value() ? coop_itr->active_participants_count.value() : 0;
  const bool branched =
    get_branch_count(coop_itr->username) >= MIN_BRANCHES_COUNT && participants >= MIN_BRANCHED_PARTICIPANTS_COUNT;

  if (coop_itr->is_branched == branched) return;

  cooperatives.modify(coop_itr, RamPayer::of(cooperatives, coop_itr->username), [&](auto &c) {
    c.is_branched = branched;
  });
}
