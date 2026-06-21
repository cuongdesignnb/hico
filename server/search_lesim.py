import pypdf
import sys
import re

sys.stdout.reconfigure(encoding='utf-8')

pdf_path = r"d:\HC\Worldmove Shipping System API Documentv2.0.1_20251112.pdf"
reader = pypdf.PdfReader(pdf_path)

print(f"Total Pages: {len(reader.pages)}")

for i, page in enumerate(reader.pages):
    text = page.extract_text()
    if re.search(r"lesim", text, re.IGNORECASE):
        print(f"\n--- leSIM found on Page {i+1} ---")
        lines = text.split("\n")
        for line in lines:
            if re.search(r"lesim", line, re.IGNORECASE):
                print(line)
