#include <eosio/action.hpp>
#include <eosio/crypto.hpp>
#include <eosio/permission.hpp>
#include "soviet.hpp"

#include "src/address/creaddress.cpp"
#include "src/address/deladdress.cpp"
#include "src/address/editaddress.cpp"

#include "src/admin/addstaff.cpp"
#include "src/admin/rmstaff.cpp"
#include "src/admin/setrights.cpp"
#include "src/admin/validate.cpp"

#include "src/agenda/createagenda.cpp"

#include "src/agreement/confirmagree.cpp"
#include "src/agreement/declineagree.cpp"
#include "src/agreement/sndagreement.cpp"
#include "src/agreement/migrateagree.cpp"
#include "src/approve/confirmapprv.cpp"
#include "src/approve/createapprv.cpp"
#include "src/approve/declineapprv.cpp"

#include "src/automator/automate.cpp"
#include "src/automator/disautomate.cpp"

#include "src/board/createboard.cpp"
#include "src/board/updateboard.cpp"

#include "src/branch/deletebranch.cpp"

#include "src/capital/capauthinvst.cpp"
#include "src/capital/capregcontr.cpp"

#include "src/decision/authorize.cpp"
#include "src/decision/freedecision.cpp"
#include "src/decision/exec.cpp"
#include "src/decision/cancelexprd.cpp"

#include "src/doc/declinedoc.cpp"
#include "src/doc/newact.cpp"
#include "src/doc/newlink.cpp"
#include "src/doc/newdecision.cpp"
#include "src/doc/newdeclined.cpp"
#include "src/doc/newresolved.cpp"
#include "src/doc/newsubmitted.cpp"
#include "src/doc/newagreement.cpp"
#include "src/doc/newpackage.cpp"

#include "src/fund/fundwithdraw.cpp"

#include "src/participant/addparticipant.cpp"
#include "src/participant/block.cpp"
#include "src/participant/cancelreg.cpp"
#include "src/participant/unblock.cpp"
#include "src/participant/selectbranch.cpp"

#include "src/program/createprog.cpp"
#include "src/program/disableprog.cpp"
#include "src/program/editprog.cpp"

#include "src/system/init.cpp"
#include "src/system/migrate.cpp"

#include "src/vote/cancelvote.cpp"
#include "src/vote/voteagainst.cpp"
#include "src/vote/votefor.cpp"

#include "src/wallet/addbal.cpp"
#include "src/wallet/addmemberfee.cpp"
#include "src/wallet/blockbal.cpp"
#include "src/wallet/openprogwall.cpp"
#include "src/wallet/subbal.cpp"
#include "src/wallet/unblockbal.cpp"

#include "src/withdraw/withdraw.cpp"

using namespace eosio;
