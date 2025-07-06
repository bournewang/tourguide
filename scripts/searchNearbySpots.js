#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import process from 'process';
import fetch from 'node-fetch';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration
const BAIDU_API_KEY = process.env.BAIDU_API_KEY || 'Cl5iurg6EmFjYEWh2KgnwDkeB9DjNZqn';
const BAIDU_API_BASE = 'https://api.map.baidu.com';

// Default search parameters
const DEFAULT_RADIUS = 2000; // 2km in meters
const DEFAULT_PAGE_SIZE = 20; // Results per page
const MAX_PAGES = 10; // Maximum pages to fetch

function showUsage() {
  console.log(`
🗺️ 百度地图搜索工具 (圆形 + 矩形搜索)

用法:
  # 圆形搜索
  node searchNearbySpots.js [选项] <location> [radius]
  node searchNearbySpots.js [选项] <longitude> <latitude> [radius]

  # 矩形搜索
  node searchNearbySpots.js --rect [选项] <sw_location> <ne_location>
  node searchNearbySpots.js --rect [选项] <sw_lng> <sw_lat> <ne_lng> <ne_lat>

参数:
  # 圆形搜索参数
  location    中心点坐标 (格式: "经度,纬度" 或分别提供)
  longitude   中心点经度 (必填)
  latitude    中心点纬度 (必填)
  radius      搜索半径，单位米 (可选，默认2000米)

  # 矩形搜索参数
  sw_location 西南角坐标 (格式: "经度,纬度")
  ne_location 东北角坐标 (格式: "经度,纬度")
  sw_lng      西南角经度 (必填，矩形搜索)
  sw_lat      西南角纬度 (必填，矩形搜索)
  ne_lng      东北角经度 (必填，矩形搜索)
  ne_lat      东北角纬度 (必填，矩形搜索)

选项:
  --rect                  启用矩形搜索模式
  -k, --key <key>        百度地图API密钥
  -q, --query <query>    搜索关键词 (默认: "景点")
  -r, --radius <radius>  搜索半径，单位米 (默认: 2000，仅圆形搜索)
  -p, --pages <pages>    最大页数 (默认: 5)
  -o, --output <file>    输出文件路径 (默认: nearby_spots.json)
  --type <type>          地点类型 (可选: 景点, 餐厅, 酒店, 购物, 交通等)
  --sort <sort>          排序方式 (默认: distance, 可选: distance, rating)
  --help                 显示帮助信息

示例:
  # 圆形搜索 - 使用坐标字符串 (推荐)
  node searchNearbySpots.js "113.038573,34.520166" 2000
  node searchNearbySpots.js --query "餐厅" "113.038573,34.520166"

  # 圆形搜索 - 传统方式
  node searchNearbySpots.js 113.0362 34.5083 2000

  # 矩形搜索 - 使用坐标字符串
  node searchNearbySpots.js --rect "112.9,34.4" "113.1,34.6"
  node searchNearbySpots.js --rect --query "餐厅" "112.9,34.4" "113.1,34.6"

  # 矩形搜索 - 传统方式
  node searchNearbySpots.js --rect 112.9 34.4 113.1 34.6

  # 搜索特定类型的场所
  node searchNearbySpots.js --query "餐厅" --type "餐饮" "113.0362,34.5083"

  # 搜索更大范围并保存到文件
  node searchNearbySpots.js -r 5000 -o restaurants.json "113.0362,34.5083"

  # 使用自定义API密钥
  node searchNearbySpots.js -k "your-api-key" "113.038573,34.520166"

环境变量:
  BAIDU_API_KEY - 百度地图API密钥

输出格式:
  # 圆形搜索输出
  {
    "searchType": "circle",
    "center": { "lat": 34.5083, "lng": 113.0362 },
    "radius": 2000,
    "query": "景点",
    "total": 15,
    "results": [...]
  }

  # 矩形搜索输出
  {
    "searchType": "rectangle",
    "bounds": {
      "sw": { "lat": 34.4, "lng": 112.9 },
      "ne": { "lat": 34.6, "lng": 113.1 }
    },
    "query": "景点",
    "total": 25,
    "results": [...]
  }
`);
}

// 解析坐标字符串 "经度,纬度"
function parseCoordinateString(coordStr) {
  if (coordStr.includes(',')) {
    const parts = coordStr.split(',');
    if (parts.length === 2) {
      const lng = parseFloat(parts[0].trim());
      const lat = parseFloat(parts[1].trim());
      if (!isNaN(lng) && !isNaN(lat)) {
        return { lng, lat };
      }
    }
  }
  return null;
}

