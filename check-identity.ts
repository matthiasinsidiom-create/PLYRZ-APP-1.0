import { GoogleAuth } from 'google-auth-library';

async function checkIdentity() {
  const auth = new GoogleAuth();
  const client = await auth.getClient();
  const credentials = await auth.getCredentials();
  console.log('Client Email:', credentials?.client_email);
  console.log('Project ID:', await auth.getProjectId());
  
  // Try to get token info to see scopes
  try {
    const token = await client.getAccessToken();
    console.log('Access Token exists');
  } catch (e) {
    console.log('Could not get access token:', e);
  }
}

checkIdentity().catch(console.error);
