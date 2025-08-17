#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import process from 'process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration
const ASSETS_DIR = 'assets';
const DASHSCOPE_API_KEY = process.env.VITE_DASHSCOPE_API_KEY || process.env.DASHSCOPE_API_KEY || '';

// Province name mappings
const PROVINCE_MAPPINGS = {
  'henan': '河南',
  'shandong': '山东', 
  'jiangsu': '江苏',
  'shanxi': '山西',
  'zhejiang': '浙江'
};

// AI service to query scenic areas using QWen-plus
async function queryScenicAreasFromAI(provinceName) {
  console.log(`🤖 正在查询${provinceName}省的景区信息...`);
  
  const prompt = `请列出${provinceName}省所有1A级及以上的旅游景区，包括5A、4A、3A、2A、1A级景区。
请按以下JSON格式返回，确保数据准确：
{
  "province": "${provinceName}",
  "scenicAreas": [
    {
      "name": "景区名称",
      "level": "5A|4A|3A|2A|1A",
      "city": "所在城市",
      "description": "简短描述",
      "coordinates": {
        "lat": 纬度,
        "lng": 经度
      }
    }
  ]
}

要求：
1. 包含所有知名景区，特别是高等级景区
2. 坐标信息要准确
3. 城市名称使用标准中文名称
4. 只返回JSON格式，不要其他说明文字
5. 确保数据真实可靠，不要编造景区`;

  try {
    const response = await fetch('https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${DASHSCOPE_API_KEY}`
      },
      body: JSON.stringify({
        model: 'qwen-plus',
        messages: [
          {
            role: 'system',
            content: '你是一位专业的旅游地理专家，对中国各省的旅游景区非常了解。请提供准确、真实的景区信息。'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        max_tokens: 4000,
        temperature: 0.1 // 低温度确保准确性
      })
    });

    if (!response.ok) {
      throw new Error(`QWen API 请求失败: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    const content = data.choices[0].message.content.trim();
    
    console.log(`✅ AI 返回内容长度: ${content.length} 字符`);
    
    // 尝试解析JSON
    try {
      // 清理可能的markdown格式
      const cleanContent = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      const result = JSON.parse(cleanContent);
      
      if (!result.scenicAreas || !Array.isArray(result.scenicAreas)) {
        throw new Error('AI返回的数据格式不正确');
      }
      
      console.log(`✅ 成功解析，找到 ${result.scenicAreas.length} 个景区`);
      return result;
      
    } catch (parseError) {
      console.error('❌ JSON解析失败:', parseError.message);
      console.log('原始内容:', content);
      throw new Error('AI返回的数据无法解析为JSON格式');
    }

  } catch (error) {
    console.error(`❌ 查询AI失败:`, error.message);
    throw error;
  }
}

// Generate scenic area entry from AI data
function generateScenicAreaFromAI(aiArea) {
  return {
    name: aiArea.name,
    level: aiArea.level,
    city: aiArea.city,
    description: aiArea.description,
    center: {
      lat: aiArea.coordinates.lat,
      lng: aiArea.coordinates.lng
    },
    radius: 2000,
    mapLevel: 18,
    spotsFile: `spots/${aiArea.name}.json`,
    display: 'show'
  };
}

// Compare with existing scenic areas
function compareWithExisting(cityPath, aiAreas) {
  const scenicAreaFile = path.join(cityPath, 'data', 'scenic-area.json');
  let existingAreas = [];
  
  if (fs.existsSync(scenicAreaFile)) {
    try {
      existingAreas = JSON.parse(fs.readFileSync(scenicAreaFile, 'utf8'));
    } catch (error) {
      console.warn(`⚠️  无法读取现有scenic-area.json: ${error.message}`);
    }
  }
  
  const existingNames = existingAreas.map(area => area.name);
  const aiNames = aiAreas.map(area => area.name);
  
  const missing = aiAreas.filter(area => !existingNames.includes(area.name));
  const existing = aiAreas.filter(area => existingNames.includes(area.name));
  const obsolete = existingAreas.filter(area => !aiNames.includes(area.name));
  
  return { missing, existing, obsolete, existingAreas };
}

// Find city directory by name (handles Chinese names)
function findCityDirectory(provincePath, cityName) {
  if (!fs.existsSync(provincePath)) {
    return null;
  }
  
  const cityDirs = fs.readdirSync(provincePath, { withFileTypes: true })
    .filter(dirent => dirent.isDirectory())
    .map(dirent => dirent.name);
  
  // Try exact match first
  let cityDir = cityDirs.find(dir => dir === cityName);
  if (cityDir) return cityDir;
  
  // Try partial match
  cityDir = cityDirs.find(dir => dir.includes(cityName) || cityName.includes(dir));
  if (cityDir) return cityDir;
  
  // Try removing common suffixes
  const cleanCityName = cityName.replace(/[市县区]/g, '');
  cityDir = cityDirs.find(dir => {
    const cleanDir = dir.replace(/[市县区]/g, '');
    return cleanDir === cleanCityName || cleanDir.includes(cleanCityName) || cleanCityName.includes(cleanDir);
  });
  
  return cityDir;
}

// Process a single province
async function processProvince(provinceCode) {
  const provinceName = PROVINCE_MAPPINGS[provinceCode];
  if (!provinceName) {
    console.error(`❌ 未知的省份代码: ${provinceCode}`);
    return;
  }
  
  console.log(`\n🏛️  处理省份: ${provinceName} (${provinceCode})`);
  console.log('='.repeat(50));
  
  // Validate API key
  if (!DASHSCOPE_API_KEY) {
    console.error('❌ 未设置 DashScope API 密钥');
    console.log('请设置环境变量: DASHSCOPE_API_KEY 或 VITE_DASHSCOPE_API_KEY');
    return;
  }
  
  try {
    // Query AI for scenic areas
    const aiData = await queryScenicAreasFromAI(provinceName);
    
    if (!aiData.scenicAreas || aiData.scenicAreas.length === 0) {
      console.log(`❌ 未找到${provinceName}的景区信息`);
      return;
    }
    
    console.log(`✅ AI找到 ${aiData.scenicAreas.length} 个景区`);
    
    // Group by city
    const citiesData = {};
    aiData.scenicAreas.forEach(area => {
      if (!citiesData[area.city]) {
        citiesData[area.city] = [];
      }
      citiesData[area.city].push(area);
    });
    
    console.log(`📍 涉及城市: ${Object.keys(citiesData).join(', ')}`);
    
    // Process each city
    const provincePath = path.join(ASSETS_DIR, provinceCode);
    let totalProcessed = 0;
    let totalMissing = 0;
    let totalUpdated = 0;
    
    for (const [cityName, cityAreas] of Object.entries(citiesData)) {
      console.log(`\n📍 处理 ${cityName} (${cityAreas.length} 个景区):`);
      
      // Find corresponding city directory
      const cityDir = findCityDirectory(provincePath, cityName);
      
      if (!cityDir) {
        console.log(`   ⚠️  未找到城市目录: ${cityName}，跳过...`);
        console.log(`   💡 提示: 请先在 ${provincePath} 中创建 ${cityName} 目录`);
        continue;
      }
      
      const cityPath = path.join(provincePath, cityDir);
      console.log(`   📂 使用目录: ${cityDir}`);
      
      // Compare with existing data
      const comparison = compareWithExisting(cityPath, cityAreas);
      
      console.log(`   📊 分析结果:`);
      console.log(`      • AI发现: ${cityAreas.length} 个景区`);
      console.log(`      • 已存在: ${comparison.existing.length} 个景区`);
      console.log(`      • 缺失: ${comparison.missing.length} 个景区`);
      console.log(`      • 过时: ${comparison.obsolete.length} 个景区`);
      
      if (comparison.missing.length > 0) {
        console.log(`   ➕ 缺失景区: ${comparison.missing.map(a => `${a.name}(${a.level})`).join(', ')}`);
      }
      
      if (comparison.obsolete.length > 0) {
        console.log(`   ❓ 过时景区: ${comparison.obsolete.map(a => a.name).join(', ')}`);
      }
      
      // Create updated scenic areas list
      const updatedAreas = [
        ...comparison.existingAreas, // Keep existing areas
        ...comparison.missing.map(generateScenicAreaFromAI) // Add missing areas
      ];
      
      // Ensure data directory exists
      const dataDir = path.join(cityPath, 'data');
      if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
        console.log(`   📁 创建数据目录: ${dataDir}`);
      }
      
      // Write updated scenic-area.json
      const scenicAreaFile = path.join(dataDir, 'scenic-area.json');
      fs.writeFileSync(scenicAreaFile, JSON.stringify(updatedAreas, null, 2));
      
      totalProcessed += cityAreas.length;
      totalMissing += comparison.missing.length;
      if (comparison.missing.length > 0) totalUpdated++;
      
      console.log(`   ✅ 已更新 ${scenicAreaFile}`);
      
      // Create placeholder spots files for new areas
      const spotsDir = path.join(dataDir, 'spots');
      if (!fs.existsSync(spotsDir)) {
        fs.mkdirSync(spotsDir, { recursive: true });
      }
      
      for (const missingArea of comparison.missing) {
        const spotsFile = path.join(spotsDir, `${missingArea.name}.json`);
        if (!fs.existsSync(spotsFile)) {
          // Create empty spots file
          fs.writeFileSync(spotsFile, JSON.stringify([], null, 2));
          console.log(`   📄 创建空景点文件: ${spotsFile}`);
        }
      }
    }
    
    console.log(`\n📊 省份处理总结:`);
    console.log(`   • 总景区数: ${totalProcessed}`);
    console.log(`   • 新增景区: ${totalMissing}`);
    console.log(`   • 更新城市: ${totalUpdated}`);
    
  } catch (error) {
    console.error(`❌ 处理省份失败:`, error.message);
    throw error;
  }
}

// Main function
async function discoverScenicAreas() {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    console.log('🤖 AI驱动的景区发现工具');
    console.log('=====================================\n');
    console.log('用法: node scripts/discover-scenic-areas-ai.js <省份代码>');
    console.log('\n可用省份:');
    Object.entries(PROVINCE_MAPPINGS).forEach(([code, name]) => {
      console.log(`  ${code} - ${name}`);
    });
    console.log('\n示例: node scripts/discover-scenic-areas-ai.js shandong');
    console.log('\n环境变量:');
    console.log('  DASHSCOPE_API_KEY - 阿里云DashScope API密钥');
    return;
  }
  
  const provinceCode = args[0].toLowerCase();
  
  if (!PROVINCE_MAPPINGS[provinceCode]) {
    console.error(`❌ 无效的省份代码: ${provinceCode}`);
    console.log('可用省份:', Object.keys(PROVINCE_MAPPINGS).join(', '));
    return;
  }
  
  console.log('🤖 AI驱动的景区发现工具');
  console.log('=====================================');
  
  try {
    await processProvince(provinceCode);
    
    console.log('\n✅ 发现完成!');
    console.log('\n💡 后续步骤:');
    console.log('   1. 检查更新的 scenic-area.json 文件');
    console.log('   2. 为新景区创建景点数据文件');
    console.log('   3. 添加图片和音频内容');
    console.log('   4. 运行 refresh-locations.js 更新索引');
    
  } catch (error) {
    console.error('❌ 程序执行失败:', error.message);
    process.exit(1);
  }
}

// Run the script
if (import.meta.url === `file://${process.argv[1]}`) {
  discoverScenicAreas().catch(console.error);
}

export { processProvince, queryScenicAreasFromAI };
