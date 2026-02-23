# Home Loan IDP Demo - 16 Critical Fields

## 🎯 Demo Impact Strategy

This demo showcases **complete loan underwriting automation** by extracting the 16 most critical decision points from mortgage application documents. Each field demonstrates real business value and risk assessment capabilities.

---

## 📊 The 16 Critical Fields

### 1️⃣ BORROWER IDENTITY

| Field | Type | Sample Value | Business Impact |
|-------|------|--------------|-----------------|
| **borrowerName** | string | Marcus Johnson | Identity verification, application matching, fraud detection |

**Demo Talking Point:** "First, we verify WHO is applying - critical for KYC compliance and fraud prevention."

---

### 2️⃣ PROPERTY INFORMATION

| Field | Type | Sample Value | Business Impact |
|-------|------|--------------|-----------------|
| **propertyAddress** | string | 2345 Maple Avenue, San Francisco, CA 94115 | Asset identification, location risk assessment, comparable sales analysis |

**Demo Talking Point:** "Next, WHAT asset are we financing - location drives risk profiles and property values."

---

### 3️⃣ LOAN STRUCTURE (3 fields)

| Field | Type | Sample Value | Business Impact |
|-------|------|--------------|-----------------|
| **loanAmount** | number | $850,000 | Exposure amount, product eligibility (jumbo vs conforming) |
| **loanType** | string | Conventional - Zava Prime Fixed Rate | Determines underwriting guidelines, MI requirements, investor eligibility |
| **interestRate** | number | 6.75% | Pricing accuracy, profitability calculation, affordability assessment |

**Demo Talking Point:** "HOW MUCH and on WHAT TERMS - determines if this fits our product matrix and profitability targets."

---

### 4️⃣ PROPERTY VALUATION (3 fields)

| Field | Type | Sample Value | Business Impact |
|-------|------|--------------|-----------------|
| **purchasePrice** | number | $1,050,000 | Buyer's negotiated price, market condition indicator |
| **appraisedValue** | number | $1,075,000 | Independent market value for LTV calculation |
| **downPaymentAmount** | number | $200,000 (19.05%) | Borrower equity stake, reduced risk exposure |

**Calculated Metric:** Loan-to-Value (LTV) = $850,000 / $1,075,000 = **79.07%** ✓

**Demo Talking Point:** "COLLATERAL VALUE - if borrower defaults, can we recover our investment? LTV under 80% means no PMI required."

---

### 5️⃣ INCOME QUALIFICATION (3 fields)

| Field | Type | Sample Value | Business Impact |
|-------|------|--------------|-----------------|
| **employerName** | string | Zava Technology Solutions | Income source stability, reputation verification |
| **monthlyIncome** | number | $31,500 | Primary qualification metric for payment capacity |
| **annualIncome** | number | $378,000 | Income trend analysis, bonus/commission stability |

**Demo Talking Point:** "CAN THEY AFFORD IT? Monthly income of $31,500 vs estimated PITI payment of $6,238 = 19.8% housing ratio."

---

### 6️⃣ DEBT & CREDIT ANALYSIS (2 fields)

| Field | Type | Sample Value | Business Impact |
|-------|------|--------------|-----------------|
| **totalMonthlyDebt** | number | $3,905 | All monthly obligations for DTI calculation |
| **creditScore** | integer | 748 | Primary risk indicator affecting approval, rate, and terms |

**Calculated Metric:** Debt-to-Income (DTI) = $3,905 / $31,500 = **12.4%** ✓ (Well below 43% threshold)

**Demo Talking Point:** "RISK ASSESSMENT - DTI of 12.4% and FICO of 748 indicate very low default risk. This qualifies for best pricing tier."

---

### 7️⃣ FINANCIAL RESERVES

| Field | Type | Sample Value | Business Impact |
|-------|------|--------------|-----------------|
| **totalAssets** | number | $285,000 | Reserves for down payment, closing costs, and emergency cushion |

