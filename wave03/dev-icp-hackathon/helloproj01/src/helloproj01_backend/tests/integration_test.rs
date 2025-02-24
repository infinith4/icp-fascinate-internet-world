#[path = "../src/lib.rs"]
mod lib;

use candid::{decode_one, encode_one, Principal};
use pocket_ic::{PocketIc, WasmResult};
use std::fs;
use lib::helloproj01_backend_lib::PasswordEntry;

const BACKEND_WASM: &str = "../../target/wasm32-unknown-unknown/release/helloproj01_backend.wasm";

fn setup() -> (PocketIc, Principal) {
    std::env::set_var("POCKET_IC_BIN", "/src/pocket-ic"); // Path of the pocket-ic binary
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

fn create_password_entry() -> PasswordEntry {
    PasswordEntry {
        service_name: "TestService".to_string(),
        username: "test_user".to_string(),
        password: "test_password".to_string(),
        encrypted: "encrypted_data".to_string(),
        iv: "test_iv".to_string(),
        salt: "test_salt".to_string(),
        notes: Some("Test notes".to_string()),
    }
}

//cargo test --package helloproj01_backend --test integration_test -- test_add_password --exact --show-output
#[test]
fn test_add_password() {
    let (pic, backend_canister) = setup();
    let entry = create_password_entry();
    let Ok(WasmResult::Reply(response)) = pic.update_call(
        backend_canister,
        Principal::anonymous(),
        "add_password",
        encode_one(PasswordEntry {
            service_name: "Google".to_string(),
            username: "myemail@example.com".to_string(),
            password: "mypassword123".to_string(),
            salt: "aaaa".to_string(),
            encrypted: "aaaa".to_string(),
            iv: "aaaa".to_string(),
            notes: Some("My Google account".to_string()),
        }).unwrap(),
    ) else {
        panic!("Expected reply");
    };

    let result_add_password: bool = decode_one(&response).unwrap();
    assert!(result_add_password);

    let Ok(WasmResult::Reply(response)) = pic.query_call(
        backend_canister,
        Principal::anonymous(),
        "get_passwords",
        encode_one(()).unwrap(),
    ) else {
        panic!("Expected reply"); 
    };
    println!("-------------------------response");
    let result_get_passwords: Vec<PasswordEntry> = decode_one(&response).unwrap();
    assert_eq!(!result_get_passwords.is_empty(), true);
    assert_eq!(result_get_passwords.len(), 1);
    assert_eq!(result_get_passwords[0].service_name, "Google");
    

    
    // let result: bool = scenario.call(canister, "add_password", ).unwrap();
    // assert!(result, "Failed to add password");

    // let passwords: Vec<PasswordEntry> = scenario.call(canister, "get_passwords", ()).unwrap();
    // assert_eq!(passwords.len(), 1);
    // assert_eq!(passwords[0].service_name, entry.service_name);
}

//cargo test --package helloproj01_backend --test integration_test -- test_get_passwords --exact --show-output
#[test]
fn test_get_passwords() {
    let (pic, backend_canister) = setup();
    //let entry = create_password_entry();
    let Ok(WasmResult::Reply(response)) = pic.query_call(
        backend_canister,
        Principal::anonymous(),
        "get_passwords",
        // encode_one(PasswordEntry {
        //     service_name: "TestService".to_string(),
        //     username: "test_user".to_string(),
        //     password: "test_password".to_string(),
        //     encrypted: "encrypted_data".to_string(),
        //     iv: "test_iv".to_string(),
        //     salt: "test_salt".to_string(),
        //     notes: Some("Test notes".to_string()),
        // }).unwrap(),
        encode_one(()).unwrap(),
    ) else {
        panic!("Expected reply"); 
    };
    println!("-------------------------response");
    let result: Vec<PasswordEntry> = decode_one(&response).unwrap();
    assert_eq!(result.is_empty(), true);
    //assert_eq!(result[0].service_name, "TestService");
        
    //assert_eq!(result.encrypted, entry.encrypted);

    
    // let result: bool = scenario.call(canister, "add_password", ).unwrap();
    // assert!(result, "Failed to add password");

    // let passwords: Vec<PasswordEntry> = scenario.call(canister, "get_passwords", ()).unwrap();
    // assert_eq!(passwords.len(), 1);
    // assert_eq!(passwords[0].service_name, entry.service_name);
}

    // #[test]
    // fn test_update_password() {
    //     let mut scenario = Scenario::new();
    //     let canister = scenario.create_canister_from_wasm("helloproj01_backend.wasm");

    //     let entry = create_password_entry();
    //     scenario.call::<bool>(canister, "add_password", (entry.clone(),)).unwrap();

    //     let updated_entry = PasswordEntry {
    //         service_name: "UpdatedService".to_string(),
    //         ..entry
    //     };

    //     let result: bool = scenario.call(canister, "update_password", (0usize, updated_entry.clone())).unwrap();
    //     assert!(result, "Failed to update password");

    //     let passwords: Vec<PasswordEntry> = scenario.call(canister, "get_passwords", ()).unwrap();
    //     assert_eq!(passwords.len(), 1);
    //     assert_eq!(passwords[0].service_name, "UpdatedService");
    // }

//cargo test --package helloproj01_backend --test integration_test -- test_delete_password --exact --show-output

#[test]
fn test_delete_password() {
    let (pic, backend_canister) = setup();
    let Ok(WasmResult::Reply(response)) = pic.update_call(
        backend_canister,
        Principal::anonymous(),
        "add_password",
        encode_one(PasswordEntry {
            service_name: "Google".to_string(),
            username: "myemail@example.com".to_string(),
            password: "mypassword123".to_string(),
            salt: "aaaa".to_string(),
            encrypted: "aaaa".to_string(),
            iv: "aaaa".to_string(),
            notes: Some("My Google account".to_string()),
        }).unwrap(),
    ) else {
        panic!("Expected reply");
    };

    let result_add_password: bool = decode_one(&response).unwrap();
    assert!(result_add_password);
    
    //let entry = create_password_entry();
    // Delete password
    let Ok(WasmResult::Reply(response)) = pic.update_call(
        backend_canister,
        Principal::anonymous(),
        "delete_password",
        encode_one(0_u64).unwrap(),  // nat64 as 0
    ) else {
        panic!("Expected reply");
    };

    let result: bool = decode_one(&response).unwrap();
    assert!(result);
}

// }


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