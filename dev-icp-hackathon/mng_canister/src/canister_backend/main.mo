//https://motoko-book.dev/common-internet-computer-canisters/ic-management-canister.html#canister-status

import Principal "mo:base/Principal";
import IC "ic";

actor {
    let ic : IC.Self = actor "aaaaa-aa";
    let canister_principal = "bd3sg-teaaa-aaaaa-qaaba-cai";
    
    var controllers : [Principal] = [];

    public func canister_status() : async {
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
