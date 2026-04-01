const xrpl = require("xrpl")

async function createDemoWallet(client, name, role) {
  const wallet = xrpl.Wallet.generate()
  await client.fundWallet(wallet)
  console.log(`\n=== ${name} (${role}) ===`)
  console.log("Address:", wallet.classicAddress)
  console.log("Seed:   ", wallet.seed)
  console.log("Explorer: https://testnet.xrpl.org/accounts/" + wallet.classicAddress)
  return wallet
}

async function main() {
  const client = new xrpl.Client("wss://s.altnet.rippletest.net:51233")
  await client.connect()
  console.log("Connected to XRPL Testnet")
  console.log("Creating Sidiq demo community...\n")

  // Create demo wallets
  const amina   = await createDemoWallet(client, "Amina Al-Hassan", "Lender")
  const fatima  = await createDemoWallet(client, "Fatima Malik", "Borrower")
  const khalid  = await createDemoWallet(client, "Khalid Ibrahim", "Voucher")
  const pool    = await createDemoWallet(client, "Sidiq Community Pool", "Pool")

  console.log("\n\nSave these details — you will need them for all demo scripts\n")
  console.log("=".repeat(60))
  console.log("DEMO WALLETS SUMMARY")
  console.log("=".repeat(60))
  console.log(`POOL    | ${pool.classicAddress}    | ${pool.seed}`)
  console.log(`AMINA   | ${amina.classicAddress}   | ${amina.seed}`)
  console.log(`FATIMA  | ${fatima.classicAddress}  | ${fatima.seed}`)
  console.log(`KHALID  | ${khalid.classicAddress}  | ${khalid.seed}`)
  console.log("=".repeat(60))

  // Wait for ledger to settle
  console.log("\nWaiting for wallets to settle on ledger...")
  await new Promise(resolve => setTimeout(resolve, 4000))

  // ── AMINA LENDS TO POOL ──
  console.log("\nAmina contributing 50 XRP to the Sidiq pool...")
  const contribution = {
    type: "SIDIQ_CONTRIBUTION",
    lender: amina.classicAddress,
    amount_xrp: 50,
    message: "Community lending contribution",
    timestamp: new Date().toISOString()
  }

  const contribution_tx = {
    TransactionType: "Payment",
    Account: amina.classicAddress,
    Amount: xrpl.xrpToDrops(50),
    Destination: pool.classicAddress,
    Memos: [{ Memo: { MemoData: Buffer.from(JSON.stringify(contribution)).toString("hex").toUpperCase() } }]
  }

  const c_prepared = await client.autofill(contribution_tx)
  const c_signed = amina.sign(c_prepared)
  const c_result = await client.submitAndWait(c_signed.tx_blob)
  console.log("✓ Amina contribution recorded:", c_result.result.hash)

  // ── FATIMA APPLIES FOR LOAN ──
  console.log("\nFatima submitting loan application...")
  const application = {
    type: "SIDIQ_LOAN_APPLICATION",
    borrower: fatima.classicAddress,
    pool_address: pool.classicAddress,
    total_amount_xrp: 40,
    purpose: "Materials for small tailoring business",
    repayment_period_days: 60,
    tranches: { tranche_1: 6, tranche_2: 10, tranche_3: 14, tranche_4: 10 },
    reputation_score: 50,
    timestamp: new Date().toISOString()
  }

  const app_tx = {
    TransactionType: "AccountSet",
    Account: fatima.classicAddress,
    Memos: [{ Memo: { MemoData: Buffer.from(JSON.stringify(application)).toString("hex").toUpperCase() } }]
  }

  const a_prepared = await client.autofill(app_tx)
  const a_signed = fatima.sign(a_prepared)
  const a_result = await client.submitAndWait(a_signed.tx_blob)
  console.log("✓ Fatima loan application recorded:", a_result.result.hash)

  // ── KHALID VOUCHES FOR FATIMA ──
  console.log("\nKhalid vouching for Fatima...")
  const vouch = {
    type: "SIDIQ_VOUCH",
    voucher_address: khalid.classicAddress,
    borrower_address: fatima.classicAddress,
    statement: "I personally know Fatima and trust her to repay",
    voucher_reputation_at_time: 75,
    timestamp: new Date().toISOString()
  }

  const vouch_tx = {
    TransactionType: "Payment",
    Account: khalid.classicAddress,
    Amount: xrpl.xrpToDrops(1),
    Destination: fatima.classicAddress,
    Memos: [{ Memo: { MemoData: Buffer.from(JSON.stringify(vouch)).toString("hex").toUpperCase() } }]
  }

  const v_prepared = await client.autofill(vouch_tx)
  const v_signed = khalid.sign(v_prepared)
  const v_result = await client.submitAndWait(v_signed.tx_blob)
  console.log("✓ Khalid vouch recorded:", v_result.result.hash)

  // ── POOL CREATES ESCROW FOR FATIMA ──
  console.log("\nPool creating escrow for Fatima — Tranche 1 (6 XRP)...")
  const ripple_offset = 946684800
  const release_time = Math.floor(Date.now() / 1000) - ripple_offset + 30
  const cancel_time  = Math.floor(Date.now() / 1000) - ripple_offset + (30 * 24 * 60 * 60)

  const loan_details = {
    type: "SIDIQ_LOAN_DISBURSEMENT",
    borrower: fatima.classicAddress,
    amount_xrp: 6,
    tranche: 1,
    total_tranches: 4,
    timestamp: new Date().toISOString()
  }

  const escrow_tx = {
    TransactionType: "EscrowCreate",
    Account: pool.classicAddress,
    Amount: xrpl.xrpToDrops(6),
    Destination: fatima.classicAddress,
    FinishAfter: release_time,
    CancelAfter: cancel_time,
    Memos: [{ Memo: { MemoData: Buffer.from(JSON.stringify(loan_details)).toString("hex").toUpperCase() } }]
  }

  const e_prepared = await client.autofill(escrow_tx)
  const e_signed = pool.sign(e_prepared)
  const e_result = await client.submitAndWait(e_signed.tx_blob)
  console.log("✓ Escrow created:", e_result.result.hash)

  // ── FATIMA REPAYS TRANCHE 1 ──
  console.log("\nWaiting 35 seconds for escrow to become claimable...")
  await new Promise(resolve => setTimeout(resolve, 35000))

  // Claim escrow
  const escrows = await client.request({
    command: "account_objects",
    account: pool.classicAddress,
    type: "escrow"
  })

  if (escrows.result.account_objects.length > 0) {
    const escrow = escrows.result.account_objects[0]
    const finish_tx = {
      TransactionType: "EscrowFinish",
      Account: fatima.classicAddress,
      Owner: pool.classicAddress,
      OfferSequence: escrow.Sequence
    }
    const f_prepared = await client.autofill(finish_tx)
    const f_signed = fatima.sign(f_prepared)
    const f_result = await client.submitAndWait(f_signed.tx_blob)
    console.log("✓ Fatima claimed tranche 1:", f_result.result.hash)
  }

  // Repayment
  console.log("\nFatima repaying tranche 1...")
  const repayment = {
    type: "SIDIQ_REPAYMENT",
    borrower: fatima.classicAddress,
    pool_address: pool.classicAddress,
    tranche_number: 1,
    repayment_amount_xrp: 6,
    previous_reputation_score: 50,
    reputation_change: "+10",
    new_reputation_score: 60,
    next_tranche_unlocked: true,
    timestamp: new Date().toISOString()
  }

  const repay_tx = {
    TransactionType: "Payment",
    Account: fatima.classicAddress,
    Amount: xrpl.xrpToDrops(6),
    Destination: pool.classicAddress,
    Memos: [{ Memo: { MemoData: Buffer.from(JSON.stringify(repayment)).toString("hex").toUpperCase() } }]
  }

  const r_prepared = await client.autofill(repay_tx)
  const r_signed = fatima.sign(r_prepared)
  const r_result = await client.submitAndWait(r_signed.tx_blob)
  console.log("✓ Fatima repayment recorded:", r_result.result.hash)

  console.log("\n" + "=".repeat(60))
  console.log("DEMO COMMUNITY SETUP COMPLETE")
  console.log("=".repeat(60))
  console.log("Your demo wallets now have realistic transaction history")
  console.log("\nAmina:  Lender who contributed to the pool")
  console.log("Fatima: Borrower who applied, received tranche 1, and repaid")
  console.log("Khalid: Community member who vouched for Fatima")
  console.log("Pool:   Community lending pool with active history")
  console.log("\nRun reputation_engine.js with Fatima's address to see her score")

  await client.disconnect()
}

main()