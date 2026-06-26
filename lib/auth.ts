import { keccak256, toUtf8Bytes } from 'ethers';

// Generate random string using browser crypto
function generateRandomString(): string {
  const array = new Uint8Array(16);
  crypto.getRandomValues(array);
  return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
}

// Create fused key using ethers.js
function createFusedKey(randomString: string, secretKey: string): string {
  return keccak256(
    toUtf8Bytes(secretKey + randomString)
  ).slice(2); // Remove '0x' prefix
}

// Secret key (should match the one in middleware)
const SECRET_KEY = process.env.NEXT_PUBLIC_API_SECRET_KEY || 'your-secret-key-here';

export interface AuthHeaders {
  'x-fused-key': string;
  'x-random-string': string;
}

export function generateAuthHeaders(): AuthHeaders {
  // Generate a random string using ethers.js
  const randomString = generateRandomString();
  
  // Create fused key using ethers.js
  const fusedKey = createFusedKey(randomString, SECRET_KEY);

  return {
    'x-fused-key': fusedKey,
    'x-random-string': randomString,
  };
}

// Helper function to add auth headers to fetch requests
export async function authenticatedFetch(url: string, options: RequestInit = {}): Promise<Response> {
  const authHeaders = generateAuthHeaders();
  
  return fetch(url, {
    ...options,
    headers: {
      ...options.headers,
      ...authHeaders,
      'Content-Type': 'application/json',
    },
  });
}
