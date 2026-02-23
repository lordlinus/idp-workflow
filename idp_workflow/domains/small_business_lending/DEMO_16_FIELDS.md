# Small Business Lending - 16-Field Extraction Demo Guide

**Demo Objective:** Showcase how Intelligent Document Processing accelerates SBA 7(a) loan underwriting through intelligent dual extraction (Azure Document Intelligence + DSPy LLM), conflict resolution via HITL, and automated decision support.

**Sample Business:** TechFlow Solutions, LLC - Software consulting company requesting $450,000 SBA 7(a) working capital loan

**Expected Demo Duration:** 2 minutes processing + 1 minute narration = 3 minutes total

---

## SECTION 1: DEMO IMPACT STRATEGY

### Why Small Business Lending Matters

Small business loans represent one of the highest-value, highest-touch document processing workflows:

- **Volume:** 500,000+ SBA 7(a) loans approved annually in the US alone
- **Processing Time:** 45 minutes average manual review per application (financial analysis, collateral verification, calculations)
- **Cost:** ~$225 per application in processing labor
- **Error Rate:** 8-12% of applications require rework due to data entry or calculation errors
- **Approval Timeline:** 2-4 weeks from submission to decision

### The IDP Advantage for Business Lending

**Traditional Underwriting Workflow:**
```
Receive app (5 min) → Manual data entry (25 min) → Calculate ratios (10 min) → 
Review for consistency (5 min) → Decision memo (10 min) = 55 minutes total
High error risk at each step. Difficult to maintain consistency.
```

**IDP-Powered Workflow:**
```
Upload documents (2 min) → Dual extraction (30 sec) → Auto-calculation (15 sec) → 
Review conflicts if any (1-2 min) → Decision support (20 sec) = 4.5 minutes total
95%+ accuracy. Consistent decision framework. Audit trail for compliance.
```

### Key Differentiators for Business Lending

1. **DSCR Calculation is Everything** - Unlike home loans (DTI focus) or insurance claims (payment routing), business lending hinges on whether the company's cash flow can service the debt. DSCR (Debt Service Coverage Ratio) automation is the differentiator.
   - Required: DSCR > 1.25x
   - TechFlow example: DSCR = 4.87x (almost 4x the requirement)

2. **Multi-Page Financial Statements** - Business loans require P&L, balance sheet, and cash flow analysis. Extracting across multiple financial statement pages and reconciling them is complex.

3. **Owner Personal Guarantees Required** - Unlike home loans where the property is primary security, business loans require personal guarantees from owners. Must extract both business credit and owner credit scores.

4. **Collateral Mix is Diverse** - May include real estate (50% LTV), equipment (80% of depreciated value), A/R (75% of quality invoices). Calculating total collateral value requires multiple source documents.

### Quantified Business Case

**Assumptions:**
- Processing volume: 100 applications/month
- Manual processing time: 45 minutes per application
- Fully loaded labor cost: $40/hour
- IDP processing time: 4.5 minutes per application
- IDP cost per application: $12

**Monthly Financial Impact:**
- Manual labor cost: 100 apps × 45 min × ($40/60 min) = $3,000/month
- IDP cost: 100 apps × $12 = $1,200/month
- **Monthly Savings: $1,800**
- **Savings per Application: $18**
- **Annual Savings (1,200 apps): $21,600**

**Quality Impact:**
- Rework reduction: 10% × 45 min × $40/hr × 1,200 apps = $3,600 annual savings
- **Total Annual Value: $25,200**

---

## SECTION 2: THE 16 CRITICAL FIELDS

### Why These 16?

Small business lending underwriting requires answering 5 core questions:

1. **WHO is borrowing?** (Business identity + ownership)
2. **WHAT loan size is requested?** (Loan amount + purpose)
3. **CAN they repay?** (Revenue, profitability, cash flow)
4. **WHAT is their financial position?** (Assets, liabilities, liquidity)
5. **IS the loan secured?** (Personal credit + collateral)

The 16 fields map directly to these 5 questions, eliminating non-essential fields that slow down underwriting.

---

### FIELD 1: Business Name
**Type:** Text | **Method:** Extract | **Category:** Business Identity

**Why It Matters:**
- Verify correct legal entity is applying
- Cross-reference with business license, tax records

**What We Extract:**
- Official business name (TechFlow Solutions, LLC)
- DBA/Trade names if different

**Expected Conflicts:**
- None typically (very standardized)

**Demo Impact:** Establishes the business context immediately

---

### FIELD 2: EIN (Employer Identification Number)
**Type:** Text | **Method:** Extract | **Category:** Business Identity

**Why It Matters:**
- Unique business identifier
- Verify business is registered with IRS
- Pull business credit report

**What We Extract:**
- EIN in format XX-XXXXXXX (45-2876543)

**Expected Conflicts:**
- Format variations: "45-2876543" vs "452876543" vs "45/2876543"
- Azure OCR might read as different characters
- DSPy contextually recognizes from "EIN:" pattern

**Demo Impact:** Shows how extraction methods handle format variations differently

---

### FIELD 3: Business Type
**Type:** Text | **Method:** Extract | **Category:** Business Identity

**Why It Matters:**
- Understand industry and risk profile
- Industry-specific underwriting rules (construction more risky than services)
- Used for fraud detection

**What We Extract:**
- NAICS classification (541511 - Custom Computer Programming)
- Plain English description

**Expected Conflicts:**
- Azure might extract: "Software Development / Consulting"
- DSPy might extract: "IT consulting and software development services"
- Both correct but phrased differently

**Demo Impact:** Shows semantic extraction differences

---

### FIELD 4: Date Established
**Type:** Date | **Method:** Extract | **Category:** Business History

**Why It Matters:**
- Minimum 24 months operating history required for SBA
- Business age affects underwriting rigor (newer = more scrutiny)

