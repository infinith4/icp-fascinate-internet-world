
createAndInstallCanister
で作成されたIDを保存しておく。
→済


ログイン後に真っ白になった。



call method


greet 以外が呼べない

dfx canister call streamingservice_manager get_canister_id_list '()'

dfx canister call streamingservice_manager create_and_install_canister '()'


dfx canister deposit-cycles 10000000000000 ulvla-h7777-77774-qaacq-cai

dfx canister call streamingservice_manager call_canister_method '("vg3po-ix777-77774-qaafa-cai", "greet", "test")'

dfx canister call streamingservice_manager call_canister_method '("vg3po-ix777-77774-qaafa-cai", "greet_streaming_no_arg", "()")'

dfx canister call streamingservice_manager call_canister_method '("vu5yx-eh777-77774-qaaga-cai", "greet_streaming_no_arg", "()")'

dfx canister call streamingservice_manager call_canister_method '("vu5yx-eh777-77774-qaaga-cai", "greet_streaming_no_arg_result", "()")'

dfx canister call streamingservice_manager call_canister_method_customresult '("vu5yx-eh777-77774-qaaga-cai", "greet_streaming_no_arg_result", "()")'

