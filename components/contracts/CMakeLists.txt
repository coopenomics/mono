cmake_minimum_required(VERSION 3.5)
project(coopenomics)

include(ExternalProject)

# Распечатываем начальное значение BUILD_TARGET
message(STATUS "Initial BUILD_TARGET=${BUILD_TARGET}")

# Макрос для сборки контрактов с диагностическими сообщениями
macro(add_contract_build name)
    string(STRIP "${BUILD_TARGET}" BUILD_TARGET_STRIPPED)
    string(STRIP "${name}" NAME_STRIPPED)

    if(NOT BUILD_TARGET_STRIPPED OR BUILD_TARGET_STRIPPED STREQUAL NAME_STRIPPED)
        message(STATUS "COMPILING ${name} CONTRACT")
        ExternalProject_Add(
            ${name}_contract
            SOURCE_DIR ${CMAKE_SOURCE_DIR}/cpp/${name}
            BINARY_DIR ${CMAKE_BINARY_DIR}/contracts/${name}
            CMAKE_ARGS -DCMAKE_TOOLCHAIN_FILE=/cdt/build/lib/cmake/cdt/CDTWasmToolchain.cmake
            UPDATE_COMMAND ""
            PATCH_COMMAND ""
            TEST_COMMAND ""
            INSTALL_COMMAND ""
            BUILD_ALWAYS 1
        )
    else()
        message(STATUS "SKIPPING ${name} CONTRACT")
    endif()
endmacro()

# Добавляем все контракты
add_contract_build(ledger)
add_contract_build(meet)
add_contract_build(loan)
add_contract_build(wallet)
add_contract_build(capital)
add_contract_build(branch)
add_contract_build(contributor)
add_contract_build(fund)
add_contract_build(draft)
add_contract_build(soviet)
add_contract_build(registrator)
add_contract_build(gateway)
add_contract_build(marketplace)
add_contract_build(system)

# Опции для тестов
option(BUILD_TESTS "Build unit tests" OFF)

if(BUILD_TESTS)
    add_subdirectory(${CMAKE_SOURCE_DIR}/cpp/tests ${CMAKE_BINARY_DIR}/contracts/tests)
endif()