function parseArguments() {
  const args = process.argv.slice(2);
  const options = {
    searchType: 'circle', // 'circle' or 'rectangle'
    latitude: null,
    longitude: null,
    radius: DEFAULT_RADIUS,
    // Rectangle bounds
    swLng: null,
    swLat: null,
    neLng: null,
    neLat: null,
    query: '景点',
    type: '',
    sort: 'distance',
    pages: MAX_PAGES,
    output: 'nearby_spots.json',
    key: BAIDU_API_KEY
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    
    switch (arg) {
      case '--help':
        showUsage();
        process.exit(0);
        break;
      case '--rect':
        options.searchType = 'rectangle';
        break;
      case '-k':
      case '--key':
        if (i + 1 < args.length) {
          options.key = args[++i];
        }
        break;
      case '-q':
      case '--query':
        if (i + 1 < args.length) {
          options.query = args[++i];
        }
        break;
      case '-r':
      case '--radius':
        if (i + 1 < args.length) {
          options.radius = parseInt(args[++i]);
        }
        break;
      case '-p':
      case '--pages':
        if (i + 1 < args.length) {
          options.pages = parseInt(args[++i]);
        }
        break;
      case '-o':
      case '--output':
        if (i + 1 < args.length) {
          options.output = args[++i];
        }
        break;
      case '--type':
        if (i + 1 < args.length) {
          options.type = args[++i];
        }
        break;
      case '--sort':
        if (i + 1 < args.length) {
          options.sort = args[++i];
        }
        break;
      default:
        if (!arg.startsWith('-')) {
          if (options.searchType === 'rectangle') {
            // Rectangle mode: 支持坐标字符串格式
            if (!options.swLng) {
              const swCoord = parseCoordinateString(arg);
              if (swCoord) {
                options.swLng = swCoord.lng;
                options.swLat = swCoord.lat;
              } else {
                options.swLng = parseFloat(arg);
              }
            } else if (!options.swLat) {
              // 如果swLng已经设置但swLat没有，说明是传统格式
              options.swLat = parseFloat(arg);
            } else if (!options.neLng) {
              const neCoord = parseCoordinateString(arg);
              if (neCoord) {
                options.neLng = neCoord.lng;
                options.neLat = neCoord.lat;
              } else {
                options.neLng = parseFloat(arg);
              }
            } else if (!options.neLat) {
              // 如果neLng已经设置但neLat没有，说明是传统格式
              options.neLat = parseFloat(arg);
            }
          } else {
            // Circle mode: 支持坐标字符串格式
            if (!options.longitude) {
              const coord = parseCoordinateString(arg);
              if (coord) {
                options.longitude = coord.lng;
                options.latitude = coord.lat;
              } else {
                options.longitude = parseFloat(arg);
              }
            } else if (!options.latitude) {
              // 如果longitude已经设置但latitude没有，说明是传统格式
              options.latitude = parseFloat(arg);
            } else if (!options.radius) {
              options.radius = parseInt(arg);
            }
          }
        }
        break;
    }
  }

  return options;
}

function validateCoordinates(lat, lng) {
  if (isNaN(lat) || isNaN(lng)) {
    throw new Error('❌ 无效的坐标值，请提供有效的数字');
  }
  
  if (lat < -90 || lat > 90) {
    throw new Error('❌ 纬度必须在 -90 到 90 之间');
  }
  
  if (lng < -180 || lng > 180) {
    throw new Error('❌ 经度必须在 -180 到 180 之间');
  }
  
  return true;
}

function validateRectangleBounds(swLat, swLng, neLat, neLng) {
  // Validate individual coordinates
  validateCoordinates(swLat, swLng);
  validateCoordinates(neLat, neLng);
  
  // Validate rectangle bounds
  if (swLat >= neLat) {
    throw new Error('❌ 西南角纬度必须小于东北角纬度');
  }
  
  if (swLng >= neLng) {
    throw new Error('❌ 西南角经度必须小于东北角经度');
  }
  
  return true;
}

async function searchNearbyPlaces(options) {
  if (options.searchType === 'rectangle') {
    return await searchRectanglePlaces(options);
  } else {
    return await searchCirclePlaces(options);
  }
}

