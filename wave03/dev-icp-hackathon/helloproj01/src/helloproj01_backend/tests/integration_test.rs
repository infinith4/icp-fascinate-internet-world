use candid::{decode_one, encode_one, Principal};
use pocket_ic::{PocketIc, WasmResult};
use std::fs;

const BACKEND_WASM: &str = "../../target/wasm32-unknown-unknown/release/helloproj01_backend.wasm";

fn setup() -> (PocketIc, Principal) {
    //std::env::set_var("POCKET_IC_BIN", "/src/pocket-ic-x86_64-linux"); // Path of the pocket-ic binary
    let pic = PocketIc::new();

    let backend_canister = pic.create_canister();
    pic.add_cycles(backend_canister, 2_000_000_000_000); // 2T Cycles
    let wasm = fs::read(BACKEND_WASM).expect("Wasm file not found, run 'dfx build'.");
    pic.install_canister(backend_canister, wasm, vec![], None);
    (pic, backend_canister)
}

#[test]
fn test_hello_world() {
    let (pic, backend_canister) = setup();

    let Ok(WasmResult::Reply(response)) = pic.query_call(
        backend_canister,
        Principal::anonymous(),
        "greet",
        encode_one("ICPZ").unwrap(),
    ) else {
        panic!("Expected reply");
    };
    let result: String = decode_one(&response).unwrap();
    assert_eq!(result, "Hello, ICP!");
}

// use candid::encode_one;
// use pocket_ic::PocketIc;

//  #[test]
//  fn test_counter_canister() {
//     let pic = PocketIc::new();
//     // Create an empty canister as the anonymous principal and add cycles.
//     let canister_id = pic.create_canister();
//     pic.add_cycles(canister_id, 2_000_000_000_000);
    
//     let wasm_bytes = load_counter_wasm(...);
//     pic.install_canister(canister_id, wasm_bytes, vec![], None);
//     // 'inc' is a counter canister method.
//     call_counter_canister(&pic, canister_id, "inc");
//     // Check if it had the desired effect.
//     let reply = call_counter_canister(&pic, canister_id, "read");
//     assert_eq!(reply, WasmResult::Reply(vec![0, 0, 0, 1]));
//  }

// fn call_counter_canister(pic: &PocketIc, canister_id: CanisterId, method: &str) -> WasmResult {
//     pic.update_call(canister_id, Principal::anonymous(), method, encode_one(()).unwrap())
//         .expect("Failed to call counter canister")
// }