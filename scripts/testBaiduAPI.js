import https from 'https';
import process from 'process';
import { Buffer } from 'buffer';

// Get API credentials from environment variables
const API_KEY = process.env.BAIDU_API_KEY;
const SECRET_KEY = process.env.BAIDU_SECRET_KEY;

async function testBaiduAPI() {
    console.log('🔍 Testing Baidu API Credentials...\n');
    
    if (!API_KEY || !SECRET_KEY) {
        console.log('❌ API credentials not found!');
        console.log('📝 Please set your credentials:');
        console.log('export BAIDU_API_KEY="your-api-key"');
        console.log('export BAIDU_SECRET_KEY="your-secret-key"');
        console.log('\n💡 Or create a .env file with:');
        console.log('BAIDU_API_KEY=your-api-key');
        console.log('BAIDU_SECRET_KEY=your-secret-key');
        return;
    }
    
    console.log('✅ API credentials found');
    console.log(`API Key: ${API_KEY.substring(0, 8)}...`);
    console.log(`Secret Key: ${SECRET_KEY.substring(0, 8)}...\n`);
    
    try {
        console.log('🔄 Getting access token...');
        
        // Get access token
        const tokenUrl = `https://aip.baidubce.com/oauth/2.0/token?grant_type=client_credentials&client_id=${API_KEY}&client_secret=${SECRET_KEY}`;
        
        const response = await new Promise((resolve, reject) => {
            https.get(tokenUrl, (res) => {
                let data = '';
                res.on('data', chunk => data += chunk);
                res.on('end', () => {
                    try {
                        resolve(JSON.parse(data));
                    } catch {
                        reject(new Error('Invalid JSON response'));
                    }
                });
            }).on('error', reject);
        });
        
        if (response.access_token) {
            console.log('✅ Access token obtained successfully!');
            console.log(`Token: ${response.access_token.substring(0, 20)}...`);
            console.log(`Expires in: ${response.expires_in} seconds`);
            
            // Test a simple image search API call
            console.log('\n🔄 Testing image search API...');
            await testImageSearch(response.access_token);
            
        } else {
            console.log('❌ Failed to get access token');
            console.log('Response:', response);
            
            if (response.error) {
                console.log(`Error: ${response.error}`);
                console.log(`Description: ${response.error_description}`);
            }
        }
        
    } catch (error) {
        console.error('❌ Error testing API:', error.message);
        console.log('\n🔧 Troubleshooting:');
        console.log('1. Check your API key and secret key');
        console.log('2. Verify your Baidu AI application is active');
        console.log('3. Check your internet connection');
        console.log('4. Visit: https://console.bce.baidu.com/ai/ to verify credentials');
    }
}

async function testImageSearch(accessToken) {
    try {
        // Test with a simple image search query
        const searchUrl = `https://aip.baidubce.com/rest/2.0/solution/v1/img_search?access_token=${accessToken}`;
        
        const postData = JSON.stringify({
            query: "少林寺 山门",
            num: 1
        });
        
        const response = await new Promise((resolve, reject) => {
            const req = https.request(searchUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Content-Length': Buffer.byteLength(postData)
                }
            }, (res) => {
                let data = '';
                res.on('data', chunk => data += chunk);
                res.on('end', () => {
                    try {
                        resolve(JSON.parse(data));
                    } catch {
                        reject(new Error('Invalid JSON response'));
                    }
                });
            });
            
            req.on('error', reject);
            req.write(postData);
            req.end();
        });
        
        if (response.error_code) {
            console.log(`⚠️  Image search API returned error: ${response.error_msg}`);
            console.log('This is normal - the API might require different parameters');
        } else {
            console.log('✅ Image search API working!');
            console.log(`Found ${response.num || 0} results`);
        }
        
    } catch (error) {
        console.log(`⚠️  Image search test failed: ${error.message}`);
        console.log('This is normal - the main API authentication is working');
    }
}

// Run the test
testBaiduAPI(); 