# Sidiq — Interest-Free Community Lending on XRPL

> *Sidiq (صدق) — Arabic for "the truthful". A decentralised interest-free micro-lending protocol built on the XRP Ledger, inspired by the Islamic principle of Qard Hasan (Interest-free lending).*

---

## What is Sidiq?

Sidiq is a decentralised micro-lending protocol built on the XRP Ledger that gives Muslim and underserved communities access to interest-free micro-loans — without charging interest.

Inspired by the Islamic principle of **Qard Hasan** — a benevolent loan given without expectation of profit — Sidiq replaces the centralised institution with a transparent, community-governed lending pool on the XRP Ledger. Every contribution, application, disbursement, and repayment is permanently and immutably recorded on chain.

---

## The Problem

- **1.8 billion Muslims** globally need access to credit but cannot use conventional interest-based lending due to religious principles
- Existing Islamic microfinance is expensive, opaque, and inaccessible to the informally employed
- The unbanked have no formal credit history and are excluded from both conventional and Islamic finance products
- Existing DeFi protocols are almost entirely interest-based and Sharia non-compliant
- Traditional Qard Hasan exists informally in communities but relies on personal trust with no accountability infrastructure — making it unscalable and vulnerable to abuse

---

## The Solution

Sidiq brings Qard Hasan on chain. Community members contribute SDQ tokens to a collective lending pool. Borrowers draw from it in tranches through XRPL native escrow with no interest charged. Every transaction is permanently recorded on the XRP Ledger, creating a fully auditable lending history that no single party can manipulate.

**One liner:** *Sidiq is a decentralised interest-free lending protocol on the XRP Ledger that gives Muslim and underserved communities access to community-backed micro-loans without charging interest.*

---

## XRPL Features Used

| Feature | How Sidiq Uses It |
|---|---|
| **Native Escrow** | Tranche-based loan disbursement — funds locked with FinishAfter and CancelAfter conditions |
| **Memo Transactions** | Permanent on-chain records for contributions, applications, repayments, and vouching |
| **Custom Token (SDQ)** | Sidiq Community Token issued via trust lines — used for all lending activity |
| **AccountSet** | Fee-free loan applications recorded on the borrower's wallet with zero XRP transfer |
| **Payment Transactions** | Lender contributions, borrower repayments, and community vouching (1 SDQ commitment fee) |
| **Reputation Engine** | Reads borrower transaction history and calculates trust score from on-chain memo data |

---

## Tech Stack

- **Blockchain:** XRP Ledger Testnet
- **Blockchain Library:** xrpl.js (Node.js for scripts, browser CDN for frontend)
- **Frontend:** Vanilla HTML, CSS, JavaScript
- **Custom Token:** SDQ issued via XRPL trust lines
- **Fonts:** Cinzel, Cormorant Garamond, Jost (Google Fonts)
- **Design:** Islamic geometric art aesthetic — navy, gold, turquoise palette

---

## Architecture
```
Landing Page (index.html)
    ↓ Connect Wallet (routes by address)
    ↓
Lender Dashboard (lender.html)     Borrower Dashboard (dashboard.html)
    ↓ Contribute SDQ                    ↓ View Active Loan
    ↓ Pool Balance Live                 ↓ Repay Tranche
    ↓ Contribution History              ↓ Reputation Score
                                        ↓ Transaction History
                    ↓
            Loan Application (apply.html)
                    ↓
            XRPL Testnet
            Pool Wallet → Escrow → Borrower Wallet
```

**Core components:**

- **Pool Wallet** — Community lending pool holding all SDQ contributions from lenders
- **Escrow** — Tranche-based disbursement locking funds until release conditions are met
- **Reputation Engine** — Reads on-chain memo history to calculate borrower trust score dynamically
- **Deterministic Templates** — Plain English loan summaries without AI dependency
- **SDQ Token** — Custom XRPL token with trust lines used for all lending activity

---

## Reputation System

Every borrower has an on-chain reputation score between 0 and 100:

| Event | Score Change |
|---|---|
| Successful tranche repayment | +10 |
| Community vouch received | +5 |
| Missed tranche | -20 |

| Tier | Score | Borrowing Limit |
|---|---|---|
| Newcomer | 0 — 59 | Score × 2 SDQ |
| Contributor | 60 — 79 | Score × 2 SDQ |
| Verified | 80 — 100 | Score × 2 SDQ |

Verified members earn governance voice — participating in dispute resolution and blind review panels for defaults.

---

## Demo Wallets

| Name | Role | Description |
|---|---|---|
| Amina Al-Hassan | Lender | Community member contributing to the pool |
| Fatima Malik | Borrower | Small business owner applying for a micro-loan |
| Khalid Ibrahim | Voucher | Community member vouching for Fatima |
| Sidiq Pool | Pool | Community lending pool wallet |

---

## Demo Flow

1. **Amina** connects wallet → routed to lender dashboard → contributes SDQ to the community pool
2. **Fatima** connects wallet → routed to borrower dashboard → views active loan and reputation score
3. Fatima clicks **Repay Now** → confirmation modal appears → confirms → transaction submitted to XRPL
4. Reputation score updates automatically from on-chain history
5. Transaction hash links directly to **testnet.xrpl.org** — proving real on-chain activity

---

## Project Structure
```
sidiq/
├── index.html              # Landing page with wallet connection
├── dashboard.html          # Borrower dashboard
├── lender.html             # Lender dashboard  
├── apply.html              # Loan application form
├── sidiq.js                # Browser-compatible XRPL functions
├── setup_wallet.js         # Pool wallet creation
├── demo_setup.js           # Creates demo community with seeded history
├── create_sdq_token.js     # Issues SDQ custom token to demo wallets
├── escrow_disburse.js      # Creates tranche escrow from pool to borrower
├── escrow_finish.js        # Borrower claims escrow after release time
├── loan_application.js     # Submits loan application via AccountSet
├── repayment.js            # Records repayment with reputation update
├── vouch.js                # Community member vouches for borrower
├── reputation_engine.js    # Calculates reputation score from on-chain history
├── README.md               # This file
├── pattern_1.jpg           # Islamic art background (carved arabesque)
├── patter_2.jpg            # Islamic geometric tilework
├── patter_3.jpg            # Mughal interior
└── pattern_4.jpg           # Persian dome ceiling
```

---

## Limitations & Future Vision

**Current limitations:**
- XRP volatility makes real-world loan denomination challenging — acknowledged as a current constraint
- Tranche automation is manual for MVP — a backend listener or Flare smart contract would automate this in production
- Single Asset Vault amendment not yet active on testnet — described as future architecture

**Future roadmap:**
- **Single Asset Vaults** — When amendment activates, migrate pool to native XRPL vault with automatic share issuance for lenders
- **RLUSD Migration** — Denominate loans in RLUSD via Single Asset Vaults to eliminate volatility risk
- **Flare Smart Contracts** — Automate tranche releases when repayment conditions are confirmed on XRPL
- **DID Integration** — Production KYC layer using XRPL Decentralised Identifiers
- **Payment Channels** — Future optimisation for bilateral progressive fund release
- **Zakat Charity Pool** — Micro-fee on disbursements accumulating in charity escrow for those who don't qualify for loans
- **Governance Panels** — Blind review panels for defaults with conflict of interest protections
- **Open Banking Integration** — Optional credit score baseline for users with formal banking history

---

## Qard Hasan Principle

> *"The best of you are those who are best in repayment."*
> — Prophet Muhammad ﷺ

Sidiq does not replace the human spirit of Qard Hasan. It gives it infrastructure.

---

## Important Security Note

All wallet seeds in this repository are placeholders. **Never commit real wallet seeds to a public repository.** Replace all placeholder values with your actual testnet seeds when running locally.

---

## Built During

XRPL Student Builder Residency — April 2026
University of Birmingham — MSc Fintech
