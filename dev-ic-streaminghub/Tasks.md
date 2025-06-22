

dfx start --clean --host 127.0.0.1:4949



sudo rm -R /src/streamingservice/target
sudo rm -R /src/streamingservice/src/declarations
sudo rm -R /src/streamingservice/src/streamingservice_frontend/node_modules
sudo rm -R /src/streamingservice/node_modules
sudo rm -R /src/streamingservice/.dfx


cd /src/streamingservice/src/streamingservice_backend
cargo build --release --target wasm32-unknown-unknown --package streamingservice_backend


cd /src/streamingservice/src/streamingservice_frontend
npm install --save-dev @types/react @types/react-dom @types/node

cd /src/streamingservice
dfx generate


cd /src/streamingservice

dfx build
dfx deploy

dfx canister deposit-cycles 10000000000000 ulvla-h7777-77774-qaacq-cai



- [x] createAndInstallCanister で作成されたIDを保存しておく。
- [x] ログイン後に真っ白になった。

- [ ] call method でgreet 以外が呼べない

dfx canister call streamingservice_manager create_and_install_canister '()'


dfx canister call streamingservice_manager get_canister_id_list '()'

dfx canister deposit-cycles 10000000000000 ulvla-h7777-77774-qaacq-cai

dfx canister call streamingservice_manager call_canister_method '("v56tl-sp777-77774-qaahq-cai", "greet", "test")'

dfx canister call streamingservice_manager call_canister_method '("v56tl-sp777-77774-qaahq-cai", "greet_streaming_no_arg", "()")'

dfx canister call streamingservice_manager call_canister_method '("v56tl-sp777-77774-qaahq-cai", "greet_streaming_no_arg", "()")'

dfx canister call streamingservice_manager call_canister_method '("v56tl-sp777-77774-qaahq-cai", "greet_streaming_no_arg_result", "()")'

dfx canister call streamingservice_manager call_canister_method_customresult '("xad5d-bh777-77774-qaaia-cai", "greet_streaming_no_arg_result", "()")'

