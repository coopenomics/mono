cmake_minimum_required(VERSION 3.5)

# Проект
project(billing)

find_package(cdt)

# Добавление контракта
add_contract(billing billing billing.cpp)
if(IS_TESTNET)
    target_compile_definitions(billing PUBLIC IS_TESTNET=1)
else()
    # Не определяем IS_TESTNET для продакшн режима
endif()
