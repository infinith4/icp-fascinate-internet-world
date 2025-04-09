use candid::{Nat, CandidType, Encode, Decode, Principal, encode_args};
use ic_cdk::api::management_canister::{
    main::{
        create_canister, install_code, deposit_cycles, start_canister, stop_canister, delete_canister, canister_status,
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
async fn CreateAndInstallCanister() -> Result<Principal, String> {
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

// #[update]
// async fn call_greet(canister_principal: String, greeting: String) -> Result<String, String> {
//     let canister_id = match Principal::from_text(canister_principal) {
//         Ok(principal) => principal,
//         Err(e) => return Err(format!("Invalid principal: {:?}", e)),
//     };
    
//     // greet関数の引数をエンコード
//     let args = match encode_args((greeting,)) {
//         Ok(args) => args,
//         Err(e) => return Err(format!("Failed to encode arguments: {:?}", e)),
//     };

//     // キャニスター間呼び出し
//     match ic_cdk::api::call::call(canister_id, "greet", args).await {
//         Ok((response,)) => Ok(response),
//         Err((code, msg)) => Err(format!("Failed to call greet: code {:?}, message: {}", code, msg)),
//     }
// }

#[derive(CandidType, Deserialize)]
pub struct CanisterStatusResult {
    pub controllers: Vec<Principal>,
}

#[update]
async fn DepositCycles(canister_principal: String) -> Result<(), String> {
    // 10^12 cycles を追加
    let available_cycles = ic_cdk::api::call::msg_cycles_available();
    ic_cdk::api::call::msg_cycles_accept(1_000_000_000_000_u64.min(available_cycles));
    
    let canister_id = match Principal::from_text(canister_principal) {
        Ok(principal) => principal,
        Err(e) => return Err(format!("Invalid principal: {:?}", e)),
    };

    match deposit_cycles(CanisterIdRecord { canister_id: canister_id }, 1_000_000_000_000_u128).await {
        Ok(_) => Ok(()),
        Err(e) => Err(format!("Failed to deposit cycles: {:?}", e)),
    }
}

#[update]
async fn StartCanister(canister_principal: String) -> Result<(), String> {
    let canister_id = match Principal::from_text(canister_principal) {
        Ok(principal) => principal,
        Err(e) => return Err(format!("Invalid principal: {:?}", e)),
    };

    match start_canister(
        CanisterIdRecord { canister_id }
    ).await {
        Ok(_) => Ok(()),
        Err(e) => Err(format!("Failed to start canister: {:?}", e)),
    }
}

#[update]
async fn StopCanister(canister_principal: String) -> Result<(), String> {
    let canister_id = match Principal::from_text(canister_principal) {
        Ok(principal) => principal,
        Err(e) => return Err(format!("Invalid principal: {:?}", e)),
    };

    match stop_canister(
        CanisterIdRecord { canister_id }
    ).await {
        Ok(_) => Ok(()),
        Err(e) => Err(format!("Failed to stop canister: {:?}", e)),
    }
}

#[update]
async fn DeleteCanister(canister_principal: String) -> Result<(), String> {
    let canister_id = match Principal::from_text(canister_principal) {
        Ok(principal) => principal,
        Err(e) => return Err(format!("Invalid principal: {:?}", e)),
    };

    match delete_canister(
        CanisterIdRecord { canister_id }
    ).await {
        Ok(_) => Ok(()),
        Err(e) => Err(format!("Failed to delete canister: {:?}", e)),
    }
}

#[update]
async fn CanisterStatus(canister_principal: String) -> Result<CanisterStatusResult, String> {
    let canister_id = match Principal::from_text(canister_principal) {
        Ok(principal) => principal,
        Err(e) => return Err(format!("Invalid principal: {:?}", e)),
    };

    match canister_status(
        CanisterIdRecord { canister_id }
    ).await {
        Ok((status,)) => Ok(CanisterStatusResult {
            controllers: status.settings.controllers,
        }),
        Err(e) => Err(format!("Failed to get canister status: {:?}", e)),
    }
}


#[query]
async fn CallGreet(canister_principal: String, greeting: String) -> Result<(String), String> {
    let canister_id = match Principal::from_text(canister_principal) {
        Ok(principal) => principal,
        Err(e) => return Err(format!("Invalid principal: {:?}", e)),
    };
    // // greet関数の引数をエンコード
    // let args = match encode_args((greeting,)) {
    //     Ok(args) => args,
    //     Err(e) => return Err(format!("Failed to encode arguments: {:?}", e)),
    // };
    // キャニスター間呼び出し
    match ic_cdk::call(canister_id, "greet", (greeting,)).await {
        Ok((response,)) => Ok((response)),
        Err((code, msg)) => Err(format!("Failed to call greet: code {:?}, message: {}", code, msg)),
    }
}