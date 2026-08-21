cmake_minimum_required(VERSION 3.5)

# Проект
project(edubridge)

find_package(cdt)

# Добавление контракта
add_contract(edubridge edubridge edubridge.cpp)
if(IS_TESTNET)
    target_compile_definitions(edubridge PUBLIC IS_TESTNET=1)
else()
    # Не определяем IS_TESTNET для продакшн режима
endif()
