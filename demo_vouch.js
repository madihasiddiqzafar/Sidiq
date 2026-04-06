const xrpl = require("xrpl")

// ── Paste your values here ──
const SDQ_ISSUER    = "paste_sdq_issuer_here"
const KHALID_SEED   = "paste_voucher_seed_here"
const LANA_ADDRESS  = "paste_borrower_address_here"

async function main() {
  const client = new xrpl.Client("wss://s.altnet.rippletest.net:51233")
  await client.connect()

  const khalid = xrpl.Wallet.fromSeed(KHALID_SEED)
  console.log("Khalid wallet loaded:", khalid.classicAddress)

  // Reputation before
  const rep_before = await getReputation(client, LANA_ADDRESS)
  console.log("\nLana reputation BEFORE vouch:", rep_before.score, "/100")

  // Vouch memo
  const vouch = {
    type:             "SIDIQ_VOUCH",
    voucher_address:  khalid.classicAddress,
    borrower_address: LANA_ADDRESS,
    statement:        "I personally know Lana and trust her to repay",
    timestamp:        new Date().toISOString()
  }

  const payment = {
    TransactionType: "Payment",
    Account:         khalid.classicAddress,
    Destination:     LANA_ADDRESS,
    Amount: {
      currency: "SDQ",
      issuer:   SDQ_ISSUER,
      value:    "1"
    },
    Memos: [{
      Memo: {
        MemoData: Buffer.from(
          JSON.stringify(vouch)
        ).toString("hex").toUpperCase()
      }
    }]
  }

  console.log("\nKhalid vouching for Lana with 1 SDQ...")
  const prepared = await client.autofill(payment)
  const signed   = khalid.sign(prepared)
  const result   = await client.submitAndWait(signed.tx_blob)

  // Reputation after
  const rep_after = await getReputation(client, LANA_ADDRESS)

  console.log("\n=== VOUCH RECORDED ===")
  console.log("Transaction hash:     ", result.result.hash)
  console.log("Voucher:              ", khalid.classicAddress)
  console.log("Borrower:             ", LANA_ADDRESS)
  console.log("Commitment:            1 SDQ (gift — non-returnable)")
  console.log("Lana reputation BEFORE:", rep_before.score, "/100")
  console.log("Lana reputation AFTER: ", rep_after.score,  "/100")
  console.log("Explorer: https://testnet.xrpl.org/transactions/" + result.result.hash)

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