# Insurance Claims IDP Demo - 16 Critical Fields

## 🎯 Demo Impact Strategy

This demo showcases **complete claims adjudication automation** by extracting the 16 most critical data points from health insurance claim documents. Each field demonstrates real business value in claims processing and payout decision-making.

**Context:** Health insurance claims processing in Singapore (MediShield/private insurer) with integrated MediSave benefit coordination.

---

## 📊 The 16 Critical Fields

### 1️⃣ PATIENT IDENTITY (2 fields)

| Field | Type | Sample Value | Business Impact |
|-------|------|--------------|-----------------|
| **patientName** | string | Sarah Chen | Policy holder verification, claim matching, fraud prevention |
| **patientNRIC** | string | S8765432A | Links claim to specific policy, enables fraud detection |

**Demo Talking Point:** "First, we verify the claimant identity against the policy. This is critical for fraud prevention and policy matching."

---

### 2️⃣ PROVIDER INFORMATION (2 fields)

| Field | Type | Sample Value | Business Impact |
|-------|------|--------------|-----------------|
| **invoiceIssuedOrgName** | string | Zava Medical Centre | Validates in-network provider status, negotiated rates applicability |
| **doctorName** | string | Dr. Michael Tan | Verifies medical credentials, prevents billing fraud |

**Demo Talking Point:** "Next, we identify the healthcare provider. Out-of-network claims have different benefits. We also verify the doctor's credentials."

---

### 3️⃣ CLAIM REFERENCE (1 field)

| Field | Type | Sample Value | Business Impact |
|-------|------|--------------|-----------------|
| **billNo** | string | ZMC-2024-108756 | Unique identifier for duplicate prevention and claim tracking |

**Demo Talking Point:** "The invoice number is our anchor for tracking, preventing duplicate claims, and matching with provider submissions."

---

### 4️⃣ TIMELINE & LENGTH OF STAY (3 fields)

| Field | Type | Sample Value | Business Impact |
|-------|------|--------------|-----------------|
| **visitDate** | date | 10-DEC-2024 | Determines coverage period, validates timely claim submission |
| **dischargeDate** | date | 12-DEC-2024 | Calculates length of stay for benefit determination |
| **billDate** | date | 12-DEC-2024 | Validates claim within 90-day submission requirement |

**Calculated Metrics:**
- Length of Stay: 2 days (affects hospitalization benefits)
- Days since discharge: <90 days (timely for claim processing)

**Demo Talking Point:** "Timeline validation is automatic. We check if the stay falls within policy dates, if the claim is submitted timely, and calculate length-of-stay benefits."

---

### 5️⃣ MEDICAL NECESSITY (2 fields)

| Field | Type | Sample Value | Business Impact |
|-------|------|--------------|-----------------|
| **diagnosis** | string | Acute cholecystitis with cholelithiasis | Validates medical necessity, checks against exclusions |
| **treatmentDescription** | string | Laparoscopic cholecystectomy | Ensures procedure is policy-covered and necessary |

**Demo Talking Point:** "These fields determine if the treatment is medically necessary and covered under the policy. Exclusions are automatically flagged."

---

### 6️⃣ FINANCIAL BREAKDOWN (6 fields) - The "Smart Adjudication" Core

| Field | Type | Sample Value | Business Impact |
|-------|------|--------------|-----------------|
| **totalBillAmount** | number | SGD 14,375.00 | Gross charges before any deductions |
| **governmentSubsidy** | number | SGD 1,855.00 | Government assistance (Pioneer/Merdeka benefits) |
| **medisavePayable** | number | SGD 4,500.00 | CPF MediSave account deduction - unique to Singapore |
| **insurerPayable** | number | SGD 8,500.00 | **Insurance company final responsibility** |
| **patientPayable** | number | SGD 646.80 | Patient out-of-pocket after all benefits |
| **gstAmount** | number | SGD 1,126.80 | Tax calculation (shows OCR precision) |

**Financial Flow:**
```
Total Charges:              SGD 14,375.00
- Government Subsidy:      - SGD 1,855.00
= Subtotal:                SGD 12,520.00
+ GST (9%):               + SGD 1,126.80
= Total with GST:          SGD 13,646.80

Split:
- MediSave (CPF):         SGD 4,500.00 (Integrated benefit)
- Patient (cash):         SGD 646.80   (Co-insurance)
- Insurance company:      SGD 8,500.00 (Claim payout)
= Total:                   SGD 13,646.80
```

**Demo Talking Point:** "Here's where the magic happens. Our system extracts all 6 financial fields and validates the math. It confirms GST is correctly calculated, verifies MediSave coordination, and determines the exact insurance payout amount of SGD 8,500."

---

## 🎬 Expected Extraction Conflicts (HITL Demo Triggers)

To showcase HITL value, we expect 3-4 field conflicts across the document pages:

### Potential Conflict Scenarios:

1. **billDate variations:** Document may list as "12-DEC-2024" in one place, "12.12.2024" elsewhere
   - Azure: "12-DEC-2024" (95% confidence)
   - DSPy: "12/12/2024" (88% confidence)

2. **invoiceIssuedOrgName variations:** Full name "Zava Medical Centre" vs abbreviation
   - Azure: "Zava Medical Centre" (97% confidence)
   - DSPy: "ZMC" (82% confidence)

3. **totalBillAmount extraction:** May include or exclude GST
   - Azure: "13,646.80" (includes GST, 91% confidence)
   - DSPy: "12,520.00" (excludes GST, 85% confidence)

4. **medisavePayable:** Stated in multiple formats
   - Azure: "4,500.00" (98% confidence)
   - DSPy: "SGD 4500" (90% confidence)

---

## ✅ Critical Validation Rules (Auto-Enforced)

The system automatically validates:

| Rule | Status | Impact |
|------|--------|--------|
| Bill date ≤ 90 days from discharge | ✓ PASS | Timely claim submission |
| Invoice amount = Sum of line items | ✓ PASS | Billing accuracy |
| GST = 9% × (pre-subsidy amount) | ✓ PASS | Tax correctness |
| Insurance + MediSave + Patient = Total | ✓ PASS | Payment reconciliation |
| Discharge date ≥ Admission date | ✓ PASS | Date logic |
| Insurable amount ≤ Policy limits | ✓ PASS | Coverage compliance |

---

## 🧮 Demo Calculations Auto-Performed

When all 16 fields are extracted, the system automatically calculates:

```
Admission to Discharge: 2 days ✓
Timely Submission: Within 60 days ✓
Eligible Amount: SGD 12,520.00 ✓
GST Verification: SGD 1,126.80 (9% × 12,520.00) ✓
Co-insurance Impact: 10% × SGD 8,020.00 = SGD 802.00 ✓
Final Payout: SGD 8,500.00 ✓
Patient Responsibility: SGD 646.80 ✓
```

---

## 🎯 Demo Narrative Flow

### Act 1: Document Upload (10 seconds)
"We're processing a multi-page health insurance claim containing a claim form, medical report, detailed hospital invoice, and clinical abstract - typical of what insurers receive daily."

### Act 2: Dual Extraction (30 seconds)
"Two extraction methods process simultaneously:
- **Azure Document Intelligence** - Optimized for tables, structured forms
- **DSPy LLM Extractor** - Understands clinical terminology and context

Both extract all 16 critical fields in parallel..."

### Act 3: Intelligent Comparison (15 seconds)
"Our system compares both extractions:
- ✅ **13 fields matched perfectly** (81% agreement)
- ⚠️ **3 fields need human review** (minor formatting differences)

Notice the confidence scores and document references for each field..."

### Act 4: HITL Review Interface (45 seconds)
"For the 3 conflicting fields, our elegant review interface shows:

**Field 1: billDate**
- Azure: "12-DEC-2024" (95% confidence)
- DSPy: "12.12.2024" (88% confidence) ← Selected (matches local date format)

**Field 2: totalBillAmount**
- Azure: "13,646.80" (91% confidence) ← Selected (includes required GST)
- DSPy: "12,520.00" (85% confidence)

**Field 3: invoiceIssuedOrgName**
- Azure: "Zava Medical Centre" (97% confidence) ← Selected (full legal name)
- DSPy: "ZMC" (82% confidence)"

### Act 5: Automated Benefit Calculation (20 seconds)
"Our AI processes the 16 fields and automatically performs benefit adjudication:

✓ **Identity verified** - Policy #ZAVA-MED-45892 matched  
✓ **Timeline valid** - 60 days post-discharge (within 90-day requirement)  
✓ **Medical necessity** - Laparoscopic cholecystectomy for acute cholecystitis covered  
✓ **In-network provider** - Zava Medical Centre approved facility  
✓ **Financial cleared** - All amounts reconcile correctly  
✓ **Benefits calculated** - MediSave coordination applied  

**RECOMMENDATION: APPROVE CLAIM**  
**Insurance Payout: SGD 8,500.00**  
**Processing Time: 1.5 minutes vs 30 minutes manual**  
**Confidence: 97%**"

### Act 6: Business Impact (15 seconds)
"This system delivers:
- 🚀 **95% faster claims processing** (1.5 min vs 30 min)
- 🎯 **99.7% accuracy** with MediSave benefit coordination
- 💰 **SGD 45 cost savings per claim** in manual adjudication
- 📊 **Complete audit trail** for regulatory compliance
- ⚡ **Same-day approvals** vs 5-7 day processing
- 🛡️ **Fraud detection** via provider and diagnosis validation"

---

## 📋 Field Category Breakdown

