// ============================================================
// sidiq.js — Browser XRPL functions for Sidiq frontend
// All functions use browser-compatible APIs (no Node.js)
// Include in HTML with:
// <script src="https://unpkg.com/xrpl@2.7.0/build/xrpl-latest-min.js"></script>
// <script src="sidiq.js"></script>
// ============================================================

// ── DEMO WALLET CONFIG ──
// Paste your values from demo_setup.js and create_sdq_token.js
const POOL_ADDRESS = "paste_pool_address"
const POOL_SEED    = "paste_pool_seed"
const SDQ_ISSUER   = "paste_SDQ_issuer_address"

// ── HELPER: Encode outgoing memo data to hex ──
function toHex(data) {
  return Array.from(
    new TextEncoder().encode(JSON.stringify(data))
  ).map(b => b.toString(16).padStart(2, '0')).join('').toUpperCase()
}

// ── HELPER: Decode incoming memo data from hex ──
function fromHex(hex) {
  return new TextDecoder().decode(
    new Uint8Array(
      hex.match(/.{1,2}/g).map(b => parseInt(b, 16))
    )
  )
}

// ── HELPER: Connect to XRPL testnet ──
async function connectToXRPL() {
  const client = new xrpl.Client("wss://s.altnet.rippletest.net:51233")
  await client.connect()
  return client
}

// ── HELPER: Get wallet from seed ──
function getWallet(seed) {
  return xrpl.Wallet.fromSeed(seed)
}

// ============================================================
// GET BALANCES
// ============================================================

// Get XRP balance for any address
async function getXRPBalance(address) {
  const client = await connectToXRPL()
  try {
    const response = await client.request({
      command: "account_info",
      account: address,
      ledger_index: "validated"
    })
    await client.disconnect()
    return parseFloat(xrpl.dropsToXrp(response.result.account_data.Balance))
  } catch(e) {
    await client.disconnect()
    return 0
  }
}

// Get SDQ token balance for any address
async function getSDQBalance(address) {
  const client = await connectToXRPL()
  try {
    const lines = await client.request({
      command: "account_lines",
      account: address,
      ledger_index: "validated"
    })
    console.log("Trust lines for", address, ":", JSON.stringify(lines.result.lines))

    await client.disconnect()
    const sdq = lines.result.lines.find(
      l => l.currency === "SDQ" && l.account === SDQ_ISSUER
    )
    return sdq ? parseFloat(sdq.balance) : 0

  } catch(e) {
    console.log("getSDQBalance error:", e.message)
    await client.disconnect()
    return 0
  }
}

// Get pool total balance
async function getPoolBalance() {
  return await getSDQBalance(POOL_ADDRESS)
}

// ============================================================
// REPUTATION ENGINE
// ============================================================

async function getReputation(address) {
  const client = await connectToXRPL()
  try {
    const response = await client.request({
      command: "account_tx",
      account: address,
      limit: 100
    })
    await client.disconnect()

    let score = 50
    let repayments = []
    let vouches = []
    let missed_tranches = 0

    for (const tx of response.result.transactions) {
      const transaction = tx.tx || tx.tx_json
      if (!transaction.Memos) continue

      for (const memo of transaction.Memos) {
        if (!memo.Memo || !memo.Memo.MemoData) continue
        try {
          // Use browser-compatible hex decoder
          const decoded = fromHex(memo.Memo.MemoData)
          const data = JSON.parse(decoded)

          if (data.type === "SIDIQ_REPAYMENT") {
            score += 10
            repayments.push(data)
          }
          if (data.type === "SIDIQ_VOUCH") {
            score += 5
            vouches.push(data)
          }
          if (data.type === "SIDIQ_MISSED_TRANCHE") {
            score -= 20
            missed_tranches++
          }
        } catch(e) {}
      }
    }

    // Cap score between 0 and 100
    score = Math.max(0, Math.min(100, score))

    // Determine trust tier
    let tier = "Newcomer"
    if (score >= 80)      tier = "Verified"
    else if (score >= 60) tier = "Contributor"

    return {
      score,
      tier,
      repayments: repayments.length,
      vouches: vouches.length,
      missed_tranches,
      borrowing_limit: score * 2,
      repayment_history: repayments,
      vouch_history: vouches
    }

  } catch(e) {
    await client.disconnect()
    return {
      score: 50,
      tier: "Newcomer",
      repayments: 0,
      vouches: 0,
      missed_tranches: 0,
      borrowing_limit: 100,
      repayment_history: [],
      vouch_history: []
    }
  }
}
// ── GET ACTIVE LOAN FOR BORROWER ──
async function getActiveLoan(address) {
  const client = await connectToXRPL()
  try {
    const response = await client.request({
      command: "account_tx",
      account: address,
      limit: 100
    })
    await client.disconnect()

    let latest_application = null
    let repaid_tranches = 0

    for (const tx of response.result.transactions) {
      const transaction = tx.tx || tx.tx_json
      if (!transaction.Memos) continue

      for (const memo of transaction.Memos) {
        if (!memo.Memo || !memo.Memo.MemoData) continue
        try {
          const decoded = fromHex(memo.Memo.MemoData)
          const data = JSON.parse(decoded)

          if (data.type === "SIDIQ_LOAN_APPLICATION") {
            latest_application = data
          }
          if (data.type === "SIDIQ_REPAYMENT") {
            repaid_tranches++
          }
        } catch(e) {}
      }
    }

    if (!latest_application) return null

    const total = latest_application.total_amount_sdq || latest_application.total_amount_xrp
    const tranches = latest_application.tranches
    const current_tranche = repaid_tranches + 1
    const tranche_amount = Object.values(tranches)[repaid_tranches] || 0

    return {
      total_amount: total,
      purpose: latest_application.purpose,
      current_tranche,
      total_tranches: 4,
      tranche_amount,
      repaid_tranches,
      tranches
    }

  } catch(e) {
    console.log("getActiveLoan error:", e.message)
    await client.disconnect()
    return null
  }
}
// ============================================================
// LOAN APPLICATION
// ============================================================

