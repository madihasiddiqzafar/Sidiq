const xrpl = require("xrpl")

// ── Paste your values here ──
const POOL_ADDRESS = "paste_pool_address_here"
const LANA_SEED    = "paste_borrower_seed_here"

async function main() {
  const client = new xrpl.Client("wss://s.altnet.rippletest.net:51233")
  await client.connect()

  const lana = xrpl.Wallet.fromSeed(LANA_SEED)
  console.log("Lana wallet loaded:", lana.classicAddress)

  const total = 40
  const tranches = {
    tranche_1: total * 0.15,
    tranche_2: total * 0.25,
    tranche_3: total * 0.35,
    tranche_4: total * 0.25
  }

  const application = {
    type:                 "SIDIQ_LOAN_APPLICATION",
    borrower:             lana.classicAddress,
    pool_address:         POOL_ADDRESS,
    total_amount_sdq:     total,
    purpose:              "Materials for small tailoring business",
    repayment_period_days: 60,
    tranches:             tranches,
    reputation_score:     55,
    timestamp:            new Date().toISOString()
  }

  const app_tx = {
    TransactionType: "AccountSet",
    Account:         lana.classicAddress,
    Memos: [{
      Memo: {
        MemoData: Buffer.from(
          JSON.stringify(application)
        ).toString("hex").toUpperCase()
      }
    }]
  }

  console.log("\nLana submitting loan application...")
  const prepared = await client.autofill(app_tx)
  const signed   = lana.sign(prepared)
  const result   = await client.submitAndWait(signed.tx_blob)

  console.log("\n=== LOAN APPLICATION SUBMITTED ===")
  console.log("Transaction hash:", result.result.hash)
  console.log("Borrower:        ", lana.classicAddress)
  console.log("Total requested:  40 SDQ")
  console.log("Purpose:          Materials for small tailoring business")
  console.log("Application fee:  None")
  console.log("\nTranche breakdown:")
  console.log("  Tranche 1:", tranches.tranche_1, "SDQ (15%)")
  console.log("  Tranche 2:", tranches.tranche_2, "SDQ (25%)")
  console.log("  Tranche 3:", tranches.tranche_3, "SDQ (35%)")
  console.log("  Tranche 4:", tranches.tranche_4, "SDQ (25%)")
  console.log("\nExplorer: https://testnet.xrpl.org/transactions/" + result.result.hash)
  console.log("\nNext step: node demo_escrow.js")

  await client.disconnect()
}

main()