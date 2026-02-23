# Trade Finance Documentary Credit - 16-Field Extraction Demo Guide

**Demo Objective:** Showcase how Intelligent Document Processing accelerates Letter of Credit (LC) compliance verification through intelligent dual extraction (Azure Document Intelligence + DSPy LLM), automated compliance checking, and human-in-the-loop conflict resolution.

**Sample Transaction:** Zava Electronics Distribution Pte Ltd importing smart home controllers and IoT sensors from Zava Manufacturing (HK) via irrevocable confirmed LC worth USD 485,750

**Expected Demo Duration:** 3 minutes processing + 1 minute narration = 4 minutes total

---

## SECTION 1: DEMO IMPACT STRATEGY

### Why Trade Finance Matters

Letters of Credit (LC) are critical for international trade:

- **Volume:** 1.5+ million LCs issued annually worldwide; worth ~$750 billion+ in annual trade value
- **Processing Time:** 60-90 minutes average manual review per LC (document gathering, verification, compliance checks)
- **Cost:** ~$400-600 per LC in processing labor (bank staff + compliance reviews)
- **Error Rate:** 10-15% of LC submissions have document discrepancies requiring amendment or resubmission (costs 2-3 weeks delay per correction)
- **Approval Timeline:** 5-10 business days from document submission to payment disbursement

### The IDP Advantage for Trade Finance

**Traditional LC Review Workflow:**
```
Receive documents (5 min) → Manual LC review (15 min) → Amount reconciliation (10 min) → 
Party verification (10 min) → Compliance checks (15 min) → Create approval memo (10 min) → 
Authorize payment (5 min) = 70 minutes total

High error risk: documents might be re-read multiple times, calculations rechecked, 
party names compared manually across 6-8 different documents.
```

**IDP-Powered Workflow:**
```
Upload documents (2 min) → Dual extraction (1 min) → Auto-validation (30 sec) → 
HITL conflict review if needed (2-3 min) → Payment authorization (1 min) = 6-7 minutes total

95%+ accuracy with audit trail. Consistent compliance framework. Zero transcription errors.
```

### Key Differentiators for Trade Finance

1. **Strict Compliance is Non-Negotiable** - Unlike home loans (underwriting decision) or insurance claims (benefit calculation), trade finance has binary rules: documents either comply with LC terms or they don't. A single violation = automatic payment rejection.
   - Amount must match within ±5% tolerance
   - Shipment must be on/before latest shipment date
   - Expiry must not be breached
   - Parties must match
   - Documents must be clean (no adverse clauses on B/L)

2. **Multi-Document Reconciliation is Complex** - A typical LC transaction has 6-8 documents (LC itself, invoice, B/L, cert of origin, insurance, packing list, inspection cert). Each must be cross-referenced.
   - Invoice amount must reconcile to LC amount
   - B/L shipper must match invoice seller
   - B/L consignee must align with LC applicant
   - Dates must sequence correctly

3. **Sanctions & Compliance Screening is Critical** - Every international trade transaction must be screened against:
   - OFAC sanctions lists (US Treasury)
   - Denied parties lists
   - Restricted countries
   - Dual-use goods control

### Quantified Business Case

**Assumptions:**
- Processing volume: 50 LCs per week (2,600 per year)
- Manual processing time: 75 minutes per LC
- Fully loaded labor cost: $50/hour (bank specialist)
- IDP processing time: 7 minutes per LC
- IDP cost per LC: $25

**Weekly Financial Impact:**
- Manual labor cost: 50 LCs × 75 min × ($50/60 min) = $3,125/week
- IDP cost: 50 LCs × $25 = $1,250/week
- **Weekly Savings: $1,875**
- **Monthly Savings: $8,100**
- **Annual Savings: $97,500 (pure labor savings)**

**Quality Impact:**
- Document discrepancies caught: 10-15% of submissions
- Rework/amendment cycles: 2-3 weeks average delay
- Rework cost: 50 × 0.125 × 75 min × ($50/60 min) per week = ~$391/week
- **Additional quality savings: $20,350/year**

**Total Annual Value: $117,850 (for 2,600 LCs/year)**

**Competitive Speed Advantage:**
- Traditional bank: 5-10 business days to approval + payment
- IDP-powered bank: 1-2 business days to approval + payment
- **Speed differential = major competitive advantage in international trade**

---

## SECTION 2: THE 16 CRITICAL FIELDS

### Why These 16?

Trade finance underwriting requires answering 5 core questions:

1. **WHO is transacting?** (Buyer, seller, banks)
2. **WHAT is the LC worth?** (Amount, currency, tolerance)
3. **WHAT is being shipped?** (Goods, quantities, origin)
4. **IS the shipment compliant?** (Date, transport docs, origin)
5. **WHEN are deadlines?** (LC expiry, shipment date, presentation window)

The 16 fields map directly to these 5 questions, eliminating non-essential fields (like specific freight rates, insurance policy details, or container seal numbers) that don't affect the core payment decision.

---

### FIELD 1: LC Number
**Type:** Text | **Method:** Extract | **Category:** LC Identity

**Why It Matters:**
- Unique identifier for the transaction
- Links all supporting documents together
- Reference for all communications

**What We Extract:**
- LC-ZIB-2024-98756 (from LC document header)

**Expected Conflicts:**
- None typically (highly standardized format)

**Demo Impact:** Establishes transaction context and document linkage

---

### FIELD 2: LC Type
**Type:** Text | **Method:** Extract | **Category:** LC Identity

**Why It Matters:**
- Determines payment guarantee strength
- Affects seller's risk level
- Options: Irrevocable, Confirmed, Transferable, Standby

**What We Extract:**
- "Irrevocable Confirmed" (from LC terms)

