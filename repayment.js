const xrpl = require("xrpl")

async function main() {
  const client = new xrpl.Client("wss://s.altnet.rippletest.net:51233")
  await client.connect()

  // Load existing borrower wallet
  const borrower_wallet = xrpl.Wallet.fromSeed("paste_borrower_seed")
  console.log("Borrower wallet loaded:", borrower_wallet.classicAddress)

  // Sidiq pool address
  const POOL_ADDRESS = "paste_pool_address"

  // Check borrower balance before repayment
  const balance_before = await client.request({
    command: "account_info",
    account: borrower_wallet.classicAddress,
    ledger_index: "validated"
  })
  console.log("\nBorrower balance BEFORE repayment:",
    xrpl.dropsToXrp(balance_before.result.account_data.Balance), "XRP")

  // Repayment details
  const repayment = {
    type: "SIDIQ_REPAYMENT",
    borrower: borrower_wallet.classicAddress,
    pool_address: POOL_ADDRESS,
    tranche_number: 1,
    repayment_amount_xrp: 15,
    previous_reputation_score: 75,
    reputation_change: "+10",
    new_reputation_score: 85,
    next_tranche_unlocked: true,
    next_tranche_amount_xrp: 25,
    timestamp: new Date().toISOString(),
    message: "Tranche 1 repayment - Sidiq micro loan"
  }

  // Convert memo to hex
  const memo_hex = Buffer.from(
    JSON.stringify(repayment)
  ).toString("hex").toUpperCase()

  // Build repayment as a Payment back to the pool
  // This IS a Payment - borrower is genuinely sending XRP back
  const payment = {
    TransactionType: "Payment",
    Account: borrower_wallet.classicAddress,
    Amount: xrpl.xrpToDrops(15),
    Destination: POOL_ADDRESS,
    Memos: [
      {
        Memo: {
          MemoData: memo_hex
        }
      }
    ]
  }

  console.log("\nSubmitting repayment to Sidiq pool...")
  const prepared = await client.autofill(payment)
  const signed = borrower_wallet.sign(prepared)
  const result = await client.submitAndWait(signed.tx_blob)

  // Check borrower balance after repayment
  const balance_after = await client.request({
    command: "account_info",
    account: borrower_wallet.classicAddress,
    ledger_index: "validated"
  })

  console.log("\n=== REPAYMENT RECORDED ===")
  console.log("Transaction hash:", result.result.hash)
  console.log("Amount repaid: 15 XRP")
  console.log("Tranche: 1 of 4")
  console.log("\nBorrower balance BEFORE:", 
    xrpl.dropsToXrp(balance_before.result.account_data.Balance), "XRP")
  console.log("Borrower balance AFTER:", 
    xrpl.dropsToXrp(balance_after.result.account_data.Balance), "XRP")
  console.log("\nReputation update:")
  console.log("Previous score: 75")
  console.log("Change: +10")
  console.log("New score: 85")
  console.log("\nNext tranche unlocked: 25 XRP")
  console.log("\nExplorer:", "https://testnet.xrpl.org/transactions/" + result.result.hash)
  console.log("\nRepayment permanently recorded on chain.")
  console.log("System can now create Tranche 2 escrow.")

  await client.disconnect()
}

main()