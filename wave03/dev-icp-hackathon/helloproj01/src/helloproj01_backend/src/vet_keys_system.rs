use crate::types::{
  VetKDCurve, VetKDEncryptedKeyReply, VetKDEncryptedKeyRequest, VetKDKeyId, VetKDPublicKeyReply,
  VetKDPublicKeyRequest,
};

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