**Expected Conflicts:**
- Azure might extract just "Irrevocable"
- DSPy contextually extracts both "Irrevocable" AND "Confirmed" from full sentence
- Difference: Confirmed status means advising bank also guarantees payment

**Demo Impact:** Shows semantic extraction difference; "Confirmed" status has significant payment security implications

---

### FIELD 3: Issuing Bank
**Type:** Text | **Method:** Extract | **Category:** Parties

**Why It Matters:**
- Bank that guarantees payment (critical for payment certainty)
- Bank reputation and credit rating determine transaction risk
- SWIFT code used for payment authorization

**What We Extract:**
- "Zava International Bank, Singapore, SWIFT: ZIBASGSG"

**Expected Conflicts:**
- Azure extracts bank name from one location
- DSPy extracts bank name + address + SWIFT code from structured section
- Completeness varies but name always matches

**Demo Impact:** Shows extraction completeness variations; SWIFT code is critical for payment processing

---

### FIELD 4: Beneficiary
**Type:** Text | **Method:** Extract | **Category:** Parties

**Why It Matters:**
- Seller/exporter who receives the payment
- Must exactly match invoice seller (verification check)
- Critical for fraud detection

**What We Extract:**
- "Zava Manufacturing (HK) Limited, Unit 2801, 28/F Trade Center Building, 789 Nathan Road, Kowloon, Hong Kong SAR"

**Expected Conflicts:**
- Azure: Exact match from "Beneficiary" section in LC
- DSPy: Might also include full address details vs just name
- Name consistency is key (address details are secondary)

**Demo Impact:** Party verification (beneficiary in LC must match seller in invoice)

---

### FIELD 5: Applicant
**Type:** Text | **Method:** Extract | **Category:** Parties

**Why It Matters:**
- Buyer/importer who requested the LC
- Creditworthiness check required (KYC - Know Your Customer)
- Used for sanctions and compliance screening

**What We Extract:**
- "Zava Electronics Distribution Pte Ltd, 123 Innovation Hub Drive, 15-01 Tech Tower, Singapore 138632"

**Expected Conflicts:**
- Azure: Name + city only
- DSPy: Full address including postal code
- Difference is detail level, not substance

**Demo Impact:** Compliance and KYC verification (applicant must pass sanctions screening)

---

### FIELD 6: LC Amount
**Type:** Currency | **Method:** Extract | **Category:** Financial Terms

**Why It Matters:**
- Total amount the bank will guarantee payment for
- Maximum payment ceiling
- Must match invoice amount within ±5% tolerance

**What We Extract:**
- USD 485,750.00 (from LC document)

**Expected Conflicts:**
- ⚠ **LIKELY CONFLICT** - This is where the major demo conflict appears
- Azure: Extracts LC amount = USD 485,750
- Invoice amount (from commercial invoice) = USD 581,750
- **CONFLICT:** Invoice EXCEEDS LC amount by USD 96,000 (19.8% over)
- Tolerance is only ±5% so this is a serious compliance violation

**Demo Impact:** **CRITICAL CONFLICT** - Shows amount reconciliation failure; requires HITL decision

---

### FIELD 7: LC Currency
**Type:** Text | **Method:** Extract | **Category:** Financial Terms

**Why It Matters:**
- Currency of the LC (USD, EUR, GBP, CNY, SGD, etc.)
- Must match invoice currency (mismatch requires bank amendment)
- Affects FX risk assessment

**What We Extract:**
- "USD" (from LC document)

**Expected Conflicts:**
- Usually none (highly standardized)
- Currency symbols sometimes read as letters by OCR

**Demo Impact:** Currency validation and consistency check across documents

---

### FIELD 8: LC Expiry Date
**Type:** Date | **Method:** Extract | **Category:** Compliance Deadlines

**Why It Matters:**
- Final date by which documents can be presented to the bank
- Critical deadline - expired LC cannot be negotiated
- Non-compliance is automatic rejection

**What We Extract:**
- 18-MAR-2025 (from LC document)

**Expected Conflicts:**
- Azure: Extracts "March 18, 2025"
- DSPy: Extracts "18-MAR-2025" or "2025-03-18"
- Format variations but same value
- Verification needed: Is current date before expiry? (Must be yes for validity)

**Demo Impact:** Compliance deadline verification (prevents expired LC negotiation)

---

### FIELD 9: Latest Shipment Date
**Type:** Date | **Method:** Extract | **Category:** Compliance Deadlines

**Why It Matters:**
- Last date by which goods must be shipped on board
- Shipment date on B/L must be on or before this date
- Non-compliance = LC condition violated

**What We Extract:**
- 28-FEB-2025 (from LC document)

**Expected Conflicts:**
- Format variations same as expiry date
- Comparison needed: B/L shipped on board date (20-FEB-2025) must be ≤ latest shipment date (28-FEB-2025)
- In sample: 20-FEB is BEFORE 28-FEB ✓ COMPLIANT

**Demo Impact:** Timeliness verification (ensures shipment occurred within agreed window)

---

### FIELD 10: Invoice Number
**Type:** Text | **Method:** Extract | **Category:** Documents

**Why It Matters:**
- Commercial invoice number from seller
- Must reference LC number (creates document linkage)
- Used for invoice-to-LC reconciliation

**What We Extract:**
- "ZM-HK-2024-5678" (from commercial invoice)

**Expected Conflicts:**
- Usually none (standardized format)

**Demo Impact:** Document linkage and invoice identification

---

### FIELD 11: Total Invoice Amount
**Type:** Currency | **Method:** Extract | **Category:** Financial Terms

**Why It Matters:**
- Total invoice value (CIF or FOB depending on Incoterms)
- Must match LC amount within ±5% tolerance
- **THIS IS THE MAJOR DEMO CONFLICT**

**What We Extract:**
- USD 581,750.00 (from commercial invoice CIF total)