**What We Extract:**
- Founding date (October 15, 2021)
- Business age calculation (3 years, 2 months ✓ meets requirement)

**Expected Conflicts:**
- Azure: "10/15/2021"
- DSPy: "October 15, 2021" → interpreted as "2021-10-15"
- None on the value, only formatting

**Demo Impact:** Date format standardization story

---

### FIELD 5: Loan Amount Requested
**Type:** Currency | **Method:** Extract | **Category:** Loan Request

**Why It Matters:**
- Determines loan program eligibility
- SBA 7(a) max is $5 million
- Affects pricing and guarantee percentage

**What We Extract:**
- $450,000 (from "Loan Amount Requested" field)

**Expected Conflicts:**
- Azure: "Four hundred fifty thousand dollars"
- DSPy: "$450,000"
- Or vice versa - different extraction styles

**Demo Impact:** Shows structured vs. narrative extraction

---

### FIELD 6: Loan Purpose
**Type:** Text | **Method:** Extract | **Category:** Loan Request

**Why It Matters:**
- Validates alignment between company needs and loan structure
- SBA prohibits certain purposes (speculation, debt refinancing, etc.)

**What We Extract:**
- "Working Capital and Equipment Purchase"
- Breakdown: $265k working capital, $120k servers, $65k software

**Expected Conflicts:**
- Azure might miss the breakdown and extract only headline
- DSPy contextually extracts detailed breakdown
- Or Azure more detailed, DSPy simpler

**Demo Impact:** Contextual extraction advantage for DSPy

---

### FIELD 7: Annual Revenue
**Type:** Currency | **Method:** Extract | **Category:** Financial Performance

**Why It Matters:**
- Determines revenue-to-loan ratio
- Supports cash flow analysis
- Fraud detection check (loans should be < 40% annual revenue)

**What We Extract:**
- $1,850,000 (2024 projected from P&L statement)

**Expected Conflicts:**
- Azure: Extracts from P&L "Gross Revenue" line = $1,850,000 ✓
- DSPy: Might also grab prior year from text = $1,420,000 (2023)
- CONFLICT: Which year's revenue to use?

**Demo Impact:** HITL resolution: "Use most recent year for underwriting decision"

---

### FIELD 8: Net Income
**Type:** Currency | **Method:** Extract | **Category:** Financial Performance

**Why It Matters:**
- Shows bottom-line profitability
- Used in DCF analysis if considering higher loan amounts
- Negative net income = major red flag

**What We Extract:**
- $377,000 (2024 projected net income)

**Expected Conflicts:**
- Azure extracts "Net Income" line from income statement = $377,000
- DSPy might interpret "Net Income (Bottom Line)" or just "Bottom Line" = $377,000
- Or Azure gets 2023 number ($298,000) from wrong section

**Demo Impact:** Multi-year financial document extraction complexity

---

### FIELD 9: EBITDA (Earnings Before Interest, Taxes, Depreciation, Amortization)
**Type:** Currency | **Method:** Extract | **Category:** Debt Service Capacity

**Why It Matters:**
- **Critical for DSCR calculation** - THE most important metric for business lending
- EBITDA = cash available to service debt (ignores taxes, financing decisions, depreciation quirks)
- Shows true operational cash generation

**What We Extract:**
- $470,000 (from P&L income statement)

**Expected Conflicts:**
- Azure: Extracts labeled line "EBITDA" = $470,000
- DSPy: Must calculate = Gross Profit ($1,065k) - Operating Expenses ($595k) = $470,000
- One extracted, one calculated - both correct but different source

**Demo Impact:** Shows automation of complex financial calculations

---

### FIELD 10: Total Monthly Debt Service
**Type:** Currency | **Method:** Extract | **Category:** Debt Obligations

**Why It Matters:**
- Input to DSCR calculation
- Shows existing obligations before new loan
- Used to understand total leverage

**What We Extract:**
- Existing: $1,450/month (equipment loan)
- Proposed: $6,582/month ($450k @ 6.75% / 84 months)
- **Total: $8,032/month**

**Expected Conflicts:**
- Azure: Extracts existing debt schedule = $1,450
- DSPy: Understands "proposed new loan payment" must be calculated = $6,582
- Azure doesn't know new loan payment calculation
- DSPy might estimate from rate/term context

**Demo Impact:** HITL reconciliation: "Combined monthly obligation is $8,032"

---

### FIELD 11: Total Assets
**Type:** Currency | **Method:** Extract | **Category:** Balance Sheet

**Why It Matters:**
- Measures overall financial position
- Supports loan sizing (asset-rich = less risky)
- Used in debt-to-equity calculation

**What We Extract:**
- $630,000 total assets
- Breakdown: Current assets $443k + Fixed assets $144k + Other assets $43k

**Expected Conflicts:**
- Azure: Sums balance sheet = $630,000
- DSPy: Might extract line items separately: $443k + $144k + $43k
- Both correct but different granularity

**Demo Impact:** Level of detail differences between extraction methods

---

### FIELD 12: Total Liabilities
**Type:** Currency | **Method:** Extract | **Category:** Balance Sheet

**Why It Matters:**
- Other side of leverage calculation
- Shows debt load relative to assets
- Used in debt-to-equity and debt-to-assets ratios

**What We Extract:**
- $190,000 total liabilities
- Breakdown: Current liabilities $155k + Long-term liabilities $35k

**Expected Conflicts:**
- Same as Total Assets - granularity differences

**Demo Impact:** Consistency check: Assets - Liabilities = Equity ($630k - $190k = $440k ✓)

---

### FIELD 13: Cash on Hand
**Type:** Currency | **Method:** Extract | **Category:** Liquidity

**Why It Matters:**
- Immediate liquidity assessment
- Shows ability to weather revenue disruptions
- May reduce loan size needed

