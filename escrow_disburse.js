const xrpl = require("xrpl")

async function main() {
  const client = new xrpl.Client("wss://s.altnet.rippletest.net:51233")
  await client.connect()

  // Your Sidiq pool wallet - paste your seed here
  const pool_wallet = xrpl.Wallet.fromSeed("paste_pool_wallet_seed")
  console.log("Pool wallet loaded:", pool_wallet.classicAddress)

  // Create a test borrower wallet
  console.log("\nCreating borrower wallet...")
  const borrower_wallet = xrpl.Wallet.generate()
  await client.fundWallet(borrower_wallet)
  console.log("Borrower address:", borrower_wallet.classicAddress)

  // Set release time to 5 minutes from now
  // XRPL uses Ripple Epoch time (seconds since Jan 1 2000)
  const ripple_offset = 946684800
  const release_time = Math.floor(Date.now() / 1000) - ripple_offset + (5 * 60)

  // Loan details to record in memo
  const loan_details = {
    type: "SIDIQ_LOAN_DISBURSEMENT",
    borrower: borrower_wallet.classicAddress,
    amount_xrp: 10,
    tranche: 1,
    release_time: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
    purpose: "First tranche - Sidiq micro loan",
    timestamp: new Date().toISOString()
  }

  const memo_hex = Buffer.from(
    JSON.stringify(loan_details)
  ).toString("hex").toUpperCase()

  // Build the escrow transaction
  const escrow = {
    TransactionType: "EscrowCreate",
    Account: pool_wallet.classicAddress,
    Amount: xrpl.xrpToDrops(10),
    Destination: borrower_wallet.classicAddress,
    FinishAfter: release_time,
    Memos: [
      {
        Memo: {
          MemoData: memo_hex
        }
      }
    ]
  }

  // Sign and submit
  console.log("\nCreating escrow on XRPL...")
  const prepared = await client.autofill(escrow)
  const signed = pool_wallet.sign(prepared)
  const result = await client.submitAndWait(signed.tx_blob)

  console.log("\n=== ESCROW CREATED ===")
  console.log("Transaction hash:", result.result.hash)
  console.log("Amount locked:", "10 XRP")
  console.log("Borrower:", borrower_wallet.classicAddress)
  console.log("Borrower seed:", borrower_wallet.seed)
  console.log("Release time: 5 minutes from now")
  console.log("Explorer: https://testnet.xrpl.org/transactions/" + result.result.hash)
  console.log("\nLoan details recorded on chain:")
  console.log(JSON.stringify(loan_details, null, 2))
  console.log("\nSave the borrower seed - you will need it to finish the escrow!")

  await client.disconnect()
}

main()
