/**
 * @brief Обратный вызов совета: заявление о паевом взносе РИД принято.
 *
 * `soviet::exec` после утверждения протокола (шаблон 3009) зовёт это действие
 * с `hash = rid_hash` и подписанным председателем протоколом. Контракт лишь
 * сверяет, что материалы на хранении и заявление по ним подано: движений
 * средств нет, паевой фонд признаётся позже, по акту приёма-передачи
 * (`acceptrid`), который подписывают преподаватель и председатель. Запись в
 * RAM не меняется — состояние «совет принял решение» ведёт приложение
 * кооператива по этому действию в цепи.
 *
 * Guards:
 *  - вызывает контракт совета;
 *  - материалы с rid_hash приняты на хранение и заявление подано.
 *
 * @ingroup public_edubridge_actions
 */
void edubridge::onridauth(eosio::name coopname,
                          checksum256 hash,
                          document2 authorization) {
  require_auth(_soviet);
  eosio::check(!is_empty_document(authorization),
               "EDUBRIDGE_RID_DECISION_REQUIRED: Отсутствует протокол совета о приёме паевого взноса РИД");

  edu_rids_index rids(_edubridge, coopname.value);
  auto rid = Edubridge::get_rid_or_fail(rids, hash);
  eosio::check(rid->statement_hash != checksum256(),
               "EDUBRIDGE_RID_STATEMENT_NOT_SUBMITTED: Заявление о паевом взносе по этим материалам не подано");
}
