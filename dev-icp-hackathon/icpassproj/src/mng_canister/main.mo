
//dfx deploy "mng_canister"
//cd /src/icpassproj/src


// 主な機能：

// Canisterの作成（createCanister）：新しいcanisterを作成し、設定を適用
// Canisterの削除（deleteCanister）：既存のcanisterを停止して削除
// ステータス確認（getCanisterStatus）：canisterの現在の状態、メモリ使用量、サイクル残量などを取得
// 設定更新（updateSettings）：既存のcanisterの設定を更新
// コードインストール（installCode）：canisterにWASMコードをインストール/更新
// セキュリティ機能：

// 各操作で呼び出し元の権限チェックを実装
// 匿名ユーザーからの操作を防止
// このコードを使用することで、プログラムからcanisterのライフサイクル管理を安全に行うことができます。

import Principal "mo:base/Principal";
import Error "mo:base/Error";
import Cycles "mo:base/ExperimentalCycles";
import Array "mo:base/Array";
import Buffer "mo:base/Buffer";

actor ManagementCanister {
    // ICマネジメントcanisterのプリンシパル
    private let IC_MANAGEMENT_CANISTER_ID : Principal = Principal.fromText("aaaaa-aa");
    
    // 許可されたコントローラーのリスト
    private stable var authorized_controllers : [Principal] = [];

    // コントローラーの追加
    public shared({ caller }) func addController(controller : Principal) : async () {
        assert(not Principal.isAnonymous(caller));
        assert(authorized_controllers.size() == 0 or Array.find<Principal>(authorized_controllers, func(p) { p == caller }) != null);
        authorized_controllers := Array.append<Principal>(authorized_controllers, [controller]);
    };

    // 呼び出し元が許可されているかチェック
    private func isAuthorized(caller : Principal) : Bool {
        if (authorized_controllers.size() == 0) {
            not Principal.isAnonymous(caller)
        } else {
            Array.find<Principal>(authorized_controllers, func(p) { p == caller }) != null
        }
    };

    // IC Management Canisterのインターフェース定義
    type canister_id = Principal;
    type canister_settings = {
        freezing_threshold : ?Nat;
        controllers : ?[Principal];
        memory_allocation : ?Nat;
        compute_allocation : ?Nat;
    };
    type wasm_module = Blob;

    type ManagementCanisterInterface = actor {
        create_canister : shared { settings : ?canister_settings } -> async { canister_id : canister_id };
        update_settings : shared { 
            canister_id : canister_id;
            settings : canister_settings;
        } -> async ();
        install_code : shared {
            mode : { #install; #reinstall; #upgrade };
            canister_id : canister_id;
            wasm_module : wasm_module;
            arg : Blob;
        } -> async ();
        uninstall_code : shared { canister_id : canister_id } -> async ();
        start_canister : shared { canister_id : canister_id } -> async ();
        stop_canister : shared { canister_id : canister_id } -> async ();
        delete_canister : shared { canister_id : canister_id } -> async ();
        canister_status : shared { canister_id : canister_id } -> async {
            status : { #running; #stopping; #stopped };
            memory_size : Nat;
            cycles : Nat;
            settings : canister_settings;
            module_hash : ?Blob;
        };
    };

    // Canister作成
    public shared({ caller }) func createCanister(settings : ?canister_settings) : async Principal {
        // 呼び出し元の権限チェック
        assert(isAuthorized(caller));

        // Cyclesの添付
        Cycles.add(20_000_000_000_000); // 20T cycles

        let ic : ManagementCanisterInterface = actor(Principal.toText(IC_MANAGEMENT_CANISTER_ID));
        let result = await ic.create_canister({
            settings = settings;
        });

        result.canister_id
    };

    // Canister削除
    public shared({ caller }) func deleteCanister(canisterId : Principal) : async () {
        // 呼び出し元の権限チェック
        assert(isAuthorized(caller));

        let ic : ManagementCanisterInterface = actor(Principal.toText(IC_MANAGEMENT_CANISTER_ID));
        await ic.stop_canister({ canister_id = canisterId });
        await ic.delete_canister({ canister_id = canisterId });
    };

    // Canisterのステータス取得
    public shared({ caller }) func getCanisterStatus(canisterId : Principal) : async {
        status : { #running; #stopping; #stopped };
        memory_size : Nat;
        cycles : Nat;
        settings : canister_settings;
        module_hash : ?Blob;
    } {
        // 呼び出し元の権限チェック
        assert(isAuthorized(caller));

        let ic : ManagementCanisterInterface = actor(Principal.toText(IC_MANAGEMENT_CANISTER_ID));
        let result = await ic.canister_status({ canister_id = canisterId });
        result
    };

    // Canister設定の更新
    public shared({ caller }) func updateSettings(canisterId : Principal, settings : canister_settings) : async () {
        // 呼び出し元の権限チェック
        assert(isAuthorized(caller));

        let ic : ManagementCanisterInterface = actor(Principal.toText(IC_MANAGEMENT_CANISTER_ID));
        await ic.update_settings({
            canister_id = canisterId;
            settings = settings;
        });
    };

    // Canisterのインストール
    public shared({ caller }) func installCode(
        canisterId : Principal, 
        wasmModule : Blob,
        mode : { #install; #reinstall; #upgrade },
        arg : Blob
    ) : async () {
        // 呼び出し元の権限チェック
        assert(isAuthorized(caller));

        let ic : ManagementCanisterInterface = actor(Principal.toText(IC_MANAGEMENT_CANISTER_ID));
        await ic.install_code({
            arg = arg;
            wasm_module = wasmModule;
            mode = mode;
            canister_id = canisterId;
        });
    };
}