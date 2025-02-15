#!/usr/bin/expect -f

set Prompt "\[#$%>\]"
expect -c "
set timeout 100
spawn sh -c {curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh}
expect \"Proceed with standard installation\"
send \"\n\n\n\"
expect {
    -glob \"${Prompt}\" {
        interact
        exit 0
    }
}
"