**Expected Conflicts:**
- **⚠⚠ CRITICAL CONFLICT FIELD ⚠⚠**
- LC Amount: USD 485,750
- Invoice Amount: USD 581,750
- **MISMATCH:** Invoice exceeds LC by USD 96,000 (19.8% over tolerance)
- **Status:** REQUIRES IMMEDIATE HITL REVIEW
- This is not a formatting issue - it's a real business/compliance problem

**Demo Impact:** **PRIMARY CONFLICT** - Amount validation failure triggers HITL escalation

---

### FIELD 12: Invoice Currency
**Type:** Text | **Method:** Extract | **Category:** Financial Terms

**Why It Matters:**
- Currency of invoice amount
- Must match LC currency
- Mismatch requires bank amendment

**What We Extract:**
- "USD" (from invoice)

**Expected Conflicts:**
- Usually none (matches LC currency in this case)

**Demo Impact:** Currency consistency validation

---

### FIELD 13: Bill of Lading Number
**Type:** Text | **Method:** Extract | **Category:** Transport Documents

**Why It Matters:**
- Proof of shipment and goods custody
- Essential document for payment negotiation
- Shows cargo is on board vessel

**What We Extract:**
- "ZSL-HK-2024-45678" (from B/L header)

**Expected Conflicts:**
- Usually none (highly standardized)

**Demo Impact:** Transport document identification and authenticity

---

### FIELD 14: Shipped On Board Date
**Type:** Date | **Method:** Extract | **Category:** Transport Documents

**Why It Matters:**
- Actual date goods were loaded on vessel
- Must be on or before "Latest Shipment Date" from LC
- Determines start of document presentation window

**What We Extract:**
- 20-FEB-2025 (from B/L)

**Expected Conflicts:**
- Format variations (20-FEB-2025 vs FEB-20-2025 vs 2025-02-20)
- Verification: 20-FEB-2025 must be ≤ 28-FEB-2025 (latest shipment date)
- Sample: ✓ COMPLIANT (20-FEB is before 28-FEB)

**Demo Impact:** Timeliness and compliance window verification

---

### FIELD 15: Country of Origin
**Type:** Text | **Method:** Extract | **Category:** Compliance

**Why It Matters:**
- Country where goods were manufactured
- Required for customs, tariffs, and trade preferences
- **Critical for sanctions and restricted country screening**

**What We Extract:**
- "Hong Kong Special Administrative Region" (from Certificate of Origin)

**Expected Conflicts:**
- Hong Kong vs HK SAR vs Hong Kong SAR (various abbreviations)
- No substantive conflict, just formatting
- Sanctions check: Hong Kong is not on OFAC restricted list ✓

**Demo Impact:** Sanctions/compliance screening (automated check against restricted countries)

---

### FIELD 16: Incoterms
**Type:** Text | **Method:** Extract | **Category:** Financial Terms

**Why It Matters:**
- Trade terms defining cost and risk allocation (FOB, CIF, CFR, DAP, etc.)
- Determines who pays freight and insurance
- Affects invoice total and payment timing
- Must be consistent across LC, invoice, and B/L

**What We Extract:**
- "CIF Singapore" (Cost, Insurance, and Freight)
- Interpretation: Seller pays for goods, freight, and insurance to Singapore. Risk transfers at Hong Kong port of loading.

**Expected Conflicts:**
- Azure: Might extract just "CIF"
- DSPy: Extracts "CIF Singapore" (with named place)
- Difference: Named place is critical (CIF Singapore vs CIF Manila = different freight terms)

**Demo Impact:** Trade terms consistency and cost allocation verification

---

## SECTION 3: AUTO-CALCULATED VALIDATIONS

Once the 16 fields are extracted, the system automatically validates compliance:

### 1. Amount Tolerance Check

```
LC Amount:            USD 485,750.00
Tolerance:            ±5%
Acceptable Range:     USD 461,462.50 to USD 510,037.50

Invoice Amount:       USD 581,750.00

RESULT:               EXCEEDS TOLERANCE
Variance:             +USD 96,000.00 (+19.8%)

Status:               ❌ NON-COMPLIANT - REQUIRES AMENDMENT
Recommendation:       Either:
                      a) Invoice amount must be reduced to match LC
                      b) LC must be amended to increase amount
                      c) Partial shipment documentation must be provided
```

**Demo Talking Point:**
"The amount validation is automatic. The system sees LC amount $485,750, sees invoice amount $581,750, calculates the tolerance window ($461k-$510k), and immediately flags: NON-COMPLIANT. This is exactly where human judgment comes in. A trade finance specialist reviews and decides: 'We need to contact the applicant (buyer) - either reduce the shipment or amend the LC.' That decision would take 10-15 minutes of manual phone calls and emails in the old process. Here, it's flagged instantly."

---

### 2. Shipment Date Compliance

```
Latest Shipment Date (per LC):  28-FEB-2025
Shipped On Board Date (per B/L): 20-FEB-2025

Verification:       20-FEB-2025 ≤ 28-FEB-2025?
Result:             ✓ YES - COMPLIANT

Status:             ✓ PASS - Shipment was timely
```

---

### 3. Expiry Window Check

```
LC Expiry Date:             18-MAR-2025
B/L Date:                   20-FEB-2025
Latest Presentation Date:   15 days after B/L = 7-MAR-2025
Verification:               7-MAR-2025 ≤ 18-MAR-2025?
Result:                     ✓ YES - Within validity window

Status:                     ✓ PASS - Documents can be presented in time
```

---

### 4. Party Consistency Check

```
LC Beneficiary:             Zava Manufacturing (HK) Limited
Invoice Seller:             Zava Manufacturing (HK) Limited
B/L Shipper:                Zava Manufacturing (HK) Limited

Fuzzy Match Score:          99.2% (exact match)

Status:                     ✓ PASS - Seller identity consistent
```