**What We Extract:**
- $185,000 (from balance sheet current assets)

**Expected Conflicts:**
- Azure: Gets exact balance sheet line = $185,000
- DSPy: Might grab from bank statement month-end = $185,000
- Or DSPy gets "average cash balance" from bank summary = $178,000

**Demo Impact:** Document source matters for exact values

---

### FIELD 14: Primary Owner Name
**Type:** Text | **Method:** Extract | **Category:** Personal Guarantee

**Why It Matters:**
- Identifies guarantor for loan
- Cross-reference with personal credit report
- Personal liability for loan

**What We Extract:**
- "Jennifer Rodriguez" (CEO, 65% owner)

**Expected Conflicts:**
- Azure: Extracts as "Jennifer Rodriguez"
- DSPy: Extracts as "Jennifer M. Rodriguez" (sees middle initial in document)
- Or one extracts from section header, one from full legal name section

**Demo Impact:** Name variations across documents (application vs financial statement)

---

### FIELD 15: Primary Owner Credit Score
**Type:** Number | **Method:** Extract | **Category:** Personal Credit

**Why It Matters:**
- Personal credit score minimum: 650 (SBA requirement)
- Affects guarantee requirement strength
- Shows owner's personal creditworthiness

**What We Extract:**
- 748 (Jennifer's FICO from credit section)

**Expected Conflicts:**
- Azure: Extracts from credit section = 748
- DSPy: Might see multiple scores (FICO, Vantage, etc.) = confusion
- Or Azure gets "Credit Score (FICO): 748" correctly, DSPy extracts "748" from a different mention

**Demo Impact:** HITL clarity: "Using 748 FICO as the primary owner's credit score"

---

### FIELD 16: Collateral Value
**Type:** Currency | **Method:** Extract | **Category:** Loan Security

**Why It Matters:**
- Determines LTV (loan-to-value)
- SBA 7(a) requires collateral >= loan amount (can waive for amounts < $25k)
- Shows loan security level

**What We Extract:**
- Total: $825,000
- Breakdown:
  - Real estate equity: $1,200,000 (from appraisal minus mortgage)
  - Equipment: $145,000
  - A/R (75% of $240k): $180,000
  - **Total: $825,000**

**Expected Conflicts:**
- Azure: Extracts real estate equity line = $1,200,000 (assumes this is "collateral value")
- DSPy: Understands "total collateral" aggregates multiple types = $825,000
- OR Azure extracts each line item separately, DSPy sums them

**Demo Impact:** Most complex field - requires understanding multi-source collateral calculation

---

## SECTION 3: AUTO-CALCULATED METRICS

Once the 16 fields are extracted, the system automatically calculates these decision-support metrics:

### 1. DSCR (Debt Service Coverage Ratio)

```
DSCR = Annual EBITDA ÷ Annual Debt Service

TechFlow Example:
DSCR = $470,000 ÷ ($8,032 × 12 months)
DSCR = $470,000 ÷ $96,384
DSCR = 4.87x

Interpretation:
- Requirement: DSCR > 1.25x (loan serviceable)
- TechFlow: 4.87x (nearly 4× the requirement)
- Assessment: EXCELLENT - business generates nearly 5x the cash needed
```

**Demo Talking Point:**
"See how TechFlow's strong EBITDA of $470k can service the $8,032 monthly debt payment nearly 5 times over? That's a DSCR of 4.87 - far above the 1.25 minimum. This business could take on nearly 4× more debt before hitting the requirement threshold. That's the kind of cash flow strength banks love to see."

### 2. Debt-to-Equity Ratio

```
Debt-to-Equity = Total Liabilities ÷ Owners' Equity

TechFlow:
D/E = $190,000 ÷ $440,000 = 0.43 (or 43%)

Interpretation:
- Healthy range: 40-60% for services businesses
- TechFlow: 43% (right in the sweet spot)
- Assessment: CONSERVATIVE leverage, good financial stability
```

### 3. Current Ratio (Liquidity)

```
Current Ratio = Current Assets ÷ Current Liabilities

TechFlow:
Current Ratio = $443,000 ÷ $155,000 = 2.86x

Interpretation:
- Requirement: > 1.0x (can pay short-term obligations)
- TechFlow: 2.86x (strong liquidity cushion)
- Assessment: EXCELLENT - has nearly $3 of current assets for every $1 of current liabilities
```

### 4. Loan-to-Value (LTV) on Collateral

```
LTV = Proposed Loan ÷ Collateral Value

TechFlow (Real Estate):
LTV = $450,000 ÷ $2,800,000 = 16%

Interpretation:
- Typical max: 50% for real estate collateral
- TechFlow: 16% (extremely conservative)
- Assessment: ULTRA-SECURE - real estate alone covers loan 6× over
```

### 5. Business Age Check

```
Requirement: Minimum 24 months operating history
TechFlow: 3 years, 2 months ✓ MEETS requirement
```

### 6. Owner Credit Check

```
Jennifer (Primary): 748 FICO ✓ Exceeds 650 minimum
David (Secondary): 721 FICO ✓ Exceeds 650 minimum
Both owners have excellent personal credit
```

---

## SECTION 4: DEMO NARRATIVE (5 ACTS)

### Act 1: The Application (10 seconds)

**Narration:** "Let's walk through a real SBA 7(a) loan application for TechFlow Solutions. They're a software consulting company requesting $450,000 for working capital and new equipment."

**What's Happening:**
- Document upload showing 5-page application package
- P&L statement, balance sheet, owner financial statements visible

**Visual:** Drag-and-drop or file selection, showing PDF being processed

**Talking Point:** "This is a typical loan application package - about 12-15 pages in reality. Let's see how IDP handles it."

---

### Act 2: Dual Extraction (30 seconds)

**Narration:** "In parallel, our system is running two extraction engines. Azure Document Intelligence handles the structured financial statements - it's great at reading tables and forms. DSPy LLM reads for semantic meaning - understanding context and relationships."

**What's Happening:**
- Split-screen showing:
  - Left: Azure extraction flow (highlighted P&L line items, balance sheet rows)
  - Right: DSPy extraction flow (highlighting contextual text, owner guarantees, collateral descriptions)
- Progress bar or step indicator showing both engines working

**Visual:** Animated extraction overlays on document pages

**Talking Point:** 
"Azure is precision - it extracts exactly what the table says. DSPy is intelligence - it understands that 'proposed debt service is calculated as' and can derive values. Different approaches, same goal: get all 16 critical fields."

---

### Act 3: Field Comparison (15 seconds)

**Narration:** "Once both engines complete, we automatically compare results. Here are the 16 fields we extracted."

**What's Happening:**
- Table view showing:
  - Column 1: Field name
  - Column 2: Azure value
  - Column 3: DSPy value
  - Column 4: Status (✓ Match, ⚠ Conflict, ⓘ Review)

**Sample Results:**
| Field | Azure | DSPy | Status |
|-------|-------|------|--------|
| businessName | TechFlow Solutions, LLC | TechFlow Solutions, LLC | ✓ Match |
| annualRevenue | $1,850,000 | $1,850,000 | ✓ Match |
| netIncome | $377,000 | $377,000 | ✓ Match |
| EBITDA | $470,000 | $470,000 | ✓ Match |
| loanAmountRequested | $450,000 | $450,000 | ✓ Match |
| **totalMonthlyDebtService** | **$1,450** | **$8,032** | **⚠ Conflict** |
| primaryOwnerCreditScore | 748 | 748 | ✓ Match |
| collateralValue | $1,200,000 | $825,000 | ⚠ Conflict |

**Talking Point:**
"Look at this - 14 out of 16 fields matched perfectly. Only 2 conflicts:
1. Monthly debt service - Azure only saw existing debt ($1,450). DSPy understood the proposed new loan and calculated total ($8,032).
2. Collateral value - Azure grabbed real estate equity ($1,200k). DSPy understood we meant total collateral including equipment and A/R ($825k)."

---

### Act 4: Human-in-the-Loop Review (45 seconds)

**Narration:** "When there are conflicts, a lender reviews them in context. It takes about 45 seconds to resolve 2-3 conflicts."

**What's Happening:**
- HITL panel showing:
  - Left side: Document preview (highlighted relevant sections)
  - Right side: Conflict resolution interface

**Conflict 1: Monthly Debt Service**
```
Azure says: $1,450 (existing debt only)
DSPy says: $8,032 (existing + proposed)
Context from document clearly shows proposed loan @ 6.75% × 84 months = $6,582/month

Decision: ACCEPT DSPy value of $8,032 total monthly service
(This is correct for DSCR calculation)
```

**Conflict 2: Collateral Value**
```
Azure says: $1,200,000 (real estate equity)
DSPy says: $825,000 (real estate $600k + equipment $145k + A/R $180k)
Document shows: "Total Collateral Offered: $825,000"

Decision: ACCEPT DSPy value of $825,000 total collateral
```

**Talking Point:**
"A lender with 3-5 years of experience can resolve these in their sleep. 'Total monthly payment is $8,032 when we include the proposed loan.' 'Total collateral is the sum of all sources - $825k.' Done. Most applications have 0-3 conflicts. This one has 2 clear ones."

---

### Act 5: Auto-Calculated Metrics & Decision Support (20 seconds)

**Narration:** "Now comes the magic. Once we have clean extracted data, the system automatically calculates all the key underwriting metrics and generates decision support."

**What's Happening:**
- Metrics dashboard showing:

```
╔════════════════════════════════════════════════════════╗
║              UNDERWRITING METRICS                      ║
╠════════════════════════════════════════════════════════╣
║                                                        ║
║ DSCR (Debt Service Coverage Ratio):    4.87x ✓ STRONG║
║ Requirement: > 1.25x                                  ║
║ Assessment: Exceeds requirement by 290%               ║
║                                                        ║
║ Debt-to-Equity:                        43% ✓ HEALTHY  ║
║ Typical Range: 40-60%                                 ║
║ Assessment: Conservative leverage                     ║
║                                                        ║
║ Current Ratio:                         2.86x ✓ STRONG║
║ Requirement: > 1.0x                                   ║
║ Assessment: Excellent liquidity position              ║
║                                                        ║
║ Collateral Coverage:                   1.83x ✓ SECURE │
║ Loan Amount: $450,000                                 ║
║ Total Collateral: $825,000                            ║
║ Assessment: Real estate alone = $600k (133% of loan)  ║
║                                                        ║
║ Business Age:                          3.2 years ✓ OK │
║ Requirement: 24 months minimum                        ║
║ Assessment: Meets requirement                         ║
║                                                        ║
║ Owner Credit Strength:                 EXCELLENT      ║
║ Jennifer Rodriguez: 748 FICO ✓                        ║
║ David Park: 721 FICO ✓                                ║
║ Assessment: Both exceed 650 minimum by significant    ║
║            margin. Excellent personal guarantees.     ║
║                                                        ║
╚════════════════════════════════════════════════════════╝
```

**Decision Support Summary:**
```
RECOMMENDATION: APPROVE
═══════════════════════════════════════════════════════

✓ All 6 core underwriting metrics are STRONG
✓ DSCR of 4.87x is nearly 4× the minimum requirement
✓ Conservative leverage with healthy liquidity
✓ Excellent collateral coverage ($1.83× loan amount)
✓ Strong owner credit and guarantee strength
✓ Business demonstrates consistent growth and profitability

Risk Assessment: LOW
- Revenue growing 30% YoY
- Net margins stable at 20%+
- Cash position strengthening
- Only minor concentration risk in customer base

Suggested Loan Terms:
- Amount: $450,000 (as requested)
- Rate: 6.50% (strong credit, standard 7(a) program)
- Term: 84 months
- Guarantee: 75% SBA guarantee
- Collateral: First lien on real estate + equipment + A/R

Estimated Processing Time Saved: 40 minutes
Confidence Level: 98%+ (only 2 minor conflicts resolved via HITL)
```

**Talking Point:**
"Notice the metrics are automatically calculated and presented in a decision-ready format. The underwriter can see immediately that this is a strong credit with low risk. No more 'let me calculate the DSCR... let me sum the collateral... let me verify the debt-to-equity.' It's all there. Ready to decide in under 3 minutes instead of 45."

---

### Act 6: Business Impact (15 seconds)

**Narration:** "What does this mean in the real world?"

**What's Happening:**
- Side-by-side comparison timer:

```
MANUAL UNDERWRITING          IDP-POWERED UNDERWRITING
═══════════════════          ═════════════════════════

Receive application:    2 min  Upload documents:        1 min
Extract key data:      20 min  Dual extraction:         1 min
Validate numbers:       8 min  Auto-calculate metrics:  0.5 min
Create decision memo:  10 min  HITL review (if needed): 2 min
Review & approve:       5 min  Decision support:        0.5 min
                       ─────                           ─────
Total Time:           45 min   Total Time:             5 min

Errors Found:          2-3      Conflicts to Resolve:   1-2
(Rework required)      (5 min)  (Lender reviews in UI)  (auto-resolved)

Quality Score:         85%      Quality Score:          98%
Audit Trail:           Partial  Audit Trail:            Complete
Consistency:           Manual   Consistency:            Algorithmic
```

**Talking Points:**

**For Lender/Credit Manager:**
"We reduced processing time from 45 minutes to 5 minutes. At 100 applications per month, that's 4,000 minutes of labor saved. At $40/hour, that's $2,700/month or $32,400/year in pure labor savings. And the quality is better - 98% vs 85%. That means 95% fewer rework cycles."

**For Compliance/Risk Officer:**
"Every extraction is logged. Every conflict is documented. Why did we choose $8,032 monthly payment over $1,450? Because DSPy correctly understood it included the proposed loan. That audit trail is in the system forever. With manual processing, you might never know which calculation the loan officer used."

**For Executive/Board:**
"Small business lending is a core profit center. Our competitors take 2-3 weeks to approve loans because of manual underwriting delays. With IDP, we can approve in 2-3 days. That competitive advantage drives market share growth. Plus, we have fewer defaults because we're making better decisions with complete data, not partial data."

---

## SECTION 5: EXPECTED EXTRACTION CONFLICTS

Based on the TechFlow sample application, we expect 1-3 conflicts requiring HITL review:

### Conflict Type 1: Debt Service Calculation (LIKELY)

**Why It Happens:**
- Azure extracts existing debt service ($1,450) from debt schedule
- Azure doesn't calculate the proposed new loan payment
- DSPy contextually understands "proposed $450k @ 6.75% / 84 months" and calculates $6,582/month

**Azure Extracts:** $1,450 (existing only)  
**DSPy Extracts:** $8,032 (existing + proposed)  
**HITL Resolution:** Underwriter confirms "We need total debt service for DSCR = $8,032"

**Resolution Time:** 20 seconds

---

### Conflict Type 2: Collateral Value Interpretation (LIKELY)

**Why It Happens:**
- Azure sees "Real Estate Equity: $1,200,000" as main collateral line
- Azure might miss the breakdown showing equipment + A/R components
- DSPy reads "Total Collateral Offered: $825,000" explicitly

**Azure Extracts:** $1,200,000 (real estate only)  
**DSPy Extracts:** $825,000 (real estate $600k + equipment $145k + A/R $180k)  
**HITL Resolution:** Underwriter confirms "Total collateral is sum of all sources = $825,000 per the application"

**Resolution Time:** 20 seconds

---

### Conflict Type 3: Revenue Period Ambiguity (POSSIBLE)

**Why It Happens:**
- Document shows both 2023 revenue ($1,420,000) and 2024 YTD/projected ($1,850,000)
- Azure might grab 2023 from one section, DSPy from another
- Or vice versa depending on which document section appears first

**Azure Extracts:** $1,420,000 (2023 prior year)  
**DSPy Extracts:** $1,850,000 (2024 current year)  
**HITL Resolution:** Underwriter confirms "We use most recent year for underwriting = $1,850,000"

**Resolution Time:** 15 seconds

---

## SECTION 6: FIELD CATEGORIES & DECISION FRAMEWORK

The 16 fields naturally group into 5 decision categories:

### Category 1: Business Identity (Fields 1-3)
- businessName
- ein
- businessType

**Purpose:** Establish who is borrowing and what industry they're in  
**Underwriting Question:** "Is this a real, legitimate business?"  
**Decision Impact:** GATING - if not legitimate, loan is declined  
**Expected Accuracy:** 99%+ (very standardized)  
**HITL Frequency:** <5% (almost never conflicts)

---

### Category 2: Loan Structure (Fields 5-6)
- loanAmountRequested
- loanPurpose

**Purpose:** Understand what the loan is for and how much is needed  
**Underwriting Question:** "Is the loan size appropriate for the stated purpose?"  
**Decision Impact:** MODERATE - affects pricing and term structure  
**Expected Accuracy:** 95%+ (usually clear)  
**HITL Frequency:** 10-15% (occasionally need clarification on breakdown)

---

### Category 3: Business Financial Strength (Fields 7-9)
- annualRevenue
- netIncome
- EBITDA

**Purpose:** Understand how much money the business makes  
**Underwriting Question:** "Is this business profitable and growing?"  
**Decision Impact:** HIGH - primary income source for loan repayment  
**Expected Accuracy:** 92% (financial statements can be complex)  
**HITL Frequency:** 15-20% (may need to reconcile multiple statements)  
**Demo Value:** CRITICAL - these are the revenue/EBITDA that drive DSCR

---

### Category 4: Balance Sheet Position (Fields 11-13)
- totalAssets
- totalLiabilities
- cashOnHand

**Purpose:** Understand overall financial position and resources  
**Underwriting Question:** "Does this business have a solid balance sheet?"  
**Decision Impact:** MODERATE - secondary to cash flow for operations business  
**Expected Accuracy:** 94% (balance sheet arithmetic can help catch errors)  
**HITL Frequency:** 12-18% (often need to clarify which assets/liabilities included)  
**Demo Value:** MODERATE - show balance sheet reconciliation (Assets = Liabilities + Equity)

---

### Category 5: Repayment Capacity & Security (Fields 10, 14-16)
- totalMonthlyDebtService
- primaryOwnerName
- primaryOwnerCreditScore
- collateralValue

**Purpose:** Understand whether they can repay and what secures the loan  
**Underwriting Question:** "Can they repay? Will we recover if they don't?"  
**Decision Impact:** CRITICAL - determines loan decision  
**Expected Accuracy:** 88% (multiple sources, calculations, aggregations)  
**HITL Frequency:** 25-30% (MOST CONFLICT-PRONE - debt calculations, collateral aggregation)  
**Demo Value:** CRITICAL - DSCR and collateral coverage are deal-makers/breakers

---

## SECTION 7: KEY TALKING POINTS BY AUDIENCE

### For Credit Officers/Underwriters

**Problem They Have:**
"I'm drowning in spreadsheets. Every application is 12-15 pages. I manually type key numbers into my analysis template. Takes forever. I make typos. Sometimes I miss a number. Then I have to recalculate the DSCR or collateral coverage by hand."

**IDP Solution:**
"Your key 16 fields are automatically extracted with 98% accuracy. The calculations (DSCR, D/E ratio, LTV) are automatic. Conflicts are highlighted for quick resolution. You get a decision-ready summary in 5 minutes instead of 45. Quality goes UP while time goes DOWN."

**Proof Point (from TechFlow example):**
"See how TechFlow's DSCR of 4.87x was calculated automatically from EBITDA and monthly debt service? In the old workflow, you'd be punching this into Excel. Now it's calculated, verified, and presented. 40 minutes saved per application."

---

### For Portfolio Managers / Credit Committees

**Problem They Have:**
"I see 100 loans a month. I need consistency in how we underwrite. Some loan officers are stricter than others. I need to know our approval criteria are being applied uniformly."

**IDP Solution:**
"Every loan decision is based on the same 16 fields, the same 5 metrics (DSCR, D/E, Current Ratio, LTV, Business Age), and the same decision framework. No more 'different loan officers, different standards.' You get consistent risk assessment across your portfolio."

**Proof Point:**
"You can now pull a report: 'Show me all loans with DSCR < 2.0x' or 'Show me all loans with collateral coverage < 1.25x.' With manual processing, you can't measure consistency. With IDP, it's transparent. One number - DSCR 4.87x for TechFlow - tells you this is a strong credit."

---

### For Operations / Processing

**Problem They Have:**
"We have 100 applications per month. Each takes 45 minutes. That's 4,000 minutes of labor. At $40/hour, we spend $2,700/month on underwriting labor alone. Plus rework when loan officers find our data entry errors."

**IDP Solution:**
"Each application now takes 5 minutes of human time (HITL review of 1-2 conflicts). That's 500 minutes instead of 4,000. You save $2,100/month in labor cost. Plus, fewer rework cycles because extraction accuracy is 98% instead of 85%."

**Proof Point (ROI calculation):**
"At 100 loans/month:
- Labor savings: 100 × (40 min/loan ÷ 60) × $40/hour = $2,700/month = $32,400/year
- Rework reduction (10% rework rate): 100 × 0.10 × 45 min × $40/hour = $300/month = $3,600/year
- **Total savings: $36,000/year for 100 loans/month**
- IDP cost: ~100 × $12/loan = $1,200/month = $14,400/year
- **Net benefit: $21,600/year (60% ROI)**"

---

### For Compliance / Risk / Internal Audit

**Problem They Have:**
"Regulators ask us to prove we're underwriting consistently. When we look back at a loan file, we need to see what data was used for decisions. Manual processes leave gaps. 'Why did we approve this loan?' might be hard to answer."

**IDP Solution:**
"Every field extracted is logged. Every conflict and its resolution is logged. Every metric calculation is traceable. When regulators ask 'Show me how you approved this loan,' you can show them:
- Original documents uploaded ✓
- Field extraction (Azure vs DSPy) ✓
- Conflicts and HITL resolution ✓
- Calculated metrics ✓
- Decision recommendation ✓
Complete, transparent audit trail."

**Proof Point:**
"TechFlow loan file shows: DSCR 4.87x was calculated from EBITDA $470k and monthly debt $8,032. That $8,032 came from existing debt $1,450 + proposed debt $6,582. The $6,582 was calculated from $450k @ 6.75% / 84 months. All documented. Zero ambiguity."

---

### For Senior Leadership / Board

**Problem They Have:**
"Small business lending is strategic for us. We need to compete on speed AND quality. Competitors are taking 2-3 weeks to approve loans. Borrowers are choosing them because they're faster. We're slower but 'safer'? That's not enough."

**IDP Solution:**
"With IDP, you can approve in 2-3 business days while maintaining or IMPROVING quality. The speed comes from eliminating manual data entry and calculation delays. The quality comes from consistent, auditable decision framework. You win on both dimensions."

**Proof Point (Strategic):**
"Year 1: 100 applications/month, 95% approval rate = 95 new loans/month, $350M in new loan volume (at avg $45k per loan). With 3-week turnaround, that's competitive but not superior.

With IDP + 2-3 day approval:
- Same 95% approval rate
- Same 100 applications/month
- But 2-3x higher customer satisfaction
- Higher market share due to speed
- Potential to increase volume to 150-200 apps/month (demand is there, we were just slow)
- Estimated new loan volume: $525-$700M/year vs $350M
- $175-$350M in incremental volume at 3% margin = $5.25-$10.5M in incremental profit"

---

## SECTION 8: DEMO SUCCESS CRITERIA

**The demo is SUCCESSFUL if:**

✓ All 16 fields are extracted (even if 1-2 have conflicts)  
✓ DSCR is calculated correctly (4.87x for TechFlow)  
✓ At least one HITL conflict is shown and resolved (proves the human loop works)  
✓ Time elapsed is <3 minutes  
✓ Audience understands why these 16 fields matter (not just "we extract 16 fields")  
✓ Business impact is clear (40 min → 5 min, 85% → 98% accuracy, $36k/year savings for 100 loans)  
✓ Metrics are calculated automatically (not shown as manually entered)

---

**The demo MUST SHOW (minimum):**

1. Document upload (PDF or image of loan application)
2. Dual extraction in progress (Azure + DSPy side-by-side)
3. Conflict detection (2-3 fields with different values)
4. HITL resolution (underwriter clicks to resolve)
5. Auto-calculated metrics (DSCR 4.87x, D/E 43%, etc.)
6. Decision support (approval recommendation with justification)
7. Time elapsed display (5 minutes vs 45 minutes traditional)

---

## SECTION 9: COMPLEX EXTRACTION SHOWCASE

### Why Collateral Calculation is Hard (Complex Showcase)

Collateral value extraction is the most complex because:

**Challenge 1: Multiple Sources**
```
Document has sections:
- "Real Estate Collateral" → Appraisal value $2,800,000 
                          → Mortgage balance $1,600,000
                          → Equity available $1,200,000
                          → But we only take 50% LTV = $600,000

- "Equipment & Assets"  → List shows $145,000 total

- "Accounts Receivable" → Outstanding A/R $240,000
                        → Policy is 75% of quality invoices
                        → Collateral value: $180,000

- "Total Collateral"    → Sum = $600k + $145k + $180k = $825,000
```

**Challenge 2: Calculation vs Extraction**
- Real estate equity isn't just read (appraisal - mortgage = equity)
- Equipment isn't just appraisal (it's a list with items)
- A/R collateral requires applying a percentage (75%)
- Total is a sum of calculated components

