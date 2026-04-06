const xrpl = require("xrpl")

// ── Paste your values here ──
const SDQ_ISSUER   = "paste_sdq_issuer_here"
const POOL_SEED    = "paste_pool_seed_here"
const LANA_SEED    = "paste_borrower_seed_here"
const LANA_ADDRESS = "paste_borrower_address_here"

async function main() {
  const client = new xrpl.Client("wss://s.altnet.rippletest.net:51233")
  await client.connect()

  const pool = xrpl.Wallet.fromSeed(POOL_SEED)
  const lana = xrpl.Wallet.fromSeed(LANA_SEED)

  console.log("Pool wallet loaded:", pool.classicAddress)
  console.log("Lana wallet loaded:", lana.classicAddress)

  // Ripple epoch offset
  const ripple_offset = 946684800
  const release_time  = Math.floor(Date.now() / 1000) - ripple_offset + 30
  const cancel_time   = Math.floor(Date.now() / 1000) - ripple_offset + (30 * 24 * 60 * 60)

  const loan_details = {
    type:       "SIDIQ_LOAN_DISBURSEMENT",
    borrower:   LANA_ADDRESS,
    amount_sdq: 6,
    tranche:    1,
    total_tranches: 4,
    purpose:    "Materials for small tailoring business",
    timestamp:  new Date().toISOString()
  }

  // Create escrow — XRP escrow for tranche 1
  // Note: XRPL native escrow uses XRP
  // SDQ lending is tracked via memos
  const escrow_tx = {
    TransactionType: "EscrowCreate",
    Account:         pool.classicAddress,
    Amount:          xrpl.xrpToDrops(6),
    Destination:     LANA_ADDRESS,
    FinishAfter:     release_time,
    CancelAfter:     cancel_time,
    Memos: [{
      Memo: {
        MemoData: Buffer.from(
          JSON.stringify(loan_details)
        ).toString("hex").toUpperCase()
      }
    }]
  }

  console.log("\nCreating escrow for Lana — Tranche 1 (6 XRP)...")
  const e_prepared = await client.autofill(escrow_tx)
  const e_signed   = pool.sign(e_prepared)
  const e_result   = await client.submitAndWait(e_signed.tx_blob)
  console.log("✓ Escrow created:", e_result.result.hash)
  console.log("Waiting 35 seconds for escrow to become claimable...")

  await new Promise(resolve => setTimeout(resolve, 35000))

  // Find and finish escrow
  const escrows = await client.request({
    command: "account_objects",
    account: pool.classicAddress,
    type:    "escrow"
  })

  if (escrows.result.account_objects.length === 0) {
    console.log("No escrows found")
    await client.disconnect()
    return
  }

  const escrow = escrows.result.account_objects[0]

  const finish_tx = {
    TransactionType: "EscrowFinish",
    Account:         lana.classicAddress,
    Owner:           pool.classicAddress,
    OfferSequence:   escrow.Sequence
  }

  console.log("\nLana claiming tranche 1...")
  const f_prepared = await client.autofill(finish_tx)
  const f_signed   = lana.sign(f_prepared)
  const f_result   = await client.submitAndWait(f_signed.tx_blob)

  console.log("\n=== TRANCHE 1 DISBURSED ===")
  console.log("Escrow hash:  ", e_result.result.hash)
  console.log("Claim hash:   ", f_result.result.hash)
  console.log("Amount:        6 XRP released to Lana")
  console.log("Explorer: https://testnet.xrpl.org/transactions/" + f_result.result.hash)
  console.log("\nNext step: node demo_repay.js")

  await client.disconnect()
}

main()