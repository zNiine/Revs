#!/usr/bin/env python3
import pandas as pd

# List of columns to remove
cols_to_drop = [
    "Level", "League",
    "System", "HomeTeamForeignID",
    "AwayTeamForeignID","CatcherId",
    "PitcherSet",
    "DetectedShift",
    "PitcherId",
    "BatterId",
    "ZoneTime",
    "CatcherThrows",
    "GameForeignID",
    "Notes",
    "TaggedPitchType",
    "1B_PositionAtReleaseX", "1B_PositionAtReleaseZ",
    "2B_PositionAtReleaseX", "2B_PositionAtReleaseZ",
    "3B_PositionAtReleaseX", "3B_PositionAtReleaseZ",
    "SS_PositionAtReleaseX", "SS_PositionAtReleaseZ",
    "LF_PositionAtReleaseX", "LF_PositionAtReleaseZ",
    "CF_PositionAtReleaseX", "CF_PositionAtReleaseZ",
    "RF_PositionAtReleaseX", "RF_PositionAtReleaseZ",
    "1B_Name", "1B_Id",
    "2B_Name", "2B_Id",
    "3B_Name", "3B_Id",
    "SS_Name", "SS_Id",
    "LF_Name", "LF_Id",
    "CF_Name", "CF_Id",
    "RF_Name", "RF_Id",
    "FHC",
    "PitchReleaseConfidence", "PitchLocationConfidence", "PitchMovementConfidence",
    "HitLaunchConfidence", "HitLandingConfidence",
    "CatcherThrowCatchConfidence", "CatcherThrowReleaseConfidence", "CatcherThrowLocationConfidence",
    "ThrowTrajectoryXc0", "ThrowTrajectoryXc1", "ThrowTrajectoryXc2",
    "ThrowTrajectoryYc0", "ThrowTrajectoryYc1", "ThrowTrajectoryYc2",
    "ThrowTrajectoryZc0", "ThrowTrajectoryZc1", "ThrowTrajectoryZc2", "TaggedPitchType", "ZoneSpeed", "ZoneTime", "HitSpinRate",	"PositionAt110X",	"PositionAt110Y", 	"PositionAt110Z",
    "LastTrackedDistance", "pfxx", "pfxz","x0","y0","z0","vx0","vy0", "vz0", "ax0", "ay0", "az0" "League",
]

# Read in the full dataset
df = pd.read_csv("data.csv")

# Drop unwanted columns (errors='ignore' skips any cols not present)
df = df.drop(columns=cols_to_drop, errors='ignore')

# Write out the cleaned data
df.to_csv("data_clean.csv", index=False)

print("Saved cleaned CSV to data_clean.csv")
