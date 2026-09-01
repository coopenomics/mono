/**
 * \brief Выдать или продлить заверение.
 * \ingroup public_ano_actions
 *
 * Действие одно на оба уровня цепочки: АНО им признаёт оператора, оператор —
 * кооператив. Отличие только в том, кто подписывает, и в предельном сроке.
 *
 * Кто вправе заверять. АНО — всегда, она корень и опирается сама на себя.
 * Все остальные — только имея действующее заверение. Это и есть то свойство,
 * ради которого затевалась цепочка: право заверять не берётся из факта
 * существования аккаунта, а передаётся сверху и вместе со сроком.
 *
 * Почему нельзя заверить самого себя. Тогда любой аккаунт объявил бы себя
 * признанным, и проверка перестала бы что-либо значить: цепочка, замкнутая на
 * себя, ведёт не к корню, а по кругу.
 *
 * Почему срок ограничен сверху. Отозвать выданную подпись невозможно — она уже
 * у того, кому её выдали. Единственный способ перестать признавать — перестать
 * продлевать и дождаться, пока заверение погаснет. Предел срока и определяет,
 * сколько ждать; без него заверяющий выписал бы бессрочное признание, и отзыв
 * стал бы недостижим.
 *
 * Что действие не проверяет — подпись. Она разбирается там же, где проверяются
 * удостоверения пайщиков, единственной реализацией. Испортивший подпись портит
 * её себе: его собственные кооперативы перестанут проходить проверку.
 */
void ano::endorse(eosio::name issuer,
                  eosio::name subject,
                  eosio::checksum256 chain_id,
                  eosio::public_key cert_key,
                  eosio::time_point_sec expires_at,
                  std::string credential) {
  require_auth(issuer);

  eosio::check(subject.value != 0, "Не указано, кого заверяют");
  eosio::check(issuer != subject, "Заверить самого себя нельзя: такая цепочка ведёт не к корню, а по кругу");
  eosio::check(chain_id != eosio::checksum256(), "Не указана сеть, в которой действует заверение");
  eosio::check(!credential.empty(), "Заверение без подписи бессмысленно: проверять будет нечего");
  eosio::check(credential.size() <= MAX_CREDENTIAL_SIZE, "Подписанное заверение неправдоподобно велико");

  const uint64_t now = eosio::current_time_point().sec_since_epoch();
  eosio::check(expires_at.sec_since_epoch() > now, "Срок заверения уже истёк");

  endorsements_index endorsements(get_self(), get_self().value);

  uint64_t max_term = ROOT_ENDORSEMENT_MAX_SECONDS;

  if (issuer != _ano) {
    auto own = endorsements.find(issuer.value);
    eosio::check(own != endorsements.end(), "Заверять вправе только тот, кто заверен сам");
    eosio::check(own->expires_at.sec_since_epoch() > now,
                 "Заверение заверяющего истекло: сначала продлите своё, потом заверяйте других");
    eosio::check(own->chain_id == chain_id, "Заверение выдаётся в той же сети, в которой заверен сам заверяющий");
    max_term = ENDORSEMENT_MAX_SECONDS;
  }

  eosio::check(expires_at.sec_since_epoch() - now <= max_term, "Срок заверения превышает предельный");

  auto it = endorsements.find(subject.value);

  if (it == endorsements.end()) {
    endorsements.emplace(issuer, [&](auto &e) {
      e.subject = subject;
      e.issuer = issuer;
      e.chain_id = chain_id;
      e.cert_key = cert_key;
      e.issued_at = eosio::time_point_sec(now);
      e.expires_at = expires_at;
      e.credential = credential;
    });
    return;
  }

  // Перехватить чужого подопечного нельзя: продлевает тот, кто заверял. АНО —
  // исключение, иначе ошибку оператора было бы некому исправить.
  eosio::check(it->issuer == issuer || issuer == _ano,
               "Этот субъект заверен другим: продлить заверение может только выдавший его либо АНО");

  const eosio::name payer = it->issuer == issuer ? eosio::same_payer : issuer;

  endorsements.modify(it, payer, [&](auto &e) {
    e.issuer = issuer;
    e.chain_id = chain_id;
    e.cert_key = cert_key;
    e.issued_at = eosio::time_point_sec(now);
    e.expires_at = expires_at;
    e.credential = credential;
  });
}
