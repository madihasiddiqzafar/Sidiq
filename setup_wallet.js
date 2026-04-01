const xrpl = require("xrpl")

async function main() {
  const client = new xrpl.Client("wss://s.altnet.rippletest.net:51233")
  await client.connect()

  console.log("Creating Sidiq Pool Wallet...")
  
  // Generate a new wallet
  const pool_wallet = xrpl.Wallet.generate()
  
  // Fund it using the testnet faucet
  await client.fundWallet(pool_wallet)
  
  console.log("\n=== SIDIQ POOL WALLET ===")
  console.log("Address:", pool_wallet.classicAddress)
  console.log("Secret:", pool_wallet.seed)
  console.log("\nSave these details - you will need them to build Sidiq!")
  console.log("Explorer: https://testnet.xrpl.org/accounts/" + pool_wallet.classicAddress)

  await client.disconnect()
}

main()
