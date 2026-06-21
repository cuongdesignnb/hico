import pypdf
import sys

sys.stdout.reconfigure(encoding='utf-8')

pdf_path = r"d:\HC\Worldmove Shipping System API Documentv2.0.1_20251112.pdf"
reader = pypdf.PdfReader(pdf_path)

print(f"=================== PAGE 10 ===================")
print(reader.pages[9].extract_text())