async function searchCirclePlaces(options) {
  const { latitude, longitude, radius, query, type, sort, pages, key } = options;
  
  console.log(`🔍 圆形搜索参数:`);
  console.log(`📍 中心点: ${latitude}, ${longitude}`);
  console.log(`📏 半径: ${radius}米`);
  console.log(`🔎 关键词: ${query}`);
  if (type) console.log(`🏷️ 类型: ${type}`);
  console.log(`📄 最大页数: ${pages}`);
  console.log('');

  const allResults = [];
  let totalResults = 0;
  let currentPage = 0;

  while (currentPage < pages) {
    try {
      console.log(`📖 正在获取第 ${currentPage + 1} 页...`);
      
      const params = new URLSearchParams({
        query: query,
        location: `${latitude},${longitude}`,
        radius: radius.toString(),
        page_size: DEFAULT_PAGE_SIZE.toString(),
        page_num: currentPage.toString(),
        output: 'json',
        ak: key
      });

      if (type) {
        params.append('type', type);
      }

      if (sort === 'rating') {
        params.append('sort_name', 'rating');
        params.append('sort_rule', 'desc');
      }

      const url = `${BAIDU_API_BASE}/place/v2/search?${params.toString()}`;
      console.log(url);
      const response = await fetch(url);
      const data = await response.json();

      if (data.status !== 0) {
        throw new Error(`API错误: ${data.message || '未知错误'}`);
      }

      const results = data.results || [];
      totalResults = data.total || 0;

      if (results.length === 0) {
        console.log('📭 没有更多结果');
        break;
      }

      // Process and format results
      const formattedResults = results.map(place => ({
        name: place.name,
        address: place.address,
        location: {
          lat: place.location.lat,
          lng: place.location.lng
        },
        distance: place.distance,
        type: place.detail_info?.type || '',
        rating: place.detail_info?.overall_rating || 0,
        uid: place.uid,
        telephone: place.telephone || '',
        detail_url: place.detail_url || '',
        price: place.detail_info?.price || '',
        business_hours: place.detail_info?.business_hours || '',
        tag: place.detail_info?.tag || ''
      }));

      allResults.push(...formattedResults);
      console.log(`✅ 获取到 ${results.length} 个结果`);

      // Check if we've got all results
      if (allResults.length >= totalResults) {
        console.log('📋 已获取所有结果');
        break;
      }

      currentPage++;
      
      // Add delay to avoid rate limiting
      if (currentPage < pages) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

    } catch (error) {
      console.error(`❌ 获取第 ${currentPage + 1} 页失败:`, error.message);
      break;
    }
  }

  return {
    searchType: 'circle',
    center: { lat: latitude, lng: longitude },
    radius: radius,
    query: query,
    type: type,
    total: totalResults,
    fetched: allResults.length,
    results: allResults
  };
}

async function searchRectanglePlaces(options) {
  const { swLat, swLng, neLat, neLng, query, type, sort, pages, key } = options;
  
  console.log(`🔍 矩形搜索参数:`);
  console.log(`📍 西南角: ${swLat}, ${swLng}`);
  console.log(`📍 东北角: ${neLat}, ${neLng}`);
  console.log(`🔎 关键词: ${query}`);
  if (type) console.log(`🏷️ 类型: ${type}`);
  console.log(`📄 最大页数: ${pages}`);
  console.log('');

  const allResults = [];
  let totalResults = 0;
  let currentPage = 0;

  while (currentPage < pages) {
    try {
      console.log(`📖 正在获取第 ${currentPage + 1} 页...`);
      
      const params = new URLSearchParams({
        query: query,
        bounds: `${swLat},${swLng},${neLat},${neLng}`,
        page_size: DEFAULT_PAGE_SIZE.toString(),
        page_num: currentPage.toString(),
        output: 'json',
        ak: key
      });

      if (type) {
        params.append('type', type);
      }

      if (sort === 'rating') {
        params.append('sort_name', 'rating');
        params.append('sort_rule', 'desc');
      }

      const url = `${BAIDU_API_BASE}/place/v2/search?${params.toString()}`;
      console.log(url);
      const response = await fetch(url);
      const data = await response.json();

      if (data.status !== 0) {
        throw new Error(`API错误: ${data.message || '未知错误'}`);
      }

      const results = data.results || [];
      totalResults = data.total || 0;

      if (results.length === 0) {
        console.log('📭 没有更多结果');
        break;
      }

      // Process and format results
      const formattedResults = results.map(place => ({
        name: place.name,
        address: place.address,
        location: {
          lat: place.location.lat,
          lng: place.location.lng
        },
        distance: place.distance || 0, // Rectangle search may not have distance
        type: place.detail_info?.type || '',
        rating: place.detail_info?.overall_rating || 0,
        uid: place.uid,
        telephone: place.telephone || '',
        detail_url: place.detail_url || '',
        price: place.detail_info?.price || '',
        business_hours: place.detail_info?.business_hours || '',
        tag: place.detail_info?.tag || ''
      }));

      allResults.push(...formattedResults);
      console.log(`✅ 获取到 ${results.length} 个结果`);

      // Check if we've got all results
      if (allResults.length >= totalResults) {
        console.log('📋 已获取所有结果');
        break;
      }

      currentPage++;
      
      // Add delay to avoid rate limiting
      if (currentPage < pages) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

    } catch (error) {
      console.error(`❌ 获取第 ${currentPage + 1} 页失败:`, error.message);
      break;
    }
  }

  return {
    searchType: 'rectangle',
    bounds: {
      sw: { lat: swLat, lng: swLng },
      ne: { lat: neLat, lng: neLng }
    },
    query: query,
    type: type,
    total: totalResults,
    fetched: allResults.length,
    results: allResults
  };
}