---

### 5. Currency Consistency Check

```
LC Currency:                USD
Invoice Currency:           USD
B/L Freight Currency:       USD

All Match?                  ✓ YES

Status:                     ✓ PASS - No FX discrepancies
```

---

### 6. Incoterms Validation

```
LC Incoterms:               CIF Singapore
Invoice Incoterms:          CIF Singapore
B/L Port of Discharge:      Singapore Port Authority

Verification:               Terms align with discharge port?
Result:                     ✓ YES

Status:                     ✓ PASS - Trade terms consistent
```

---

### 7. Compliance Summary Dashboard

```
╔═══════════════════════════════════════════════════════════════╗
║              LC COMPLIANCE VERIFICATION RESULTS               ║
╠═══════════════════════════════════════════════════════════════╣
║                                                               ║
║  ✓ Party Verification:           PASS (beneficiary match)    ║
║  ✓ Shipment Timeliness:          PASS (20-FEB ≤ 28-FEB)     ║
║  ✓ LC Expiry:                    PASS (expires 18-MAR-2025)  ║
║  ✓ Presentation Window:          PASS (7-days before expiry) ║
║  ✓ Currency Consistency:         PASS (all USD)              ║
║  ✓ Incoterms Validation:         PASS (CIF Singapore)        ║
║  ❌ AMOUNT COMPLIANCE:           FAIL - EXCEEDS TOLERANCE    ║
║     Invoice ($581,750) > LC ($485,750 + 5%)                 ║
║     Variance: +$96,000 (19.8%)                              ║
║  ✓ Clean B/L:                    PASS (no adverse clauses)   ║
║  ✓ Country Sanctions:            PASS (HK not restricted)    ║
║                                                               ║
║  OVERALL DECISION:               CONDITIONAL PASS            ║
║  Status:                         AMOUNT AMENDMENT REQUIRED   ║
║                                                               ║
║  Recommendation:                 Contact applicant for       ║
║                                  LC amendment or goods       ║
║                                  adjustment before payment.  ║
║                                                               ║
╚═══════════════════════════════════════════════════════════════╝
```

---

## SECTION 4: DEMO NARRATIVE (5 ACTS)

### Act 1: Document Upload (2 minutes)

**Narration:** "Let's walk through a real international trade transaction. Zava Electronics in Singapore imported smart home controllers and IoT sensors from their supplier in Hong Kong. The sale is covered by a Letter of Credit issued by Zava International Bank. We have 8 documents here - the LC itself, commercial invoice, bill of lading, packing list, certificate of origin, insurance certificate, and inspection report. This is a typical LC transaction package."

**What's Happening:**
- Screen shows multiple PDF documents being uploaded (stacked or carousel view)
- Document types labeled: LC, Invoice, B/L, Cert of Origin, etc.
- Progress indicator showing upload completion

**Visual:** File upload interface, document count, total page count

**Talking Point:** "In a manual process, a trade finance specialist would now spend 15-20 minutes just reading through these documents, making notes, organizing information. They'd have a checklist of things to verify. Let's see how IDP handles it automatically."

---

### Act 2: Dual Extraction (1 minute)

**Narration:** "Our system runs two extraction engines in parallel. Azure Document Intelligence handles the structured parts - it's excellent at reading forms, tables, and fields. DSPy LLM reads for context and meaning - understanding what the document is saying, not just what it literally says."

**What's Happening:**
- Split-screen animation:
  - Left: Azure extraction highlighting form fields, amounts, dates, names
  - Right: DSPy extraction highlighting context, party relationships, compliance conditions

**Sample Highlights:**
- Azure: Highlights "$485,750" in LC amount field
- DSPy: Highlights "Invoice amount $581,750" and contextually understands "±5% tolerance"
- Azure: Extracts "Zava Manufacturing (HK) Limited" as shipper
- DSPy: Understands this is the "beneficiary" and matches to invoice seller

**Visual:** Animated overlays on document pages showing extraction happening

**Talking Point:** 
"Notice Azure is pure extraction - it gets the explicit values. DSPy adds intelligence - it understands the relationships and rules. When you combine them, you get coverage and comprehension. This is how we avoid missing important nuances."

---

### Act 3: Field Comparison & Conflict Detection (1 minute)

**Narration:** "Once both extraction engines finish, we compare results. Here are the 16 critical fields we extracted."

**What's Happening:**
- Table view showing all 16 fields with results:

| Field | LC Value | Invoice/B/L Value | Status |
|-------|----------|------------------|--------|
| lcNumber | LC-ZIB-2024-98756 | LC-ZIB-2024-98756 | ✓ Match |
| lcType | Irrevocable Confirmed | (from LC) | ✓ Match |
| issuingBank | Zava International Bank | (from LC) | ✓ Match |
| beneficiary | Zava Manufacturing (HK) | Zava Manufacturing (HK) | ✓ Match |
| applicant | Zava Electronics Dist. | Zava Electronics Dist. | ✓ Match |
| lcAmount | USD 485,750 | USD 485,750 | ✓ Match |
| lcCurrency | USD | USD | ✓ Match |
| expiryDate | 18-MAR-2025 | (from LC) | ✓ Match |
| latestShipmentDate | 28-FEB-2025 | 20-FEB-2025 shipped | ✓ Compliant |
| invoiceNumber | ZM-HK-2024-5678 | ZM-HK-2024-5678 | ✓ Match |
| **totalInvoiceAmount** | **LC: 485,750** | **Invoice: 581,750** | **❌ CONFLICT** |
| invoiceCurrency | USD | USD | ✓ Match |
| blNumber | ZSL-HK-2024-45678 | ZSL-HK-2024-45678 | ✓ Match |
| shippedOnBoardDate | 20-FEB-2025 | 20-FEB-2025 | ✓ Match |
| countryOfOrigin | Hong Kong | Hong Kong | ✓ Match |
| incoterms | CIF Singapore | CIF Singapore | ✓ Match |