**Challenge 3: Context-Dependent Values**
- Real estate "value" could be: appraised value OR equity OR LTV-adjusted value
- Equipment "value" could be: original cost OR depreciated value OR market value
- Need to understand which definition applies

**What Azure Does:**
```
Extracts:
- Appraised value: $2,800,000 ✓
- Mortgage: $1,600,000 ✓
- Equipment: $145,000 ✓
- A/R: $240,000 ✓

But doesn't understand:
- "Take 50% of $1,200,000 = $600,000 for real estate"
- "Apply 75% to A/R = $180,000"
- Sum = $825,000

Result: Might extract real estate equity ($1,200k) as "collateral value" - WRONG
```

**What DSPy Does:**
```
Reads narrative:
- "Real estate equity: $1,200,000"
- "Estimated collateral value (50% LTV on equity): $600,000"
- "Equipment: $145,000"
- "A/R collateral (75% of $240k): $180,000"
- "Total collateral offered: $825,000"

Understands:
- Different values are calculated differently
- Context ("for this loan, 50% LTV") matters
- Total is explicitly stated at bottom

Result: Extracts $825,000 as total collateral - CORRECT
```

**HITL Resolution:**
```
Underwriter sees conflict:
Azure: $1,200,000 (real estate equity)
DSPy: $825,000 (total collateral with mix)

Reviews document:
- Finds "Total Collateral Offered: $825,000" line
- Understands it's sum of: real estate $600k (50% LTV) + equipment $145k + A/R $180k

Accepts DSPy value because it matches the explicit total
Documents decision: "Collateral = $825,000 per applicant's stated total"
```

