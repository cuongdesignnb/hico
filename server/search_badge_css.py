import sys

sys.stdout.reconfigure(encoding='utf-8')

file_path = r"d:\HC\src\components\Admin\AdminDashboard.css"
with open(file_path, "r", encoding="utf-8") as f:
    content = f.read()

import re
print("=== status-badge-mini matches ===")
for match in re.finditer(r"\.status-badge-mini[^{]*\{[^}]*\}", content):
    print(match.group(0))

print("\n=== status-badge matches ===")
for match in re.finditer(r"\.status-badge[^{]*\{[^}]*\}", content):
    print(match.group(0))
