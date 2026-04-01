const xrpl = require("xrpl")

async function calculateReputation(client, borrower_address) {
  
  // Fetch all transactions for this borrower
  const response = await client.request({
    command: "account_tx",
    account: borrower_address,
    limit: 100
  })

  const transactions = response.result.transactions
  
  // Starting baseline score
  let score = 50
  let repayments = []
  let vouches = []
  let missed_tranches = 0

  // Loop through all transactions and find Sidiq memos
  for (const tx of transactions) {
    const transaction = tx.tx || tx.tx_json
    if (!transaction.Memos) continue

    for (const memo of transaction.Memos) {
      if (!memo.Memo || !memo.Memo.MemoData) continue

      try {
        const decoded = Buffer.from(
          memo.Memo.MemoData, 'hex'
        ).toString('utf8')
        
        const data = JSON.parse(decoded)

        // Repayment detected — add points
        if (data.type === "SIDIQ_REPAYMENT") {
          score += 10
          repayments.push({
            tranche: data.tranche_number,
            amount: data.repayment_amount_xrp,
            timestamp: data.timestamp
          })
        }

        // Vouch detected — add points
        if (data.type === "SIDIQ_VOUCH") {
          score += 5
          vouches.push({
            voucher: data.voucher_address,
            timestamp: data.timestamp
          })
        }

        // Missed tranche detected — deduct points
        if (data.type === "SIDIQ_MISSED_TRANCHE") {
          score -= 20
          missed_tranches++
        }

      } catch (e) {
        // Not a Sidiq memo, skip
      }
    }
  }

  // Cap score between 0 and 100
  score = Math.max(0, Math.min(100, score))

  // Determine trust tier
  let tier = "Newcomer"
  if (score >= 80) tier = "Verified"
  else if (score >= 60) tier = "Contributor"

  return {
    borrower: borrower_address,
    reputation_score: score,
    trust_tier: tier,
    total_repayments: repayments.length,
    total_vouches: vouches.length,
    missed_tranches: missed_tranches,
    repayment_history: repayments,
    vouches: vouches,
    borrowing_limit_xrp: score * 2  // Simple rule — score of 75 = 150 XRP limit
  }
}

// Main function to test it
async function main() {
  const client = new xrpl.Client("wss://s.altnet.rippletest.net:51233")
  await client.connect()

  const borrower_address = "paste_borrower_address"

  console.log("Calculating reputation for:", borrower_address)
  console.log("Reading on-chain transaction history...\n")

  const reputation = await calculateReputation(client, borrower_address)

  console.log("=== REPUTATION REPORT ===")
  console.log("Borrower:         ", reputation.borrower)
  console.log("Reputation Score: ", reputation.reputation_score, "/ 100")
  console.log("Trust Tier:       ", reputation.trust_tier)
  console.log("Total Repayments: ", reputation.total_repayments)
  console.log("Total Vouches:    ", reputation.total_vouches)
  console.log("Missed Tranches:  ", reputation.missed_tranches)
  console.log("Borrowing Limit:  ", reputation.borrowing_limit_xrp, "XRP")
  console.log("\nRepayment History:")
  reputation.repayment_history.forEach(r => {
    console.log(`  Tranche ${r.tranche} — ${r.amount} XRP — ${r.timestamp}`)
  })
  console.log("\nVouches Received:")
  reputation.vouches.forEach(v => {
    console.log(`  From ${v.voucher} — ${v.timestamp}`)
  })

  await client.disconnect()
}

main()
