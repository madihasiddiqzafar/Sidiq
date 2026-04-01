const xrpl = require("xrpl")

async function main() {
  const client = new xrpl.Client("wss://s.altnet.rippletest.net:51233")
  await client.connect()

  // Borrower wallet - paste the borrower seed you saved
  const borrower_wallet = xrpl.Wallet.fromSeed("paste_borrower_seed")
  console.log("Borrower wallet loaded:", borrower_wallet.classicAddress)

  // Pool wallet address - paste your pool address
  const POOL_ADDRESS = "paste_pool_address"

  // Check borrower balance before claiming
  const balance_before = await client.request({
    command: "account_info",
    account: borrower_wallet.classicAddress,
    ledger_index: "validated"
  })
  console.log("\nBorrower balance BEFORE claiming:", 
    xrpl.dropsToXrp(balance_before.result.account_data.Balance), "XRP")

  // Find the escrow on chain
  console.log("\nLooking for escrow on chain...")
  const escrows = await client.request({
    command: "account_objects",
    account: POOL_ADDRESS,
    type: "escrow"
  })

  if (escrows.result.account_objects.length === 0) {
    console.log("No escrows found - either already claimed or not yet created")
    await client.disconnect()
    return
  }

  // Get the most recent escrow
  const escrow = escrows.result.account_objects[0]
  console.log("Escrow found!")
  console.log("Escrow sequence:", escrow.PreviousTxnLgrSeq)

  // Build the escrow finish transaction
  const escrow_finish = {
    TransactionType: "EscrowFinish",
    Account: borrower_wallet.classicAddress,
    Owner: POOL_ADDRESS,
    OfferSequence: escrow.Sequence
  }

  // Sign and submit
  console.log("\nClaiming escrow...")
  const prepared = await client.autofill(escrow_finish)
  const signed = borrower_wallet.sign(prepared)
  const result = await client.submitAndWait(signed.tx_blob)

  // Check borrower balance after claiming
  const balance_after = await client.request({
    command: "account_info",
    account: borrower_wallet.classicAddress,
    ledger_index: "validated"
  })

  console.log("\n=== ESCROW CLAIMED ===")
  console.log("Transaction hash:", result.result.hash)
  console.log("Borrower balance AFTER claiming:", 
    xrpl.dropsToXrp(balance_after.result.account_data.Balance), "XRP")
  console.log("Explorer: https://testnet.xrpl.org/transactions/" + result.result.hash)
  console.log("\nThe borrower has successfully received their Sidiq loan!")

  await client.disconnect()
}

main()