async function submitLoanApplication(borrower_seed, amount_sdq, purpose) {
  const client = await connectToXRPL()
  const borrower = xrpl.Wallet.fromSeed(borrower_seed)

  const total = parseFloat(amount_sdq)
  const application = {
    type: "SIDIQ_LOAN_APPLICATION",
    borrower: borrower.classicAddress,
    pool_address: POOL_ADDRESS,
    total_amount_sdq: total,
    purpose: purpose,
    repayment_period_days: 60,
    tranches: {
      tranche_1: Math.round(total * 0.15 * 100) / 100,
      tranche_2: Math.round(total * 0.25 * 100) / 100,
      tranche_3: Math.round(total * 0.35 * 100) / 100,
      tranche_4: Math.round(total * 0.25 * 100) / 100
    },
    timestamp: new Date().toISOString()
  }

  const app_tx = {
    TransactionType: "AccountSet",
    Account: borrower.classicAddress,
    Memos: [{
      Memo: { MemoData: toHex(application) }
    }]
  }

  try {
    const prepared = await client.autofill(app_tx)
    const signed = borrower.sign(prepared)
    const result = await client.submitAndWait(signed.tx_blob)
    await client.disconnect()
    return {
      success: true,
      hash: result.result.hash,
      application
    }
  } catch(e) {
    await client.disconnect()
    return { success: false, error: e.message }
  }
}

// ============================================================
// LENDER CONTRIBUTION
// ============================================================

async function submitContribution(lender_seed, amount_sdq) {
  const client = await connectToXRPL()
  const lender = xrpl.Wallet.fromSeed(lender_seed)

  const contribution = {
    type: "SIDIQ_CONTRIBUTION",
    lender: lender.classicAddress,
    pool_address: POOL_ADDRESS,
    amount_sdq: parseFloat(amount_sdq),
    currency: "SDQ",
    timestamp: new Date().toISOString()
  }

  const payment = {
    TransactionType: "Payment",
    Account: lender.classicAddress,
    Destination: POOL_ADDRESS,
    Amount: {
      currency: "SDQ",
      issuer: SDQ_ISSUER,
      value: amount_sdq.toString()
    },
    Memos: [{
      Memo: { MemoData: toHex(contribution) }
    }]
  }

  try {
    const prepared = await client.autofill(payment)
    const signed = lender.sign(prepared)
    const result = await client.submitAndWait(signed.tx_blob)
    await client.disconnect()
    return {
      success: true,
      hash: result.result.hash
    }
  } catch(e) {
    await client.disconnect()
    return { success: false, error: e.message }
  }
}

// ============================================================
// REPAYMENT
// ============================================================

