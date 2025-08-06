import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CITIES_DIR = path.join(__dirname, '../cities');
const PUBLIC_DATA_DIR = path.join(__dirname, '../public/data');
const OUTPUT_FILE = path.join(PUBLIC_DATA_DIR, 'cities.json');

function listCities() {
  const cities = [];
  
  if (fs.existsSync(CITIES_DIR)) {
    const files = fs.readdirSync(CITIES_DIR);
    files.forEach(file => {
      if (file.endsWith('.json')) {
        const cityName = file.replace('.json', '');
        try {
          const configPath = path.join(CITIES_DIR, file);
          const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
          cities.push({
            id: cityName,
            name: config.displayName,
            description: config.description,
          });
        } catch (error) {
          console.warn(`⚠️  Invalid city config: ${file}`, error);
        }
      }
    });
  }
  
  return cities;
}

function main() {
  const cities = listCities();
  
  if (!fs.existsSync(PUBLIC_DATA_DIR)) {
    fs.mkdirSync(PUBLIC_DATA_DIR, { recursive: true });
  }
  
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(cities, null, 2));
  console.log(`✅ Successfully generated cities.json at ${OUTPUT_FILE}`);
}

main();