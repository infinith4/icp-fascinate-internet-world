module {
  public type CanisterId = Principal;

  public type CanisterSettings = {
    freezing_threshold : ?Nat;
    controllers : ?[Principal];
    memory_allocation : ?Nat;
    compute_allocation : ?Nat;
  };

  public type DefiniteCanisterSettings = {
    freezing_threshold : Nat;
    controllers : [Principal];
    memory_allocation : Nat;
    compute_allocation : Nat;
  };

  public type WasmModule = [Nat8];

  public type Self = actor {
    canister_status : shared { canister_id : CanisterId } -> async {
      status : { #stopped; #stopping; #running };
      memory_size : Nat;
      cycles : Nat;
      settings : DefiniteCanisterSettings;
      idle_cycles_burned_per_day : Nat;
      module_hash : ?[Nat8];
    };

    create_canister : ({ settings : ?CanisterSettings }) -> async ({
        canister_id : CanisterId;
    });

    delete_canister : shared { canister_id : CanisterId } -> async ();

    deposit_cycles : shared { canister_id : CanisterId } -> async ();

    install_code : shared {
      arg : [Nat8];
      wasm_module : WasmModule;
      mode : { #reinstall; #upgrade; #install };
      canister_id : CanisterId;
    } -> async ();

    start_canister : shared { canister_id : CanisterId } -> async ();

    stop_canister : shared { canister_id : CanisterId } -> async ();

    uninstall_code : shared { canister_id : CanisterId } -> async ();

    update_settings : shared {
      canister_id : Principal;
      settings : CanisterSettings;
    } -> async ();

  };
};
