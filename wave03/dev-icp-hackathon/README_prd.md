
https://smacon.dev/posts/deploy-to-ic/
https://zenn.dev/taka101/articles/717529cb1a6490


https://internetcomputer.org/docs/building-apps/developing-canisters/deploy


https://zenn.dev/taka101/articles/717529cb1a6490#icp%E3%83%88%E3%83%BC%E3%82%AF%E3%83%B3%E3%82%92cycle%E3%81%AB%E5%A4%89%E6%8F%9B


dfx identity import --seed-file /src/seed.txt prd-id-helloproj01


dfx identity list

dfx identity use prd-id-helloproj01
dfx identity use default

dfx identity whoami


dfx ping ic

dfx identity whoami
dfx identity get-principal
dfx ledger account-id

dfx ledger --network ic balance



dfx cycles balance --network ic



dfx wallet --network ic balance

ICPトークンをcycleに変換

dfx cycles convert --amount 0.1 --network ic

vscode ➜ /src $ dfx cycles convert --amount 0.01 --network ic
Please enter the passphrase for your identity: [hidden]
Decryption complete.
Transfer sent at block height 21426826
Using transfer at block height 21426826
Account was topped up with 43_183_000_000 cycles! New balance is 23_591_683_000_000 cycles.


https://dashboard.internetcomputer.org/transaction/cce3fd09cc03396970fe4abd32f7b6a7f5822090d1dbc358a95eead41c65f027?index=21426826


https://dashboard.internetcomputer.org/account/37ce38207c2eab4a81d8127c3eeed5421a74de420280f111f057a8841a5d397b

https://dashboard.internetcomputer.org/account/c9830a7de0fba86bf56b8481ebaa99f591912faa4f147bf9080d63d9956134d2

dfx cycles balance --network ic

vscode ➜ /src $ dfx cycles balance --network ic
Please enter the passphrase for your identity: [hidden]
Decryption complete.
23.592 TC (trillion cycles).

vscode ➜ /src/helloproj01 $ dfx deploy --network ic
Please enter the passphrase for your identity: [hidden]
Decryption complete.
Deploying all canisters.
created-at-time for canister helloproj01_backend is 1742520440674736299.
helloproj01_backend canister created on network ic with canister id: mestl-4aaaa-aaaan-qzx2q-cai
WARN: The "/src/helloproj01/canister_ids.json" file has been generated. Please make sure you store it correctly, e.g., submitting it to a GitHub repository.
created-at-time for canister helloproj01_frontend is 1742520467750535673.
helloproj01_frontend canister created on network ic with canister id: mnryx-kiaaa-aaaan-qzx3a-cai
created-at-time for canister secrets_backend is 1742520490961717753.
secrets_backend canister created on network ic with canister id: mkq6d-hqaaa-aaaan-qzx3q-cai
WARN: Specified ID is ignored on the IC mainnet.
created-at-time for canister vetkd_system_api is 1742520501112759841.
vetkd_system_api canister created on network ic with canister id: nh62n-iyaaa-aaaan-qzx4a-cai
WARN: Cannot check for vulnerabilities in rust canisters because cargo-audit is not installed. Please run 'cargo install cargo-audit' so that vulnerabilities can be detected.
WARN: /src/helloproj01/src/secrets_backend/main.mo:70.75-70.84: warning [M0154], field hash is deprecated:
For large `Nat` values consider using a bespoke hash function that considers all of the argument's bits.
/src/helloproj01/src/secrets_backend/main.mo:349.13-349.22: warning [M0154], field hash is deprecated:
For large `Nat` values consider using a bespoke hash function that considers all of the argument's bits.
/src/helloproj01/src/secrets_backend/main.mo:12.8-12.14: warning [M0194], unused identifier Result (delete or rename to wildcard `_` or `_Result`)
/src/helloproj01/src/secrets_backend/main.mo:15.8-15.13: warning [M0194], unused identifier Order (delete or rename to wildcard `_` or `_Order`)
/src/helloproj01/src/secrets_backend/main.mo:36.17-36.38: warning [M0194], unused identifier MAX_SHARES_PER_SECRET (delete or rename to wildcard `_` or `_MAX_SHARES_PER_SECRET`)
/src/helloproj01/src/secrets_backend/main.mo:277.22-277.28: warning [M0198], unused field caller in object pattern (delete or rewrite as `caller = _`)
/src/helloproj01/src/secrets_backend/main.mo:319.18-319.41: warning [M0194], unused identifier natToBigEndianByteArray (delete or rename to wildcard `_` or `_natToBigEndianByteArray`)

Executing: cargo build --target wasm32-unknown-unknown --release -p helloproj01_backend --locked
warning: unused return value of `clone` that must be used
  --> src/helloproj01_backend/src/lib.rs:36:13
   |
36 |             (*state.borrow()).clone();
   |             ^^^^^^^^^^^^^^^^^^^^^^^^^
   |
   = note: cloning is often expensive and is not expected to have side effects
   = note: `#[warn(unused_must_use)]` on by default
help: use `let _ = ...` to ignore the resulting value
   |
36 |             let _ = (*state.borrow()).clone();
   |             +++++++

warning: `helloproj01_backend` (lib) generated 1 warning
    Finished `release` profile [optimized] target(s) in 3.29s
