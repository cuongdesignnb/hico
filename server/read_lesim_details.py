import pypdf
import sys

sys.stdout.reconfigure(encoding='utf-8')

pdf_path = r"d:\HC\Worldmove Shipping System API Documentv2.0.1_20251112.pdf"
reader = pypdf.PdfReader(pdf_path)

for page_num in [3, 16]: # 0-indexed for pages 4 and 17
    print(f"\n=================== PAGE {page_num + 1} ===================")
    print(reader.pages[page_num].extract_text())
