import re
import sys

with open('d:/HC/src/components/Admin/AdminDashboard.tsx', 'r', encoding='utf-8') as f:
    lines = f.readlines()

output_lines = []

for i, line in enumerate(lines):
    if 'setDestinationForm' in line or 'setPackageForm' in line or 'setDeviceForm' in line or 'setArticleForm' in line:
        if '{' in line or 'isAdding' in line:
            output_lines.append(f"Line {i+1}:")
            for j in range(max(0, i-2), min(len(lines), i+8)):
                output_lines.append(f"  {j+1}: {lines[j].strip()}")
            output_lines.append("-" * 40)

with open('C:/Users/cuong/.gemini/antigravity/brain/a453ab33-2e1e-4db1-bfa7-9b48f5ded009/scratch/admin_resets.txt', 'w', encoding='utf-8') as f:
    f.write('\n'.join(output_lines))

print("Results written successfully!")
