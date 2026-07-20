#include "registrator.hpp"

#include "src/system/init.cpp"
#include "src/system/migrate.cpp"

#include "src/user/adduser.cpp"
#include "src/user/confirmpay.cpp"
#include "src/user/confirmreg.cpp"
#include "src/user/declinereg.cpp"
#include "src/user/declinepay.cpp"
#include "src/user/refundpay.cpp"
#include "src/user/declinerfnd.cpp"
#include "src/user/reguser.cpp"

#include "src/exit/exit_helpers.hpp"
#include "src/exit/exitcoop.cpp"
#include "src/exit/confirmexit.cpp"
#include "src/exit/completexit.cpp"
#include "src/exit/declinexit.cpp"

#include "src/account/createbranch.cpp"
#include "src/account/newaccount.cpp"
#include "src/account/updateaccnt.cpp"
#include "src/account/changekey.cpp"

#include "src/coop/delcoop.cpp"
#include "src/coop/regcoop.cpp"
#include "src/coop/stcoopstatus.cpp"
#include "src/coop/enabranches.cpp"
#include "src/coop/disbranches.cpp"
#include "src/coop/updatecoop.cpp"
#include "src/coop/decparticpnt.cpp"

#include "src/verification/verificate.cpp"
