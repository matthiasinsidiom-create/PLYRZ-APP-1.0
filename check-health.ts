import fetch from 'node-fetch';

async function checkHealth() {
  try {
    const response = await fetch('http://localhost:3000/api/health');
    const data = await response.json();
    console.log('Health Check Response:', JSON.stringify(data, null, 2));
  } catch (e) {
    console.error('Health Check Error:', e);
  }
}

checkHealth().catch(console.error);
