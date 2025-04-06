//https://motoko-book.dev/common-internet-computer-canisters/ic-management-canister.html#canister-status

import Principal "mo:base/Principal";
import ICMng "ic-management-interface";
import Cycles "mo:base/ExperimentalCycles";
import Text "mo:base/Text";

import Blob "mo:base/Blob";
import Time "mo:base/Time";
import Hex "./Hex";
import ExperimentalCycles "mo:base/ExperimentalCycles";
import Array "mo:base/Array";
import Buffer "mo:base/Buffer";
import Nat "mo:base/Nat";

actor {
    // WASMチャンクのサイズ (2MB)
    private let CHUNK_SIZE : Nat = 2 * 1024 * 1024;

    // WASMをチャンクに分割する関数
    private func chunkWasm(wasm : [Nat8]) : [[Nat8]] {
        let totalSize = wasm.size();
        let chunkCount = (totalSize + CHUNK_SIZE - 1) / CHUNK_SIZE;
        let chunks = Buffer.Buffer<[Nat8]>(chunkCount);

        var offset = 0;
        while (offset < totalSize) {
            let size = Nat.min(CHUNK_SIZE, totalSize - offset);
            let chunk = Array.tabulate<Nat8>(size, func(i) = wasm[offset + i]);
            chunks.add(chunk);
            offset += size;
        };

        Buffer.toArray(chunks)
    };

  let icMng : ICMng.Self = actor "aaaaa-aa";
  //let interface : Interface.Self;
  // let canister_principal = "bd3sg-teaaa-aaaaa-qaaba-cai";
  private let GREET_WASM : [Nat8] = [];
  
  // // WASMをバイト配列として読み込む
  // private let GREET_WASM : [Nat8] = switch(File.read(".dfx/local/canisters/canister_backend/canister_backend.wasm")) {  // これは概念的な例です
  //     case (#ok(bytes)) bytes;
  //     case (#err(error)) [];
  // };

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

  //https://internetcomputer.org/docs/references/ic-interface-spec

   public shared({ caller }) func deployGreetCanister(canister_principal: Text) : async Principal {
       Cycles.add(10 ** 12);

       // 新しいcanisterを作成
       let mng_canister_id = Principal.fromText(canister_principal);
       let canister = await icMng.create_canister({
           settings = ?{
               freezing_threshold = null;
               controllers = ?[mng_canister_id];
               memory_allocation = null;
               compute_allocation = null;
           }
       });

       let canister_id = canister.canister_id;

       // 作成したcanisterのcontrollersを設定
       await icMng.update_settings({
           canister_id;
           settings = {
               controllers = ?[caller, canister_id, mng_canister_id];
               compute_allocation = null;
               memory_allocation = null;
               freezing_threshold = null;
           };
       });

       // WASMをチャンクに分割
       let chunks = chunkWasm(GREET_WASM);
       
       // 各チャンクを順番にアップロード
       var chunkIndex = 0;
       for (chunk in chunks.vals()) {
           let isFirstChunk = chunkIndex == 0;
           let isLastChunk = chunkIndex == chunks.size() - 1;
           
           let mode = if (isFirstChunk) {
               #install
           } else if (isLastChunk) {
               #upgrade
           } else {
               #reinstall
           };

           await icMng.install_code({
               arg = [];
               wasm_module = chunk;
               mode = mode;
               canister_id = canister_id;
           });

           chunkIndex += 1;
       };

       // canisterを起動
       await icMng.start_canister({ canister_id });

       canister_id
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

    // 現在のcanisterのcycles balanceを取得
    public func getBalance() : async Nat {
        return ExperimentalCycles.balance();
    };

    // 現在のcanisterの利用可能なcycles balanceを取得
    public func getAvailableBalance() : async Nat {
        return ExperimentalCycles.available();
    };

    // balanceの情報をまとめて取得
    public func getCyclesInfo() : async {
        balance: Nat;
        available: Nat;
    } {
        return {
            balance = ExperimentalCycles.balance();
            available = ExperimentalCycles.available();
        };
    };

    // 警告を出すしきい値
    private let WARNING_THRESHOLD : Nat = 1_000_000_000_000; // 1T cycles

    // balanceをチェックして警告を返す
    public func checkBalance() : async Text {
        let currentBalance = ExperimentalCycles.balance();
        if (currentBalance < WARNING_THRESHOLD) {
            return "Warning: Cycles balance is low! Current balance: " # debug_show(currentBalance);
        } else {
            return "Cycles balance is healthy: " # debug_show(currentBalance);
        };
    };

    // より詳細な情報を返す
    public func getDetailedBalance() : async {
        timestamp: Int;
        balance: Nat;
        available: Nat;
        isLow: Bool;
    } {
        let currentBalance = ExperimentalCycles.balance();
        return {
            timestamp = Time.now();
            balance = currentBalance;
            available = ExperimentalCycles.available();
            isLow = currentBalance < WARNING_THRESHOLD;
        };
    };
};
