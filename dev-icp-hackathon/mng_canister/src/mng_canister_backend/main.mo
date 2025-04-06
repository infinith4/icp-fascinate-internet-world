//https://motoko-book.dev/common-internet-computer-canisters/ic-management-canister.html#canister-status

import Principal "mo:base/Principal";
import IC "ic";
import Interface "ic-management-interface";
import Cycles "mo:base/ExperimentalCycles";
import Text "mo:base/Text";

actor {
  let ic : IC.Self = actor "aaaaa-aa";
  //let interface : Interface.Self;
  // let canister_principal = "bd3sg-teaaa-aaaaa-qaaba-cai";
  
  var controllers : [Principal] = [];

  public query func greet(name : Text) : async Text {
    return "Hello, " # name # "!";
  };

  public shared({ caller }) func create_canister() : async Text {
      Cycles.add(10 ** 12);

      let newCanister = await ic.create_canister({ settings = null });
      
      let canister_principal = Principal.toText(newCanister.canister_id);
      //canister_principal := canister_principal;
      return canister_principal;
  };
  // // Canister作成
  // public shared({ caller }) func createCanister() : async Principal {
  //     // 呼び出し元の権限チェック
  //     assert(isAuthorized(caller));

  //     // Cyclesの添付
  //     Cycles.add(20_000_000_000_000); // 20T cycles

  //     let ic : ManagementCanisterInterface = actor(Principal.toText(IC_MANAGEMENT_CANISTER_ID));
  //     let result = await ic.create_canister({
  //         settings = settings;
  //     });

  //     result.canister_id
  // };


  public func canister_status(canister_principal: Text) : async {
      controllers : [Principal];
  } {
      let canister_id = Principal.fromText(canister_principal);

      let canisterStatus = await ic.canister_status({ canister_id });

      controllers := canisterStatus.settings.controllers;
      
      return {
          controllers = controllers;
      };
  };

};
