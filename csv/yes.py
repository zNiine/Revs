import pandas as pd

# Load the CSV file
df = pd.read_csv("../data.csv")

# Filter rows where the pitcher is "Kickham, Mike"
filtered_df = df[df["pitcher"] == "Kickham, Mike"]
filtered_df.to_csv("kickham_mike_pitches.csv", index=False)
# Display the result

# Optionally, save the filtered data to a new CSV
# filtered_df.to_csv("kickham_mike_pitches.csv", index=False)
