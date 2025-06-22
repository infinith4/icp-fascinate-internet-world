
createAndInstallCanister
で作成されたIDを保存しておく。
→済


ログイン後に真っ白になった。



call method


greet 以外が呼べない

dfx canister call streamingservice_manager create_and_install_canister '()'


dfx canister call streamingservice_manager get_canister_id_list '()'

dfx canister deposit-cycles 10000000000000 ulvla-h7777-77774-qaacq-cai

dfx canister call streamingservice_manager call_canister_method '("v56tl-sp777-77774-qaahq-cai", "greet", "test")'

dfx canister call streamingservice_manager call_canister_method '("v56tl-sp777-77774-qaahq-cai", "greet_streaming_no_arg", "()")'

dfx canister call streamingservice_manager call_canister_method '("v56tl-sp777-77774-qaahq-cai", "greet_streaming_no_arg", "()")'

dfx canister call streamingservice_manager call_canister_method '("v56tl-sp777-77774-qaahq-cai", "greet_streaming_no_arg_result", "()")'

dfx canister call streamingservice_manager call_canister_method_customresult '("xad5d-bh777-77774-qaaia-cai", "greet_streaming_no_arg_result", "()")'

