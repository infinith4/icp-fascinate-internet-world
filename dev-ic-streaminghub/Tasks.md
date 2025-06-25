

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


dfx canister call streamingservice_manager call_canister_method '("xobql-2x777-77774-qaaja-cai", "create_video", "('1','testtitle01','')")'

dfx canister call streamingservice_manager call_canister_method_vec '("ufxgi-4p777-77774-qaadq-cai", "greet_streaming_args", vec { "1"; "testtitle01"; "" })'


greet_streaming_args

{ "1"; "testtitle01"; "" }


call_raw は「生のCandidバイト列」を返します。
そのまま String::from_utf8_lossy(&response) で文字列化すると、Candidバイナリ（DIDLヘッダ付き）を無理やり文字列化するため、DIDL\0\u{1}q\ などの不可視文字が先頭に現れます。
本来は decode_args::<(String,)>(...) などでCandidデコードしてから使うべきです。

```
    // // call_rawで呼び出し
    // match ic_cdk::api::call::call_raw(canister_id, &method_name, encoded_args, 0).await {
    //     Ok(response) => Ok(String::from_utf8_lossy(&response).to_string()),
    //     Err((code, msg)) => Err(format!("Failed to call method_name {} code {:?}, message: {}", method_name, code, msg)),
    // }

    match ic_cdk::api::call::call_raw(canister_id, &method_name, encoded_args, 0).await {
    Ok(response) => {
        // CandidデコードしてDIDLヘッダを除去
        match decode_args::<(String,)>(&response) {
            Ok((decoded,)) => Ok(decoded),
            Err(e) => Err(format!("decode error: {:?}", e)),
        }
    }
    Err((code, msg)) => Err(format!("Failed to call method_name {} code {:?}, message: {}", method_name, code, msg)),
}
```