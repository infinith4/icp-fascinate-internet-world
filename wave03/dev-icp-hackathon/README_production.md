# deploy production

https://note.com/d4f_cripto/n/n2ec540dbc6df


https://zenn.dev/halifax/books/icpbook-rust/viewer/03_hello

https://frdop-7aaaa-aaaah-aadla-cai.raw.ic0.app/getting_started/get_cycles.html

https://internetcomputer.org/docs/building-apps/developer-tools/dfx/dfx-identity


https://smacon.dev/posts/deploy-to-ic/


dfx ping ic

vscode ➜ /src/helloproj01 $ dfx ping ic
{
  "replica_health_status": "healthy",
  "root_key": [48, 129, 130, 48, 29, 6, 13, 43, 6, 1, 4, 1, 130, 220, 124, 5, 3, 1, 2, 1, 6, 12, 43, 6, 1, 4, 1, 130, 220, 124, 5, 3, 2, 1, 3, 97, 0, 129, 76, 14, 110, 199, 31, 171, 88, 59, 8, 189, 129, 55, 60, 37, 92, 60, 55, 27, 46, 132, 134, 60, 152, 164, 241, 224, 139, 116, 35, 93, 20, 251, 93, 156, 12, 213, 70, 217, 104, 95, 145, 58, 12, 11, 44, 197, 52, 21, 131, 191, 75, 67, 146, 228, 103, 219, 150, 214, 91, 155, 180, 203, 113, 113, 18, 248, 71, 46, 13, 90, 77, 20, 80, 95, 253, 116, 132, 176, 18, 145, 9, 28, 95, 135, 185, 136, 131, 70, 63, 152, 9, 26, 11, 170, 174]
}



dfx identity whoami



dfx identity list


dfx identity new prd-id-helloproj01

dfx identity use prd-id-helloproj01



dfx identity whoami



他のブロックチェーン ネットワークと同様に、IC インフラストラクチャのさまざまな部分でメッセージを認証するためにデジタル署名スキームが使用されます。dfx で ID を作成すると、ID の .pem ファイルが生成されます。これらのファイルは、~/.config/dfx/identity/ ディレクトリにあります。インターネット コンピュータの「プリンシパル」は、他のブロックチェーン システムの「パブリック アドレス」とほぼ同等です。サイクルの作成手順では、この識別子が必要になります。次のコマンドでプリンシパル ID を取得できます。

dfx identity get-principal

vscode ➜ /src/helloproj01 $ dfx identity get-principal
Please enter the passphrase for your identity: [hidden]
Decryption complete.
r7w2f-lwvo2-oseoa-tylhg-2cuqk-mz7a3-5qoxk-tofbp-yukm4-62bz6-zqe

dfx ledger account-id

vscode ➜ /src/helloproj01 $ dfx ledger account-id
Please enter the passphrase for your identity: [hidden]
Decryption complete.
c9830a7de0fba86bf56b8481ebaa99f591912faa4f147bf9080d63d9956134d2

vscode ➜ /src/helloproj01 $ dfx ledger account-id
dfx ledger account-id --network ic
Please enter the passphrase for your identity: [hidden]
Decryption complete.
c9830a7de0fba86bf56b8481ebaa99f591912faa4f147bf9080d63d9956134d2
Please enter the passphrase for your identity: [hidden]
Decryption complete.
c9830a7de0fba86bf56b8481ebaa99f591912faa4f147bf9080d63d9956134d2


dfx ledger --network ic balance

vscode ➜ /src/helloproj01 $ dfx ledger --network ic balance
Please enter the passphrase for your identity: [hidden]
Decryption complete.
0.00000000 ICP
vscode ➜ /src/helloproj01 $




Plug ウォレットや他の取引所のwallet から dfx ledger の 上記で取得した Account ID へ ICP を送金しておく。

試しに 1.08 ICPを送金した。

vscode ➜ /src/helloproj01 $ dfx ledger --network ic balance
Please enter the passphrase for your identity: [hidden]
Decryption complete.
1.07964000 ICP



## Cycle ウォレットを作る


Internet Computer のウォレット自体もキャニスターとして作られる

https://smacon.dev/posts/ledger-cycle-wallet/

2 つのコマンドを実行して Cycle ウォレットを作ります。 ここでのポイントは

Cycle ウォレット自身もキャニスターである
キャニスターの作成は Cycle で支払うが、まだ Cycle ウォレットがないので最初だけは ICP で払う

#### Cycle 用の空の canister を作成する。

dfx ledger --network ic create-canister <principal-identifier> --amount <icp-tokens>


