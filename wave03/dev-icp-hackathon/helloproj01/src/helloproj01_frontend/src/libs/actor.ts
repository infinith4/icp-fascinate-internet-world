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
     //deploy したときのURLを Legacy にしないと動かない
    host: (process.env.DFX_NETWORK === "ic" ||
           process.env.DFX_NETWORK === "playground") ? `https://${process.env.CANISTER_ID_SECRETS_BACKEND}.raw.ic0.app` : 'http://localhost:4943',
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

  const agent = HttpAgent.createSync(options.agentOptions);
  // Fetch root key for certificate validation during development
  if (process.env.DFX_NETWORK !== "ic") {
    console.log(`process.env.DFX_NETWORK: ${process.env.DFX_NETWORK}; Dev environment - fetching root key...`);

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
    canisterId: process.env.CANISTER_ID_SECRETS_BACKEND!,
    ...options?.actorOptions,
  });
}