Installed code for canister helloproj01_backend, with canister ID mestl-4aaaa-aaaan-qzx2q-cai
WARN: This project uses the default security policy for all assets. While it is set up to work with many applications, it is recommended to further harden the policy to increase security against attacks like XSS.
WARN: To get started, have a look at 'dfx info canister-security-policy'. It shows the default security policy along with suggestions on how to improve it.
WARN: To disable the policy warning, define "disable_security_policy_warning": true in .ic-assets.json5.
Installed code for canister helloproj01_frontend, with canister ID mnryx-kiaaa-aaaan-qzx3a-cai
Installed code for canister secrets_backend, with canister ID mkq6d-hqaaa-aaaan-qzx3q-cai
Installed code for canister vetkd_system_api, with canister ID nh62n-iyaaa-aaaan-qzx4a-cai
Deployed canisters.
URLs:
  Frontend canister via browser:
    helloproj01_frontend: https://mnryx-kiaaa-aaaan-qzx3a-cai.icp0.io/
  Backend canister via Candid interface:
    helloproj01_backend: https://a4gq6-oaaaa-aaaab-qaa4q-cai.raw.icp0.io/?id=mestl-4aaaa-aaaan-qzx2q-cai
    secrets_backend: https://a4gq6-oaaaa-aaaab-qaa4q-cai.raw.icp0.io/?id=mkq6d-hqaaa-aaaan-qzx3q-cai
    vetkd_system_api: https://a4gq6-oaaaa-aaaab-qaa4q-cai.raw.icp0.io/?id=nh62n-iyaaa-aaaan-qzx4a-cai
vscode ➜ /src/helloproj01 $ 


vscode ➜ /src/helloproj01 $ dfx cycles balance --network ic
Please enter the passphrase for your identity: [hidden]
Decryption complete.
11.191 TC (trillion cycles).



dfx deploy secrets_backend --network=local --argument '(principal "s55qq-oqaaa-aaaaa-aaakq-cai")'

dfx deploy secrets_backend --network=ic --argument '(principal "nh62n-iyaaa-aaaan-qzx4a-cai")'


    headers: {
      "Content-Security-Policy":
        "default-src 'self' https://ic0.app; connect-src 'self' https://ic0.app; script-src 'self' 'unsafe-inline' 'unsafe-eval';",
    },


dfx canister delete helloproj01_frontend --network=local 

dfx canister delete helloproj01_frontend --network=local 

dfx canister delete helloproj01_frontend --network=local 

dfx canister delete helloproj01_frontend --network=local 



dfx deploy --network=local vetkd_system_api
dfx deploy --network=local secrets_backend  --argument '(principal "nh62n-iyaaa-aaaan-qzx4a-cai")'
dfx deploy --network=local helloproj01_backend
dfx deploy --network=local helloproj01_frontend


https://internetcomputer.org/docs/building-apps/frontends/asset-security#content-security-policies-csp


Content Security Policies (CSP)
By default, frontend canisters created with dfx new contain the following Content Security Policy (CSP) in the project's .ic-assets.json5 file:

"Content-Security-Policy": "default-src 'self';script-src 'self';connect-src 'self' http://localhost:* https://icp0.io https://*.icp0.io https://icp-api.io;img-src 'self' data:;style-src * 'unsafe-inline';style-src-elem * 'unsafe-inline';font-src *;object-src 'none';base-uri 'self';frame-ancestors 'none';form-action 'self';upgrade-insecure-requests;",


This CSP includes the configuration img-src data because image files are often included in frontend interfaces. It also includes the security setting frame-ancestors: none which is used to mitigate clickjacking attacks.


```
index-Chtltzf9.js:44 Refused to connect to 'https://ic0.app/api/v3/canister/mkq6d-hqaaa-aaaan-qzx3q-cai/call' because it violates the following Content Security Policy directive: "connect-src 'self' http://localhost:* https://icp0.io https://*.icp0.io https://icp-api.io".
```

上記のエラーは以下のファイルにheadersを追加することで解決した。

helloproj01/src/helloproj01_frontend/public/.ic-assets.json5


```
headers: {
      "Content-Security-Policy": "default-src 'self';script-src 'self';connect-src 'self' http://localhost:* https://icp0.io https://*.icp0.app https://icp-api.app https://ic0.app https://*.ic0.app;img-src 'self' data:;style-src * 'unsafe-inline';style-src-elem * 'unsafe-inline';font-src *;object-src 'none';base-uri 'self';frame-ancestors 'none';form-action 'self';upgrade-insecure-requests;",
      "Access-Control-Allow-Origin": "*"
    }
```

infinity を表現する鍵マークを真ん中になるようなシンプルなアイコンを作成してください。青、黄色を含む3色でお願いします。

infinity を表現する鍵マークを真ん中になるようなシンプルなアイコンを作成してください。青、黄色を含む3色でお願いします。 web ページのアイコンとして利用したいです。

infinity を表現する鍵マークを真ん中になるようなシンプルなアイコンを作成してください。青、黄色を含む5色でお願いします。 web ページのアイコンとして利用したいです。

infinity を表現する鍵穴になるようなシンプルなアイコンを作成してください。青、黄色を含む5色でお願いします。 web ページのアイコンとして利用したいです。

infinity を表現する鍵穴になるようなシンプルなアイコンを作成してください。青、黄色を含む5色でお願いします。 web ページのアイコンとして利用したいです。 アイコンは1つにして下さい。