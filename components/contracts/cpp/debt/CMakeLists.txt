cmake_minimum_required(VERSION 3.5)

# Проект
project(debt)

find_package(cdt)

# Добавление контракта
add_contract(debt debt debt.cpp)
if(IS_TESTNET)
    target_compile_definitions(debt PUBLIC IS_TESTNET=1)
else()
    # Не определяем IS_TESTNET для продакшн режима
endif()
