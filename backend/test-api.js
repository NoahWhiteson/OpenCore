import crypto from 'crypto';
import dotenv from 'dotenv';

dotenv.config();

const BASE_URL = process.env.TEST_URL || 'http://localhost:3000';
const ALGORITHM = 'aes-256-gcm';

function decrypt(encryptedData, encryptionKey) {
  try {
    if (!encryptionKey || encryptionKey.length !== 64) {
      throw new Error('Encryption key must be exactly 64 hex characters (32 bytes)');
    }
    
    const keyBuffer = Buffer.from(encryptionKey, 'hex');
    if (keyBuffer.length !== 32) {
      throw new Error('Invalid encryption key format');
    }
    
    const decipher = crypto.createDecipheriv(
      ALGORITHM,
      keyBuffer,
      Buffer.from(encryptedData.iv, 'hex')
    );
    
    decipher.setAuthTag(Buffer.from(encryptedData.authTag, 'hex'));
    
    let decrypted = decipher.update(encryptedData.encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return JSON.parse(decrypted);
  } catch (error) {
    return { error: 'Decryption failed', message: error.message };
  }
}

async function testAPI() {
  console.log('🧪 Testing OpenCore Backend API\n');
  console.log(`Base URL: ${BASE_URL}\n`);

  let token = null;
  const encryptionKey = process.env.ENCRYPTION_KEY;
  
  if (!encryptionKey) {
    console.log('⚠️  ENCRYPTION_KEY not found in .env - responses will be encrypted but cannot be decrypted');
    console.log('   Run setup-env.js to generate a .env file with encryption key\n');
  } else {
    console.log(`✅ Encryption key loaded (${encryptionKey.length} chars)\n`);
  }

  try {
    console.log('1️⃣ Testing Health Endpoint...');
    const healthRes = await fetch(`${BASE_URL}/health`);
    const health = await healthRes.json();
    console.log('✅ Health:', health);
    console.log('');

    console.log('2️⃣ Testing Login...');
    const loginRes = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: process.env.ADMIN_USERNAME || 'admin',
        password: process.env.ADMIN_PASSWORD || 'admin123'
      })
    });

    if (!loginRes.ok) {
      const error = await loginRes.json();
      throw new Error(`Login failed: ${error.error || loginRes.statusText}`);
    }

    const loginData = await loginRes.json();
    token = loginData.token;
    console.log('✅ Login successful!');
    console.log(`   Token: ${token.substring(0, 50)}...`);
    console.log(`   Expires: ${loginData.expiresIn}`);
    console.log('');

    console.log('3️⃣ Testing Token Verification...');
    const verifyRes = await fetch(`${BASE_URL}/api/auth/verify`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const verify = await verifyRes.json();
    console.log('✅ Token verified:', verify);
    console.log('');

    const endpoints = [
      { name: 'System Stats', path: '/api/stats/system' },
      { name: 'CPU Stats', path: '/api/stats/cpu' },
      { name: 'Memory Stats', path: '/api/stats/memory' },
      { name: 'Network Stats', path: '/api/stats/network' },
      { name: 'Storage Stats', path: '/api/stats/storage' },
      { name: 'Processes', path: '/api/stats/processes' },
      { name: 'Applications', path: '/api/stats/applications' }
    ];

    for (const endpoint of endpoints) {
      console.log(`4️⃣ Testing ${endpoint.name}...`);
      const res = await fetch(`${BASE_URL}${endpoint.path}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!res.ok) {
        const error = await res.json();
        console.log(`❌ Failed: ${error.error || res.statusText}`);
        console.log('');
        continue;
      }

      const data = await res.json();
      
      if (data.data && data.data.encrypted) {
        if (encryptionKey) {
          const decrypted = decrypt(data.data, encryptionKey);
          if (decrypted.error) {
            console.log(`❌ ${endpoint.name} decryption failed: ${decrypted.message}`);
          } else {
            console.log(`✅ ${endpoint.name} (decrypted):`);
            const preview = JSON.stringify(decrypted, null, 2).substring(0, 500);
            console.log(preview + (JSON.stringify(decrypted).length > 500 ? '...' : ''));
          }
        } else {
          console.log(`✅ ${endpoint.name} (encrypted):`);
          console.log(`   Encrypted data received (${Object.keys(data.data).join(', ')})`);
          console.log(`   Note: Set ENCRYPTION_KEY in .env to decrypt responses`);
        }
      } else {
        console.log(`✅ ${endpoint.name}:`, data);
      }
      console.log('');
    }

    console.log('🎉 All tests completed!');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    if (error.stack) {
      console.error(error.stack);
    }
    process.exit(1);
  }
}

testAPI();
