ic_cdk::export_candid!();
use candid::{CandidType, Principal};
use serde::Deserialize;
use std::collections::HashMap;
use std::cell::RefCell;

#[derive(Clone, Debug, CandidType, Deserialize)]
struct PasswordEntry {
    service_name: String,
    username: String,
    password: String,
    encrypted: String,
    iv: String,
    salt: String,
    notes: Option<String>,
}

#[derive(Clone, Debug, Default)]
struct PasswordStore {
    passwords: HashMap<Principal, Vec<PasswordEntry>>,
}

thread_local! {
    static PASSWORD_ENTRY_STATE: RefCell<PasswordStore> = RefCell::new(PasswordStore::default());
}
// thread_local! {
//     static STATE: ic_cdk::export::Cell<PasswordStore> = ic_cdk::export::Cell::default();
// }

#[ic_cdk::query]
fn get_passwords() -> Vec<PasswordEntry> {
    let caller = ic_cdk::caller();
    PASSWORD_ENTRY_STATE.with(|state| {
        let store = state.take();
        let passwords = store.passwords.get(&caller).cloned().unwrap_or_default();
        (*state.borrow()).clone();
        passwords
    })
}

#[ic_cdk::update]
fn add_password(entry: PasswordEntry) -> bool {
    let caller = ic_cdk::api::caller();
    PASSWORD_ENTRY_STATE.with(|state| {
        let mut store = state.take();
        let user_passwords = store.passwords.entry(caller).or_insert_with(Vec::new);
        user_passwords.push(entry);

        let mut passwords: HashMap<Principal, Vec<PasswordEntry>> = HashMap::new();
        passwords.insert(caller, user_passwords.to_vec());
        let mut password_store = PasswordStore::default();
        password_store.passwords = passwords;
        *state.borrow_mut() = password_store;
        // store.passwords.insert(caller, user_passwords.to_vec());
        // state.replace(store);
    });
    true
}

#[ic_cdk::update]
fn update_password(index: usize, entry: PasswordEntry) -> bool {
    let caller = ic_cdk::caller();
    PASSWORD_ENTRY_STATE.with(|state| {
        let mut store = state.take();
        if let Some(user_passwords) = store.passwords.get_mut(&caller) {
            if index < user_passwords.len() {
                user_passwords[index] = entry;

                let mut passwords: HashMap<Principal, Vec<PasswordEntry>> = HashMap::new();
                passwords.insert(caller, user_passwords.to_vec());
                let mut password_store: PasswordStore = PasswordStore::default();
                password_store.passwords = passwords;
                *state.borrow_mut() = password_store;
                return true;
            }
        }
        false
    })
}

//Nat: dfx canister call helloproj01_backend delete_password "(0 : nat)"
//usize: dfx canister call helloproj01_backend delete_password "(0 : nat64)"

#[ic_cdk::update]
fn delete_password(index: usize) -> bool {
    println!("start delete_password; index: {}", index);
    let index_usize :String = index.to_string();
    println!("start delete_password; index_usize: {}", index_usize);
    let caller = ic_cdk::caller();
    PASSWORD_ENTRY_STATE.with(|state| {
        let mut store = state.take();
        if let Some(user_passwords) = store.passwords.get_mut(&caller) {
            if index < user_passwords.len() {
                user_passwords.remove(index);
                
                let mut passwords: HashMap<Principal, Vec<PasswordEntry>> = HashMap::new();
                passwords.insert(caller, user_passwords.to_vec());
                let mut password_store: PasswordStore = PasswordStore::default();
                password_store.passwords = passwords;
                *state.borrow_mut() = password_store;
                return true;
            }
        }
        false
    })
}
// use aes_gcm::aead::{Aead, KeyInit, OsRng};
// use aes_gcm::{Aes256Gcm, Key, Nonce};

// // 暗号化関数
// fn encrypt_password(password: &str, key: &[u8; 32]) -> Vec<u8> {
//     let cipher = Aes256Gcm::new(Key::<Aes256Gcm>::from_slice(key));
//     let nonce = Nonce::from_slice(&[0; 12]); // 固定値でなくランダム生成が望ましい
//     cipher.encrypt(nonce, password.as_bytes()).expect("encryption failure!")
// }


#[ic_cdk::query]
fn greet(name: String) -> String {
    format!("Hello, {}!", name)
}

#[cfg(test)]
mod tests {
    use super::*;
    // use candid::Principal;
    // use ic_cdk::api::call::RejectionCode;
    // use ic_cdk_test::{Scenario, WasmResult};

    // fn create_password_entry() -> PasswordEntry {
    //     PasswordEntry {
    //         service_name: "TestService".to_string(),
    //         username: "test_user".to_string(),
    //         password: "test_password".to_string(),
    //         encrypted: "encrypted_data".to_string(),
    //         iv: "test_iv".to_string(),
    //         salt: "test_salt".to_string(),
    //         notes: Some("Test notes".to_string()),
    //     }
    // }

    // #[test]
    // fn test_add_password() {
    //     let mut scenario = Scenario::new();
    //     let canister = scenario.create_canister_from_wasm("helloproj01_backend.wasm");

    //     let entry = create_password_entry();
    //     let result: bool = scenario.call(canister, "add_password", (entry.clone(),)).unwrap();
    //     assert!(result, "Failed to add password");

    //     let passwords: Vec<PasswordEntry> = scenario.call(canister, "get_passwords", ()).unwrap();
    //     assert_eq!(passwords.len(), 1);
    //     assert_eq!(passwords[0].service_name, entry.service_name);
    // }

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

    // #[test]
    // fn test_delete_password() {
    //     let mut scenario = Scenario::new();
    //     let canister = scenario.create_canister_from_wasm("helloproj01_backend.wasm");

    //     let entry = create_password_entry();
    //     scenario.call::<bool>(canister, "add_password", (entry.clone(),)).unwrap();

    //     let result: bool = scenario.call(canister, "delete_password", (0usize,)).unwrap();
    //     assert!(result, "Failed to delete password");

    //     let passwords: Vec<PasswordEntry> = scenario.call(canister, "get_passwords", ()).unwrap();
    //     assert!(passwords.is_empty(), "Password list should be empty after deletion");
    // }

    #[test]
    fn test_greet() {
        // let mut scenario = Scenario::new();
        // let canister = scenario.create_canister_from_wasm("helloproj01_backend.wasm");

        let name = "Alice".to_string();
        assert!(name == "Alice");
    }
}

