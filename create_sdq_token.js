const xrpl = require("xrpl")

async function main() {
  const client = new xrpl.Client("wss://s.altnet.rippletest.net:51233")
  await client.connect()
  console.log("Connected to XRPL Testnet")

  // ── STEP 1: Create the SDQ Issuer Wallet ──
  // This wallet is the official issuer of all SDQ tokens
  // In production this would be a highly secured cold wallet
  console.log("\nCreating SDQ Issuer wallet...")
  const issuer = xrpl.Wallet.generate()
  await client.fundWallet(issuer)
  console.log("Issuer address:", issuer.classicAddress)
  console.log("Issuer seed:   ", issuer.seed)

  // Wait for ledger to settle
  await new Promise(resolve => setTimeout(resolve, 3000))

  // ── STEP 2: Configure the Issuer Account ──
  // Set Default Ripple flag on issuer so trust lines work correctly
  console.log("\nConfiguring issuer account...")
  const issuer_settings = {
    TransactionType: "AccountSet",
    Account: issuer.classicAddress,
    SetFlag: xrpl.AccountSetAsfFlags.asfDefaultRipple
  }

  const is_prepared = await client.autofill(issuer_settings)
  const is_signed = issuer.sign(is_prepared)
  await client.submitAndWait(is_signed.tx_blob)
  console.log("✓ Issuer configured")

  // ── STEP 3: Load your demo wallets ──
  // Paste your seeds from demo_setup.js here
  const pool   = xrpl.Wallet.fromSeed("paste pool address")
  const amina  = xrpl.Wallet.fromSeed("paste lender address")
  const lana   = xrpl.Wallet.fromSeed("paste borrower address")
  const khalid = xrpl.Wallet.fromSeed("paste voucher address")

  const wallets = [
    { wallet: pool,   name: "Sidiq Pool"   },
    { wallet: amina,  name: "Amina"        },
    { wallet: lana,   name: "Lana"       },
    { wallet: khalid, name: "Khalid"       }
  ]

  // ── STEP 4: Create Trust Lines ──
  // Each wallet must trust the issuer before receiving SDQ
  console.log("\nSetting up SDQ trust lines for all wallets...")

  for (const { wallet, name } of wallets) {
    const trust_line = {
      TransactionType: "TrustSet",
      Account: wallet.classicAddress,
      LimitAmount: {
        currency: "SDQ",
        issuer: issuer.classicAddress,
        value: "1000000"  // Maximum SDQ this wallet will ever hold
      }
    }

    const t_prepared = await client.autofill(trust_line)
    const t_signed = wallet.sign(t_prepared)
    await client.submitAndWait(t_signed.tx_blob)
    console.log(`✓ Trust line created for ${name}`)
  }

  // ── STEP 5: Issue SDQ Tokens ──
  // Issuer sends SDQ to each wallet
  console.log("\nIssuing SDQ tokens to demo wallets...")

  const distributions = [
    { wallet: pool,   name: "Sidiq Pool",  amount: "10000" },
    { wallet: amina,  name: "Amina",       amount: "500"   },
    { wallet: lana,   name: "Lana",      amount: "100"   },
    { wallet: khalid, name: "Khalid",      amount: "200"   }
  ]

  for (const { wallet, name, amount } of distributions) {
    const payment = {
      TransactionType: "Payment",
      Account: issuer.classicAddress,
      Destination: wallet.classicAddress,
      Amount: {
        currency: "SDQ",
        issuer: issuer.classicAddress,
        value: amount
      }
    }

    const p_prepared = await client.autofill(payment)
    const p_signed = issuer.sign(p_prepared)
    await client.submitAndWait(p_signed.tx_blob)
    console.log(`✓ Issued ${amount} SDQ to ${name}`)
  }

  // ── STEP 6: Verify balances ──
  console.log("\nVerifying SDQ balances...")

  for (const { wallet, name } of wallets) {
    const lines = await client.request({
      command: "account_lines",
      account: wallet.classicAddress,
      ledger_index: "validated"
    })

    const sdq = lines.result.lines.find(
      l => l.currency === "SDQ" && l.account === issuer.classicAddress
    )

    console.log(`${name}: ${sdq ? sdq.balance : "0"} SDQ`)
  }

  // ── STEP 7: Test SDQ Payment ──
  // Amina sends 50 SDQ to the pool as a contribution
  console.log("\nTesting SDQ payment — Amina contributes 50 SDQ to pool...")

  const contribution = {
    type: "SIDIQ_CONTRIBUTION",
    lender: amina.classicAddress,
    amount_sdq: 50,
    currency: "SDQ",
    message: "Community lending contribution in SDQ",
    timestamp: new Date().toISOString()
  }

  const sdq_payment = {
    TransactionType: "Payment",
    Account: amina.classicAddress,
    Destination: pool.classicAddress,
    Amount: {
      currency: "SDQ",
      issuer: issuer.classicAddress,
      value: "50"
    },
    Memos: [{
      Memo: {
        MemoData: Buffer.from(
          JSON.stringify(contribution)
        ).toString("hex").toUpperCase()
      }
    }]
  }

  const sdq_prepared = await client.autofill(sdq_payment)
  const sdq_signed = amina.sign(sdq_prepared)
  const sdq_result = await client.submitAndWait(sdq_signed.tx_blob)
  console.log("✓ SDQ contribution recorded:", sdq_result.result.hash)

  console.log("\n" + "=".repeat(60))
  console.log("SDQ TOKEN SETUP COMPLETE")
  console.log("=".repeat(60))
  console.log("Token:   SDQ (Sidiq Community Token)")
  console.log("Issuer: ", issuer.classicAddress)
  console.log("Issuer seed:", issuer.seed)
  console.log("\nSave the issuer seed — needed for future SDQ issuance")
  console.log("\nAll demo wallets can now send and receive SDQ")
  console.log("SDQ is used for all Sidiq lending, repayments and vouching")
  console.log("\nExplorer — check issuer account:")
  console.log("https://testnet.xrpl.org/accounts/" + issuer.classicAddress)

  await client.disconnect()
}

main()

