# Refresh Locations Script

This script automatically generates and updates the unified `assets/index.json` and minimal `cities/{cityId}.json` files based on the structure of the `assets/` folder.

## Usage

```bash
node scripts/refresh-locations.js
```

## What it does

1. **Scans the assets folder** - Discovers all provinces and cities with valid data
2. **Generates unified `assets/index.json`** - Creates a single source of truth for all city data
3. **Creates/updates minimal city configuration files** - Generates streamlined `cities/{cityId}.json` files for each city
4. **Cleans up obsolete files** - Removes redundant and obsolete configuration files

## Requirements

Each city must have:
- A `data/` directory
- A `scenic-area.json` file in the data directory

## Generated Files

### `assets/index.json`
Unified assets index containing all city data:
```json
{
  "lastUpdated": "2025-08-14T10:34:46.176Z",
  "cities": [
    {
      "id": "kaifeng",
      "name": "开封",
      "province": "河南",
      "provinceCode": "henan",
      "assetsPath": "assets/henan/kaifeng",
      "defaultArea": "包公祠"
    }
  ]
}
```

### `cities/{cityId}.json`
Minimal city configuration files with only essential fields:
```json
{
  "name": "杭州",
  "displayName": "杭州",
  "description": "杭州景区导览",
  "domain": "杭州.qingfan.wang",
  "workerUrl": "https://杭州.qingfan.wang",
  "resourceBaseUrl": "https://杭州.res.qingfan.wang",
  "logoPath": "logos/杭州.png"
}
```

## City Name Mapping

The script includes mappings for:
- **Province names**: pinyin → Chinese (e.g., 'henan' → '河南')
- **City names**: pinyin → Chinese (e.g., 'nanjing' → '南京')

## Domain Generation

Domains are automatically generated using the first 2 characters of the city ID:
- City: `nanjing` → Domain: `na.qingfan.wang`
- City: `kaifeng` → Domain: `ka.qingfan.wang`

## Output Example

```
🔄 Refreshing locations and city configurations...

Found provinces: henan, jiangsu, shandong, zhejiang
  henan cities: dengfeng, kaifeng, luoyang
  jiangsu cities: nanjing, suzhou, wuxi
  ...

✅ Found 41 valid cities

📝 Generated assets/index.json
🗑️  Removed redundant src/data/locations.json (now using assets/index.json)
🔄 Updated cities/kaifeng.json
✨ Created cities/nanjing.json
...

📊 Summary:
   • Total cities: 41
   • Created: 38
   • Updated: 3
   • Removed: 0
   • Assets index: assets/index.json

✅ Refresh completed successfully!
```

## When to run

Run this script whenever:
- New cities are added to the assets folder
- City data is reorganized
- You need to refresh the location configurations
- Setting up the project for the first time

## Notes

- **Unified data source**: All city data is now centralized in `assets/index.json`
- **Minimal city configs**: City configuration files contain only essential deployment fields
- **No redundant data**: Removed duplicate fields like `assetsPath`, `name`, and `defaultArea` from city configs
- **NFC secrets excluded**: Sensitive data like NFC secret keys should be defined in environment variables
- The script skips backup directories (`.bk` suffix) and the `preview` directory
- Cities without `scenic-area.json` files are skipped with a warning
- The default scenic area is taken from the first entry in `scenic-area.json`
- HomePage.jsx now dynamically groups cities by province from the assets index
- dataService.js uses the unified assets index for province/city lookups
