cmake_minimum_required(VERSION 3.5)

# Проект
project(ledger)

find_package(cdt)

# Добавление контракта
add_contract(ledger ledger ledger.cpp)
target_compile_definitions(ledger PUBLIC IS_TESTNET=${IS_TESTNET})
