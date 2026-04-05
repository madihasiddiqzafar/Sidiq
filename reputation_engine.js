const xrpl = require("xrpl")

async function calculateReputation(client, address) {

  // Fetch all transactions for this wallet
  const response = await client.request({
    command: "account_tx",
    account: address,
    limit: 100
  })

  const transactions = response.result.transactions

  // Starting baseline score
  let score = 50
  let repayments        = []
  let vouches_received  = []
  let vouches_given     = []
  let contributions     = []
  let missed_tranches   = 0

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

        // ── BORROWER ACTIONS ──

        // Repayment — borrower repaid a tranche on time
        if (data.type === "SIDIQ_REPAYMENT") {
          score += 10
          repayments.push({
            tranche:   data.tranche_number,
            amount:    data.repayment_amount_sdq || data.repayment_amount_xrp,
            new_score: data.new_reputation_score,
            timestamp: data.timestamp
          })
        }

        // Missed tranche — borrower failed to repay
        if (data.type === "SIDIQ_MISSED_TRANCHE") {
          score -= 20
          missed_tranches++
        }

        // ── VOUCHER ACTIONS ──

        // Vouch received — someone vouched for this wallet
        if (data.type === "SIDIQ_VOUCH" &&
            data.borrower_address === address) {
          score += 5
          vouches_received.push({
            voucher:   data.voucher_address,
            statement: data.statement,
            timestamp: data.timestamp
          })
        }

        // Vouch given — this wallet vouched for someone else
        if (data.type === "SIDIQ_VOUCH" &&
            data.voucher_address === address) {
          score += 3
          vouches_given.push({
            borrower:  data.borrower_address,
            statement: data.statement,
            timestamp: data.timestamp
          })
        }

        // ── LENDER ACTIONS ──

        // Contribution to the pool
        if (data.type === "SIDIQ_CONTRIBUTION" &&
            data.lender === address) {
          score += 8
          contributions.push({
            amount:    data.amount_sdq || data.amount_xrp,
            timestamp: data.timestamp
          })
        }

      } catch (e) {
        // Not a Sidiq memo — skip
      }
    }
  }

  // Cap score between 0 and 100
  score = Math.max(0, Math.min(100, score))

  // Determine trust tier
  let tier = "Newcomer"
  if (score >= 80)      tier = "Verified"
  else if (score >= 60) tier = "Contributor"

  // Determine role based on activity
  let role = "Community Member"
  if (repayments.length > 0 && contributions.length === 0) role = "Borrower"
  if (contributions.length > 0 && repayments.length === 0) role = "Lender"
  if (contributions.length > 0 && repayments.length > 0)   role = "Lender & Borrower"
  if (vouches_given.length > 0)                            role += " · Voucher"

  return {
    address:            address,
    reputation_score:   score,
    trust_tier:         tier,
    role:               role,
    borrowing_limit:    score * 2,
    // Borrower stats
    total_repayments:   repayments.length,
    missed_tranches:    missed_tranches,
    repayment_history:  repayments,
    // Vouching stats
    vouches_received:   vouches_received.length,
    vouches_given:      vouches_given.length,
    vouch_history_in:   vouches_received,
    vouch_history_out:  vouches_given,
    // Lender stats
    total_contributions:     contributions.length,
    contribution_history:    contributions
  }
}

// Main function
async function main() {
  const client = new xrpl.Client("wss://s.altnet.rippletest.net:51233")
  await client.connect()

  // Test with all three demo wallets
  const wallets = [
    { name: "Fatima (Borrower)", address: "paste_fatima_address_here" },
    { name: "Amina (Lender)",    address: "paste_amina_address_here"  },
    { name: "Khalid (Voucher)",  address: "paste_khalid_address_here" }
  ]

  for (const { name, address } of wallets) {
    console.log("\n" + "=".repeat(50))
    console.log(`REPUTATION REPORT — ${name}`)
    console.log("=".repeat(50))

    const rep = await calculateReputation(client, address)

    console.log(`Address:           ${rep.address}`)
    console.log(`Role:              ${rep.role}`)
    console.log(`Reputation Score:  ${rep.reputation_score} / 100`)
    console.log(`Trust Tier:        ${rep.trust_tier}`)
    console.log(`Borrowing Limit:   ${rep.borrowing_limit} SDQ`)
    console.log(`\nBorrower Activity:`)
    console.log(`  Repayments:      ${rep.total_repayments}`)
    console.log(`  Missed Tranches: ${rep.missed_tranches}`)
    console.log(`\nVouching Activity:`)
    console.log(`  Vouches Received: ${rep.vouches_received}`)
    console.log(`  Vouches Given:    ${rep.vouches_given}`)
    console.log(`\nLender Activity:`)
    console.log(`  Contributions:   ${rep.total_contributions}`)

    if (rep.contribution_history.length > 0) {
      console.log(`  Contribution History:`)
      rep.contribution_history.forEach(c => {
        console.log(`    ${c.amount} SDQ — ${c.timestamp}`)
      })
    }
  }

  await client.disconnect()
}

main()