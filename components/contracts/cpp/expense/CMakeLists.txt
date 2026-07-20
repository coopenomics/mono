cmake_minimum_required(VERSION 3.5)

project(expense)

find_package(cdt)

add_contract(expense expense expense.cpp)
if(IS_TESTNET)
    target_compile_definitions(expense PUBLIC IS_TESTNET=1)
endif()
