#[path = "../src/lib.rs"]
mod lib;

use candid::{decode_one, encode_args, encode_one, Principal};
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

fn create_password_entry(param: Option<String>) -> PasswordEntry {
    let prefix = param.unwrap_or_default();
    return PasswordEntry {
        service_name: format!("{}TestService", prefix).to_string(),
        username: format!("{}test_user", prefix).to_string(),
        password: format!("{}test_password", prefix).to_string(),
        encrypted: format!("{}test_encrypted", prefix).to_string(),
        iv: format!("{}test_iv", prefix).to_string(),
        salt: format!("{}test_salt", prefix).to_string(),
        notes: Some(format!("{}Test notes", prefix).to_string()),
    }
}


//cargo test --package helloproj01_backend --test integration_test -- test_hello_world --exact --show-output
#[test]
fn test_hello_world() {
    let (pic, backend_canister) = setup();

    let Ok(WasmResult::Reply(response)) = pic.query_call(
        backend_canister,
        Principal::anonymous(),
        "greet",
        encode_one("ICP").unwrap(),
    ) else {
        panic!("Expected reply");
    };

    println!("response assertion");
    let result: String = decode_one(&response).unwrap();
    assert_eq!(result, "Hello, ICP!");
}

//cargo test --package helloproj01_backend --test integration_test -- test_add_password --exact --show-output
#[test]
fn test_add_password() {
    let (pic, backend_canister) = setup();
    let entry = create_password_entry(None);
    let Ok(WasmResult::Reply(response)) = pic.update_call(
        backend_canister,
        Principal::anonymous(),
        "add_password",
        encode_one(entry).unwrap(),
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
    println!("response assertion");
    let result_get_passwords: Vec<PasswordEntry> = decode_one(&response).unwrap();
    assert_eq!(!result_get_passwords.is_empty(), true);
    assert_eq!(result_get_passwords.len(), 1);
    assert_eq!(result_get_passwords[0].service_name, "TestService");
    assert_eq!(result_get_passwords[0].username, "test_user");
    assert_eq!(result_get_passwords[0].password, "test_password");
    assert_eq!(result_get_passwords[0].encrypted, "test_encrypted");
    assert_eq!(result_get_passwords[0].iv, "test_iv");
    assert_eq!(result_get_passwords[0].salt, "test_salt");
    assert_eq!(result_get_passwords[0].notes, Some("Test notes".to_string()));
}

//cargo test --package helloproj01_backend --test integration_test -- test_get_passwords --exact --show-output
#[test]
fn test_get_passwords_length0() {
    let (pic, backend_canister) = setup();
    //let entry = create_password_entry();
    let Ok(WasmResult::Reply(response)) = pic.query_call(
        backend_canister,
        Principal::anonymous(),
        "get_passwords",
        encode_one(()).unwrap(),
    ) else {
        panic!("Expected reply"); 
    };

    println!("response assertion");
    let result: Vec<PasswordEntry> = decode_one(&response).unwrap();
    assert_eq!(result.is_empty(), true);
}

//cargo test --package helloproj01_backend --test integration_test -- test_update_password --exact --show-output
#[test]
fn test_update_password() {
    let (pic, backend_canister) = setup();
    let entry = create_password_entry(None);
    let Ok(WasmResult::Reply(response)) = pic.update_call(
        backend_canister,
        Principal::anonymous(),
        "add_password",
        encode_one(entry).unwrap(),
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
    println!("response assertion");
    let result_get_passwords: Vec<PasswordEntry> = decode_one(&response).unwrap();
    assert_eq!(!result_get_passwords.is_empty(), true);
    assert_eq!(result_get_passwords.len(), 1);

    let update_entry = create_password_entry(Some("update".to_string()));
    let Ok(WasmResult::Reply(response)) = pic.update_call(
        backend_canister,
        Principal::anonymous(),
        "update_password",
        encode_args((0_u64, update_entry)).unwrap(),
    ) else {
        panic!("Expected reply");
    };
    
    let result_update_password: bool = decode_one(&response).unwrap();
    assert!(result_update_password);

    let Ok(WasmResult::Reply(response)) = pic.query_call(
        backend_canister,
        Principal::anonymous(),
        "get_passwords",
        encode_one(()).unwrap(),
    ) else {
        panic!("Expected reply"); 
    };
    println!("response assertion");
    let result_get_passwords_after_update: Vec<PasswordEntry> = decode_one(&response).unwrap();
    assert_eq!(!result_get_passwords_after_update.is_empty(), true);
    assert_eq!(result_get_passwords_after_update.len(), 1);
    assert_eq!(result_get_passwords_after_update[0].service_name, "updateTestService");

}

//cargo test --package helloproj01_backend --test integration_test -- test_delete_password --exact --show-output

#[test]
fn test_delete_password() {
    let (pic, backend_canister) = setup();
    let entry = create_password_entry(None);
    let Ok(WasmResult::Reply(response)) = pic.update_call(
        backend_canister,
        Principal::anonymous(),
        "add_password",
        encode_one(entry).unwrap(),
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

    println!("response assertion");
    let result: bool = decode_one(&response).unwrap();
    assert!(result);
}
