// capital.cpp
#include "capital.hpp"

// Подключение реализации core функций
#include "domain/core/balances/balances.cpp"
#include "domain/core/crps/crps.cpp"
#include "domain/core/gamification/gamification.cpp"
#include "domain/core/generation/generation.cpp"
#include "domain/core/program_investment.cpp"
#include "domain/core/voting/voting.cpp"

// Конфигурация контракта
#include "app/contract_managment/set_config/setconfig.cpp"
#include "app/contract_managment/migrate/migrate.cpp"

// Управление участниками
#include "app/participation_management/register_contributor/approvereg.cpp"
#include "app/participation_management/register_contributor/declinereg.cpp"
#include "app/participation_management/register_contributor/regcontrib.cpp"
#include "app/participation_management/edit_contributor/editcontrib.cpp"
#include "app/participation_management/refresh_contributor/refreshcontr.cpp"
#include "app/participation_management/level_up_notification/lvlnotify.cpp"
#include "app/participation_management/import_contributor/importcontr.cpp"

// Регистрация приложений к договору
#include "app/participation_management/get_clearance/apprvappndx.cpp"
#include "app/participation_management/get_clearance/dclineappndx.cpp"
#include "app/participation_management/get_clearance/getclearance.cpp"

// Управление проектами
#include "app/project_managment/add_author/addauthor.cpp"
#include "app/project_managment/complete_voting/cmpltvoting.cpp"
#include "app/project_managment/create_project/createproj.cpp"
#include "app/project_managment/edit_project/editproj.cpp"
#include "app/project_managment/delete_project/delproject.cpp"
#include "app/project_managment/open_project/openproject.cpp"
#include "app/project_managment/close_project/closeproject.cpp"
#include "app/project_managment/set_master/setmaster.cpp"
#include "app/project_managment/set_plan/setplan.cpp"
#include "app/project_managment/start_project/startproject.cpp"
#include "app/project_managment/start_voting/startvoting.cpp"
#include "app/project_managment/stop_project/stopproject.cpp"
#include "app/project_managment/finalize_project/finalizeproj.cpp"
#include "app/project_managment/finalize_project/returntopool.cpp"


// Инвестиции в проект
#include "app/invests_managment/invest_in_project/invest_to_project/createinvest.cpp"

// Генерация и коммиты
#include "app/generation/create_commit/approvecmmt.cpp"
#include "app/generation/create_commit/createcmmt.cpp"
#include "app/generation/create_commit/declinecmmt.cpp"
#include "app/generation/refresh_segment/rfrshsegment.cpp"
#include "app/generation/register_share/regshare.cpp"

// Голосование
#include "app/voting/calculcate_votes/calcvotes.cpp"
#include "app/voting/submit_vote/submitvote.cpp"

// Подача результатов
#include "app/result_submission/purge_segment/purgesegment.cpp"
#include "app/result_submission/push_result/approverslt.cpp"
#include "app/result_submission/push_result/authrslt.cpp"
#include "app/result_submission/push_result/declrslt.cpp"
#include "app/result_submission/push_result/pushrslt.cpp"
#include "app/result_submission/push_result/signact1.cpp"
#include "app/result_submission/push_result/signact2.cpp"
#include "app/result_submission/push_result/convertsegm.cpp"

// Инвестиции в программу
#include "app/invests_managment/invest_in_program/allocate/allocate.cpp"
#include "app/invests_managment/invest_in_program/diallocate/diallocate.cpp"
#include "app/invests_managment/invest_in_program/invest_to_program/createpinv.cpp"

// Имущественные взносы в проект
#include "app/property_management/contribute_property_in_project/approvepjprp.cpp"
#include "app/property_management/contribute_property_in_project/createpjprp.cpp"
#include "app/property_management/contribute_property_in_project/declinepjprp.cpp"

// Имущественные взносы в программу
#include "app/property_management/contribute_property_in_program/act1pgprp.cpp"
#include "app/property_management/contribute_property_in_program/act2pgprp.cpp"
#include "app/property_management/contribute_property_in_program/approvepgprp.cpp"
#include "app/property_management/contribute_property_in_program/authpgprp.cpp"
#include "app/property_management/contribute_property_in_program/createpgprp.cpp"
#include "app/property_management/contribute_property_in_program/declinepgprp.cpp"

// Управление долгами
#include "app/debt_managment/create_debt/approvedebt.cpp"
#include "app/debt_managment/create_debt/createdebt.cpp"
#include "app/debt_managment/create_debt/debtauthcnfr.cpp"
#include "app/debt_managment/create_debt/debtpaycnfrm.cpp"
#include "app/debt_managment/create_debt/debtpaydcln.cpp"
#include "app/debt_managment/create_debt/declinedebt.cpp"
#include "app/debt_managment/settle_debt/settledebt.cpp"

// Управление расходами
#include "app/expense_managment/create_expense/approveexpns.cpp"
#include "app/expense_managment/create_expense/capauthexpns.cpp"
#include "app/expense_managment/create_expense/capdeclexpns.cpp"
#include "app/expense_managment/create_expense/createexpnse.cpp"
#include "app/expense_managment/create_expense/exppaycnfrm.cpp"
#include "app/expense_managment/expand_expenses/expandexpnss.cpp"


// Распределение в программе
#include "app/distribution_managment/distribution_in_program/fund_program/fundprog.cpp"
#include "app/distribution_managment/distribution_in_program/refresh_program_wallet/refreshprog.cpp"
#include "app/distribution_managment/distribution_in_program/withdraw_from_program/approvewthd3.cpp"
#include "app/distribution_managment/distribution_in_program/withdraw_from_program/capauthwthd3.cpp"
#include "app/distribution_managment/distribution_in_program/withdraw_from_program/capdeclwthd3.cpp"
#include "app/distribution_managment/distribution_in_program/withdraw_from_program/createwthd3.cpp"