**Status Summary:**
- 15 fields match or are compliant ✓
- 1 field has a critical conflict ❌

**Talking Point:**
"Look at this - 15 out of 16 fields are perfectly aligned. One critical conflict: the invoice amount is $581,750 but the LC only covers $485,750. That's a $96,000 difference - way outside the ±5% tolerance. This is exactly where human expertise comes in."

---

### Act 4: HITL Review & Conflict Resolution (2-3 minutes)

**Narration:** "When there's a conflict, the trade finance specialist reviews it in context. This takes about 2-3 minutes. The system has already identified the problem and provided all the relevant information."

**What's Happening:**
- HITL panel showing:
  - Left: Document preview (invoice and LC side-by-side, amounts highlighted)
  - Right: Conflict resolution interface

**The Conflict: Amount Discrepancy**

```
┌─────────────────────────────────────────────────────────┐
│ AMOUNT RECONCILIATION CONFLICT                          │
├─────────────────────────────────────────────────────────┤
│                                                         │
│ LC Amount (maximum bank will pay):                      │
│ USD 485,750.00                                          │
│                                                         │
│ Invoice Amount (what seller is billing):               │
│ USD 581,750.00                                          │
│                                                         │
│ Difference:                                             │
│ +USD 96,000.00 (19.8% over LC amount)                  │
│                                                         │
│ Tolerance Limit:                                        │
│ ±5% = USD 461,462.50 to USD 510,037.50                │
│                                                         │
│ Status:                                                 │
│ ❌ EXCEEDS TOLERANCE - NON-COMPLIANT                   │
│                                                         │
├─────────────────────────────────────────────────────────┤
│ DECISION OPTIONS:                                       │
│                                                         │
│ ○ Option 1: Invoice is correct, needs LC amendment     │
│   Action: Ask applicant to request amendment from      │
│           issuing bank (2-5 day process)              │
│                                                         │
│ ○ Option 2: LC is the target, reduce shipment         │
│   Action: Request partial shipment docs; adjust        │
│           quantities to match LC amount               │
│                                                         │
│ ○ Option 3: Pricing error in invoice                  │
│   Action: Request corrected invoice from beneficiary   │
│                                                         │
│ Selected: ☑ Option 1 - LC Amendment Required          │
│                                                         │
│ Next Step: Email applicant with amendment request     │
│           Expected timeline: 3-5 business days        │
└─────────────────────────────────────────────────────────┘
```

**Talking Point:**
"Here's where the real value of a trade finance specialist shows. The system says 'problem: amount mismatch.' The human says 'here's why it happened and here's what we do about it.' Could be legitimate - maybe the seller added packaging costs, maybe the buyer agreed to pay more. Or maybe it's a data entry error. The specialist knows their buyer and seller, knows the market, and makes the call: 'Request an LC amendment.' That decision is made in 30 seconds instead of 10 minutes of manual review."

---

### Act 5: Compliance Dashboard & Payment Authorization (1 minute)

**Narration:** "With the amount discrepancy identified and a path to resolution, the system shows the compliance status."

**What's Happening:**
- Dashboard showing:

```
╔════════════════════════════════════════════════════════════╗
║            LC PAYMENT AUTHORIZATION DASHBOARD              ║
╠════════════════════════════════════════════════════════════╣
║                                                            ║
║  Transaction: LC-ZIB-2024-98756                           ║
║  Beneficiary: Zava Manufacturing (HK) Limited             ║
║  Amount: USD 485,750.00 (pending amendment)               ║
║  Status: CONDITIONAL APPROVAL                             ║
║                                                            ║
║  ✓ Party Verification:        PASS                        ║
║    Beneficiary matched across LC, invoice, B/L            ║
║                                                            ║
║  ✓ Shipment Timeliness:       PASS                        ║
║    B/L dated 20-FEB (before latest shipment 28-FEB)      ║
║                                                            ║
║  ✓ LC Validity:               PASS                        ║
║    Expires 18-MAR (11 days margin)                        ║
║                                                            ║
║  ✓ Transport Documents:       PASS                        ║
║    Clean on board B/L received                            ║
║                                                            ║
║  ✓ Sanctions Screening:       PASS                        ║
║    Hong Kong not on restricted list                       ║
║    Parties not on OFAC SDN list                           ║
║                                                            ║
║  ⏳ Amount Adjustment:        PENDING                      ║
║    Awaiting LC amendment or corrected invoice             ║
║    Timeline: 3-5 business days expected                   ║
║                                                            ║
║  ✓ Insurance Coverage:        PASS                        ║
║    Marine insurance certificate present                   ║
║    Coverage adequate for shipment value                   ║
║                                                            ║
║  NEXT STEP:                                               ║
║  [→ Request LC Amendment] [→ Expedite Shipping] [→ Pause] │
║                                                            ║
╚════════════════════════════════════════════════════════════╝
```

**Talking Point:**
"Once the amount issue is resolved, everything else is ready for payment. The system has verified parties, shipment timeliness, document authenticity, insurance coverage - all automatically. The specialist can now confidently authorize payment knowing all compliance boxes are checked. In a manual process, you'd still be verifying these items by hand. Here, they're done."

---

## SECTION 5: EXPECTED EXTRACTION CONFLICTS

Based on the Zava Electronics sample LC package, we expect 1-2 conflicts requiring HITL review:

### Conflict Type 1: Amount Discrepancy (CRITICAL - EXPECTED)

**Why It Happens:**
- LC shows maximum amount: USD 485,750
- Invoice shows total amount: USD 581,750
- Different documents, different perspectives

**Azure Extracts:** USD 485,750 (from LC)  
**DSPy Extracts:** USD 581,750 (from invoice)  