**Calculated Metric:** Reserves = $285,000 - $200,000 down = **$85,000** (≈ 13.6 months PITI)

**Demo Talking Point:** "FINANCIAL STRENGTH - $85k in reserves post-closing = 13+ months of payments. Shows strong financial position."

---

### 8️⃣ RISK CLASSIFICATION

| Field | Type | Sample Value | Business Impact |
|-------|------|--------------|-----------------|
| **occupancyType** | string | Primary Residence | Lower default risk vs. investment property, affects rate and requirements |

**Demo Talking Point:** "OCCUPANCY INTENT - Primary residences have 3-4x lower default rates than investment properties."

---

### 9️⃣ TIMELINE MANAGEMENT

| Field | Type | Sample Value | Business Impact |
|-------|------|--------------|-----------------|
| **closingDate** | date | February 15, 2025 | Pipeline management, coordination of title, inspection, funding |

**Demo Talking Point:** "EXECUTION TIMELINE - 57 days to close. Automated extraction accelerates processing by 5-7 days."

---

## 💡 Key Underwriting Metrics Calculated from 16 Fields

| Metric | Formula | Value | Threshold | Status |
|--------|---------|-------|-----------|--------|
| **Loan-to-Value (LTV)** | Loan ÷ Appraised Value | 79.07% | ≤ 80% | ✅ PASS |
| **Debt-to-Income (DTI)** | Total Debt ÷ Monthly Income | 12.4% | ≤ 43% | ✅ PASS |
| **Housing Ratio** | PITI ÷ Monthly Income | 19.8% | ≤ 28% | ✅ PASS |
| **Credit Score** | FICO Score | 748 | ≥ 620 | ✅ PASS |
| **Reserves** | Assets - Down Payment | $85,000 | ≥ 2 months PITI | ✅ PASS |
| **Down Payment %** | Down ÷ Purchase Price | 19.05% | ≥ 3% | ✅ PASS |

**Overall Assessment:** ✅ **STRONG APPROVAL CANDIDATE**

---

## 🎬 Demo Flow Narrative

### Act 1: Document Upload (10 seconds)
"Let's process this 8-page mortgage application package containing loan application, pay stubs, bank statements, employment verification, and property appraisal..."

### Act 2: Real-Time Extraction (30 seconds)
"Watch as our dual-extraction system processes these documents:
- **Azure Document Intelligence** - Structure-based extraction
- **DSPy LLM Extractor** - Semantic understanding
Both extracting all 16 critical fields simultaneously..."

### Act 3: Intelligent Comparison (15 seconds)
"Our AI compares both extractions field-by-field:
- ✅ **13 fields matched perfectly** (81% agreement)
- ⚠️ **3 fields need human review** (values differ)

Notice the **confidence scores** for each extraction..."

### Act 4: Human-in-the-Loop Review (45 seconds)
"For the 3 conflicting fields, our elegant review interface presents:
- Side-by-side values from both extractors
- Confidence percentages
- Document preview with highlighting
- One-click selection

**Field 1: Total Monthly Debt**
- Azure: $3,905 (92% confidence) ← Selected
- DSPy: $3,205 (88% confidence)

**Field 2: Closing Date**
- Azure: Feb 15, 2025 (85% confidence)
- DSPy: 02/15/2025 (95% confidence) ← Selected

**Field 3: Credit Score**
- Azure: 748 (99% confidence) ← Selected
- DSPy: 747 (94% confidence)"

### Act 5: AI Reasoning & Decision (20 seconds)
"Our reasoning engine analyzes all 16 fields and calculates:
- ✅ LTV: 79.07% (under 80% - no PMI needed)
- ✅ DTI: 12.4% (well below 43% limit)
- ✅ Credit: 748 (excellent - qualifies for best rates)
- ✅ Reserves: $85k (13+ months coverage)

**Recommendation: APPROVE for Prime Rate Product**
**Confidence: 94%**
**Processing Time: 2 minutes vs 45 minutes manual**"

