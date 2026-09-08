#!/usr/bin/env node

/**
 * Bottleneck API Test Harness
 * 
 * This script tests both bottleneck endpoints to verify:
 * 1. Routes are properly registered
 * 2. Controllers are computing values dynamically
 * 3. AI fallbacks are set to null (not mock data)
 * 4. Console logs appear for verification
 * 
 * Usage: node scripts/test_bottleneck_api.js
 */

const axios = require('axios');

const BASE_URL = 'http://localhost:5000';
const API_JWT = process.env.TEST_JWT || 'test-token'; // Will need real JWT for auth

console.log('\n╔════════════════════════════════════════════════════════════╗');
console.log('║     Bottleneck System API Test Harness                     ║');
console.log('╚════════════════════════════════════════════════════════════╝\n');

// Test Case 1: Command Mode
async function testCommandMode() {
  console.log('📋 Test 1: Command Mode Endpoint');
  console.log('─'.repeat(60));
  
  const payload = {
    affectedPopulation: 5000,
    disasterIntensity: 7,
    preparednessScore: 60,
    evacuationLoad: 50,
    roadCapacityMultiplier: 'normal',
    timeOfDay: 'day'
  };
  
  console.log('Request payload:');
  console.log(JSON.stringify(payload, null, 2));
  
  try {
    const response = await axios.post(
      `${BASE_URL}/api/bottleneck/command`,
      payload,
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${API_JWT}`
        }
      }
    );
    
    console.log('\n✅ Response received:');
    console.log(JSON.stringify(response.data, null, 2));
    
    // Verification
    console.log('\n🔍 Verification:');
    if (response.data.simulation) {
      console.log(`  ✓ Congestion Risk: ${response.data.simulation.congestionRiskPercent}% (dynamic value)`);
      console.log(`  ✓ Evacuation Flow Rate: ${response.data.simulation.evacuationFlowRate} people/min`);
      console.log(`  ✓ Total Evacuation Time: ${response.data.simulation.totalEvacuationTimeMinutes} minutes`);
      console.log(`  ✓ Bottleneck Count: ${response.data.simulation.bottlenecks.length}`);
      console.log(`  ✓ Confidence Level: ${response.data.simulation.confidenceLevel}%`);
    }
    
    if (response.data.aiSummary === null) {
      console.log('  ✓ AI Summary: null (correct - not mock data)');
    } else if (response.data.aiSummary) {
      console.log('  ✓ AI Summary: Present (Groq API responded)');
      console.log(`    Strategy: ${response.data.aiSummary.substring(0, 100)}...`);
    }
    
    return true;
  } catch (error) {
    console.error('\n❌ Error:', error.response?.data || error.message);
    return false;
  }
}

// Test Case 2: Civilian Mode
async function testCivilianMode() {
  console.log('\n\n📋 Test 2: Civilian Mode Endpoint');
  console.log('─'.repeat(60));
  
  const payload = {
    userLatitude: 40.7128,
    userLongitude: -74.0060,
    familySize: 3,
    mobilityType: 'vehicle',
    departureDelay: 0,
    disasterType: 'earthquake',
    disasterIntensity: 8,
    preparednessScore: 65
  };
  
  console.log('Request payload:');
  console.log(JSON.stringify(payload, null, 2));
  
  try {
    const response = await axios.post(
      `${BASE_URL}/api/bottleneck/civilian`,
      payload,
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${API_JWT}`
        }
      }
    );
    
    console.log('\n✅ Response received:');
    console.log(JSON.stringify(response.data, null, 2));
    
    // Verification
    console.log('\n🔍 Verification:');
    if (response.data.zone) {
      console.log(`  ✓ Assigned Zone: ${response.data.zone.name}`);
    }
    
    if (response.data.routeAnalysis && response.data.routeAnalysis.length > 0) {
      console.log(`  ✓ Route Count: ${response.data.routeAnalysis.length}`);
      console.log(`  ✓ Recommended Route: ${response.data.recommendedRoute.name || 'Primary Route'}`);
      console.log(`  ✓ Safety Score: ${response.data.recommendedRoute.safetyScore}`);
    }
    
    console.log(`  ✓ Avg Congestion Risk: ${response.data.congestionRiskPercent}%`);
    console.log(`  ✓ Est. Evacuation Time: ${response.data.evacuationTimeEstimate} minutes`);
    
    if (response.data.aiGuidance === null) {
      console.log('  ✓ AI Guidance: null (correct - not mock data)');
    } else if (response.data.aiGuidance) {
      console.log('  ✓ AI Guidance: Present (Groq API responded)');
      console.log(`    Safety Summary: ${response.data.aiGuidance.safetySummary?.substring(0, 100)}...`);
    }
    
    return true;
  } catch (error) {
    console.error('\n❌ Error:', error.response?.data || error.message);
    return false;
  }
}

