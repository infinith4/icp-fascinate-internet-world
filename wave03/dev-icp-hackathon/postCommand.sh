
### install nvm
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash

#### install node
. $HOME/.nvm/nvm.sh && \
    nvm install --lts && \
    nvm use --lts && \
    node -v && npm -v && \
    npm i -g yarn
npm install -g npm@11.1.0
nvm use --lts

# sudo apt-get update
sudo apt install libxtables12 -y
# sudo apt-get install expect -y


# bash ./postCommandDfx.sh
export DFXVM_INIT_YES=true
sh -ci "$(curl -fsSL https://internetcomputer.org/install.sh)"
export DFX_VERSION=0.25.0
sh -ci "$HOME/.local/share/dfx/env && dfx --version"


dfx --version

curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
. "$HOME/.cargo/env"

# bash ./postCommandRust.sh

. "$HOME/.cargo/env"

cargo --version


rustup target add wasm32-unknown-unknown


cd /src

curl -OL https://github.com/dfinity/pocketic/releases/download/7.0.0/pocket-ic-x86_64-linux.gz
gzip -d pocket-ic-x86_64-linux.gz
chmod +x pocket-ic-x86_64-linux
mv pocket-ic-x86_64-linux pocket-ic
export POCKET_IC_BIN="$(pwd)/pocket-ic"


curl https://rustwasm.github.io/wasm-pack/installer/init.sh -sSf | sh

git clone https://github.com/sstephenson/bats.git
cd bats
sudo ./install.sh /usr/local

cd /src/helloproj01
exec bash