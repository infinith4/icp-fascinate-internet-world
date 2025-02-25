
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

sudo apt-get update
sudo apt-get install expect -y


bash ./postCommandDfx.sh


dfx --version


bash ./postCommandRust.sh

. "$HOME/.cargo/env"

cargo --version


rustup target add wasm32-unknown-unknown


cd /src

curl -OL https://github.com/dfinity/pocketic/releases/download/7.0.0/pocket-ic-x86_64-linux.gz
gzip -d pocket-ic-x86_64-linux.gz
chmod +x pocket-ic-x86_64-linux
mv pocket-ic-x86_64-linux pocket-ic
export POCKET_IC_BIN="$(pwd)/pocket-ic"

git clone https://github.com/sstephenson/bats.git
cd bats
sudo ./install.sh /usr/local


exec bash