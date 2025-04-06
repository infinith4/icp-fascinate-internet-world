import Principal "mo:base/Principal";

module {
    public type CanisterId = Principal;
    public type CanisterSettings = {
        controllers : [Principal];
        compute_allocation : ?Nat;
        memory_allocation : ?Nat;
        freezing_threshold : ?Nat;
    };

    public type CanisterStatus = {
        status : { #running; #stopping; #stopped };
        settings : CanisterSettings;
        module_hash : ?[Nat8];
        memory_size : Nat;
        cycles : Nat;
        idle_cycles_burned_per_day : Nat;
    };

    public type Self = actor {
        canister_status : { canister_id : Principal } -> async CanisterStatus;
        
        create_canister : ({ settings : ?CanisterSettings }) -> async ({
            canister_id : CanisterId;
        });
        install_code : ({
            mode : { #install; #reinstall; #upgrade };
            canister_id : CanisterId;
            wasm_module : Blob;
            arg : Blob;
            }) -> async ();
    };
};