**Demo Talking Point:**
"This is where semantic extraction wins. Azure reads the parts. DSPy understands the whole. Total collateral is $825,000, and that's what we use for the LTV calculation. The underwriter reviews and confirms in about 20 seconds."

---

### Why DSCR Calculation is Critical (Complex Showcase #2)

DSCR is THE most important metric for business lending, and IDP automates it:

```
Manual Process:
1. Find EBITDA on P&L: $470,000
2. Find existing debt service in debt schedule: $1,450/month
3. Calculate proposed debt service: $450,000 ÷ rate ÷ term = $6,582/month
4. Add them: $1,450 + $6,582 = $8,032/month total
5. Annualize: $8,032 × 12 = $96,384/year
6. Calculate DSCR: $470,000 ÷ $96,384 = 4.87x
7. Look up requirement: > 1.25x
8. Assess: 4.87x >> 1.25x → PASS

Underwriter does this in 5-10 minutes, manual calculator required
Risk: Math errors, transcription errors, wrong figures used

IDP Process:
1. Extract EBITDA: $470,000 ✓
2. Extract existing debt service: $1,450 ✓
3. Extract/calculate proposed debt service: $6,582 ✓
4. Calculate total monthly: $8,032 ✓
5. Automatic DSCR: 4.87x ✓
6. Compare to requirement: 4.87x vs 1.25x ✓
7. Decision support: STRONG / WEAK / BORDERLINE

Completed in 30 seconds, zero math errors
```

