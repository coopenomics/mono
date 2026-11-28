#include <eosio.token/eosio.token.hpp>
#include "../../../../lib/index.hpp"

namespace eosio {

/**
 * @brief Создает новый токен с указанным максимальным предложением.
 * Позволяет эмитенту создать токен с заданным символом и максимальным предложением.
 * @param issuer Аккаунт-эмитент токена
 * @param maximum_supply Максимальное предложение токенов
 * @ingroup public_actions
 * @ingroup public_token_actions

 * @note Авторизация требуется от аккаунта: @p eosio.token
 */
void token::create( const name&   issuer,
                    const asset&  maximum_supply )
{
    require_auth( get_self() );

    auto sym = maximum_supply.symbol;
    check( maximum_supply.is_valid(), "invalid supply");
    check( maximum_supply.amount > 0, "max-supply must be positive");

    stats statstable( get_self(), sym.code().raw() );
    auto existing = statstable.find( sym.code().raw() );
    check( existing == statstable.end(), "token with symbol already exists" );

    statstable.emplace( get_self(), [&]( auto& s ) {
       s.supply.symbol = maximum_supply.symbol;
       s.max_supply    = maximum_supply;
       s.issuer        = issuer;
    });
}

void token::is_can_transfer(const name& from, const name& to) {
  // Ведущий сети: участники его программы кошелька вправе переводить токен.
  // Имя читается из цепи один раз на перевод; сам ведущий в списке системных
  // аккаунтов больше не прописан и сверяется отдельно.
  const eosio::name lead = network_lead();
  bool from_in_lead_program = from == lead || is_valid_participant_of_program_by_type(lead, from, "wallet"_n);
  bool to_in_lead_program = to == lead || is_valid_participant_of_program_by_type(lead, to, "wallet"_n);
  
  if (!from_in_lead_program && std::find(token_whitelist.begin(), token_whitelist.end(), from) == token_whitelist.end()) {
      check(false, "Отправитель не является участником целевой потребительской программы кошелька");
  }
  
  print("from: ", from);
  print("to: ", to);
  
  if (!to_in_lead_program && std::find(token_whitelist.begin(), token_whitelist.end(), to) == token_whitelist.end()) {
      check(false, "Получатель не является участником целевой потребительской программы кошелька");
  }
}

/**
 * @brief Выпускает токены указанному аккаунту.
 * Позволяет эмитенту выпустить определенное количество токенов на аккаунт получателя.
 * @param to Аккаунт, которому выпускаются токены
 * @param quantity Количество токенов для выпуска
 * @param memo Мемо транзакции (максимум 256 байт)
 * @ingroup public_actions
 * @ingroup public_token_actions

 * @note Авторизация требуется от аккаунта: @p issuer
 */
void token::issue( const name& to, const asset& quantity, const string& memo )
{
    auto sym = quantity.symbol;
    check( sym.is_valid(), "invalid symbol name" );
    check( memo.size() <= 256, "memo has more than 256 bytes" );

    stats statstable( get_self(), sym.code().raw() );
    auto existing = statstable.find( sym.code().raw() );
    check( existing != statstable.end(), "token with symbol does not exist, create token before issue" );
    const auto& st = *existing;
    check( to == st.issuer, "tokens can only be issued to issuer account" );

    require_auth( st.issuer );
    check( quantity.is_valid(), "invalid quantity" );
    check( quantity.amount > 0, "must issue positive quantity" );

    check( quantity.symbol == st.supply.symbol, "symbol precision mismatch" );
    check( quantity.amount <= st.max_supply.amount - st.supply.amount, "quantity exceeds available supply");

    statstable.modify( st, same_payer, [&]( auto& s ) {
       s.supply += quantity;
    });
    
    is_can_transfer(st.issuer, to);
    //
    add_balance( to, quantity, st.issuer );
}

/**
 * @brief Изымает токены из обращения.
 * Позволяет эмитенту изъять определенное количество токенов из общего предложения.
 * @param quantity Количество токенов для изъятия
 * @param memo Мемо транзакции (максимум 256 байт)
 * @ingroup public_actions
 * @ingroup public_token_actions

 * @note Авторизация требуется от аккаунта: @p issuer
 */
void token::retire( const asset& quantity, const string& memo )
{
    auto sym = quantity.symbol;
    check( sym.is_valid(), "invalid symbol name" );
    check( memo.size() <= 256, "memo has more than 256 bytes" );

    stats statstable( get_self(), sym.code().raw() );
    auto existing = statstable.find( sym.code().raw() );
    check( existing != statstable.end(), "token with symbol does not exist" );
    const auto& st = *existing;

    require_auth( st.issuer );
    check( quantity.is_valid(), "invalid quantity" );
    check( quantity.amount > 0, "must retire positive quantity" );

    check( quantity.symbol == st.supply.symbol, "symbol precision mismatch" );

    statstable.modify( st, same_payer, [&]( auto& s ) {
       s.supply -= quantity;
    });

    sub_balance( st.issuer, quantity );
}

/**
 * @brief Переводит токены между аккаунтами.
 * Позволяет отправителю перевести определенное количество токенов получателю.
 * @param from Аккаунт-отправитель
 * @param to Аккаунт-получатель
 * @param quantity Количество токенов для перевода
 * @param memo Мемо транзакции
 * @ingroup public_actions
 * @ingroup public_token_actions

 * @note Авторизация требуется от аккаунта: @p from
 */
void token::transfer( const name&    from,
                      const name&    to,
                      const asset&   quantity,
                      const string&  memo )
{
    check( from != to, "cannot transfer to self" );
    require_auth( from );
    check( is_account( to ), "to account does not exist");
    auto sym = quantity.symbol.code();
    stats statstable( get_self(), sym.raw() );
    const auto& st = statstable.get( sym.raw() );

    require_recipient( from );
    require_recipient( to );

    check( quantity.is_valid(), "invalid quantity" );
    check( quantity.amount > 0, "must transfer positive quantity" );
    check( quantity.symbol == st.supply.symbol, "symbol precision mismatch" );
    check( memo.size() <= 256, "memo has more than 256 bytes" );

    auto payer = has_auth( to ) ? to : from;

    is_can_transfer(from, to);

    sub_balance( from, quantity );
    add_balance( to, quantity, payer );
}

void token::sub_balance( const name& owner, const asset& value ) {
   accounts from_acnts( get_self(), owner.value );

   const auto& from = from_acnts.get( value.symbol.code().raw(), "no balance object found" );
   check( from.balance.amount >= value.amount, "overdrawn balance" );

   from_acnts.modify( from, owner, [&]( auto& a ) {
         a.balance -= value;
      });
}

void token::add_balance( const name& owner, const asset& value, const name& ram_payer )
{
   accounts to_acnts( get_self(), owner.value );
   auto to = to_acnts.find( value.symbol.code().raw() );
   if( to == to_acnts.end() ) {
      to_acnts.emplace( ram_payer, [&]( auto& a ){
        a.balance = value;
      });
   } else {
      to_acnts.modify( to, same_payer, [&]( auto& a ) {
        a.balance += value;
      });
   }
}

/**
 * @brief Открывает аккаунт для указанного токена.
 * Позволяет ram_payer создать аккаунт owner с нулевым балансом для указанного токена.
 * @param owner Аккаунт, который будет создан
 * @param symbol Символ токена
 * @param ram_payer Аккаунт, который оплачивает RAM для этого действия
 * @ingroup public_actions
 * @ingroup public_token_actions

 * @note Авторизация требуется от аккаунта: @p ram_payer
 */
void token::open( const name& owner, const symbol& symbol, const name& ram_payer )
{
   require_auth( ram_payer );

   check( is_account( owner ), "owner account does not exist" );

   auto sym_code_raw = symbol.code().raw();
   stats statstable( get_self(), sym_code_raw );
   const auto& st = statstable.get( sym_code_raw, "symbol does not exist" );
   check( st.supply.symbol == symbol, "symbol precision mismatch" );

   accounts acnts( get_self(), owner.value );
   auto it = acnts.find( sym_code_raw );
   if( it == acnts.end() ) {
      acnts.emplace( ram_payer, [&]( auto& a ){
        a.balance = asset{0, symbol};
      });
   }
}

/**
 * @brief Закрывает аккаунт для указанного токена.
 * Позволяет владельцу закрыть аккаунт для указанного токена, если баланс равен нулю.
 * @param owner Аккаунт-владелец для выполнения действия закрытия
 * @param symbol Символ токена для выполнения действия закрытия
 * @ingroup public_actions
 * @ingroup public_token_actions

 * @note Авторизация требуется от аккаунта: @p owner
 */
void token::close( const name& owner, const symbol& symbol )
{
   require_auth( owner );
   accounts acnts( get_self(), owner.value );
   auto it = acnts.find( symbol.code().raw() );
   check( it != acnts.end(), "Balance row already deleted or never existed. Action won't have any effect." );
   check( it->balance.amount == 0, "Cannot close because the balance is not zero." );
   acnts.erase( it );
}

} /// namespace eosio
