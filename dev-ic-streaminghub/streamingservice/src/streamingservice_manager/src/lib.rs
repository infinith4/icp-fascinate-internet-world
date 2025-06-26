use candid::{encode_args, decode_args, types::principal, CandidType, Decode, Encode, Nat, Principal};
use std::str::FromStr;
use candid::ser::IDLBuilder; // Import IDLBuilder

use ic_cdk::api::management_canister::{
    main::{
        create_canister, install_code, deposit_cycles, start_canister, stop_canister, delete_canister, canister_status,
        CanisterInstallMode, CreateCanisterArgument, InstallCodeArgument, CanisterSettings, CanisterIdRecord, LogVisibility
    },
};

use ic_cdk_macros::*;
use serde::Deserialize;
use ic_cdk::{
    api::{call, time, call::call_raw},
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

// 1. Define Rust types that mirror your Candid DID
//    For the variant type
#[derive(CandidType, Deserialize, Debug)]
pub enum MyResult {
    Ok(String),
    Err(String),
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
async fn begin_canister(canister_principal_id: String) -> Result<(), String> {
    let canister_id = match Principal::from_text(canister_principal_id) {
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

#[derive(CandidType, Deserialize)]
enum GreetResult {
    //NOTE: #[serde(rename = "ok")] をつけないと Cannot find field hash _17724_ になる
    //Cannot find field hash となるときはClassをResponse に設定したほうが良い
    #[serde(rename = "ok")]
    Ok(String),
    #[serde(rename = "err")]
    Err(String),
}

#[derive(CandidType, Deserialize)]
enum SegmentChunkResult {
    //NOTE: #[serde(rename = "ok")] をつけないと Cannot find field hash _17724_ になる
    //Cannot find field hash となるときはClassをResponse に設定したほうが良い
    #[serde(rename = "ok")]
    Ok(String),
    #[serde(rename = "err")]
    Err(String),
}
//TODO: 引数がないときにエラーになる
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
    match ic_cdk::call(canister_id, &method_name, (args, )).await {
        Ok((response,)) => Ok(response),
        Err((code, msg)) => Err(format!("Failed to call method_name {} code {:?}, message: {}", method_name, code, msg)),
    }
}

#[update]
async fn call_canister_method_vec(
    canister_principal: String,
    method_name: String,
    args: Vec<String>,
) -> Result<String, String> {
    let canister_id = match Principal::from_text(canister_principal) {
        Ok(principal) => principal,
        Err(e) => return Err(format!("Invalid principal: {:?}", e)),
    };

    // Vec<String>をタプルに変換してCandidエンコード
    let encoded_args = match match args.len() {
        0 => encode_args(()),
        1 => encode_args((&args[0],)),
        2 => encode_args((&args[0], &args[1])),
        3 => encode_args((&args[0], &args[1], &args[2])),
        4 => encode_args((&args[0], &args[1], &args[2], &args[3])),
        _ => return Err("Too many arguments (max 4 supported)".to_string()),
    } {
        Ok(bytes) => bytes,
        Err(e) => return Err(format!("Failed to encode arguments: {:?}", e)),
    };

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
}

#[update]
async fn call_canister_method_customresult(canister_principal: String, method_name: String, args: String) -> Result<String, String> {
    let canister_id = match Principal::from_text(canister_principal) {
        Ok(principal) => principal,
        Err(e) => return Err(format!("Invalid principal: {:?}", e)),
    };
    // Encode the arguments as Candid bytes
    let encoded_args = match encode_args((args,)) {
        Ok(bytes) => bytes,
        Err(e) => return Err(format!("Failed to encode arguments: {:?}", e)),
    };
    // Perform the raw call with cycles payment set to 0
    match ic_cdk::api::call::call_raw(canister_id, &method_name, encoded_args, 0).await {
        Ok(response_bytes) => {
            // Decode the response bytes into the desired type
            match decode_args::<(GreetResult,)>(&response_bytes) {
                Ok((result,)) => match result {
                    GreetResult::Ok(message) => Ok(message),
                    GreetResult::Err(error) => Err(error),
                },
                Err(e) => Err(format!("Failed to decode response: {:?}", e)),
            }
        }
        Err((code, msg)) => Err(format!("Failed to call method {} code {:?}, message: {}", method_name, code, msg)),
    }
}

// --- どこか上部で定義 ---
enum EitherSegmentIndex {
    U32(u32),
    U64(u64),
    Str(String),
}

#[update]
async fn call_canister_method_vecargs_customresult(
    canister_principal: String,
    method_name: String,
    args: Vec<String>,
) -> Result<String, String> {
    let canister_id = match Principal::from_text(canister_principal) {
        Ok(principal) => principal,
        Err(e) => return Err(format!("Invalid principal: {:?}", e)),
    };

    // get_segment_chunk(video_id: String, segment_index: u32/u64/String, chunk_index: u32)
    if args.len() != 3 {
        return Err("get_segment_chunk expects exactly 3 arguments: (video_id: String, segment_index: u32/u64/String, chunk_index: u32)".to_string());
    }

    let video_id = args[0].clone();
    let chunk_index = args[2].parse::<u32>().map_err(|e| format!("Failed to parse chunk_index: {:?}", e))?;

    // segment_index: try u32, then u64, then String
    let encoded_args = if let Ok(val) = args[1].parse::<u32>() {
        encode_args((&video_id, val, chunk_index))
    } else if let Ok(val) = args[1].parse::<u64>() {
        encode_args((&video_id, val, chunk_index))
    } else {
        encode_args((&video_id, args[1].clone(), chunk_index))
    };
    
    let encoded_args = match encoded_args {
        Ok(bytes) => bytes,
        Err(e) => return Err(format!("Failed to encode arguments: {:?}", e)),
    };

    // Perform the raw call with cycles payment set to 0
    match ic_cdk::api::call::call_raw(canister_id, &method_name, encoded_args, 0).await {
        Ok(response_bytes) => {
            // SegmentChunkResult型でデコード
            match decode_args::<(SegmentChunkResult,)>(&response_bytes) {
                Ok((result,)) => match result {
                    SegmentChunkResult::Ok(resp) => Ok(resp),
                    SegmentChunkResult::Err(error) => Err(error),
                },
                Err(e) => Err(format!("Failed to decode response: {:?}", e)),
            }
        }
        Err((code, msg)) => Err(format!("Failed to call method {} code {:?}, message: {}", method_name, code, msg)),
    }
}

#[update]
async fn call_canister_method_get_segment_chunk_vecargs_customresult(
    canister_principal: String,
    method_name: String,
    args: Vec<String>,
) -> Result<String, String> {
    let canister_id = match Principal::from_text(canister_principal) {
        Ok(principal) => principal,
        Err(e) => return Err(format!("Invalid principal: {:?}", e)),
    };

    // get_segment_chunk(video_id: String, segment_index: u32, chunk_index: u32)
    // のような関数に対応するため、引数を型推論してタプルに変換
    if args.len() != 3 {
        return Err("get_segment_chunk expects exactly 3 arguments: (video_id: String, segment_index: u32, chunk_index: u32)".to_string());
    }

    let video_id = args[0].clone();
    let segment_index = args[1].parse::<u32>().map_err(|e| format!("Failed to parse segment_index: {:?}", e))?;
    let chunk_index = args[2].parse::<u32>().map_err(|e| format!("Failed to parse chunk_index: {:?}", e))?;

    let encoded_args = match encode_args((&video_id, segment_index, chunk_index)) {
        Ok(bytes) => bytes,
        Err(e) => return Err(format!("Failed to encode arguments: {:?}", e)),
    };

    // Perform the raw call with cycles payment set to 0
    match ic_cdk::api::call::call_raw(canister_id, &method_name, encoded_args, 0).await {
        Ok(response_bytes) => {
            // SegmentChunkResult型でデコード
            match decode_args::<(SegmentChunkResult,)>(&response_bytes) {
                Ok((result,)) => match result {
                    SegmentChunkResult::Ok(resp) => Ok(format!("chunk_data: {} bytes, total_chunk_count: {}", resp.len(), resp)),
                    SegmentChunkResult::Err(error) => Err(error),
                },
                Err(e) => Err(format!("Failed to decode response: {:?}", e)),
            }
        }
        Err((code, msg)) => Err(format!("Failed to call method {} code {:?}, message: {}", method_name, code, msg)),
    }
}

#[update]
async fn call_canister_method_vecresult(canister_principal: String, method_name: String, args: String) -> Result<String, String> {
    let canister_id = match Principal::from_text(canister_principal) {
        Ok(principal) => principal,
        Err(e) => return Err(format!("Invalid principal: {:?}", e)),
    };
    // Encode the arguments as Candid bytes
    let encoded_args = match encode_args((args,)) {
        Ok(bytes) => bytes,
        Err(e) => return Err(format!("Failed to encode arguments: {:?}", e)),
    };
    // Perform the raw call with cycles payment set to 0
    match ic_cdk::api::call::call_raw(canister_id, &method_name, encoded_args, 0).await {
        Ok(response) => {
            // デコード
            match decode_args::<(Vec<(String, String, String, String)>,)>(&response) {
                Ok((list,)) => {
                    // list は Vec<(String, String, String, String)>
                    // ここで利用できる
                    // 例: Ok(format!("{:?}", list))
                    Ok(format!("{:?}", list))
                }
                Err(e) => Err(format!("decode error: {:?}", e)),
            }
        }
        Err((code, msg)) => Err(format!("Failed to call method {} code {:?}, message: {}", method_name, code, msg)),
    }
}

// //TODO: 引数がないときにエラーになる
// #[update]
// async fn call_canister_method_customresult(canister_principal: String, method_name: String, args: String) -> Result<MyResult, String> {
//     let canister_id = match Principal::from_text(canister_principal) {
//         Ok(principal) => principal,
//         Err(e) => return Err(format!("Invalid principal: {:?}", e)),
//     };
//     // // greet関数の引数をエンコード
//     // let args = match encode_args((greeting,)) {
//     //     Ok(args) => args,
//     //     Err(e) => return Err(format!("Failed to encode arguments: {:?}", e)),
//     // };
//     // キャニスター間呼び出し
//     match ic_cdk::call(canister_id, &method_name, (args,)).await {
//         Ok(response_bytes) => {
//             // レスポンスをデコード
//             match decode_args::<(MyResult,)>(response_bytes) {
//                 Ok((response,)) => Ok(response),
//                 Err(e) => Err(format!("Failed to decode response: {:?}", e)),
//             }
//         }
//         // Ok((response,)) => Ok(response),
//         // Err((code, msg)) => Err(format!("Failed to call method_name {} code {:?}, message: {}", method_name, code, msg)),
//     }
// }

// #[update]
// async fn call_canister_method<Input, Output>(
//     canister_principal: String,
//     method_name: String,
//     args: Input,
// ) -> Result<Output, String>
// where
//     Input: CandidType + Send + 'static,
//     Output: CandidType + Deserialize<'static> + Send + 'static,
// {
//     let canister_id = match Principal::from_text(canister_principal) {
//         Ok(principal) => principal,
//         Err(e) => return Err(format!("Invalid principal: {:?}", e)),
//     };

//     // Encode the input arguments
//     let encoded_args = match encode_args((args,)) {
//         Ok(encoded) => encoded,
//         Err(e) => return Err(format!("Failed to encode arguments: {:?}", e)),
//     };

//     // Perform the inter-canister call
//     match ic_call(canister_id, &method_name, encoded_args).await {
//         Ok(response_bytes) => {
//             // Decode the response bytes into the desired Output type
//             match decode_args(&response_bytes) {
//                 Ok((decoded_response,)) => Ok(decoded_response),
//                 Err(e) => Err(format!("Failed to decode response: {:?}", e)),
//             }
//         }
//         Err((code, msg)) => Err(format!(
//             "Failed to call method {} code {:?}, message: {}",
//             method_name, code, msg
//         )),
//     }
// }


// #[update]
// async fn call_canister_method(canister_principal: String, method_name: String, args: String) -> Result<String, String> {
//     let canister_id = match Principal::from_text(canister_principal) {
//         Ok(principal) => principal,
//         Err(e) => return Err(format!("Invalid principal: {:?}", e)),
//     };

//     // 1. Argument Encoding:
//     // This part is crucial. The `args: String` parameter from the frontend needs to be
//     // Candid-encoded into raw bytes that the target canister method expects.
//     // Assuming the target method expects a single `text` (string) argument,
//     // we should encode your `args` string as such.
//     // If your target method expects a different type or multiple arguments,
//     // you'll need to adjust the `encode_args` tuple accordingly.
//     // For example, if target expects `(nat, text)`, you'd need `encode_args((my_nat, &args))`
//     let encoded_args = match encode_args((args,)) { // Encodes the single string argument
//         Ok(bytes) => bytes,
//         Err(e) => return Err(format!("Failed to encode arguments for {}: {:?}", method_name, e)),
//     };

//     // 2. Canister Call
//     // Use `call_raw` for more control over response decoding, or confirm the exact return type.
//     // If the target method truly returns a `String`, `call` with `(String,)` is fine.
//     // The error suggests it's *not* returning a `String` (or not just a string).

//     match ic_cdk::call(canister_id, &method_name, (encoded_args,)).await {
//         Ok(raw_response_tuple) => {
//             // 3. Response Decoding:
//             // The error `failed to decode canister response as (alloc::string::String,)`
//             // implies that the response tuple from the called method is NOT a single String.
//             // Let's try to decode the raw response bytes into a String.
//             // We need to match the actual return type of the remote method.
//             // If `greet_streaming_result` returns `text`, then `decode_args::<(String,)>` is correct.
//             // If it returns other types, you need to change `(String,)` to match it, e.g., `(nat, String)`.

//             // Example: Try to decode as a single string. This is what your original code implies.
//             // The error suggests this is failing, likely because the *actual* response type
//             // from the remote method doesn't match `(String,)`.
//             match decode_args::<(String,)>(raw_response_tuple.0) { // Access the first element of the tuple of tuples
//                 Ok((decoded_string,)) => Ok(decoded_string),
//                 Err(e) => Err(format!("Failed to decode response from {}: {:?}", method_name, e)),
//             }
//         },
//         Err((code, msg)) => Err(format!("Failed to call method {} on canister {}: Code {:?}, Message: {}", method_name, canister_id, code, msg)),
//     }
// }