### Act 6: Business Impact (15 seconds)
"This IDP system delivers:
- 🚀 **95% faster processing** (2 min vs 45 min)
- 🎯 **99.2% accuracy** with dual extraction + human review
- 💰 **$87 cost savings per loan** in manual labor
- 📊 **Complete audit trail** for compliance
- ⚡ **Same-day approval** vs 3-5 day turnaround"

---

## 🎯 What Makes This Demo Impactful

### 1. **Completeness**
All 16 fields cover the complete underwriting decision - nothing is missing.

### 2. **Real-World Accuracy**
Sample values reflect actual loan scenarios with realistic edge cases.

### 3. **Visual Proof**
Live extraction shows both systems working simultaneously with different approaches.

### 4. **Conflict Resolution**
3 intentional conflicts demonstrate HITL value without overwhelming the viewer.

### 5. **Business Metrics**
Real underwriting ratios (LTV, DTI) calculated automatically from extracted data.

### 6. **Decision Automation**
AI reasoning provides actual loan recommendation with confidence score.

### 7. **ROI Clarity**
Clear time and cost savings that resonate with executives.

---

## 📋 Field Category Breakdown

| Category | Field Count | Purpose |
|----------|-------------|---------|
| 🆔 Identity | 1 | Who is applying? |
| 🏠 Property | 1 | What asset is being financed? |
| 💰 Loan Terms | 3 | How much and on what terms? |
| 📊 Valuation | 3 | What is it worth? (LTV calculation) |
| 💵 Income | 3 | Can they afford it? |
| 📉 Debt/Credit | 2 | What is their risk profile? |
| 💼 Reserves | 1 | Do they have financial cushion? |
| 🔑 Risk Class | 1 | What is the use case? |
| 📅 Timeline | 1 | When does it close? |
| **TOTAL** | **16** | **Complete underwriting picture** |

---

## 🔄 Expected Extraction Conflicts (for HITL Demo)

To showcase the HITL value, we expect these 3-4 fields to have extraction differences:

1. **totalMonthlyDebt** - Multiple sources in document (rent, loans, cards)
2. **closingDate** - Different date formats (02/15/2025 vs February 15, 2025)
3. **creditScore** - May appear in multiple locations with slight variations
4. **totalAssets** - Calculation vs stated value differences

This creates a realistic scenario where human judgment adds value without being overwhelming.

---

## 🎓 Training Talking Points

### For Technical Audience:
"Notice the dual extraction strategy - Azure for structured data from forms and tables, DSPy for semantic extraction from unstructured text. When they disagree, human expertise resolves the ambiguity."

### For Business Audience:
"In 2 minutes, we've extracted and validated 16 critical data points that would take an underwriter 45 minutes to manually key in. That's 95% faster with higher accuracy and complete audit trail."

### For Compliance Audience:
"Every extraction includes confidence scores, source document references, and human review decisions - providing complete transparency for audits and regulatory inquiries."

---

## ✅ Demo Checklist

- [ ] All 16 fields present in sample document with clear values
- [ ] Sample document includes realistic variations to trigger conflicts
- [ ] UI displays all 16 fields with categories
- [ ] Confidence scores visible for each field
- [ ] HITL interface shows 3-4 conflicts for review
- [ ] Reasoning output calculates LTV, DTI, and approval recommendation
- [ ] Processing time displayed (target: < 2 minutes)
- [ ] Clear before/after comparison (manual vs automated)

---

## 🚀 Expected Demo Outcome

**Audience Reaction:** "Wow, it extracted everything needed for a loan decision in 2 minutes, flagged the uncertain values for human review, and even calculated the underwriting ratios automatically. This would transform our operations."

**Next Steps:** "Can we pilot this with 50 real applications next month?"

---

**Last Updated:** January 2, 2026  
**Demo Version:** 1.0  
**Domain:** Home Loan Processing
