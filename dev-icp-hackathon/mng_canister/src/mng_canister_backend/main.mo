//https://motoko-book.dev/common-internet-computer-canisters/ic-management-canister.html#canister-status

import Principal "mo:base/Principal";
import ICMng "ic-management-interface";
import Cycles "mo:base/ExperimentalCycles";
import Text "mo:base/Text";

actor {
  let icMng : ICMng.Self = actor "aaaaa-aa";
  //let interface : Interface.Self;
  // let canister_principal = "bd3sg-teaaa-aaaaa-qaaba-cai";
  
  var controllers : [Principal] = [];

  public query func greet(name : Text) : async Text {
    return "Hello, " # name # "!";
  };

  public shared({ caller }) func create_canister() : async Text {
      Cycles.add(10 ** 12);

      let newCanister = await icMng.create_canister({ settings = null });
      
      let canister_principal = Principal.toText(newCanister.canister_id);
      //canister_principal := canister_principal;
      return canister_principal;
  };
  
  public func deposit_cycles(canister_principal: Text) : async () {
      Cycles.add(10 ** 12);

      let canister_id = Principal.fromText(canister_principal);

      await icMng.deposit_cycles({ canister_id });
  };
  
  public func start_canister(canister_principal: Text) : async () {
      let canister_id = Principal.fromText(canister_principal);

      await icMng.start_canister({ canister_id });
  };
  public func stop_canister(canister_principal: Text) : async () {
      let canister_id = Principal.fromText(canister_principal);

      await icMng.stop_canister({ canister_id });
  };

  public func delete_canister(canister_principal: Text) : async () {
        let canister_id = Principal.fromText(canister_principal);

        await icMng.delete_canister({ canister_id });
    };

  public func canister_status(canister_principal: Text) : async {
      controllers : [Principal];
  } {
      let canister_id = Principal.fromText(canister_principal);

      let canisterStatus = await icMng.canister_status({ canister_id });

      controllers := canisterStatus.settings.controllers;
      
      return {
          controllers = controllers;
      };
  };

};
