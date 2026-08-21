cmake_minimum_required(VERSION 3.5)

# Проект
project(ano)

find_package(cdt)

# Добавление контракта
add_contract(ano ano ano.cpp)
if(IS_TESTNET)
    target_compile_definitions(ano PUBLIC IS_TESTNET=1)
else()
    # Не определяем IS_TESTNET для продакшн режима
endif()
