import requests
import pandas as pd
from bs4 import BeautifulSoup

# 1) Fetch the page
url = "https://baseball.pointstreak.com/schedule.html?leagueid=174&seasonid=34102"
resp = requests.get(url)
resp.raise_for_status()

# 2) Parse it
soup = BeautifulSoup(resp.text, "html.parser")
table = soup.find(
    "table",
    {"class": "table table-hover table-striped nova-stats-table"}
)

# 3) Extract headers
headers = [th.get_text(strip=True) for th in table.thead.find_all("th")]

# 4) Extract all rows
rows = []
for row in table.tbody.find_all("tr"):
    cells = [td.get_text(strip=True) for td in row.find_all("td")]
    rows.append(cells)

# 5) Create DataFrame and save to CSV
df = pd.DataFrame(rows, columns=headers)
df.to_csv('schedule.csv', index=False)

print("Saved schedule.csv with the following columns:")
print(headers)
print("\nFirst 5 rows:")
print(df.head())