dfx ledger --network ic create-canister r7w2f-lwvo2-oseoa-tylhg-2cuqk-mz7a3-5qoxk-tofbp-yukm4-62bz6-zqe --amount 0.25

vscode ➜ /src/helloproj01 $ 
dfx ledger --network ic create-canister r7w2f-lwvo2-oseoa-tylhg-2cuqk-mz7a3-5qoxk-tofbp-yukm4-62bz6-zqe --amount 0.25
Please enter the passphrase for your identity: [hidden]
Decryption complete.
Transfer sent at block height 21125796
Using transfer at block height 21125796
Canister created with id: "lrq44-iaaaa-aaaao-a37ia-cai"




dfx identity --network ic deploy-wallet <canister-identifer>

dfx identity --network ic deploy-wallet "lrq44-iaaaa-aaaao-a37ia-cai"

vscode ➜ /src/helloproj01 $ dfx identity --network ic deploy-wallet "lrq44-iaaaa-aaaao-a37ia-cai"
Please enter the passphrase for your identity: [hidden]
Decryption complete.
Created a wallet canister on the "ic" network for user "prd-id-helloproj01" with ID "lrq44-iaaaa-aaaao-a37ia-cai"


dfx wallet --network ic balance

vscode ➜ /src/helloproj01 $ dfx wallet --network ic balance
Please enter the passphrase for your identity: [hidden]
Decryption complete.
0.598 TC (trillion cycles).

dfx identity --network ic get-wallet

vscode ➜ /src/helloproj01 $ dfx identity --network ic get-wallet
Please enter the passphrase for your identity: [hidden]
Decryption complete.
lrq44-iaaaa-aaaao-a37ia-cai


https://<WALLET-CANISTER-ID>.icp0.io


https://lrq44-iaaaa-aaaao-a37ia-cai.icp0.io


https://iclight.io/account




dfx wallet --network ic balance

dfx cycles balance --network=ic

上記の違いは何？？？




Replace AMOUNT with the number of ICP tokens

dfx cycles convert --amount AMOUNT --network=ic

dfx cycles convert --amount 0.5 --network=ic




vscode ➜ /src/helloproj01 $ dfx cycles convert --amount 0.5 --network=ic
Please enter the passphrase for your identity: [hidden]
Decryption complete.
Transfer sent at block height 21126101
Using transfer at block height 21126101
Account was topped up with 2_220_300_000_000 cycles! New balance is 2_220_200_000_000 cycles.


dfx cycles balance --network=ic

vscode ➜ /src/helloproj01 $ dfx cycles balance --network=ic
Please enter the passphrase for your identity: [hidden]
Decryption complete.
0.000 TC (trillion cycles).

vscode ➜ /src/helloproj01 $ dfx wallet --network ic balance
Please enter the passphrase for your identity: [hidden]
Decryption complete.
0.598 TC (trillion cycles).

vscode ➜ /src/helloproj01 $ dfx cycles balance --network=ic
Please enter the passphrase for your identity: [hidden]
Decryption complete.
2.220 TC (trillion cycles).

vscode ➜ /src/helloproj01 $  dfx ledger --network ic balance
Please enter the passphrase for your identity: [hidden]
Decryption complete.
0.32944000 ICP

dfx cycles convert：Use the dfx cycles convert command to convert ICP into cycles that are stored on the cycles ledger.

0.5 ICP → 2.220 TC

5 ICP → 20 TC

キャニスターのデプロイの前に Cycle を追加で取得する必要があります。 この後で hello プロジェクトの 2 つのキャニスターを１発でデプロイするためには 6.3 TCycle 程度必要です。(2023 年 5 月現在)

公式ガイドの手順通りに簡単に進めるためにも Faucet を利用して 20 TCycle をもらうのがオススメです。

vscode ➜ /src/helloproj01 $ dfx ledger --network ic balance
Please enter the passphrase for your identity: [hidden]
Decryption complete.
5.46508000 ICP

vscode ➜ /src/helloproj01 $ dfx cycles convert --amount 5 --network=ic
Please enter the passphrase for your identity: [hidden]
Decryption complete.
Transfer sent at block height 21154620
Using transfer at block height 21154620
Error: Call(TransportError(reqwest::Error { kind: Decode, source: reqwest::Error { kind: Body, source: hyper::Error(Body, Error { kind: Reset(StreamId(3), INTERNAL_ERROR, Remote) }) } }))

vscode ➜ /src/helloproj01 $ dfx cycles balance --network=ic
Please enter the passphrase for your identity: [hidden]
Decryption complete.
23.549 TC (trillion cycles).
