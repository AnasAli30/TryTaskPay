import { NextRequest } from "next/server";
import { Readable } from "stream";
import PinataSDK from "@pinata/sdk";

// Round-robin counter for cycling through API keys
let keyIndex = 0;

// Get all available Pinata credentials from environment variables
function getAllPinataCredentials() {
  const credentials: Array<{ apiKey: string; secretKey: string; index: number }> = [];
  
  // Check for 5 sets of API keys
  for (let i = 1; i <= 5; i++) {
    const apiKey = i === 1 
      ? process.env.PINATA_API_KEY 
      : process.env[`PINATA_API_KEY_${i}`];
    const secretKey = i === 1 
      ? process.env.PINATA_SECRET_API_KEY 
      : process.env[`PINATA_SECRET_API_KEY_${i}`];
    
    if (apiKey && secretKey) {
      credentials.push({ apiKey, secretKey, index: i });
    }
  }
  
  if (credentials.length === 0) {
    throw new Error("At least one set of PINATA_API_KEY and PINATA_SECRET_API_KEY must be set in environment variables");
  }
  
  return credentials;
}

// Get Pinata credentials using round-robin
function getPinataCredentials() {
  const allCredentials = getAllPinataCredentials();
  
  // Use round-robin to cycle through available keys
  const selected = allCredentials[keyIndex % allCredentials.length];
  keyIndex = (keyIndex + 1) % allCredentials.length;
  
  return { apiKey: selected.apiKey, secretKey: selected.secretKey };
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    
    if (!file) {
      return Response.json(
        { success: false, error: "No file provided" },
        { status: 400 }
      );
    }

    // Convert File to Buffer once (reuse for retries)
    const arrayBuffer = await file.arrayBuffer();
    const imageBuffer = Buffer.from(arrayBuffer);

    // Initialize Pinata SDK with round-robin key selection
    const allCredentials = getAllPinataCredentials();
    let lastError: Error | null = null;
    
    // Try each key until one succeeds
    for (let attempt = 0; attempt < allCredentials.length; attempt++) {
      const { apiKey, secretKey } = getPinataCredentials();
      const pinata = new PinataSDK(apiKey, secretKey);
      
      // Create a fresh stream for each attempt (streams can only be read once)
      const imageStream = Readable.from(imageBuffer);
      
      try {
        // Upload to IPFS using Pinata SDK
        const imageUploadResult = await pinata.pinFileToIPFS(imageStream, {
          pinataMetadata: {
            name: file.name || `tree-nft-${Date.now()}.png`,
          },
        });
        
        const imageCid = imageUploadResult.IpfsHash;
        
        // Get gateway URL (use PINATA_GATEWAY if set, otherwise default)
        const gateway = process.env.PINATA_GATEWAY || 'ipfs.filebase.io';
        const ipfsGatewayUrl = `https://${gateway}/ipfs/${imageCid}`;
        
        return Response.json({
          success: true,
          cid: imageCid,
          ipfsUrl: ipfsGatewayUrl,
        });
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        console.warn(`Pinata key attempt ${attempt + 1}/${allCredentials.length} failed, trying next key...`, error instanceof Error ? error.message : String(error));
        // Continue to next key
        continue;
      }
    }
    
    // If all keys failed, throw the last error
    throw lastError || new Error("All Pinata API keys failed");

  } catch (error) {
    console.error("Error uploading to IPFS:", error);
    return Response.json(
      { success: false, error: error instanceof Error ? error.message : "Failed to upload to IPFS" },
      { status: 500 }
    );
  }
}
