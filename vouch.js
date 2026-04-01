const xrpl = require("xrpl")

async function main() {
  const client = new xrpl.Client("wss://s.altnet.rippletest.net:51233")
  await client.connect()

  // Voucher wallet — community member doing the vouching
  const voucher_wallet = xrpl.Wallet.fromSeed("paste_voucher_seed")
  console.log("Voucher wallet loaded:", voucher_wallet.classicAddress)

  // Borrower address — shared privately between borrower and voucher
  const BORROWER_ADDRESS = "paste_borrower_address"

  // Check voucher balance before
  const balance_before = await client.request({
    command: "account_info",
    account: voucher_wallet.classicAddress,
    ledger_index: "validated"
  })
  console.log("\nVoucher balance BEFORE:", 
    xrpl.dropsToXrp(balance_before.result.account_data.Balance), "XRP")

  // Vouch details
  const vouch_data = {
    type: "SIDIQ_VOUCH",
    voucher_address: voucher_wallet.classicAddress,
    borrower_address: BORROWER_ADDRESS,
    statement: "I personally know this person and trust them to repay",
    voucher_reputation_at_time: 75,
    timestamp: new Date().toISOString()
  }

  const memo_hex = Buffer.from(
    JSON.stringify(vouch_data)
  ).toString("hex").toUpperCase()

  // Payment to borrower — 1 XRP commitment fee
  // This appears on the borrower's wallet transaction history
  // so the reputation engine can find it
  const vouch_tx = {
    TransactionType: "Payment",
    Account: voucher_wallet.classicAddress,
    Amount: xrpl.xrpToDrops(1),
    Destination: BORROWER_ADDRESS,
    Memos: [{ Memo: { MemoData: memo_hex } }]
  }

  console.log("\nSubmitting vouch to chain...")
  const prepared = await client.autofill(vouch_tx)
  const signed = voucher_wallet.sign(prepared)
  const result = await client.submitAndWait(signed.tx_blob)

  // Check voucher balance after
  const balance_after = await client.request({
    command: "account_info",
    account: voucher_wallet.classicAddress,
    ledger_index: "validated"
  })

  console.log("\n=== VOUCH RECORDED ===")
  console.log("Transaction hash:", result.result.hash)
  console.log("Voucher:         ", voucher_wallet.classicAddress)
  console.log("Borrower:        ", BORROWER_ADDRESS)
  console.log("Amount sent:      1 XRP (commitment fee — non-returnable)")
  console.log("Voucher balance BEFORE:", 
    xrpl.dropsToXrp(balance_before.result.account_data.Balance), "XRP")
  console.log("Voucher balance AFTER: ", 
    xrpl.dropsToXrp(balance_after.result.account_data.Balance), "XRP")
  console.log("\nWhat this means:")
  console.log("— Vouch permanently recorded on borrower's wallet")
  console.log("— 1 XRP gifted to borrower as community support")
  console.log("— Voucher reputation increases if borrower repays")
  console.log("— Voucher reputation decreases if borrower defaults")
  console.log("— This 1 XRP is a gift, not a loan — it does not return")
  console.log("\nExplorer:", "https://testnet.xrpl.org/transactions/" + result.result.hash)

  await client.disconnect()
}

main()