**Root Cause:**
- Could be legitimate (goods added later)
- Could be error (pricing miscalculation)
- Could be pricing negotiation (buyer agreed to pay more)

**HITL Resolution:**
"Invoice amount ($581,750) exceeds LC amount ($485,750) by 19.8%. Outside ±5% tolerance. Request LC amendment from issuing bank or corrected invoice from beneficiary."

**Resolution Time:** 30-45 seconds (decision made; email drafted)

---

### Conflict Type 2: LC Type Interpretation (LIKELY)

**Why It Happens:**
- LC terms include "Irrevocable" AND "Confirmed"
- Azure might extract just one

**Azure Extracts:** "Irrevocable"  
**DSPy Extracts:** "Irrevocable Confirmed"  

**Why It Matters:**
- "Confirmed" means advising bank also guarantees payment (additional security)
- Affects risk assessment and payment certainty

**HITL Resolution:**
"LC is both irrevocable AND confirmed. Confirmed status provides additional payment guarantee from advising bank. Seller has excellent payment security."

**Resolution Time:** 15 seconds (information confirmed)

---

### Conflict Type 3: Party Name Variations (POSSIBLE)

**Why It Happens:**
- Different documents might reference party slightly differently
- Legal name vs trading name
- Abbreviations vs full name

**Example:**
- LC: "Zava Manufacturing (HK) Limited"
- Invoice: "Zava Manufacturing HK Ltd"
- B/L: "ZAVA MFG HK"

**Azure Extracts:** Different versions from each document  
**DSPy Extracts:** Understands these are the same entity with fuzzy matching

**HITL Resolution:**
"All refer to same entity - Zava Manufacturing (HK) Limited. Fuzzy match score: 96%. Party verification passed."

**Resolution Time:** 10 seconds (confirmation)

---

## SECTION 6: FIELD CATEGORIES & DECISION FRAMEWORK

The 16 fields naturally group into 6 decision categories:

### Category 1: LC Identity (2 fields)
- lcNumber, lcType

**Purpose:** Establish the transaction and its payment terms  
**Underwriting Question:** "Is this a valid, irrevocable LC?"  
**Decision Impact:** GATING - if not valid, transaction cannot proceed  
**Expected Accuracy:** 99%+ (highly standardized)  
**HITL Frequency:** <5% (rarely conflicts)

---

### Category 2: Parties (3 fields)
- issuingBank, beneficiary, applicant

**Purpose:** Identify who is transacting and verify identities  
**Underwriting Question:** "Are all parties legitimate and verified?"  
**Decision Impact:** HIGH - party verification is critical for fraud detection  
**Expected Accuracy:** 95%+ (name variations common)  
**HITL Frequency:** 10-15% (name format variations)

**Risk Assessment Dimension:**
- Issuing bank rating determines transaction risk
- Beneficiary identity tied to credit history
- Applicant subject to sanctions screening

---

### Category 3: Financial Terms (4 fields)
- lcAmount, lcCurrency, totalInvoiceAmount, invoiceCurrency

**Purpose:** Verify amounts and currencies match per LC terms  
**Underwriting Question:** "Does invoice amount match LC amount within tolerance?"  
**Decision Impact:** CRITICAL - amount mismatch = automatic rejection  
**Expected Accuracy:** 92% (calculation variations)  
**HITL Frequency:** 20-25% (MOST CONFLICT-PRONE)

**Compliance Rules:**
- Invoice must be ≤ LC amount
- Tolerance is ±5% only
- Currency must match exactly

---

### Category 4: Compliance Deadlines (2 fields)
- expiryDate, latestShipmentDate

**Purpose:** Verify transaction is within valid timelines  
**Underwriting Question:** "Is shipment date compliant? Is LC still valid?"  
**Decision Impact:** CRITICAL - non-compliance = payment rejection  
**Expected Accuracy:** 98% (dates are precise)  
**HITL Frequency:** <5% (dates are unambiguous)

**Validation Rules:**
- Shipped on board date ≤ latest shipment date
- Document presentation date within 15 days of B/L date
- All dates before LC expiry

---

### Category 5: Transport Documents (2 fields)
- blNumber, shippedOnBoardDate

**Purpose:** Verify shipment occurred and document is authentic  
**Underwriting Question:** "Is shipment documented? Is B/L clean and timely?"  
**Decision Impact:** HIGH - B/L is required document for payment  
**Expected Accuracy:** 99% (highly structured)  
**HITL Frequency:** <5% (rarely conflicts)

---

### Category 6: Trade Terms (3 fields)
- countryOfOrigin, incoterms, (beneficiary/applicant locations)

**Purpose:** Verify legal compliance and trade terms alignment  
**Underwriting Question:** "Is this trade legally compliant? Are terms consistent?"  
**Decision Impact:** MODERATE - compliance check, tariff assessment  
**Expected Accuracy:** 96% (origin certification required)  
**HITL Frequency:** 5-10% (restrictions/sanctions check)

**Compliance Checks:**
- Country of origin screening (sanctions, restricted countries)
- Incoterms validation (CIF Singapore matched to actual discharge port)
- Dual-use goods screening

---

## SECTION 7: KEY TALKING POINTS BY AUDIENCE

### For Trade Finance Specialists / LC Officers

**Problem They Have:**
"I review 5-8 LCs a day. Each one takes 60-90 minutes. I have a checklist of things to verify: amounts, parties, dates, documents. I take notes, cross-reference, use a calculator for tolerance checks. Sometimes I miss things. Last week I almost missed that a B/L was dated AFTER the latest shipment date. That would have been a non-compliant payment."

**IDP Solution:**
"Your 16 critical fields are extracted automatically from all documents with 95%+ accuracy. The system checks all compliance rules instantly: amount tolerance, shipment timeliness, party consistency, sanctions screening. Conflicts are highlighted for quick review. You go from 75-minute manual review to 5-minute decision review."

