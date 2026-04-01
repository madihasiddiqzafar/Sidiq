// === VERSION 2 - Updated loan application using AccountSet ===
// === No XRP transferred - clean and fee-free ===
const xrpl = require("xrpl")

async function main() {
  const client = new xrpl.Client("wss://s.altnet.rippletest.net:51233")
  await client.connect()

  // Load existing borrower wallet
  const borrower_wallet = xrpl.Wallet.fromSeed("paste_borrower_seed")
  console.log("Borrower wallet loaded:", borrower_wallet.classicAddress)

  // Sidiq pool address included in memo not as destination
  const POOL_ADDRESS = "paste_pool_address"

  // Calculate tranches based on requested amount
  const total_loan = 100
  const tranches = {
    tranche_1: total_loan * 0.15,
    tranche_2: total_loan * 0.25,
    tranche_3: total_loan * 0.35,
    tranche_4: total_loan * 0.25
  }

  // Loan application details with pool address inside memo
  const application = {
    type: "SIDIQ_LOAN_APPLICATION",
    borrower: borrower_wallet.classicAddress,
    pool_address: POOL_ADDRESS,
    total_amount_xrp: total_loan,
    purpose: "Materials for small business",
    repayment_period_days: 90,
    tranches: tranches,
    reputation_score: 75,
    timestamp: new Date().toISOString()
  }

  // Convert memo to hex
  const memo_hex = Buffer.from(
    JSON.stringify(application)
  ).toString("hex").toUpperCase()

  // AccountSet transaction - no XRP transferred
  const application_tx = {
    TransactionType: "AccountSet",
    Account: borrower_wallet.classicAddress,
    Memos: [
      {
        Memo: {
          MemoData: memo_hex
        }
      }
    ]
  }

  console.log("\nSubmitting loan application on chain...")
  const prepared = await client.autofill(application_tx)
  //console.log("Transaction type being sent:", prepared.TransactionType) //debug 
  //console.log("Full prepared transaction:", JSON.stringify(prepared, null, 2)) //debug
  const signed = borrower_wallet.sign(prepared)
  const result = await client.submitAndWait(signed.tx_blob)

  console.log("\n=== LOAN APPLICATION SUBMITTED ===")
  console.log("Transaction hash:", result.result.hash)
  console.log("Borrower:", borrower_wallet.classicAddress)
  console.log("Pool:", POOL_ADDRESS)
  console.log("Total loan requested:", total_loan, "XRP")
  console.log("Application fee: None")
  console.log("\nTranche breakdown:")
  console.log("Tranche 1:", tranches.tranche_1, "XRP (15%)")
  console.log("Tranche 2:", tranches.tranche_2, "XRP (25%)")
  console.log("Tranche 3:", tranches.tranche_3, "XRP (35%)")
  console.log("Tranche 4:", tranches.tranche_4, "XRP (25%)")
  console.log("\nExplorer:", "https://testnet.xrpl.org/transactions/" + result.result.hash)
  console.log("\nApplication recorded on chain. No funds transferred.")

  await client.disconnect()
}

main()

