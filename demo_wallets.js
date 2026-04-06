const xrpl = require("xrpl")

async function main() {
  const client = new xrpl.Client("wss://s.altnet.rippletest.net:51233")
  await client.connect()
  console.log("Connected to XRPL Testnet")
  console.log("Creating Sidiq demo wallets...\n")

  const pool   = xrpl.Wallet.generate()
  const amina  = xrpl.Wallet.generate()
  const lana   = xrpl.Wallet.generate()
  const khalid = xrpl.Wallet.generate()

  console.log("Funding wallets — this takes a moment...")
  await client.fundWallet(pool)
  await client.fundWallet(amina)
  await client.fundWallet(lana)
  await client.fundWallet(khalid)

  console.log("\n" + "=".repeat(60))
  console.log("DEMO WALLETS CREATED")
  console.log("=".repeat(60))
  console.log("\nPool Wallet:")
  console.log("  Address:", pool.classicAddress)
  console.log("  Seed:   ", pool.seed)

  console.log("\nAmina (Lender):")
  console.log("  Address:", amina.classicAddress)
  console.log("  Seed:   ", amina.seed)

  console.log("\nLana (Borrower):")
  console.log("  Address:", lana.classicAddress)
  console.log("  Seed:   ", lana.seed)

  console.log("\nKhalid (Voucher):")
  console.log("  Address:", khalid.classicAddress)
  console.log("  Seed:   ", khalid.seed)

  console.log("\n" + "=".repeat(60))
  console.log("Save all seeds before closing this terminal")
  console.log("Next step: node create_sdq_token.js")
  console.log("=".repeat(60))

  await client.disconnect()
}

main()