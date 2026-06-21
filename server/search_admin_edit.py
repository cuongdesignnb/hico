import re

with open('d:/HC/src/components/Admin/AdminDashboard.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Let's find matches of setDestinationForm
matches = [m.start() for m in re.finditer('setDestinationForm', content)]
for m in matches:
    start = max(0, m - 50)
    end = min(len(content), m + 350)
    print(f"Match found at position {m}:")
    print(content[start:end])
    print("-" * 50)
