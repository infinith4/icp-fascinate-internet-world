use candid::{Nat, CandidType, Encode, Decode, Principal};
use ic_cdk::api::management_canister::{
    main::{
        create_canister, install_code, 
        CanisterInstallMode, CreateCanisterArgument, InstallCodeArgument, CanisterSettings, CanisterIdRecord, LogVisibility
    },
};

use ic_cdk_macros::*;
use serde::Deserialize;
use ic_cdk::{
    api::{call, time},
    id,
};

#[update]
async fn create_and_install_canister() -> Result<Principal, String> {
    // 🔹 Create Canister with optional settings
    let canister_setting = CanisterSettings {
        controllers: Some(vec![id()]),
        compute_allocation: Some(Nat::from(0_u64)),
        memory_allocation: Some(Nat::from(0_u64)),
        freezing_threshold: Some(Nat::from(0_u64)),
        reserved_cycles_limit: Some(Nat::from(0_u64)), // 追加
        log_visibility: Some(LogVisibility::Public), // 追加
        wasm_memory_limit: Some(Nat::from(4_u64 * 1024_u64 * 1024_u64)), // 例: 4MBのメモリ制限を設定
    };
    let create_args = CreateCanisterArgument {
        settings: Some(canister_setting),
    };

    let (create_result,) = match create_canister(create_args, 100_000_000_000).await {
        Ok(res) => res,
        Err(e) => return Err(format!("Failed to create canister: {:?}", e)),
    };

    let new_canister_id = create_result.canister_id;

    // 🔹 WASM バイナリを用意（ここでは空のWASMを使うが、実際には include_bytes! などでファイル読み込み）
    let wasm_module: Vec<u8> = include_bytes!("../../../target/wasm32-unknown-unknown/release/greet_backend.wasm").to_vec();

    // 🔹 初期化引数（ここでは空）
    let init_args = Encode!().unwrap();

    // 🔹 Install Code
    let install_args = InstallCodeArgument {
        mode: CanisterInstallMode::Install,
        canister_id: new_canister_id,
        wasm_module,
        arg: init_args,
    };

    if let Err(e) = install_code(install_args).await {
        return Err(format!("Failed to install code: {:?}", e));
    }

    Ok(new_canister_id)
}
