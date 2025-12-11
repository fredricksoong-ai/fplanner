# Premier League Logo Extraction Guide

## Step-by-Step Instructions

### Prerequisites
1. You need a Figma account (free account works)
2. Open the Figma file: https://www.figma.com/community/file/1378407378373659105/premier-league-clubs-logos
3. Click "Open in Figma" button on the page

---

## Extraction Process

### Step 1: Open the File in Figma
1. Go to: https://www.figma.com/community/file/1378407378373659105/premier-league-clubs-logos
2. Click the **"Open in Figma"** button (blue button on the page)
3. The file will open in Figma (web or desktop app)

### Step 2: Find the Team Logos
1. In Figma, look at the left sidebar (Layers panel)
2. You should see frames/components with team names
3. Each team logo should be in its own frame or component

### Step 3: Extract SVG for Each Team

For **each team** (1-20), follow these steps:

#### 3a. Select the Logo
1. Click on the team logo you want to extract
2. Make sure you select the entire logo (not just a part of it)
3. The logo should be highlighted/selected

#### 3b. Copy as SVG
1. **Right-click** on the selected logo
2. In the context menu, look for **"Copy/Paste as"** → **"Copy as SVG"**
   - OR use keyboard shortcut: `Cmd/Ctrl + Shift + C` (then select SVG if prompted)
   - OR go to: Edit → Copy as → Copy as SVG

#### 3c. Get the SVG Code
1. The SVG code is now in your clipboard
2. Open a text editor (VS Code, Notepad, etc.) and paste it
3. You should see something like: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">...</svg>`

---

## Team ID Mapping Reference

Use this mapping to know which team ID corresponds to which team:

| Team ID | Team Name | Short Code | Notes |
|---------|-----------|------------|-------|
| 1 | Arsenal | ARS | |
| 2 | Aston Villa | AVL | |
| 3 | Bournemouth | BOU | |
| 4 | Brentford | BRE | |
| 5 | Brighton & Hove Albion | BHA | |
| 6 | Chelsea | CHE | |
| 7 | Crystal Palace | CRY | |
| 8 | Everton | EVE | |
| 9 | Fulham | FUL | |
| 10 | Ipswich Town | IPS | |
| 11 | Leicester City | LEI | |
| 12 | Liverpool | LIV | |
| 13 | Manchester City | MCI | |
| 14 | Manchester United | MUN | |
| 15 | Newcastle United | NEW | |
| 16 | Nottingham Forest | NFO | |
| 17 | Southampton | SOU | |
| 18 | Tottenham Hotspur | TOT | |
| 19 | West Ham United | WHU | |
| 20 | Wolverhampton Wanderers | WOL | |

---

## Step 4: Insert into Code

### 4a. Open the File
1. Open: `/frontend/src/utils/teamLogos.js`
2. Find the `teamLogos` object (around line 12)

### 4b. Add Each Logo
For each team, add the SVG code like this:

```javascript
const teamLogos = {
    1: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">...</svg>', // Arsenal
    2: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">...</svg>', // Aston Villa
    3: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">...</svg>', // Bournemouth
    // ... continue for all 20 teams
};
```

### 4c. Formatting Tips
- Keep the SVG code on a single line (or use template literals with backticks)
- Make sure to include the comment with team name for reference
- Ensure each SVG is properly closed with `</svg>`

### 4d. Example Entry
```javascript
1: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200"><path d="M100,50 L150,100 L100,150 L50,100 Z" fill="#EF0107"/></svg>', // Arsenal
```

---

## Step 5: Verify

### 5a. Check Syntax
1. Make sure all quotes are properly closed
2. Ensure commas between entries (except the last one)
3. Check that all SVGs are valid XML

### 5b. Test in Browser
1. Save the file
2. Run your app
3. Check the fixture ticker - logos should appear instead of text
4. If a logo doesn't appear, check the browser console for errors

---

## Quick Workflow Summary

For each of the 20 teams:

1. **In Figma:**
   - Find team logo
   - Select it
   - Right-click → Copy as SVG

2. **In Code:**
   - Open `teamLogos.js`
   - Find the team ID in the mapping table above
   - Paste SVG code: `[ID]: '<svg>...</svg>', // Team Name`

3. **Repeat** for all 20 teams

---

## Troubleshooting

### SVG too large/complex?
- The SVG should work as-is, but if it's very large, you can optimize it
- Use tools like SVGOMG (https://jakearchibald.github.io/svgomg/) to optimize

### Can't find "Copy as SVG"?
- Make sure you're selecting the actual logo element, not a frame
- Try selecting individual elements within the logo
- Some Figma files have logos as components - try right-clicking the component instance

### SVG not displaying?
- Check browser console for errors
- Verify the SVG code is valid (try opening it in a browser)
- Make sure quotes are escaped properly in the JavaScript string

### Need to resize logos?
- The code automatically resizes logos to 12px for the ticker
- If you need different sizes, modify the `size` parameter in `renderTeamLogo()`

---

## Alternative: Batch Export

If Figma allows batch export:
1. Select all logo frames/components
2. Right-click → Export → SVG
3. Download all SVGs
4. Then manually copy each SVG's content into the code

---

## Estimated Time
- **Per logo:** ~30 seconds (select → copy → paste)
- **Total time:** ~10-15 minutes for all 20 teams

Good luck! 🎨⚽

