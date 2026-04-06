const xrpl = require("xrpl")

// ── Paste your values here ──
const SDQ_ISSUER   = "paste_sdq_issuer_here"
const POOL_ADDRESS = "paste_pool_address_here"
const LANA_SEED    = "paste_borrower_seed_here"
const LANA_ADDRESS = "paste_borrower_address_here"

async function main() {
  const client = new xrpl.Client("wss://s.altnet.rippletest.net:51233")
  await client.connect()

  const lana = xrpl.Wallet.fromSeed(LANA_SEED)
  console.log("Lana wallet loaded:", lana.classicAddress)

  // Reputation before
  const rep_before = await getReputation(client, LANA_ADDRESS)
  console.log("\nLana reputation BEFORE repayment:", rep_before.score, "/100")

  const repayment = {
    type:                   "SIDIQ_REPAYMENT",
    borrower:               LANA_ADDRESS,
    pool_address:           POOL_ADDRESS,
    tranche_number:         1,
    repayment_amount_sdq:   6,
    previous_reputation_score: rep_before.score,
    reputation_change:      "+10",
    new_reputation_score:   Math.min(100, rep_before.score + 10),
    next_tranche_unlocked:  true,
    timestamp:              new Date().toISOString(),
    message:                "Tranche 1 repayment — Sidiq micro loan"
  }

  const payment = {
    TransactionType: "Payment",
    Account:         lana.classicAddress,
    Destination:     POOL_ADDRESS,
    Amount: {
      currency: "SDQ",
      issuer:   SDQ_ISSUER,
      value:    "6"
    },
    Memos: [{
      Memo: {
        MemoData: Buffer.from(
          JSON.stringify(repayment)
        ).toString("hex").toUpperCase()
      }
    }]
  }

  console.log("\nLana repaying tranche 1 — 6 SDQ...")
  const prepared = await client.autofill(payment)
  const signed   = lana.sign(prepared)
  const result   = await client.submitAndWait(signed.tx_blob)

  // Reputation after
  const rep_after = await getReputation(client, LANA_ADDRESS)

  console.log("\n=== REPAYMENT RECORDED ===")
  console.log("Transaction hash:       ", result.result.hash)
  console.log("Amount repaid:           6 SDQ")
  console.log("Tranche:                 1 of 4")
  console.log("Reputation BEFORE:      ", rep_before.score, "/100")
  console.log("Reputation AFTER:       ", rep_after.score,  "/100")
  console.log("Next tranche unlocked:   25% — 10 SDQ")
  console.log("Explorer: https://testnet.xrpl.org/transactions/" + result.result.hash)
  console.log("\nAll demo transactions complete.")
  console.log("Open your frontend to show the live dashboard.")

  await client.disconnect()
}

// Simple reputation helper
async function getReputation(client, address) {
  const response = await client.request({
    command: "account_tx",
    account: address,
    limit: 100
  })
  let score = 50
  for (const tx of response.result.transactions) {
    const transaction = tx.tx || tx.tx_json
    if (!transaction.Memos) continue
    for (const memo of transaction.Memos) {
      if (!memo.Memo || !memo.Memo.MemoData) continue
      try {
        const data = JSON.parse(
          Buffer.from(memo.Memo.MemoData, "hex").toString("utf8")
        )
        if (data.type === "SIDIQ_REPAYMENT")      score += 10
        if (data.type === "SIDIQ_VOUCH" &&
            data.borrower_address === address)     score += 5
        if (data.type === "SIDIQ_MISSED_TRANCHE") score -= 20
      } catch(e) {}
    }
  }
  return { score: Math.max(0, Math.min(100, score)) }
}

main()