**Demo Impact:**
"DSCR of 4.87x is calculated and presented instantly. The underwriter doesn't have to think - they see 'STRONG' in green. That's the power of automation: consistency, speed, accuracy."

---

## SECTION 10: EXPECTED DEMO OUTCOME

### For the Audience

By the end of this 3-minute demo, the audience should understand:

1. **Problem Identified:** Small business lending requires manual review of 16 critical financial and legal fields from 12-15 page applications. Current process takes 45 minutes per application and has 8-12% error/rework rate.

2. **Solution Demonstrated:** IDP with dual extraction engines (Azure + DSPy) + HITL conflict resolution + auto-calculated metrics.

3. **Results Quantified:**
   - Processing time: 45 min → 5 min (89% faster)
   - Accuracy: 85% → 98% (13 percentage point improvement)
   - Labor cost: $2,700/month → $900/month (67% savings at 100 apps/month)
   - Annual value: $36,000+ ROI

4. **Unique Insight:** DSCR (business-specific metric) is auto-calculated from extracted EBITDA and debt service. This is different from home loans (DTI) or insurance (payment split).

5. **Business Case Clarity:** Faster approvals = competitive advantage. Better decisions = lower defaults. Consistent underwriting = regulatory compliance.

### Post-Demo Questions to Expect

