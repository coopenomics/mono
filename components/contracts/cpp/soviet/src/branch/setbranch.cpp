/**
 * @brief Системная привязка пайщика к кооперативному участку
 * Устанавливает или сбрасывает кооперативный участок пайщика без заявления —
 * вызывается контрактом участков при назначении или смене председателя участка:
 * председатель всегда привязан к собственному участку и не выбирает его заявлением.
 * Пустое наименование участка сбрасывает привязку (пайщик выберет участок заново).
 * @param coopname Наименование кооператива
 * @param username Наименование пайщика
 * @param braname Наименование кооперативного участка (пустое — сброс привязки)
 * @ingroup public_actions
 * @ingroup public_soviet_actions

 * @note Авторизация требуется от аккаунта: @p _branch
 */
void soviet::setbranch(eosio::name coopname, eosio::name username, eosio::name braname) {
    require_auth(_branch);

    participants_index participants(_soviet, coopname.value);
    auto participant = participants.find(username.value);

    // председатель участка может не быть пайщиком на момент учреждения — не роняем создание участка
    if (participant == participants.end()) {
        return;
    }

    participants.modify(participant, get_self(), [&](auto& row) {
        if (braname == ""_n) {
            row.braname.reset();
        } else {
            row.braname = braname;
        }
    });
}
