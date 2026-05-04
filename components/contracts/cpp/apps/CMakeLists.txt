cmake_minimum_required(VERSION 3.5)

# Проект
project(apps)

find_package(cdt)

# Добавление контракта
add_contract(apps apps apps.cpp)
if(IS_TESTNET)
    target_compile_definitions(apps PUBLIC IS_TESTNET=1)
else()
    # Не определяем IS_TESTNET для продакшн режима
endif()
