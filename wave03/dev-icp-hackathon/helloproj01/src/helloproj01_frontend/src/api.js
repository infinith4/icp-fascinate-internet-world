import { HttpAgent, Actor } from "@dfinity/agent";

const canisterId = "YOUR_CANISTER_ID"; // `dfx deploy` 後に取得
const agent = new HttpAgent({ host: "http://localhost:4943" });

const idlFactory = ({ IDL }) => {
  return IDL.Service({
    get_passwords: IDL.Func([], [IDL.Vec(
      IDL.Record({
        service_name: IDL.Text,
        username: IDL.Text,
        password: IDL.Text,
        notes: IDL.Opt(IDL.Text)
      })
    )], ['query']),
    add_password: IDL.Func([
      IDL.Record({
        service_name: IDL.Text,
        username: IDL.Text,
        password: IDL.Text,
        notes: IDL.Opt(IDL.Text)
      })
    ], [IDL.Bool], []),
    delete_password: IDL.Func([IDL.Nat], [IDL.Bool], []),
  });
};

const backend = Actor.createActor(idlFactory, { agent, canisterId });

export default backend;