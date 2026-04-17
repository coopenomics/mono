cmake_minimum_required(VERSION 3.5)

project(ledger2)

find_package(cdt)

add_contract(ledger2 ledger2 ledger2.cpp)
if(IS_TESTNET)
    target_compile_definitions(ledger2 PUBLIC IS_TESTNET=1)
else()
    # Не определяем IS_TESTNET для продакшн режима
endif()
