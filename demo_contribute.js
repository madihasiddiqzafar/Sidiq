const xrpl = require("xrpl")

// ── Paste after running demo_wallets.js and create_sdq_token.js ──
const SDQ_ISSUER   = "paste_sdq_issuer_here"
const POOL_ADDRESS = "paste_pool_address_here"
const AMINA_SEED   = "paste_lender_seed_here"

async function main() {
  const client = new xrpl.Client("wss://s.altnet.rippletest.net:51233")
  await client.connect()

  const amina = xrpl.Wallet.fromSeed(AMINA_SEED)
  console.log("Amina wallet loaded:", amina.classicAddress)

  // Check balance before
  const lines_before = await client.request({
    command: "account_lines",
    account: POOL_ADDRESS,
    ledger_index: "validated"
  })
  const sdq_before = lines_before.result.lines.find(
    l => l.currency === "SDQ" && l.account === SDQ_ISSUER
  )
  console.log("\nPool SDQ balance BEFORE:", sdq_before ? sdq_before.balance : "0")

  // Contribution memo
  const contribution = {
    type:      "SIDIQ_CONTRIBUTION",
    lender:    amina.classicAddress,
    amount_sdq: 50,
    currency:  "SDQ",
    message:   "Community lending contribution to Sidiq pool",
    timestamp: new Date().toISOString()
  }

  const payment = {
    TransactionType: "Payment",
    Account:         amina.classicAddress,
    Destination:     POOL_ADDRESS,
    Amount: {
      currency: "SDQ",
      issuer:   SDQ_ISSUER,
      value:    "50"
    },
    Memos: [{
      Memo: {
        MemoData: Buffer.from(
          JSON.stringify(contribution)
        ).toString("hex").toUpperCase()
      }
    }]
  }

  console.log("\nAmina contributing 50 SDQ to Sidiq pool...")
  const prepared = await client.autofill(payment)
  const signed   = amina.sign(prepared)
  const result   = await client.submitAndWait(signed.tx_blob)

  // Check balance after
  const lines_after = await client.request({
    command: "account_lines",
    account: POOL_ADDRESS,
    ledger_index: "validated"
  })
  const sdq_after = lines_after.result.lines.find(
    l => l.currency === "SDQ" && l.account === SDQ_ISSUER
  )

  console.log("\n=== CONTRIBUTION RECORDED ===")
  console.log("Transaction hash:", result.result.hash)
  console.log("Amount:          50 SDQ")
  console.log("Pool BEFORE:     ", sdq_before ? sdq_before.balance : "0", "SDQ")
  console.log("Pool AFTER:      ", sdq_after  ? sdq_after.balance  : "0", "SDQ")
  console.log("Explorer: https://testnet.xrpl.org/transactions/" + result.result.hash)

  await client.disconnect()
}

main()