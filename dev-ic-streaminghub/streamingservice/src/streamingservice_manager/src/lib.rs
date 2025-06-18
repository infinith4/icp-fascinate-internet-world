use candid::{encode_args, types::principal, CandidType, Decode, Encode, Nat, Principal};
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
use std::cell::RefCell;
use std::collections::HashMap;

#[derive(CandidType, Deserialize)]
struct CanisterInfo {
    id: String,
    principal_id: String,
}

#[derive(CandidType, Deserialize)]
pub struct CanisterStatusResult {
    pub controllers: Vec<Principal>,
}

#[derive(CandidType, Deserialize)]
enum CreateAndInstallCanisterResult {
    #[serde(rename = "ok")]
    Ok(String),
    #[serde(rename = "err")]
    Err(String),
}

thread_local! {
    static GENERATED_CANISTERS: RefCell<HashMap<String, CanisterInfo>> = RefCell::new(HashMap::new());
}

#[query]
fn get_canister_id_list() -> Vec<(String, String)> {
    GENERATED_CANISTERS.with(|canister_info_list| {
        let canister_info_list = canister_info_list.borrow();
        canister_info_list.iter()
            .map(|(id, canister_info)| (
                id.clone(),
                canister_info.principal_id.clone()
            ))
            .collect()
    })
}

#[update]
async fn create_and_install_canister() -> Result<String, String> {
    // 🔹 Create Canister with optional settings
    let canister_setting = CanisterSettings {
        controllers: Some(vec![id()]),
        compute_allocation: Some(Nat::from(0_u64)),
        memory_allocation: Some(Nat::from(0_u64)),
        freezing_threshold: Some(Nat::from(0_u64)),
        reserved_cycles_limit: Some(Nat::from(0_u64)),
        log_visibility: Some(LogVisibility::Public),
        wasm_memory_limit: Some(Nat::from(4_u64 * 1024_u64 * 1024_u64)), // 4MB memory limit
    };
    let create_args = CreateCanisterArgument {
        settings: Some(canister_setting),
    };

    let (create_result,) = match create_canister(create_args, 5_093_757_542_230).await {
        Ok(res) => res,
        Err(e) => return Err(format!("Failed to create canister: {:?}", e)),
    };

    let new_canister_id = create_result.canister_id;

    // // 🔹 WASM binary (using an empty WASM for now)
    // // In a real implementation, you would include the actual WASM binary
    // let wasm_module: Vec<u8> = vec![
    //     0x00, 0x61, 0x73, 0x6D, 0x01, 0x00, 0x00, 0x00, 
    //     0x01, 0x04, 0x01, 0x60, 0x00, 0x00, 0x03, 0x02, 
    //     0x01, 0x00, 0x07, 0x08, 0x01, 0x04, 0x63, 0x61, 
    //     0x6E, 0x64, 0x00, 0x00, 0x0A, 0x04, 0x01, 0x02, 
    //     0x00, 0x0B
    // ];

    // 🔹 WASM バイナリを用意（ここでは空のWASMを使うが、実際には include_bytes! などでファイル読み込み）
    let wasm_module: Vec<u8> = include_bytes!("../../../target/wasm32-unknown-unknown/release/streamingservice_backend.wasm").to_vec();

    // 🔹 Initialize arguments (empty for now)
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

    ic_cdk::println!("-------------------------createAndInstallCanister: {}", new_canister_id);
    let canister_info_id = ic_cdk::api::time().to_string();
    let canister_info = CanisterInfo {
        id: canister_info_id.clone(),
        principal_id: new_canister_id.to_string(),
    };
    GENERATED_CANISTERS.with(|canister_info_list| {
        canister_info_list.borrow_mut().insert(canister_info_id.clone(), canister_info);
    });
    Ok(new_canister_id.to_string())
}

// #[update]
// async fn createStreamingCanister(title: String, description: String) -> Result<Principal, String> {
//     // 🔹 Create Canister with optional settings
//     let canister_setting = CanisterSettings {
//         controllers: Some(vec![id()]),
//         compute_allocation: Some(Nat::from(0_u64)),
//         memory_allocation: Some(Nat::from(0_u64)),
//         freezing_threshold: Some(Nat::from(0_u64)),
//         reserved_cycles_limit: Some(Nat::from(0_u64)),
//         log_visibility: Some(LogVisibility::Public),
//         wasm_memory_limit: Some(Nat::from(4_u64 * 1024_u64 * 1024_u64)), // 4MB memory limit
//     };
//     let create_args = CreateCanisterArgument {
//         settings: Some(canister_setting),
//     };

//     let (create_result,) = match create_canister(create_args, 900_000_000_000).await {
//         Ok(res) => res,
//         Err(e) => return Err(format!("Failed to create canister: {:?}", e)),
//     };

//     let new_canister_id = create_result.canister_id;

//     // // In a real implementation, you would include the actual streamingservice_backend WASM binary
//     // // For now, we're using a placeholder
//     // let wasm_module: Vec<u8> = vec![
//     //     0x00, 0x61, 0x73, 0x6D, 0x01, 0x00, 0x00, 0x00, 
//     //     0x01, 0x04, 0x01, 0x60, 0x00, 0x00, 0x03, 0x02, 
//     //     0x01, 0x00, 0x07, 0x08, 0x01, 0x04, 0x63, 0x61, 
//     //     0x6E, 0x64, 0x00, 0x00, 0x0A, 0x04, 0x01, 0x02, 
//     //     0x00, 0x0B
//     // ];

//     // 🔹 WASM バイナリを用意（ここでは空のWASMを使うが、実際には include_bytes! などでファイル読み込み）
//     let wasm_module: Vec<u8> = include_bytes!("../../../target/wasm32-unknown-unknown/release/greet_backend.wasm").to_vec();

//     // Initialize with title and description
//     let init_args = match Encode!(&title, &description) {
//         Ok(args) => args,
//         Err(e) => return Err(format!("Failed to encode arguments: {:?}", e)),
//     };

//     // 🔹 Install Code
//     let install_args = InstallCodeArgument {
//         mode: CanisterInstallMode::Install,
//         canister_id: new_canister_id,
//         wasm_module,
//         arg: init_args,
//     };

//     if let Err(e) = install_code(install_args).await {
//         return Err(format!("Failed to install code: {:?}", e));
//     }

//     Ok(new_canister_id)
// }

#[update]
async fn deposit(canister_principal: String) -> Result<(), String> {
    // Add 10^12 cycles
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
async fn begin_canister(canister_principal: String) -> Result<(), String> {
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
async fn end_canister(canister_principal: String) -> Result<(), String> {
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
async fn remove_canister(canister_principal: String) -> Result<(), String> {
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
async fn canister_condition(canister_principal: String) -> Result<CanisterStatusResult, String> {
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


#[update]
async fn call_canister_method(canister_principal: String, method_name: String, args: String) -> Result<String, String> {
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
    match ic_cdk::call(canister_id, &method_name, (args,)).await {
        Ok((response,)) => Ok(response),
        Err((code, msg)) => Err(format!("Failed to call Greet: code {:?}, message: {}", code, msg)),
    }
}