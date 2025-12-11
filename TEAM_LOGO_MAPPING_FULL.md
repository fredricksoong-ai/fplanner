# Complete Team Logo Mapping Reference

## Overview

The logo system uses **name-based mapping** to match FPL API team names/short names to logo files. This ensures logos are correctly matched regardless of:
- What team ID the FPL API assigns
- Which season we're in
- Which teams are currently in the Premier League

## Available Logo Files

We have logo files for the following teams (mapped by name, not by season):

| Logo File | Import Variable | Team Full Name | Team Short Name |
|-----------|----------------|----------------|-----------------|
| `1.svg` | `arsenalLogo` | Arsenal | ARS |
| `2.svg` | `astonVillaLogo` | Aston Villa | AVL |
| `3.svg` | `bournemouthLogo` | Bournemouth | BOU |
| `4.svg` | `brentfordLogo` | Brentford | BRE |
| `5.svg` | `brightonLogo` | Brighton & Hove Albion | BHA |
| `6.svg` | `chelseaLogo` | Chelsea | CHE |
| `7.svg` | `crystalPalaceLogo` | Crystal Palace | CRY |
| `8.svg` | `evertonLogo` | Everton | EVE |
| `9.svg` | `fulhamLogo` | Fulham | FUL |
| `10.svg` | `burnleyLogo` | Burnley | BUR |
| `11.svg` | `leedsLogo` | Leeds United | LEE |
| `12.svg` | `liverpoolLogo` | Liverpool | LIV |
| `13.svg` | `manCityLogo` | Manchester City | MCI |
| `14.svg` | `manUnitedLogo` | Manchester United | MUN |
| `15.svg` | `newcastleLogo` | Newcastle United | NEW |
| `16.svg` | `nottinghamForestLogo` | Nottingham Forest | NFO |
| `17.svg` | `sunderlandLogo` | Sunderland | SUN |
| `18.svg` | `tottenhamLogo` | Tottenham Hotspur | TOT |
| `19.svg` | `westHamLogo` | West Ham United | WHU |
| `20.svg` | `wolvesLogo` | Wolverhampton Wanderers | WOL |

## Supported Name Variations

The mapping supports multiple name variations for each team:

### Full Name Variations
- **Brighton**: "Brighton", "Brighton & Hove Albion"
- **Manchester City**: "Manchester City", "Man City"
- **Manchester United**: "Manchester United", "Man United"
- **Newcastle**: "Newcastle", "Newcastle United"
- **Nottingham Forest**: "Nottingham Forest", "Nott'm Forest"
- **Tottenham**: "Tottenham", "Tottenham Hotspur"
- **West Ham**: "West Ham", "West Ham United"
- **Wolves**: "Wolves", "Wolverhampton Wanderers", "Wolverhampton"
- **Leeds**: "Leeds", "Leeds United", "Leeds United F.C."

### Short Name Variations
All teams support their standard 3-letter short names (ARS, AVL, BOU, etc.)

## How It Works

1. **When a team object is provided:**
   - First checks `team.name` (full name) against the map
   - If no match, checks `team.short_name` (3-letter code) against the map
   - Returns the matching SVG logo or `null`

2. **When a team ID is provided:**
   - Looks up the team object from `fplBootstrap.teams` using the ID
   - Then follows the name-based lookup process above

3. **Fallback behavior:**
   - If no logo is found, the system displays the team's short name as text
   - This ensures all teams are always displayed, even if we don't have their logo yet

## All Supported Keys in teamNameToLogoMap

### Full Names (team.name):
- Arsenal
- Aston Villa
- Bournemouth
- Brentford
- Brighton
- Brighton & Hove Albion
- Burnley
- Chelsea
- Crystal Palace
- Everton
- Fulham
- Leeds
- Leeds United
- Leeds United F.C.
- Liverpool
- Man City
- Manchester City
- Man United
- Manchester United
- Newcastle
- Newcastle United
- Nott'm Forest
- Nottingham Forest
- Sunderland
- Tottenham
- Tottenham Hotspur
- West Ham
- West Ham United
- Wolverhampton
- Wolverhampton Wanderers
- Wolves

### Short Names (team.short_name):
- ARS
- AVL
- BOU
- BRE
- BHA
- BUR
- CHE
- CRY
- EVE
- FUL
- LEE
- LIV
- MCI
- MUN
- NEW
- NFO
- SUN
- TOT
- WHU
- WOL

## Teams Without Logos

Any team in the FPL API that doesn't have a mapping in `teamNameToLogoMap` will automatically fall back to displaying their short name as text. This includes:
- Teams that are newly promoted
- Teams that were previously in the league but we don't have logos for
- Any team name variations we haven't accounted for

## How to Add New Logos

1. **Add the logo file:**
   - Copy the SVG file to `frontend/src/assets/logos/` (numbered sequentially, e.g., `21.svg`)

2. **Import it in `teamLogos.js`:**
   ```javascript
   import newTeamLogo from '../assets/logos/21.svg?raw';
   ```

3. **Add mappings to `teamNameToLogoMap`:**
   ```javascript
   'Team Full Name': newTeamLogo,
   'Team Short Name': newTeamLogo,
   // Add any name variations as needed
   ```

4. **Update this documentation**

## Identifying Missing Mappings

To identify which teams don't have logos:
1. Check the browser console - teams without logos will show their short name as text
2. Compare `fplBootstrap.teams` array with the `teamNameToLogoMap` keys
3. Look for teams displaying text instead of logos in the UI

## Important Notes

- **No season-specific logic**: The mapping doesn't care which season we're in or which teams are currently in the league
- **Name-based only**: Logos are matched by team name/short name, not by team ID
- **Graceful fallback**: Teams without logos automatically display their short name as text
- **Comprehensive coverage**: The mapping includes all teams we have logo files for, regardless of current league status
