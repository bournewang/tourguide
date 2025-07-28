# TourGuide Data Management Scripts

This directory contains scripts for migrating and syncing data between local assets and EdgeOne KV storage.

## Migration to EdgeOne KV Storage

The `migrate-to-edgeone.js` script migrates local data from `assets/dengfeng/data` to EdgeOne KV storage.

### Prerequisites

1. **EdgeOne Functions Deployed**: Make sure your EdgeOne functions are deployed and accessible
2. **Environment Variables**: Set the API endpoint (optional, defaults to `https://df.qingfan.wang`)

### Usage

#### Option 1: Migrate all data
```bash
cd scripts
node migrate-to-edgeone.js
```

#### Option 2: Migrate specific spot file
```bash
cd scripts
node migrate-to-edgeone.js spots/fawangsi.json
node migrate-to-edgeone.js spots/songyangshuyuan.json
```

#### Option 3: Using npm script (migrates all data)
```bash
cd scripts
npm run migrate
```

#### Option 4: With custom API endpoint
```bash
cd scripts
EDGEONE_API_URL=https://your-worker-domain.com node migrate-to-edgeone.js
EDGEONE_API_URL=https://your-worker-domain.com node migrate-to-edgeone.js spots/fawangsi.json
```

### What it does

1. **Loads Scenic Areas**: Reads `assets/dengfeng/data/scenic-area.json`
2. **Uploads Scenic Areas**: Posts the scenic areas data to `/api/scenic-areas`
3. **Loads Spots Data**: For each scenic area, reads its corresponding spots file
4. **Uploads Spots Data**: Posts each area's spots data to `/api/spots`

### Data Structure Support

The script supports both data formats:
- **Old Format**: Direct array of spots
- **New Format**: Baidu Map search result with `results` array

### Output

The script provides colored console output showing:
- ✅ Success messages (green)
- ❌ Error messages (red)
- ℹ️ Info messages (blue)
- 📊 Summary statistics

### Example Output

**Full Migration:**
```
🚀 Starting data migration to EdgeOne KV storage...
📁 Source path: /path/to/assets/dengfeng/data
🌐 API endpoint: https://df.qingfan.wang

✅ Loaded scenic areas data: 12 areas
ℹ️  Uploading scenic areas data...
✅ Scenic areas uploaded successfully: 12 areas

ℹ️  Processing area: 法王寺
ℹ️  Loaded spots data: 34 spots
ℹ️  Uploading spots data for area: 法王寺
✅ Spots data uploaded for 法王寺: 34 spots
✅ Completed: 法王寺 (34 spots)

📊 Migration Summary:
   Scenic Areas: 12
   Total Spots: 359
   Successful Areas: 12
   Failed Areas: 0
🎉 Migration completed successfully!
```

**Single File Migration:**
```
🚀 Starting data migration to EdgeOne KV storage...
📁 Source path: /path/to/assets/dengfeng/data
🌐 API endpoint: https://df.qingfan.wang
🎯 Target spot file: spots/fawangsi.json

✅ Loaded scenic areas data: 12 areas
ℹ️  Uploading scenic areas data...
✅ Scenic areas uploaded successfully: 12 areas

🎯 Migrating specific spot file...
ℹ️  Found area: 法王寺 for spot file: spots/fawangsi.json
ℹ️  Loaded spots data: 34 spots
ℹ️  Uploading spots data for area: 法王寺
✅ Spots data uploaded for 法王寺: 34 spots
✅ Completed: 法王寺 (34 spots)
📊 Migration Summary:
   Scenic Areas: 12
   Total Spots: 34
   Successful Areas: 1
   Failed Areas: 0
🎉 Migration completed successfully!
```

## Sync from EdgeOne KV Storage

The `sync-from-edgeone.js` script downloads data from EdgeOne KV storage back to local assets folder.

### Usage

#### Option 1: Default location
```bash
cd scripts
node sync-from-edgeone.js
```

#### Option 2: Custom data folder
```bash
cd scripts
node sync-from-edgeone.js assets/dengfeng/data
```

