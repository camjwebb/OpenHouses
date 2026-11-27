import csv
import json
from pathlib import Path

src = Path(r"C:\Users\camjw\Downloads\Open-Houses-Nov-27-29-2026.csv")
out = Path(__file__).with_name("seed.js")
rows = []
with src.open(encoding="utf-8-sig", newline="") as handle:
    for record in csv.DictReader(handle):
        price = record.get("Price", "").strip()
        row = {
            "Loan Officer": record.get("Loan Officer", "").strip(),
            "Date": record.get("Date", "").strip(),
            "Start": record.get("Start", "").strip(),
            "End": record.get("End", "").strip(),
            "Realtor": record.get("Realtor", "").strip(),
            "Co-Agent": record.get("Co-Agent", "").strip(),
            "Phone": record.get("Phone", "").strip(),
            "VIP": record.get("VIP", "").strip(),
            "Relationship": record.get("Relationship", "").strip(),
            "MLS": record.get("MLS", "").strip(),
            "Price": int(price) if price.isdigit() else price,
            "Address": record.get("Address", "").strip(),
            "City": record.get("City", "").strip(),
            "Class": record.get("Class", "").strip(),
            "Realtor Link": record.get("Realtor Link", "").strip(),
            "Listing Link": record.get("Listing Link", "").strip(),
        }
        rows.append(row)

seed = {
    "id": "included-2026-11-27",
    "included": True,
    "uploadedAt": "2026-11-27T15:00:00.000Z",
    "weekLabel": "Nov 27\u201329, 2026",
    "weekStart": "2026-11-27",
    "weekEnd": "2026-11-29",
    "rows": rows,
}
payload = json.dumps(seed, ensure_ascii=False, separators=(",", ":")).replace("<", "\\u003c")
out.write_text("window.OPEN_HOUSES_SEED = " + payload + ";\n", encoding="utf-8")
print(len(rows), out.stat().st_size)