function saveResults(results, outputFile) {
  try {
    const outputPath = path.resolve(outputFile);
    fs.writeFileSync(outputPath, JSON.stringify(results, null, 2), 'utf8');
    console.log(`💾 结果已保存到: ${outputPath}`);
    return outputPath;
  } catch (error) {
    console.error(`❌ 保存文件失败:`, error.message);
    return null;
  }
}

function displayResults(results) {
  console.log('\n📊 搜索结果统计:');
  
  if (results.searchType === 'circle') {
    console.log(`📍 中心点: ${results.center.lat}, ${results.center.lng}`);
    console.log(`📏 搜索半径: ${results.radius}米`);
  } else {
    console.log(`📍 西南角: ${results.bounds.sw.lat}, ${results.bounds.sw.lng}`);
    console.log(`📍 东北角: ${results.bounds.ne.lat}, ${results.bounds.ne.lng}`);
  }
  
  console.log(`🔎 搜索关键词: ${results.query}`);
  if (results.type) console.log(`🏷️ 地点类型: ${results.type}`);
  console.log(`📋 总结果数: ${results.total}`);
  console.log(`📖 已获取: ${results.fetched}个`);
  console.log('');

  if (results.results.length === 0) {
    console.log('❌ 没有找到任何结果');
    return;
  }

  console.log('🏛️ 搜索结果:');
  console.log('─'.repeat(80));
  
  results.results.forEach((place, index) => {
    console.log(`${index + 1}. ${place.name}`);
    console.log(`   📍 地址: ${place.address}`);
    if (results.searchType === 'circle' && place.distance > 0) {
      console.log(`   📏 距离: ${place.distance}米`);
    }
    console.log(`   🏷️ 类型: ${place.type || '未分类'}`);
    if (place.rating > 0) {
      console.log(`   ⭐ 评分: ${place.rating}/5`);
    }
    if (place.telephone) {
      console.log(`   📞 电话: ${place.telephone}`);
    }
    if (place.price) {
      console.log(`   💰 价格: ${place.price}`);
    }
    console.log('');
  });
}

async function main() {
  try {
    const options = parseArguments();
    
    if (!options.key) {
      console.error('❌ 百度地图API密钥未设置。请设置环境变量 BAIDU_API_KEY 或使用 -k 参数');
      process.exit(1);
    }

    // Validate parameters based on search type
    if (options.searchType === 'rectangle') {
      if (!options.swLng || !options.swLat || !options.neLng || !options.neLat) {
        console.error('❌ 矩形搜索需要提供四个坐标参数: 西南角经度、纬度，东北角经度、纬度');
        showUsage();
        process.exit(1);
      }
      validateRectangleBounds(options.swLat, options.swLng, options.neLat, options.neLng);
    } else {
      if (!options.longitude || !options.latitude) {
        console.error('❌ 圆形搜索需要提供中心点的经度和纬度');
        showUsage();
        process.exit(1);
      }
      validateCoordinates(options.latitude, options.longitude);
    }

    // Search places
    const results = await searchNearbyPlaces(options);

    // Display results
    displayResults(results);

    // Save to file
    if (results.results.length > 0) {
      const savedPath = saveResults(results, options.output);
      if (savedPath) {
        console.log(`\n💡 提示: 您可以使用以下命令查看保存的结果:`);
        console.log(`   cat ${savedPath}`);
      }
    }

  } catch (error) {
    console.error('❌ 执行失败:', error.message);
    process.exit(1);
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { searchNearbyPlaces, validateCoordinates, validateRectangleBounds }; 