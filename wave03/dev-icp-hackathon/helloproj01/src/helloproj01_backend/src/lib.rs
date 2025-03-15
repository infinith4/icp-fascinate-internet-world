pub mod helloproj01_backend_lib {
    ic_cdk::export_candid!();
    use candid::{CandidType, Principal};
    use serde::Deserialize;
    use std::collections::HashMap;
    use std::cell::RefCell;
    
    #[derive(Clone, Debug, CandidType, Deserialize)]
    pub struct PasswordEntry {
        pub service_name: String,
        pub username: String,
        pub encrypted: String,
        pub iv: String,
        pub salt: String,
        pub notes: Option<String>,
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
    
    #[ic_cdk::update]
    pub async fn vetkd_public_key(request: VetKDPublicKeyRequest) -> VetKDPublicKeyReply {
        ensure_bls12_381_g2_test_key_1(request.key_id);
        ensure_derivation_path_is_valid(&request.derivation_path);
        let derivation_path = {
            let canister_id = request.canister_id.unwrap_or_else(ic_cdk::caller);
            DerivationPath::new(canister_id.as_slice(), &request.derivation_path)
        };
        let derived_public_key = DerivedPublicKey::compute_derived_key(&MASTER_PK, &derivation_path);
        VetKDPublicKeyReply {
            public_key: derived_public_key.serialize().to_vec(),
        }
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
    
}