async function submitRepayment(borrower_seed, amount_sdq, tranche_number, current_score) {
  const client = await connectToXRPL()
  const borrower = xrpl.Wallet.fromSeed(borrower_seed)

  const repayment = {
    type: "SIDIQ_REPAYMENT",
    borrower: borrower.classicAddress,
    pool_address: POOL_ADDRESS,
    tranche_number: tranche_number,
    repayment_amount_sdq: parseFloat(amount_sdq),
    previous_reputation_score: current_score,
    reputation_change: "+10",
    new_reputation_score: Math.min(100, current_score + 10),
    next_tranche_unlocked: tranche_number < 4,
    timestamp: new Date().toISOString()
  }

  const payment = {
    TransactionType: "Payment",
    Account: borrower.classicAddress,
    Destination: POOL_ADDRESS,
    Amount: {
      currency: "SDQ",
      issuer: SDQ_ISSUER,
      value: amount_sdq.toString()
    },
    Memos: [{
      Memo: { MemoData: toHex(repayment) }
    }]
  }

  try {
    const prepared = await client.autofill(payment)
    const signed = borrower.sign(prepared)
    const result = await client.submitAndWait(signed.tx_blob)
    await client.disconnect()
    return {
      success: true,
      hash: result.result.hash,
      new_score: repayment.new_reputation_score
    }
  } catch(e) {
    await client.disconnect()
    return { success: false, error: e.message }
  }
}

// ============================================================
// VOUCHING
// ============================================================

async function submitVouch(voucher_seed, borrower_address) {
  const client = await connectToXRPL()
  const voucher = xrpl.Wallet.fromSeed(voucher_seed)

  const vouch = {
    type: "SIDIQ_VOUCH",
    voucher_address: voucher.classicAddress,
    borrower_address: borrower_address,
    statement: "I personally know this person and trust them to repay",
    timestamp: new Date().toISOString()
  }

  const payment = {
    TransactionType: "Payment",
    Account: voucher.classicAddress,
    Destination: borrower_address,
    Amount: {
      currency: "SDQ",
      issuer: SDQ_ISSUER,
      value: "1"
    },
    Memos: [{
      Memo: { MemoData: toHex(vouch) }
    }]
  }

  try {
    const prepared = await client.autofill(payment)
    const signed = voucher.sign(prepared)
    const result = await client.submitAndWait(signed.tx_blob)
    await client.disconnect()
    return {
      success: true,
      hash: result.result.hash
    }
  } catch(e) {
    await client.disconnect()
    return { success: false, error: e.message }
  }
}

// ============================================================
// DETERMINISTIC TEMPLATES
// Plain English summaries — no AI needed
// ============================================================

function loanSummary(loan) {
  if (!loan) return "No active loan found."
  return `You have applied for a ${loan.total_amount} SDQ loan for "${loan.purpose}". 
  Your loan will be released in ${loan.total_tranches} stages over 60 days. 
  First payment: ${loan.tranche_amount} SDQ released upon approval.`
}


function repaymentSummary(repayment) {
  return `
    Tranche ${repayment.tranche_number} of 4 repaid successfully.
    Amount: ${repayment.repayment_amount_sdq} SDQ returned to community pool.
    Your reputation score increased from ${repayment.previous_reputation_score}
    to ${repayment.new_reputation_score}.
    ${repayment.next_tranche_unlocked
      ? "Your next tranche is now available."
      : "Loan fully repaid. Well done."}
  `.trim()
}

function reputationSummary(reputation) {
  return `
    Reputation Score: ${reputation.score} / 100
    Trust Tier: ${reputation.tier}
    Repayments made: ${reputation.repayments}
    Community vouches received: ${reputation.vouches}
    Maximum borrowing limit: ${reputation.borrowing_limit} SDQ
  `.trim()
}

// ============================================================
// WALLET SESSION HELPERS
// Store and retrieve connected wallet from session
// ============================================================

function saveWalletSession(address, seed, role) {
  sessionStorage.setItem('sidiq_address', address)
  sessionStorage.setItem('sidiq_seed', seed)
  sessionStorage.setItem('sidiq_role', role)
}

function getWalletSession() {
  return {
    address: sessionStorage.getItem('sidiq_address'),
    seed:    sessionStorage.getItem('sidiq_seed'),
    role:    sessionStorage.getItem('sidiq_role')
  }
}

function clearWalletSession() {
  sessionStorage.removeItem('sidiq_address')
  sessionStorage.removeItem('sidiq_seed')
  sessionStorage.removeItem('sidiq_role')
}

function isConnected() {
  return !!sessionStorage.getItem('sidiq_address')
}