**Q: What if there are more than 2-3 conflicts?**  
A: Very rare in our experience. The TechFlow sample has 2 clear conflicts. If there are more, it usually means the document is poorly formatted or application is incomplete - in which case we'd flag it for applicant to resubmit.

**Q: Can you handle documents in other languages?**  
A: DSPy can, Azure Document Intelligence has multilingual support. For small business lending, you'd configure which languages (English, Spanish, Mandarin, etc.) and set up language-specific extraction rules.

**Q: How long does it take to configure for a new domain (like auto lending or equipment leasing)?**  
A: ~2-4 weeks per domain. You define the 16 key fields, the calculation rules, the validation thresholds, and provide 20-30 sample documents. The system learns the patterns.

**Q: Do you store customer documents?**  
A: No. By default, documents are processed and deleted. If audit trail is required (regulatory), you can enable encrypted storage with 7-year retention policy. Compliant with GLBA, FCRA, SOX depending on lender type.

**Q: How does this integrate with our existing LOS (Loan Origination System)?**  
A: API integration. Once fields are extracted and conflicts resolved, we send JSON payload to your LOS with all 16 fields + calculated metrics + confidence scores + HITL resolution notes. Your LOS then updates decision templates, pricing models, etc. as usual.

**Q: What's the confidence score I see in the outputs?**  
A: It's an aggregate based on: (1) agreement between Azure & DSPy (exact match = high confidence, conflict = lower), (2) field-specific difficulty (e.g., name extraction is usually 99% confident, collateral value might be 92% due to calculations), (3) document quality (clear scans = high, poor scans = lower).

