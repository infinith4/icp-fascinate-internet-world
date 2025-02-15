#!/usr/bin/expect -f

set Prompt "\[#$%>\]"
expect -c "
set timeout 100
spawn sh -ci {$(curl -fsSL https://internetcomputer.org/install.sh)}
expect \"Proceed with installation\"
send \"\n\n\n\"
expect {
    -glob "${Prompt}" {
        interact
        exit 0
    }
}
"

expect -c "
spawn sh -ci {. $HOME/.local/share/dfx/env && dfx --version}
send \"\n\n\n\n\"
expect {
    -glob "${Prompt}" {
        interact
        exit 0
    }
}
"