#### Option 3: With custom API endpoint
```bash
cd scripts
EDGEONE_API_URL=https://your-worker-domain.com node sync-from-edgeone.js assets/dengfeng/data
```

### What it does

1. **Fetches Scenic Areas**: Downloads scenic areas data from `/api/scenic-areas`
2. **Backs Up Existing Files**: Creates timestamped backups of existing files
3. **Downloads Spots Data**: For each scenic area, downloads spots data from `/api/spots`
4. **Writes Local Files**: Saves all data to the specified local folder

### Features

- **Automatic Backups**: Creates `.backup.{timestamp}` files before overwriting
- **Directory Creation**: Automatically creates missing directories
- **Error Handling**: Continues processing if individual areas fail
- **Progress Tracking**: Shows detailed progress and summary

### Example Output

```
🔄 Starting sync from EdgeOne KV storage...
📁 Target folder: /path/to/assets/dengfeng/data
🌐 API endpoint: https://df.qingfan.wang

ℹ️  Fetching scenic areas data from EdgeOne KV...
✅ Fetched 12 scenic areas
ℹ️  Backed up: /path/to/scenic-area.json → /path/to/scenic-area.json.backup.1703123456789
✅ Written: /path/to/scenic-area.json

ℹ️  Processing area: 法王寺
✅ Written: /path/to/spots/fawangsi.json
✅ Completed: 法王寺 (34 spots)

📊 Sync Summary:
   Scenic Areas: 12
   Total Spots: 359
   Successful Areas: 12
   Failed Areas: 0
   Target Folder: /path/to/assets/dengfeng/data
🎉 Sync completed successfully!
```

### Prerequisites

1. **EdgeOne Functions Deployed**: Make sure your EdgeOne functions are deployed and accessible
2. **Environment Variables**: Set the API endpoint (optional, defaults to `https://worker.qingfan.org`)

### Usage

#### Option 1: Direct execution
```bash
cd scripts
node migrate-to-edgeone.js
```

#### Option 2: Using npm script
```bash
cd scripts
npm run migrate
```

#### Option 3: With custom API endpoint
```bash
cd scripts
EDGEONE_API_URL=https://your-worker-domain.com node migrate-to-edgeone.js
```

### What it does

1. **Loads Scenic Areas**: Reads `assets/dengfeng/data/scenic-area.json`
2. **Uploads Scenic Areas**: Posts the scenic areas data to `/api/scenic-areas`
3. **Loads Spots Data**: For each scenic area, reads its corresponding spots file
4. **Uploads Spots Data**: Posts each area's spots data to `/api/spots`

### Data Structure Support

The script supports both data formats:
- **Old Format**: Direct array of spots
- **New Format**: Baidu Map search result with `results` array

### Output

The script provides colored console output showing:
- ✅ Success messages (green)
- ❌ Error messages (red)
- ℹ️ Info messages (blue)
- 📊 Summary statistics

### Example Output

```
🚀 Starting data migration to EdgeOne KV storage...
📁 Source path: /path/to/assets/dengfeng/data
🌐 API endpoint: https://worker.qingfan.org

✅ Loaded scenic areas data: 10 areas
ℹ️  Uploading scenic areas data...
✅ Scenic areas uploaded successfully: 10 areas

ℹ️  Processing area: 法王寺
ℹ️  Loaded spots data: 34 spots
ℹ️  Uploading spots data for area: 法王寺
✅ Spots data uploaded for 法王寺: 34 spots
✅ Completed: 法王寺 (34 spots)

📊 Migration Summary:
   Scenic Areas: 10
   Total Spots: 245
   Successful Areas: 10
   Failed Areas: 0
🎉 Migration completed successfully!
```

### Error Handling

- If a single area fails to migrate, the script continues with other areas
- Detailed error messages are shown for debugging
- A summary shows how many areas succeeded/failed

### Troubleshooting

1. **API Connection Issues**: Check if your EdgeOne functions are deployed and accessible
2. **File Not Found**: Ensure the data files exist in `assets/dengfeng/data`
3. **Permission Issues**: Make sure the script has read access to the data files
4. **KV Storage Issues**: Verify your EdgeOne KV bindings are configured correctly 