**Proof Point (from Zava example):**
"The system immediately spotted that the invoice amount ($581,750) exceeded the LC amount ($485,750) by 19.8% - way outside the 5% tolerance. That's exactly the type of subtle-but-critical issue that gets missed in manual processing. Here, it's flagged in seconds."

---

### For Trade Finance Managers / Compliance Officers

**Problem They Have:**
"We process 50+ LCs per week. I need consistency in how we verify documents. Some officers are more thorough than others. I need to ensure we never pay on non-compliant documents - that's a bank loss. I also need audit trails for regulatory review."

**IDP Solution:**
"Every LC is reviewed by the same 16-field framework with the same compliance rules. No more inconsistency between officers. Every extraction, every validation, every HITL decision is logged with timestamps. You get consistent risk assessment AND complete audit trail."

**Proof Point:**
"You can now generate reports like 'Show me all LCs where amount exceeded tolerance' or 'Show me all transactions with sanctions-restricted countries.' With manual processing, that data doesn't exist in searchable form. With IDP, it's all documented and queryable."

---

### For Operations / Back Office

**Problem They Have:**
"We handle document processing for LCs. Each transaction generates 6-8 documents that need to be organized, scanned, filed, and tracked. If documents are missing, we send emails to clarify. Processing is slow and error-prone."

**IDP Solution:**
"All documents are automatically extracted into a structured format. Missing required documents are identified immediately. Filing is automatic. Status is immediately visible to all parties. You go from manual filing to automated document management."

**Proof Point (ROI):**
"At 50 LCs/week:
- Manual review: 75 min × 50 = 3,750 min/week = 63 hours/week
- IDP-powered review: 7 min × 50 = 350 min/week = 6 hours/week
- Time saved: 57 hours/week = $2,850/week in labor cost
- Annual savings: $148,200 (for 50 LCs/week volume)"

---

### For Executive / Board / Sales

**Problem They Have:**
"Trade finance is a commodity business. Every bank offers LCs. The differentiator is speed and reliability. Customers want fast approvals. We're currently at 5-10 business days. Competitors are also slow, so we're not losing deals yet. But this is strategic - speed = competitive advantage."

**IDP Solution:**
"With IDP, we can approve LCs in 1-2 business days instead of 5-10. That's a 5x speed improvement. Customers experience fast, transparent, compliant approvals. We become the preferred bank for import-export businesses that value speed."

**Proof Point (Strategic):**
"Year 1: With current 5-10 day approval timeline, assume 2,600 LCs/year at $10k profit per LC = $26M in annual profit.

With IDP + 1-2 day approvals:
- Same 2,600 LCs assume 20% volume increase due to speed reputation = 3,120 LCs
- Assume 5% margin improvement (reduced rework, fewer amendments) = $10.5k profit per LC
- New profit: 3,120 × $10,500 = $32.76M annual profit
- **Incremental profit: $6.76M/year**

IDP cost (including setup): ~$400k year 1, $150k/year recurring
**ROI: 1,594% year 1; ongoing ROI: 4,400%+**"

---

## SECTION 8: DEMO SUCCESS CRITERIA

**The demo is SUCCESSFUL if:**

✓ All 16 fields are extracted from multi-page, multi-document LC package (LC, invoice, B/L, cert of origin minimum)  
✓ Amount conflict is clearly identified ($581,750 invoice vs $485,750 LC)  
✓ Compliance validations are shown (date checks, party verification, sanctions screening)  
✓ HITL review demonstrates human judgment on amount conflict  
✓ Time elapsed is 4-5 minutes total  
✓ Audience understands why these 16 fields matter (not just "we extract 16 fields")  
✓ Business impact is clear (60-90 min → 5-7 min processing, consistency, audit trail)  
✓ Conflict resolution path is clear (LC amendment vs goods adjustment vs corrected invoice)

---

**The demo MUST SHOW (minimum):**

1. Multi-document upload (LC, invoice, B/L, cert of origin)
2. Dual extraction engines running (Azure + DSPy)
3. Conflict detection (amount mismatch: $581,750 vs $485,750)
4. HITL resolution (specialist decides: request LC amendment)
5. Compliance validation checks (shipment date, expiry, parties, sanctions)
6. Payment authorization decision (conditional approval pending amendment)
7. Time elapsed display (90 minutes manual vs 5 minutes IDP)

---

## SECTION 9: COMPLEX EXTRACTION SHOWCASE

### Why Amount Reconciliation is Hard (Complex Showcase #1)

Amount extraction appears simple but is actually complex:

**Challenge 1: Multiple Amount References**
```
Document has various amounts:
- LC header: "Amount: USD 485,750.00"
- Invoice subtotal (FOB): $590,500.00
- Invoice freight: $12,500.00
- Invoice with discount: $575,500.00
- Invoice CIF total: $581,750.00
- All four are "in" the document
- Which one is "the amount" we should extract?
```

**Challenge 2: Tolerance Rules**
```
"Invoice Amount Must Not Exceed LC Amount"
AND
"Tolerance is +/- 5% of LC Amount"

This requires:
1. Understanding LC amount ($485,750)
2. Understanding tolerance rule (±5%)
3. Calculating acceptable range ($461,462.50 to $510,037.50)
4. Understanding which invoice amount applies (CIF? FOB? net of discount?)
5. Comparing invoice amount to acceptable range
6. Determining compliance (invoice at $581,750 exceeds range)
```

**Challenge 3: Document Sources**
```
- Azure reads invoice document, sees CIF line item $581,750
- Azure extracts: $581,750

- DSPy reads LC terms about tolerance, understands rules
- DSPy reads invoice, sees FOB $590,500 and CIF $581,750
- DSPy understands context: which is the "binding" amount?
- DSPy calculates: CIF is the invoice total to compare to LC

Both extract numbers, but which is "correct" for compliance purposes?
That's why HITL review is needed.
```

