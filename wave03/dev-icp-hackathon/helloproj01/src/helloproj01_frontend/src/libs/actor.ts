import {
  Actor,
  type ActorConfig,
  type ActorSubclass,
  HttpAgent,
  type HttpAgentOptions,
} from '@dfinity/agent';
// import { ENCRYPTED_NOTES_CANISTER_ID, _SERVICE } from './backend';
// import { idlFactory } from './backend';

//import { ENCRYPTED_NOTES_CANISTER_ID, _SERVICE } from './backend';
import { idlFactory } from './idlFactory';
import type { _SERVICE } from "../../../declarations/secrets_backend/secrets_backend.did.js";
// import { idlFactory } from "../../../declarations/vetkd_system_api/vetkd_system_api.did";

export type BackendActor = ActorSubclass<_SERVICE>;

export function createActor(options?: {
  agentOptions?: HttpAgentOptions;
  actorOptions?: ActorConfig;
}): BackendActor {
  console.log("createActor")
  const hostOptions = {
    host:'http://localhost:4943', //deploy したときのURLを Legacy にしないと動かない
  };

  if (!options) {
    options = {
      agentOptions: hostOptions,
    };
  } else if (!options.agentOptions) {
    options.agentOptions = hostOptions;
  } else {
    options.agentOptions.host = hostOptions.host;
  }

  const agent = new HttpAgent({ ...options.agentOptions });
  // Fetch root key for certificate validation during development
  if (true) {
    console.log(`Dev environment - fetching root key...`);

    agent.fetchRootKey().catch((err) => {
      console.warn(
        'Unable to fetch root key. Check to ensure that your local replica is running'
      );
      console.error(err);
    });
  }

  // Creates an actor with using the candid interface and the HttpAgent
  return Actor.createActor(idlFactory, {
    agent,
    canisterId: "br5f7-7uaaa-aaaaa-qaaca-cai",
    ...options?.actorOptions,
  });
}
