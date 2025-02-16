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

#[ic_cdk::query]
fn greet(name: String) -> String {
    format!("Hello, {}!", name)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_add_and_get_password() {
        let entry = PasswordEntry {
            service_name: "TestService".to_string(),
            username: "testuser".to_string(),
            password: "testpass123".to_string(),
            notes: Some("Test note".to_string()),
        };

        // Add password
        assert!(add_password(entry.clone()));

        // Get passwords
        let passwords = get_passwords();
        assert!(!passwords.is_empty());
        assert_eq!(passwords[0].service_name, "TestService");
        assert_eq!(passwords[0].username, "testuser");
    }

    // #[test]
    // fn test_delete_password() {
    //     let entry = PasswordEntry {
    //         service_name: "DeleteTest".to_string(),
    //         username: "deleteuser".to_string(),
    //         password: "deletepass123".to_string(),
    //         notes: None,
    //     };

    //     // Add password
    //     add_password(entry);
    //     // Delete password
    //     assert!(delete_password(Nat::from(0)));

    //     // Verify deletion
    //     let passwords = get_passwords();
    //     assert!(passwords.is_empty());
    // }
}