**What Azure Does:**
```
✓ Extracts numeric amounts accurately: $485,750 and $581,750
✗ Doesn't understand tolerance rules
✗ Doesn't calculate acceptable range
✗ Doesn't flag non-compliance
Result: Two numbers extracted, but no analysis
```

**What DSPy Does:**
```
✓ Understands "tolerance is ±5%"
✓ Understands "invoice must not exceed LC"
✓ Contextually identifies which amount is the "invoice total"
✓ Could flag non-compliance
✗ Might not extract the raw numeric values as precisely
Result: Analysis and flagging, but might miss exact amounts
```

**HITL Resolution:**
```
Specialist sees both amounts, sees they don't match, understands why.
Decides: "Invoice total is $581,750. LC is $485,750. Variance is $96,000.
This exceeds 5% tolerance by a lot. Request LC amendment from applicant
or corrected invoice from beneficiary. Mark as 'amendment pending'."

Time: 30 seconds for experienced specialist
```

**Demo Impact:**
"This is why we use BOTH extraction engines. Azure gives us precision. DSPy gives us comprehension. Together, they surface issues that a human specialist can then resolve intelligently."

---

### Why Party Matching is Complex (Complex Showcase #2)

Party verification seems simple but has multiple data quality issues:

```
LC says:           "Beneficiary: Zava Manufacturing (HK) Limited"
Invoice says:      "Seller: ZAVA MANUFACTURING HK LIMITED"
B/L says:          "Shipper: Zava Mfg (HK) Ltd"
Cert of Origin:    "Exporter: Zava Manufacturing (Hong Kong) Limited"

Are these the same party?
Azure:   Might see 4 different entities (exact string matching)
DSPy:    Fuzzy match recognizes all variants of same company

Correct answer: YES, all refer to same entity
Fuzzy score: 94% similarity (exceeds 85% threshold)
Result: ✓ PASS - Party verified
```

**Why It Matters:**
- If shipper doesn't match LC beneficiary, payment might be rejected
- Manual process: 5-10 minutes comparing names across documents
- IDP process: Automatic fuzzy matching in 2 seconds

---

## SECTION 10: COMPETITIVE ADVANTAGES

### vs Manual Review
- 12-15× faster (90 min → 5-7 min)
- 98%+ accuracy vs 85% accuracy
- 100% consistency (same rules applied to every LC)
- Complete audit trail
- Zero transcription errors

### vs Simple OCR Solutions
- Semantic understanding (DSPy) vs character recognition
- Rule-based validation (compliance checks) not just extraction
- Automatic conflict detection
- Business logic embedded (±5% tolerance, sanctions screening)
- Multi-document reconciliation

### vs Custom AI Models
- No machine learning training required
- Works immediately on day 1 (vs 6-12 months training)
- No historical labeled data needed
- Generalizes across different LC formats
- Compliant with bank regulatory requirements (explainable, auditable)

---

## SECTION 11: NEXT STEPS IF CUSTOMER SHOWS INTEREST

1. **Pilot Program:** Process 100 real LCs through IDP to validate in your environment
2. **Integration Planning:** Design API connection to your LC management system
3. **Compliance Review:** Ensure extraction and validation meets regulatory requirements (SWIFT, UCP 600)
4. **Officer Training:** Train LC officers on HITL interface and conflict resolution
5. **Rollout:** Gradual migration to production, measure time/cost savings

Expected timeline: 60-90 days from pilot start to production

---

## SECTION 12: TRADE FINANCE METRICS AT A GLANCE

| Metric | Sample LC (Zava) | Status |
|--------|-----------------|--------|
| **LC Number** | LC-ZIB-2024-98756 | ✓ Unique identifier |
| **LC Type** | Irrevocable Confirmed | ✓ Full payment guarantee |
| **Amount** | USD 485,750 | ✓ Clear commitment |
| **Currency** | USD | ✓ Standard for trade |
| **Issued By** | Zava International Bank | ✓ Tier-1 bank |
| **Beneficiary** | Zava Manufacturing (HK) | ✓ Matches invoice seller |
| **Applicant** | Zava Electronics Dist. | ✓ Buyer identity verified |
| **Expiry Date** | 18-MAR-2025 | ✓ 11 days margin |
| **Latest Ship Date** | 28-FEB-2025 | ✓ Compliant (B/L: 20-FEB) |
| **Incoterms** | CIF Singapore | ✓ Seller pays freight |
| **B/L Number** | ZSL-HK-2024-45678 | ✓ Proof of shipment |
| **Shipped On Board** | 20-FEB-2025 | ✓ Timely |
| **Country of Origin** | Hong Kong | ✓ Not restricted |
| **Goods** | Smart home controllers | ✓ HS codes valid |
| **Qty** | 2,500 + 1,800 units | ✓ Inventory listed |
| **Invoice Amount** | $581,750 (CIF) | **⚠ Exceeds LC** |
| **⚠ ISSUE** | Amount exceeds tolerance | ❌ Amendment required |

**Underwriting Decision:** CONDITIONAL APPROVAL - Payment holds pending LC amendment or goods adjustment to bring invoice within ±5% tolerance of LC amount.

---

## Conclusion

The 16-field Trade Finance IDP demo proves that intelligent extraction + business rule validation + human judgment transforms LC review from a tedious 75-90 minute manual process into a 5-7 minute decision-support process with better accuracy and complete auditability.

The competitive advantage isn't just speed - it's the ability to process more transactions with better quality and zero errors. For banks, that's the path to market leadership in trade finance.

For customers (importers/exporters), faster LC approvals mean faster payment, faster goods delivery, and competitive advantage in their own businesses.
