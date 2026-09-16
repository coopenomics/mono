#pragma once

/**
 * Вспомогательные функции робота решений совета.
 *
 * Робот голосует и подписывает протоколы от имени членов совета ключом отдельного
 * разрешения их аккаунта. Две проверки ниже держат это юридически чистым:
 *  - хэш голоса жёстко привязан к конкретному голосу, подпись нельзя переиспользовать;
 *  - ключ подписи обязан принадлежать заявленному разрешению аккаунта члена совета,
 *    и если это не active, то по этому типу решения должна быть включена автоматизация.
 */
namespace Automation {

/**
 * @brief Хэш, который подписывает член совета при голосовании
 *
 * Строка «<действие>:<кооператив>:<номер решения>:<секунды подписи>». Подпись над
 * ним нельзя переиспользовать для другого решения, другого кооператива или голоса
 * противоположного знака. Тот же формат считает SDK (Classes.Vote).
 */
inline checksum256 vote_digest(eosio::name action, eosio::name coopname, uint64_t decision_id, eosio::time_point_sec signed_at) {
  std::string payload = action.to_string() + ":" + coopname.to_string() + ":" + std::to_string(decision_id) + ":" +
                        std::to_string(signed_at.sec_since_epoch());
  return eosio::sha256(payload.data(), payload.size());
}

/** Что именно подписывает член совета: голос или протокол. */
enum class Kind { vote, authorize };

/**
 * @brief Проверка, что подпись сделана ключом указанного разрешения аккаунта члена совета
 *
 * active — ручная подпись, ограничений нет. Любое другое разрешение — подпись
 * робота: запись в реестре автоматизаций обязана существовать, совпадать по имени
 * разрешения, не быть просроченной и содержать тип решения в нужном списке.
 * Принадлежность ключа разрешению проверяет интринзик ноды
 * assert_recover_key_account, поэтому чужим ключом подписать нельзя даже при
 * включённой автоматизации.
 */
inline void verify_member_signature(eosio::name coopname, eosio::name member, eosio::name permission, eosio::name decision_type,
                                    Kind kind, const checksum256& signed_hash, const eosio::signature& signature,
                                    const eosio::public_key& public_key) {
  eosio::check(permission != ""_n, "Не указано разрешение, которым подписан голос");

  if (permission != "active"_n) {
    automator_index automator(_soviet, coopname.value);
    auto by_member = automator.get_index<"bymember"_n>();
    auto autom = by_member.find(member.value);

    eosio::check(autom != by_member.end(), "Автоматизация решений для члена совета не включена");
    eosio::check(autom->permission_name == permission, "Разрешение не совпадает с разрешением робота в реестре автоматизаций");
    eosio::check(!autom->is_expired(), "Срок действия автоматизации истёк");

    if (kind == Kind::vote) {
      eosio::check(autom->allows_vote(decision_type), "Голосование по этому типу решения роботу не делегировано");
    } else {
      eosio::check(autom->allows_authorize(decision_type), "Подпись протокола по этому типу решения роботу не делегирована");
    }
  }

  eosio::assert_recover_key_account(signed_hash, signature, public_key, member, permission);
}

}  // namespace Automation
