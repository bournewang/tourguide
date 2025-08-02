#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import process from 'process';
import * as turf from '@turf/turf';

// Configuration
const OVERLAP_THRESHOLD = 0.1; // 10% overlap threshold
const CITIES = ['dengfeng', 'kaifeng', 'preview'];

/**
 * Calculate overlap percentage between two areas
 */
function calculateOverlap(area1, area2) {
  try {
    // Create polygons from center and radius if polygon doesn't exist
    const poly1 = area1.polygon || createCirclePolygon(area1.center, area1.radius);
    const poly2 = area2.polygon || createCirclePolygon(area2.center, area2.radius);
    
    if (!poly1 || !poly2) {
      return 0;
    }
    
    // Calculate intersection
    const intersection = turf.intersect(poly1, poly2);
    if (!intersection) {
      return 0;
    }
    
    // Calculate areas
    const area1Size = turf.area(poly1);
    const area2Size = turf.area(poly2);
    const intersectionSize = turf.area(intersection);
    
    // Calculate overlap percentage (relative to smaller area)
    const smallerArea = Math.min(area1Size, area2Size);
    const overlapPercentage = intersectionSize / smallerArea;
    
    return overlapPercentage;
  } catch {
    // Fallback to simple distance-based overlap detection
    const distance = calculateDistance(area1.center, area2.center);
    const combinedRadius = area1.radius + area2.radius;
    
    if (distance < combinedRadius) {
      // Simple overlap calculation based on distance and radii
      const overlapDistance = combinedRadius - distance;
      const smallerRadius = Math.min(area1.radius, area2.radius);
      return Math.min(overlapDistance / smallerRadius, 1);
    }
    
    return 0;
  }
}

/**
 * Create a circular polygon from center and radius
 */
function createCirclePolygon(center, radius) {
  try {
    return turf.circle([center.lng, center.lat], radius / 1000, { steps: 32 });
  } catch (error) {
    console.error('Error creating circle polygon:', error.message);
    return null;
  }
}

/**
 * Detect overlaps in a city's scenic areas
 */
function detectOverlaps(cityName) {
  const dataPath = path.join('assets', cityName, 'data', 'scenic-area.json');
  
  if (!fs.existsSync(dataPath)) {
    console.log(`❌ No scenic area data found for ${cityName}`);
    return;
  }
  
  console.log(`\n🔍 Analyzing overlaps for ${cityName}...`);
  
  try {
    const data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
    const areas = Array.isArray(data) ? data : data.scenicAreas || [];
    
    if (areas.length === 0) {
      console.log(`❌ No scenic areas found in ${cityName}`);
      return;
    }
    
    console.log(`📊 Found ${areas.length} scenic areas`);
    
    const overlaps = [];
    
    // Check each pair of areas for overlaps
    for (let i = 0; i < areas.length; i++) {
      for (let j = i + 1; j < areas.length; j++) {
        const area1 = areas[i];
        const area2 = areas[j];
        
        if (!area1.center || !area1.radius || !area2.center || !area2.radius) {
          continue;
        }
        
        const overlapPercentage = calculateOverlap(area1, area2);
        
        if (overlapPercentage > OVERLAP_THRESHOLD) {
          overlaps.push({
            area1: area1.name,
            area2: area2.name,
            overlap: overlapPercentage,
            area1Radius: area1.radius,
            area2Radius: area2.radius,
            distance: calculateDistance(area1.center, area2.center)
          });
        }
      }
    }
    
    if (overlaps.length === 0) {
      console.log(`✅ No significant overlaps detected (threshold: ${OVERLAP_THRESHOLD * 100}%)`);
    } else {
      console.log(`⚠️  Found ${overlaps.length} overlapping area pairs:`);
      
      overlaps.sort((a, b) => b.overlap - a.overlap);
      
      overlaps.forEach((overlap, index) => {
        console.log(`\n${index + 1}. ${overlap.area1} ↔ ${overlap.area2}`);
        console.log(`   Overlap: ${(overlap.overlap * 100).toFixed(1)}%`);
        console.log(`   Radii: ${overlap.area1Radius}m, ${overlap.area2Radius}m`);
        console.log(`   Distance: ${overlap.distance.toFixed(0)}m`);
        
        // Suggest fixes
        if (overlap.overlap > 0.5) {
          console.log(`   🔴 HIGH OVERLAP - Consider reducing radius of smaller area`);
        } else if (overlap.overlap > 0.2) {
          console.log(`   🟡 MEDIUM OVERLAP - Consider adjusting centers or radii`);
        } else {
          console.log(`   🟢 LOW OVERLAP - Minor adjustment may be needed`);
        }
      });
    }
    
    return overlaps;
    
  } catch (error) {
    console.error(`❌ Error analyzing ${cityName}:`, error.message);
    return [];
  }
}

/**
 * Calculate distance between two points
 */
function calculateDistance(point1, point2) {
  const R = 6371000; // Earth's radius in meters
  const dLat = (point2.lat - point1.lat) * Math.PI / 180;
  const dLng = (point2.lng - point1.lng) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(point1.lat * Math.PI / 180) * Math.cos(point2.lat * Math.PI / 180) *
            Math.sin(dLng/2) * Math.sin(dLng/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

/**
 * Generate suggestions for fixing overlaps
 */
function generateSuggestions(overlaps) {
  if (!overlaps || overlaps.length === 0) return;
  
  console.log('\n💡 Suggestions for fixing overlaps:');
  console.log('1. Reduce radius of smaller areas');
  console.log('2. Adjust center points to better represent actual boundaries');
  console.log('3. Use polygon boundaries instead of circles for complex shapes');
  console.log('4. Consider hierarchical structure (parent-child areas)');
  console.log('5. Set priority for larger/more important areas');
}

/**
 * Main function
 */
function main() {
  console.log('🎯 Scenic Area Overlap Detection Tool');
  console.log('=====================================');
  
  const cityName = process.argv[2];
  
  if (cityName) {
    // Analyze specific city
    if (!CITIES.includes(cityName)) {
      console.log(`❌ Invalid city name: ${cityName}`);
      console.log(`Available cities: ${CITIES.join(', ')}`);
      process.exit(1);
    }
    
    const overlaps = detectOverlaps(cityName);
    generateSuggestions(overlaps);
    
  } else {
    // Analyze all cities
    console.log('Analyzing all cities...\n');
    
    let totalOverlaps = 0;
    
    CITIES.forEach(city => {
      const overlaps = detectOverlaps(city);
      if (overlaps) {
        totalOverlaps += overlaps.length;
      }
    });
    
    console.log(`\n📈 Summary: Found ${totalOverlaps} total overlaps across all cities`);
    
    if (totalOverlaps > 0) {
      generateSuggestions();
    }
  }
}

// Run the script
main(); 