#!/usr/bin/env node

// 百度地图周边搜索示例
// 展示如何使用 searchNearbySpots.js 脚本

import process from 'process';
import { searchNearbyPlaces } from './searchNearbySpots.js';

console.log('🗺️ 百度地图周边搜索示例');
console.log('');

// 少林寺坐标
const SHAOLIN_COORDS = {
  lng: 113.0362,
  lat: 34.5083
};

// 示例1: 搜索少林寺周边景点
async function searchNearbyAttractions() {
  console.log('示例1: 搜索少林寺周边景点');
  console.log('─'.repeat(50));
  
  const options = {
    longitude: SHAOLIN_COORDS.lng,
    latitude: SHAOLIN_COORDS.lat,
    radius: 3000, // 3公里
    query: '景点',
    type: '旅游景点',
    sort: 'distance',
    pages: 3,
    key: process.env.BAIDU_API_KEY || 'Cl5iurg6EmFjYEWh2KgnwDkeB9DjNZqn'
  };

  try {
    const results = await searchNearbyPlaces(options);
    console.log(`✅ 找到 ${results.results.length} 个景点`);
    
    // 显示前5个结果
    results.results.slice(0, 5).forEach((place, index) => {
      console.log(`${index + 1}. ${place.name} (${place.distance}米)`);
    });
  } catch (error) {
    console.error('❌ 搜索失败:', error.message);
  }
}

// 示例2: 搜索餐厅
async function searchNearbyRestaurants() {
  console.log('\n示例2: 搜索少林寺周边餐厅');
  console.log('─'.repeat(50));
  
  const options = {
    longitude: SHAOLIN_COORDS.lng,
    latitude: SHAOLIN_COORDS.lat,
    radius: 2000, // 2公里
    query: '餐厅',
    type: '餐饮',
    sort: 'rating',
    pages: 2,
    key: process.env.BAIDU_API_KEY || 'Cl5iurg6EmFjYEWh2KgnwDkeB9DjNZqn'
  };

  try {
    const results = await searchNearbyPlaces(options);
    console.log(`✅ 找到 ${results.results.length} 个餐厅`);
    
    // 显示评分最高的3个
    results.results.slice(0, 3).forEach((place, index) => {
      console.log(`${index + 1}. ${place.name} (评分: ${place.rating}/5)`);
    });
  } catch (error) {
    console.error('❌ 搜索失败:', error.message);
  }
}

// 示例3: 搜索酒店
async function searchNearbyHotels() {
  console.log('\n示例3: 搜索少林寺周边酒店');
  console.log('─'.repeat(50));
  
  const options = {
    longitude: SHAOLIN_COORDS.lng,
    latitude: SHAOLIN_COORDS.lat,
    radius: 5000, // 5公里
    query: '酒店',
    type: '住宿',
    sort: 'distance',
    pages: 2,
    key: process.env.BAIDU_API_KEY || 'Cl5iurg6EmFjYEWh2KgnwDkeB9DjNZqn'
  };

  try {
    const results = await searchNearbyPlaces(options);
    console.log(`✅ 找到 ${results.results.length} 个酒店`);
    
    // 显示最近的3个
    results.results.slice(0, 3).forEach((place, index) => {
      console.log(`${index + 1}. ${place.name} (${place.distance}米)`);
    });
  } catch (error) {
    console.error('❌ 搜索失败:', error.message);
  }
}

// 示例4: 搜索购物场所
async function searchNearbyShopping() {
  console.log('\n示例4: 搜索少林寺周边购物场所');
  console.log('─'.repeat(50));
  
  const options = {
    longitude: SHAOLIN_COORDS.lng,
    latitude: SHAOLIN_COORDS.lat,
    radius: 3000, // 3公里
    query: '购物',
    type: '购物',
    sort: 'distance',
    pages: 2,
    key: process.env.BAIDU_API_KEY || 'Cl5iurg6EmFjYEWh2KgnwDkeB9DjNZqn'
  };

  try {
    const results = await searchNearbyPlaces(options);
    console.log(`✅ 找到 ${results.results.length} 个购物场所`);
    
    // 显示最近的3个
    results.results.slice(0, 3).forEach((place, index) => {
      console.log(`${index + 1}. ${place.name} (${place.distance}米)`);
    });
  } catch (error) {
    console.error('❌ 搜索失败:', error.message);
  }
}

// 示例5: 搜索交通设施
async function searchNearbyTransport() {
  console.log('\n示例5: 搜索少林寺周边交通设施');
  console.log('─'.repeat(50));
  
  const options = {
    longitude: SHAOLIN_COORDS.lng,
    latitude: SHAOLIN_COORDS.lat,
    radius: 2000, // 2公里
    query: '公交站',
    type: '交通',
    sort: 'distance',
    pages: 2,
    key: process.env.BAIDU_API_KEY || 'Cl5iurg6EmFjYEWh2KgnwDkeB9DjNZqn'
  };

  try {
    const results = await searchNearbyPlaces(options);
    console.log(`✅ 找到 ${results.results.length} 个交通设施`);
    
    // 显示最近的3个
    results.results.slice(0, 3).forEach((place, index) => {
      console.log(`${index + 1}. ${place.name} (${place.distance}米)`);
    });
  } catch (error) {
    console.error('❌ 搜索失败:', error.message);
  }
}

// 运行所有示例
async function runAllExamples() {
  console.log('🚀 开始运行周边搜索示例...\n');
  
  await searchNearbyAttractions();
  await searchNearbyRestaurants();
  await searchNearbyHotels();
  await searchNearbyShopping();
  await searchNearbyTransport();
  
  console.log('\n🎉 所有示例运行完成!');
  console.log('\n💡 提示:');
  console.log('1. 您可以使用 --help 查看完整的使用说明');
  console.log('2. 使用 -o 参数保存结果到文件');
  console.log('3. 使用 -r 参数调整搜索半径');
  console.log('4. 使用 --type 参数指定地点类型');
}

// 如果直接运行此脚本
if (import.meta.url === `file://${process.argv[1]}`) {
  runAllExamples();
} 