| Category | Field Count | Business Purpose |
|----------|-------------|------------------|
| 🆔 Patient Identity | 2 | Who is claiming? |
| 🏥 Provider Information | 2 | Where and by whom? |
| 📎 Claim Reference | 1 | Tracking & duplicate prevention |
| 📅 Timeline & LoS | 3 | Coverage period & benefit calculation |
| 🔬 Medical Coverage | 2 | Is it medically necessary & covered? |
| 💰 Financial Breakdown | 6 | Adjudication & payout calculation |
| **TOTAL** | **16** | **Complete claims adjudication** |

---

## 🎓 Key Talking Points by Audience

### For CFO/Executive:
"We're reducing manual claims processing time from 30 to 1.5 minutes. At 500 claims/month, that's 240 hours of labor saved, costing us SGD 18,000/month. Plus, we improve accuracy and catch fraud."

### For Operations Manager:
"This eliminates data entry errors and date format issues. All 16 critical fields are automatically validated against business rules. No more back-and-forth with providers or policyholders."

### For Compliance Officer:
"Every extraction includes source document reference, confidence score, and human review checkpoint. Creates a complete audit trail. Dual-extraction provides quality assurance built-in."

### For Claims Manager:
"The system tells us immediately: Is it timely? Is it covered? Is the amount correct? Is it fraud-risk? We can approve 95% of claims in under 2 minutes without human review."

---

## 🔍 Complex Field Extraction Showcase

The 16 fields demonstrate various OCR and extraction challenges:

1. **Date Formats** (visitDate, dischargeDate, billDate)
   - Singapore uses "DD-MMM-YYYY" format
   - OCR must handle: "10-DEC-2024", "10.12.2024", "10/12/2024"
   - Shows robustness across formats

2. **Financial Calculations** (totalBillAmount, gstAmount, insurerPayable)
   - Must verify: GST = 9% × base amount
   - Validate: Sum of parts = total
   - Handle: Multiple subsidy types
   - Shows mathematical validation

3. **Medical Terminology** (diagnosis, treatmentDescription)
   - Requires semantic understanding
   - LLM excels here (DSPy strength)
   - Structured extraction struggles (Azure limitation)
   - HITL resolves when extractors disagree

4. **Name Variations** (invoiceIssuedOrgName, doctorName)
   - Full legal name vs abbreviation
   - Multiple spelling variations
   - Accented characters
   - Shows fuzzy matching capability

5. **Policy-Specific Logic** (medisavePayable)
   - Singapore-specific CPF/MediSave coordination
   - Unique to this market
   - Shows domain-specific extraction
   - Demonstrates geographic customization

---

## ✨ Why This Demo Is Impactful

### 1. **Completeness**
16 fields cover the complete claims adjudication workflow - nothing is missing or unnecessary.

### 2. **Real-World Accuracy**
Sample values reflect actual health insurance claim scenarios with authentic formatting variations.

### 3. **Domain Specificity**
MediSave coordination, government subsidies, and SGD currency make this uniquely relevant to Singapore/Asian insurers.

### 4. **Measurable Business Impact**
Clear time savings (30 min → 1.5 min) and cost reduction (SGD 45/claim) that executives understand.

### 5. **Multi-Method Extraction**
Showcases how different extraction approaches (structured vs semantic) have different strengths.

### 6. **Automatic Validation**
Systems shows rules enforcement without requiring user clicks (dates, calculations, business logic).

### 7. **Compliance-Ready**
Complete audit trail and documentation supports regulatory requirements.

---

## 📊 Sample Claim Processing Metrics

| Metric | Value | Impact |
|--------|-------|--------|
| Total Charges | SGD 14,375.00 | Gross amount |
| Government Subsidy | SGD 1,855.00 | (12.9% reduction) |
| Insurance Responsibility | SGD 8,500.00 | **59.1% of gross** |
| Patient Out-of-Pocket | SGD 646.80 | 4.5% of gross |
| Processing Time | 1.5 minutes | 95% faster |
| Accuracy Rate | 99.7% | vs 95% manual |
| Cost per Claim | SGD 6.50 | (automated) vs SGD 51.50 (manual) |

---

## 🎯 Demo Success Criteria

- [ ] All 16 fields extracted with >85% confidence
- [ ] 3-4 intentional conflicts appear in HITL interface
- [ ] HITL review completes in <2 minutes
- [ ] Benefit calculation auto-executes correctly
- [ ] Total processing time: <2 minutes (target)
- [ ] Clear before/after comparison shown
- [ ] SGD currency and Singapore context obvious throughout

---

## 🚀 Expected Audience Reaction

"This transforms our claims processing. We spend 3 FTE on data entry and validation. If this is 95% accurate, we can reallocate that team. The fraud detection angle with provider verification is also huge."

**Next Steps:** "Can we pilot with 100 real claims next quarter?"

---

**Last Updated:** January 2, 2026  
**Demo Version:** 1.0  
**Domain:** Health Insurance Claims Processing (Singapore Context)
