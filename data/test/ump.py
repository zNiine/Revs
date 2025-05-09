import pandas as pd

# 1. Read your combined CSV (or the one with full names)
df = pd.read_csv("combined_with_full_names.csv")

# 2. Define your GameID → umpire name mapping
umpire_mapping = {
    "932781d9-f5eb-45d1-86c4-b1d73966f575": "Steve Bartelstein",
    "ec583749-c087-44a1-a4c7-e34fbf4199c5": "Matt Criss (CC)",
    "eea7ea68-83ff-4ed0-af83-918ebb156b53": "Gavin Holdgreve",
    "795b5756-d449-4242-9906-91099150391b": "",
    "c9c7c328-59e3-4c22-bd94-5ddfa4b78b5d": "Rob Massaro",
    "4cf53127-b656-4461-845d-ab46fb66566a": "Andrew Eng",
    "17029b56-e2ad-4492-a3b5-bc432e60bafe": "Nick Rosa",
    "19237589-5339-43fd-abd1-539a5d6659d3": "John Thelan",
    "8aaeb7a3-b74b-4db6-b34a-666f3c098771" : "Mike Williams",
    "36e523ed-31e5-41f3-bfff-16b6ed215e0e": "Bill Worthington",
    "7f9886d4-ebf3-495e-b6fe-24c470b06a62": "Nick Rosa",
    "2fdab690-7aff-46f3-8e3c-8feb3cd8d7f1": "Andy McPherson",
    "ad672878-3f38-4a89-b499-726beaa2e430" : "Steve Bartelstein",
    "a5af0568-dab4-410b-bb45-a776774ca1fc" : "Owen Ballard IV",
    "22bc2bb6-e6f8-4d30-8ba3-8b4f0e17b34c": "Clark Morgan",
    "20f844a7-56c2-4d88-8200-812a02e1843c" : "Derek Moccia",
    "c93d5252-621e-4d6a-aa54-6d48e719fdf0" : "Gavin Handgreve",
    "59cf5bee-24c1-4777-b79f-3b3745da95e0" : "Drew Ashcraft",
    "83cab867-0f58-4788-854e-7ebfb6ea39c6" : "Fred DeJesus (CC)",
    "e45d1561-6318-4851-8fe3-6c83c90e9931" : "Miguel De La Cruz Segura",
    "36dea875-ab1b-4ded-9570-b490f815e1e7" : "Zachery Burr",
    "2d770fd1-028e-42df-bb70-bf57f7d83ee1" : "Marvin King",
    "df0a7898-c811-4b79-91a6-ab26ac68774b" : "Rich Capitelli",
    "5e4727ec-0d3d-4ebc-86dc-e33af17b83e1" : "Andrew Eng",
    "f6f19a9c-340c-453c-9785-3657b144ed55" : "Jacob Cackett",
    "28f0c7c1-d094-4586-b79a-184f4b390a71" : "Gus Curtis",
    "954ed70e-9547-4536-8dc2-77230aa4ec73" : "Ronnie Withrow",
    "81033df9-5495-4fa4-a836-308d111b97a9" : "",
    "7527fd70-36f1-4354-bfc0-e660f82cb0b0" : "Steve Bartelstein",
    "d44263a2-f07d-45b9-8cb6-6172a9a5edf2" : "Antonio Pinzon",
    "6fb8cc1b-c6f3-4ebc-9dfd-38a250666b34" : "Zach Burr",
    "99161b22-0df4-48de-ba8a-98caf827fd2f" : "Layne Landesman",
    "1256c3bc-2aeb-4c63-a0b8-664f089de9f5" : "Steve Bartelstein",
    "a9998100-c848-426d-80ff-989dcc9ab23a" : "Zach Burr",
    "b37b87d7-194b-460d-b046-355e622c3c97" : "Owen Ballard IV",
    "9652c3f3-2e70-4a69-8258-82277be37020" : "Brett Stowe",
    "95553735-d073-44db-a869-8f4a8c22035d" : "Andrew Eng",
    "57d9e984-5252-49f4-bef2-aa05a2418e8c" : "Gavin Holdgrove",
    "fba636bd-4f9f-422d-b3c9-49b81ea49f1e" : "Steve Zawisky",
    "e8478b86-44bf-4b06-8e97-f42fc55b0dfd" : "Pat Adkins",
    "e15b36c7-a39a-46d6-b809-151eadee9c21" : "Nick Sempert",
    "c1e80a3e-1fbb-4b64-9191-f9ebde2928b7" : "Bill Reuter",
    "3c99bd66-34dc-427f-8715-f64a0557e472" : "Gavin Holdgreve",
    "4ac395a0-469b-4fb5-bad5-6bfed11e0e3d" : "Calvin Baker",
    "376733dc-67f3-4efc-96a9-8f75a6fab131" : "Steve Bartelstein",
    "6a6a390a-cc4b-467c-9859-1d6930e13979" : "Warren Nicholson",
    "7f7b3f09-f1cf-4648-9baa-cade95fb3b53" : "Benjamin Wilson",
    "64ad3e0a-87e9-4ab8-9ee2-8f40213ce4e2" : "Dustin Fields",
    "20846eab-c59e-46af-a797-67b1f060101f" : "Daniel Wetzel",
    "d07abe5f-72e7-478e-9d4c-09a460049366" : "Andrew Eng",
    "cdb51c41-3d3b-4fbb-830a-fdcca9e66076" : "Owen Ballard IV",
    "8a421e80-e10b-4530-9e59-9ee28c301f62" : "David Martinez",
    "f576593b-b421-46cb-a31d-73bdb2fdaddc" : "Miguel De La Cruz Segura",
    # add your other GameID→Umpire entries here…
}

# 3. Create the new “Umpire” column by mapping GameID
df["Umpire"] = df["GameUID"].map(umpire_mapping)

# 4. (Optional) If you want to see which GameIDs didn’t map
missing = df.loc[df["Umpire"].isna(), "GameID"].unique()
if len(missing):
    print("No umpire found for these GameIDs:", missing)

# 5. Save your enriched CSV
df.to_csv("combined_with_umpires.csv", index=False)

print("Done! → combined_with_umpires.csv created.")
