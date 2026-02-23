#!/usr/bin/env python3
"""Quick test: submit PDF to CU analyzeBinary through APIM and poll for result."""
import requests, json, time, sys

EP = "https://apim-ssattiraju-01.azure-api.net"
KEY = "e03130f23957464292f19700d3470407"
ANALYZER = "analyzer_home_loan"
PDF = "sample_documents/home_loan_zava.pdf"
HEADERS = {"Ocp-Apim-Subscription-Key": KEY}

# Step 1: Submit
print("=== Step 1: Submit analyzeBinary ===")
with open(PDF, "rb") as f:
    data = f.read()
print(f"File size: {len(data)} bytes")

r = requests.post(
    f"{EP}/contentunderstanding/analyzers/{ANALYZER}:analyzeBinary?api-version=2025-11-01",
    headers={**HEADERS, "Content-Type": "application/octet-stream"},
    data=data,
)
print(f"HTTP {r.status_code}")
if r.status_code != 202:
    print(f"ERROR: {r.text}")
    sys.exit(1)

op_loc = r.headers.get("operation-location", "")
print(f"Operation-Location: {op_loc}")
body = r.json()
print(f"Initial status: {body.get('status')}")

# Step 2: Poll
print("\n=== Step 2: Polling ===")
start = time.time()
for i in range(60):
    time.sleep(5)
    elapsed = time.time() - start
    r2 = requests.get(op_loc, headers=HEADERS)
    if r2.status_code != 200:
        print(f"Poll {i+1} ({elapsed:.0f}s): HTTP {r2.status_code} - {r2.text[:200]}")
        continue
    d = r2.json()
    st = d.get("status", "?")
    print(f"Poll {i+1} ({elapsed:.0f}s): {st}")
    if st == "Succeeded":
        contents = d.get("result", {}).get("contents", [])
        if contents:
            fields = contents[0].get("fields", {})
            print(f"\n=== Extracted {len(fields)} fields ===")
            for k, v in fields.items():
                val = v.get("valueString", v.get("valueNumber", v.get("valueDate", "?")))
                conf = v.get("confidence", "?")
                print(f"  {k}: {val} (confidence: {conf})")
        print(f"\nTotal time: {elapsed:.0f}s")
        sys.exit(0)
    elif st == "Failed":
        print(f"FAILED: {json.dumps(d, indent=2)}")
        sys.exit(1)

print("TIMED OUT after 300s")
sys.exit(1)