---

## SECTION 11: COMPETITIVE ADVANTAGES

### vs Manual Underwriting
- 9× faster (45 min → 5 min)
- 98% vs 85% accuracy
- 67% cost reduction per application
- Audit trail and consistency

### vs Simple OCR Solutions
- Semantic understanding (DSPy) vs character recognition
- Automatic conflict detection (dual extraction)
- Calculation of complex metrics (DSCR, LTV, D/E)
- Business logic embedded (24-month minimum check, FICO score validation)

### vs Custom AI Models
- No machine learning training required (pre-trained models)
- No historical labeled data needed
- Works on day 1 (vs months of training)
- Generalizes to new business types (transfer learning)

---

## SECTION 12: NEXT STEPS IF CUSTOMER SHOWS INTEREST

1. **Pilot Program:** Run 50 real applications through IDP to validate in your environment
2. **Integration Planning:** Design API connection to your LOS
3. **User Training:** Credit officers learn the HITL interface
4. **Rollout:** Move to production, measure ROI

Expected timeline: 60-90 days from pilot start to production.

---

## APPENDIX: TechFlow Numbers at a Glance

| Metric | Value | Status |
|--------|-------|--------|
| **Business Age** | 3 years, 2 months | ✓ Meets 24-month min |
| **Annual Revenue** | $1,850,000 | ✓ Growing 30% YoY |
| **Net Income** | $377,000 | ✓ Strong profitability |
| **EBITDA** | $470,000 | ✓ Excellent cash flow |
| **Total Assets** | $630,000 | ✓ Solid balance sheet |
| **Total Liabilities** | $190,000 | ✓ Conservative |
| **Debt-to-Equity** | 43% | ✓ Healthy leverage |
| **Current Ratio** | 2.86x | ✓ Strong liquidity |
| **Cash on Hand** | $185,000 | ✓ Adequate reserves |
| **Existing Debt Service** | $1,450/month | Baseline |
| **Proposed Debt Service** | $6,582/month | $450k @ 6.75% / 84mo |
| **Total Monthly Debt** | $8,032/month | For DSCR calculation |
| **DSCR** | 4.87x | ✓✓ Far exceeds 1.25x min |
| **Total Collateral** | $825,000 | 1.83× loan coverage |
| **Real Estate LTV** | 16% | ✓ Extremely secure |
| **Owner 1 FICO** | 748 | ✓ Excellent |
| **Owner 2 FICO** | 721 | ✓ Excellent |

**Underwriting Assessment:** ✓ **STRONG APPROVAL** - All metrics excellent, low risk, excellent collateral coverage, strong owner guarantees.

---

## Conclusion

The 16-field Small Business Lending IDP demo proves that intelligent extraction + human oversight + auto-calculated metrics transforms underwriting from a manual, error-prone 45-minute process into a consistent, accurate 5-minute process with better decision quality.

The competitive advantage isn't just speed - it's the ability to scale quality underwriting without hiring more loan officers. That's how fintech companies are disrupting traditional lending.
