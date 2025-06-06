import Map "mo:base/HashMap";
import Text "mo:base/Text";
import Array "mo:base/Array";
import Buffer "mo:base/Buffer";
import List "mo:base/List";
import Iter "mo:base/Iter";
import Int "mo:base/Int";
import Nat "mo:base/Nat";
import Nat8 "mo:base/Nat8";
import Bool "mo:base/Bool";
import Principal "mo:base/Principal";
import Result "mo:base/Result";
import Option "mo:base/Option";
import Debug "mo:base/Debug";
import Order "mo:base/Order";
import Blob "mo:base/Blob";
import Hash "mo:base/Hash";
import Hex "./utils/Hex";

// Declare a shared actor class
// Bind the caller and the initializer
shared ({ caller = initializer }) actor class (vetkdSystemApiCanisterId: Principal) {

    // Currently, a single canister smart contract is limited to 4 GB of heap size.
    // For the current limits see https://internetcomputer.org/docs/current/developer-docs/production/resource-limits.
    // To ensure that our canister does not exceed the limit, we put various restrictions (e.g., max number of users) in place.
    // This should keep us well below a memory usage of 2 GB because
    // up to 2x memory may be needed for data serialization during canister upgrades.
    // This is sufficient for this proof-of-concept, but in a production environment the actual
    // memory usage must be calculated or monitored and the various restrictions adapted accordingly.

    // Define dapp limits - important for security assurance
    private let MAX_USERS = 500;
    private let MAX_SECRETS_PER_USER = 200;
    private let MAX_SECRET_CHARS = 1000;
    private let MAX_SHARES_PER_SECRET = 50;

    private type PrincipalName = Text;
    private type SecretId = Nat;

    // Define public types
    // Type of an encrypted secret
    // Attention: This canister does *not* perform any encryption.
    //            Here we assume that the secrets are encrypted end-
    //            to-end by the front-end (at client side).

    type Secret = {
        id: Nat;
        serviceName: Text;
        userName: Text;
        password: Text;
        created: Int;
        updated: Int;
        owner : PrincipalName;
        // users : [PrincipalName];
    };

    // Define private fields
    // Stable actor fields are automatically retained across canister upgrades.
    // See https://internetcomputer.org/docs/current/motoko/main/upgrades/

    // Design choice: Use globally unique secret identifiers for all users.
    //
    // The keyword `stable` makes this (scalar) variable keep its value across canister upgrades.
    //
    // See https://internetcomputer.org/docs/current/developer-docs/setup/manage-canisters#upgrade-a-canister
    private stable var nextSecretId : Nat = 1;

    // Store secrets by their ID, so that secret-specific encryption keys can be derived.
    private var secretsById = Map.HashMap<SecretId, Secret>(0, Nat.equal, Hash.hash);
    // Store which secret IDs are owned by a particular principal
    private var secretIdsByOwner = Map.HashMap<PrincipalName, List.List<SecretId>>(0, Text.equal, Text.hash);
    // Store which secrets are shared with a particular principal. Does not include the owner, as this is tracked by `SecretIdsByOwner`.
    private var secretIdsByUser = Map.HashMap<PrincipalName, List.List<SecretId>>(0, Text.equal, Text.hash);

    // While accessing _heap_ data is more efficient, we use the following _stable memory_
    // as a buffer to preserve data across canister upgrades.
    // Stable memory is currently 96GB. For the current limits see
    // https://internetcomputer.org/docs/current/developer-docs/production/resource-limits.
    // See also: [preupgrade], [postupgrade]
    private stable var stable_SecretsById : [(SecretId, Secret)] = [];
    private stable var stable_SecretIdsByOwner : [(PrincipalName, List.List<SecretId>)] = [];
    private stable var stable_SecretIdsByUser : [(PrincipalName, List.List<SecretId>)] = [];

    // Utility function that helps writing assertion-driven code more concisely.
    private func expect<T>(opt : ?T, violation_msg : Text) : T {
        switch (opt) {
            case (null) {
                Debug.trap(violation_msg);
            };
            case (?x) {
                x;
            };
        };
    };

    private func is_authorized(user : PrincipalName, secret : Secret) : Bool {
        user == secret.owner; //or Option.isSome(Array.find(secret.users, func(x : PrincipalName) : Bool { x == user }));
    };


    public shared ({ caller }) func whoami() : async Text {
        return Principal.toText(caller);
    };

    // Shared functions, i.e., those specified with [shared], are
    // accessible to remote callers.
    // The extra parameter [caller] is the caller's principal
    // See https://internetcomputer.org/docs/current/motoko/main/actors-async

    // Add new empty secret for this [caller].
    //
    // Returns:
    //      Future of ID of new empty secret
    // Traps:
    //      [caller] is the anonymous identity
    //      [caller] already has [MAX_secrets_PER_USER] secrets
    //      This is the first secret for [caller] and [MAX_USERS] is exceeded
    public shared ({ caller }) func create_secret() : async SecretId {
        //local ではコメントアウト: assert not Principal.isAnonymous(caller);
        let owner = Principal.toText(caller);
        // type Secret = {
        //     id: Nat;
        //     title: Text;
        //     password: Text;
        //     // created: Int;
        //     // updated: Int;
        //     owner : PrincipalName;
        //     // users : [PrincipalName];
        // };
        let newSecret : Secret = {
            id = nextSecretId;
            serviceName = "";
            userName = "";
            password = "";
            created = 0;
            updated = 0;
            owner = owner;
            //users = [];
        };

        switch (secretIdsByOwner.get(owner)) {
            case (?owner_nids) {
                assert List.size(owner_nids) < MAX_SECRETS_PER_USER;
                secretIdsByOwner.put(owner, List.push(newSecret.id, owner_nids));
            };
            case null {
                assert secretIdsByOwner.size() < MAX_USERS;
                secretIdsByOwner.put(owner, List.make(newSecret.id));
            };
        };

        secretsById.put(newSecret.id, newSecret);
        nextSecretId += 1;
        newSecret.id;
    };

    public shared ({ caller }) func get_secrets() : async [Secret] {
        assert not Principal.isAnonymous(caller);  //Backend candid ui ではFront側でログインしていないとAnonymousになるのでエラーになる
        let user = Principal.toText(caller);

        let owned_secrets = List.map(
            Option.get(secretIdsByOwner.get(user), List.nil()),
            func(nid : SecretId) : Secret {
                expect(secretsById.get(nid), "missing secret with ID " # Nat.toText(nid));
            },
        );
        let shared_secrets = List.map(
            Option.get(secretIdsByUser.get(user), List.nil()),
            func(nid : SecretId) : Secret {
                expect(secretsById.get(nid), "missing secret with ID " # Nat.toText(nid));
            },
        );

        let buf = Buffer.Buffer<Secret>(List.size(owned_secrets) + List.size(shared_secrets));
        buf.append(Buffer.fromArray(List.toArray(owned_secrets)));
        buf.append(Buffer.fromArray(List.toArray(shared_secrets)));
        Buffer.toArray(buf);
    };

    //1件だけ取得する
    public shared ({ caller }) func get_onesecret(id : SecretId) : async Secret {
        assert not Principal.isAnonymous(caller);  //Backend candid ui ではFront側でログインしていないとAnonymousになるのでエラーになる
        let caller_text = Principal.toText(caller);
        
        // シークレットの存在確認と取得
        let (?secret) = secretsById.get(id) else Debug.trap("secret with id " # Nat.toText(id) # " not found");
        
        // アクセス権限の確認
        if (not is_authorized(caller_text, secret)) {
            Debug.trap("unauthorized: user does not have access to this secret");
        };
        
        secret
    };

    // Replaces the encrypted text of secret with ID [id] with [password].
    //
    // Returns:
    //      Future of unit
    // Traps:
    //     [caller] is the anonymous identity
    //     secret with ID [id] does not exist
    //     [caller] is not the secret's owner and not a user with whom the secret is shared
    //     [password] exceeds [MAX_SECRET_CHARS]
    public shared ({ caller }) func update_secret(id : SecretId, password : Text) : async () {
        assert not Principal.isAnonymous(caller);  //Backend candid ui ではFront側でログインしていないとAnonymousになるのでエラーになる
        let caller_text = Principal.toText(caller);
        let (?secret_to_update) = secretsById.get(id) else Debug.trap("secret with id " # Nat.toText(id) # "not found");
        if (not is_authorized(caller_text, secret_to_update)) {
            Debug.trap("unauthorized");
        };
        assert secret_to_update.password.size() <= MAX_SECRET_CHARS;
        secretsById.put(id, { secret_to_update with password });
    };

    // シークレットを削除する関数
    public shared ({ caller }) func delete_secret(id : SecretId) : async () {
        assert not Principal.isAnonymous(caller);
        let caller_text = Principal.toText(caller);
        
        // シークレットの存在確認
        let (?secret_to_delete) = secretsById.get(id) else Debug.trap("secret with id " # Nat.toText(id) # "not found");
        
        // 所有者のみ削除可能
        if (caller_text != secret_to_delete.owner) {
            Debug.trap("unauthorized: only owner can delete secret");
        };

        // secretsByIdから削除
        secretsById.delete(id);

        // secretIdsByOwnerから削除
        switch (secretIdsByOwner.get(caller_text)) {
            case (?owner_secrets) {
                secretIdsByOwner.put(
                    caller_text,
                    List.filter(
                        owner_secrets,
                        func(secret_id : SecretId) : Bool { secret_id != id }
                    )
                );
            };
            case null {
                // 所有者のリストが見つからない場合は何もしない
            };
        };
    };

    // Shares the secret with ID [secret_id] with the [user].
    // Has no effect if the secret is already shared with that user.
    //
    // Returns:
    //      Future of unit
    // Traps:
    //     [caller] is the anonymous identity
    //     secret with ID [id] does not exist
    //     [caller] is not the secret's owner
    public shared ({ caller }) func add_user(secret_id : SecretId, user : PrincipalName) : async () {
        assert not Principal.isAnonymous(caller);  //Backend candid ui ではFront側でログインしていないとAnonymousになるのでエラーになる
        let caller_text = Principal.toText(caller);
        let (?secret) = secretsById.get(secret_id) else Debug.trap("secret with id " # Nat.toText(secret_id) # "not found");
        if (caller_text != secret.owner) {
            Debug.trap("unauthorized");
        };
        // assert secret.users.size() < MAX_SHARES_PER_SECRET;
        // if (not Option.isSome(Array.find(secret.users, func(u : PrincipalName) : Bool { u == user }))) {
        //     let users_buf = Buffer.fromArray<PrincipalName>(secret.users);
        //     users_buf.add(user);
        //     let updated_secret = { secret with users = Buffer.toArray(users_buf) };
        //     secretsById.put(secret_id, updated_secret);
        // };
        switch (secretIdsByUser.get(user)) {
            case (?user_nids) {
                if (not List.some(user_nids, func(nid : SecretId) : Bool { nid == secret_id })) {
                    secretIdsByUser.put(user, List.push(secret_id, user_nids));
                };
            };
            case null {
                secretIdsByUser.put(user, List.make(secret_id));
            };
        };
    };

    // Only the vetKD methods in the IC management canister are required here.
    type VETKD_SYSTEM_API = actor {
        vetkd_public_key : ({
            canister_id : ?Principal;
            derivation_path : [Blob];
            key_id : { curve : { #bls12_381 }; name : Text };
        }) -> async ({ public_key : Blob });
        vetkd_encrypted_key : ({
            public_key_derivation_path : [Blob];
            derivation_id : Blob;
            key_id : { curve : { #bls12_381 }; name : Text };
            encryption_public_key : Blob;
        }) -> async ({ encrypted_key : Blob });
    };
    //NOTE: motoko は環境変数からCanisterIDを取得できないので、deploy 時に引数で渡す
    let vetkd_system_api : VETKD_SYSTEM_API = actor (Principal.toText(vetkdSystemApiCanisterId));

    public shared ({ caller }) func symmetric_key_verification_key_for_secret() : async Text {
        let { public_key } = await vetkd_system_api.vetkd_public_key({
            canister_id = null;
            derivation_path = Array.make(Text.encodeUtf8("secsymkey_a9msvamna5jemnskjsddrf3wu4jdjhswqnvsp"));
            key_id = { curve = #bls12_381; name = "test_key_1" };
        });
        Hex.encode(Blob.toArray(public_key));
    };

    public shared ({ caller }) func encrypted_symmetric_key_for_secret(secret_id : SecretId, encryption_public_key : Blob) : async Text {
        let caller_text = Principal.toText(caller);
        let (?secret) = secretsById.get(secret_id) else Debug.trap("secret with id " # Nat.toText(secret_id) # "not found");
        if (not is_authorized(caller_text, secret)) {
            Debug.trap("unauthorized");
        };

        //Debug.print("encrypted_symmetric_key_for_caller: caller: " # debug_show (caller_text));

        let { encrypted_key } = await vetkd_system_api.vetkd_encrypted_key({
            derivation_id = Principal.toBlob(caller);
            public_key_derivation_path = Array.make(Text.encodeUtf8("secsymkey_a9msvamna5jemnskjsddrf3wu4jdjhswqnvsp"));
            key_id = { curve = #bls12_381; name = "test_key_1" };
            encryption_public_key;
        });
        Hex.encode(Blob.toArray(encrypted_key));

        // let buf = Buffer.Buffer<Nat8>(32);
        // buf.append(Buffer.fromArray(natToBigEndianByteArray(16, secret_id))); // fixed-size encoding
        // buf.append(Buffer.fromArray(Blob.toArray(Text.encodeUtf8(secret.owner))));
        // let derivation_id = Blob.fromArray(Buffer.toArray(buf)); // prefix-free

        // let { encrypted_key } = await vetkd_system_api.vetkd_encrypted_key({
        //     derivation_id;
        //     public_key_derivation_path = Array.make(Text.encodeUtf8("secsymkey_a9msvamna5jemnskjsddrf3wu4jdjhswqnvsp"));
        //     key_id = { curve = #bls12_381; name = "test_key_1" };
        //     encryption_public_key;
        // });
        // Hex.encode(Blob.toArray(encrypted_key));
    };

    // Converts a nat to a fixed-size big-endian byte (Nat8) array
    private func natToBigEndianByteArray(len : Nat, n : Nat) : [Nat8] {
        let ith_byte = func(i : Nat) : Nat8 {
            assert (i < len);
            let shift : Nat = 8 * (len - 1 - i);
            Nat8.fromIntWrap(n / 2 ** shift);
        };
        Array.tabulate<Nat8>(len, ith_byte);
    };

    // Below, we implement the upgrade hooks for our canister.
    // See https://internetcomputer.org/docs/current/motoko/main/upgrades/

    // The work required before a canister upgrade begins.
    system func preupgrade() {
        //Debug.print("Starting pre-upgrade hook...");
        stable_SecretsById := Iter.toArray(secretsById.entries());
        stable_SecretIdsByOwner := Iter.toArray(secretIdsByOwner.entries());
        stable_SecretIdsByUser := Iter.toArray(secretIdsByUser.entries());
        //Debug.print("pre-upgrade finished.");
    };

    // The work required after a canister upgrade ends.
    // See [nextSecretId], [stable_SecretsByUser]
    system func postupgrade() {
        //Debug.print("Starting post-upgrade hook...");

        secretsById := Map.fromIter<SecretId, Secret>(
            stable_SecretsById.vals(),
            stable_SecretsById.size(),
            Nat.equal,
            Hash.hash,
        );
        stable_SecretsById := [];

        secretIdsByOwner := Map.fromIter<PrincipalName, List.List<SecretId>>(
            stable_SecretIdsByOwner.vals(),
            stable_SecretIdsByOwner.size(),
            Text.equal,
            Text.hash,
        );
        stable_SecretIdsByOwner := [];

        secretIdsByUser := Map.fromIter<PrincipalName, List.List<SecretId>>(
            stable_SecretIdsByUser.vals(),
            stable_SecretIdsByUser.size(),
            Text.equal,
            Text.hash,
        );
        stable_SecretIdsByUser := [];

        //Debug.print("post-upgrade finished.");
    };
};