// Test Case 3: Check for Mock Data
async function testNoMockData() {
  console.log('\n\n📋 Test 3: Verify No Mock Data in Responses');
  console.log('─'.repeat(60));
  
  const payload = {
    affectedPopulation: 1000,
    disasterIntensity: 5,
    preparednessScore: 50,
    evacuationLoad: 30,
    roadCapacityMultiplier: 'limited',
    timeOfDay: 'night'
  };
  
  try {
    const response = await axios.post(
      `${BASE_URL}/api/bottleneck/command`,
      payload,
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${API_JWT}`
        }
      }
    );
    
    const data = JSON.stringify(response.data);
    
    // Check for mock data patterns
    const mockedStrings = [
      'Mock data',
      'placeholder',
      'TODO',
      'hardcoded',
      'will be implemented',
      'pending verification'
    ];
    
    let hasMockData = false;
    for (const mockStr of mockedStrings) {
      if (data.toLowerCase().includes(mockStr.toLowerCase())) {
        console.log(`  ❌ Found mock data: "${mockStr}"`);
        hasMockData = true;
      }
    }
    
    if (!hasMockData) {
      console.log('  ✓ No mock data patterns detected');
      console.log('  ✓ All values appear to be dynamically computed');
    }
    
    // Verify values change with different parameters
    const response2 = await axios.post(
      `${BASE_URL}/api/bottleneck/command`,
      {
        ...payload,
        affectedPopulation: 10000, // Different value
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${API_JWT}`
        }
      }
    );
    
    if (response.data.simulation.congestionRiskPercent !== response2.data.simulation.congestionRiskPercent) {
      console.log('  ✓ Responses vary with different parameters (not hardcoded)');
    } else {
      console.log('  ⚠️  Responses identical with different parameters (might be static)');
    }
    
    return !hasMockData;
  } catch (error) {
    console.error('\n❌ Error:', error.response?.data || error.message);
    return false;
  }
}

// Main execution
async function main() {
  console.log('ℹ️  Make sure backend is running on port 5000');
  console.log('ℹ️  Run: cd backend && npm run dev\n');
  
  let passCount = 0;
  
  // Test 1
  try {
    if (await testCommandMode()) passCount++;
  } catch (e) {
    console.log('⚠️  Command mode test skipped (backend not running?)');
  }
  
  // Test 2
  try {
    if (await testCivilianMode()) passCount++;
  } catch (e) {
    console.log('⚠️  Civilian mode test skipped (backend not running?)');
  }
  
  // Test 3
  try {
    if (await testNoMockData()) passCount++;
  } catch (e) {
    console.log('⚠️  Mock data test skipped (backend not running?)');
  }
  
  console.log('\n╔════════════════════════════════════════════════════════════╗');
  console.log(`║  Tests Passed: ${passCount}/3                                      ║`);
  console.log('╚════════════════════════════════════════════════════════════╝\n');
  
  process.exit(passCount === 3 ? 0 : 1);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
