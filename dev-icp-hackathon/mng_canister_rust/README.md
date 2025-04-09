

https://internetcomputer.org/docs/building-apps/developer-tools/cdks/rust/generating-candid

Compile the Canister Wasm module.

cd /src/mng_canister_rust/src/greet_backend

cargo build --release --target wasm32-unknown-unknown --package greet_backend

/src/mng_canister_rust/target/wasm32-unknown-unknown/release/greet_backend.wasm

Step 3: Extract candid from the Wasm module and save it to a file:

candid-extractor target/wasm32-unknown-unknown/release/<CANISTER>.wasm > <CANISTER>.did


dfx build

dfx generate



dfx deploy 


Deployed canisters.
URLs:
  Backend canister via Candid interface:
    greet_backend: http://127.0.0.1:4943/?canisterId=b77ix-eeaaa-aaaaa-qaada-cai&id=br5f7-7uaaa-aaaaa-qaaca-cai
    mng_can_backend: http://127.0.0.1:4943/?canisterId=b77ix-eeaaa-aaaaa-qaada-cai&id=bw4dl-smaaa-aaaaa-qaacq-cai


› create_and_install_canister()
(variant {Ok=principal "by6od-j4aaa-aaaaa-qaadq-cai"})
› create_and_install_canister()
(variant {Ok=principal "avqkn-guaaa-aaaaa-qaaea-cai"})

http://localhost:4943/?canisterId=c2lt4-zmaaa-aaaaa-qaaiq-cai&id=c5kvi-uuaaa-aaaaa-qaaia-cai


以下のように mng_canister で作成したCanister を mng_canister からGreet をコールできた。

```
› CreateAndInstallCanister()
(variant {Ok=principal "cuj6u-c4aaa-aaaaa-qaajq-cai"})
› CanisterStatus("cuj6u-c4aaa-aaaaa-qaajq-cai")
(variant {Ok=record {controllers=vec {principal "c5kvi-uuaaa-aaaaa-qaaia-cai"}}})
› CallGreet("cuj6u-c4aaa-aaaaa-qaajq-cai", "test")
(variant {Ok="Hello, test!"})
```
