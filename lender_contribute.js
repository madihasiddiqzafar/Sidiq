const xrpl = require("xrpl")

async function main() {
  const client = new xrpl.Client("wss://s.altnet.rippletest.net:51233")
  await client.connect()

  // Create a test lender wallet and fund it
  console.log("Creating lender wallet...")
  const lender_wallet = xrpl.Wallet.generate()
  await client.fundWallet(lender_wallet)
  console.log("Lender address:", lender_wallet.classicAddress)

  // Your Sidiq pool wallet address from the previous step
  const POOL_ADDRESS = "paste_pool_address"

  // The contribution details we want to record on chain
  const contribution = {
    type: "SIDIQ_CONTRIBUTION",
    lender: lender_wallet.classicAddress,
    amount_xrp: 50,
    timestamp: new Date().toISOString(),
    message: "Community lending contribution to Sidiq pool"
  }

  // Convert memo to hex (required by XRPL)
  const memo_hex = Buffer.from(
    JSON.stringify(contribution)
  ).toString("hex").toUpperCase()

  // Build the payment transaction with memo
  const payment = {
    TransactionType: "Payment",
    Account: lender_wallet.classicAddress,
    Amount: xrpl.xrpToDrops(50),
    Destination: POOL_ADDRESS,
    Memos: [
      {
        Memo: {
          MemoData: memo_hex
        }
      }
    ]
  }

  // Sign and submit the transaction
  console.log("\nSubmitting contribution to XRPL...")
  const prepared = await client.autofill(payment)
  const signed = lender_wallet.sign(prepared)
  const result = await client.submitAndWait(signed.tx_blob)

  console.log("\n=== CONTRIBUTION RECORDED ===")
  console.log("Transaction hash:", result.result.hash)
  console.log("Amount contributed: 50 XRP")
  console.log("Explorer: https://testnet.xrpl.org/transactions/" + result.result.hash)
  console.log("\nContribution memo recorded on chain:")
  console.log(JSON.stringify(contribution, null, 2))

  await client.disconnect()
}

main()
