import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { updateUserProfile, upsertWalletUser } from '@/lib/userAccountLinks';
import PinataSDK from '@pinata/sdk';
import { Readable } from 'stream';

function getPinataCredentials() {
  const apiKey = process.env.PINATA_API_KEY;
  const secretKey = process.env.PINATA_SECRET_API_KEY;
  if (!apiKey || !secretKey) throw new Error('Pinata not configured');
  return { apiKey, secretKey };
}

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session?.walletAddress) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const imageBuffer = Buffer.from(arrayBuffer);
    const { apiKey, secretKey } = getPinataCredentials();
    const pinata = new PinataSDK(apiKey, secretKey);
    const imageStream = Readable.from(imageBuffer);
    const result = await pinata.pinFileToIPFS(imageStream, {
      pinataMetadata: { name: `taskpay-avatar-${session.walletAddress.slice(0, 8)}` },
    });

    const gateway = process.env.PINATA_GATEWAY || 'ipfs.filebase.io';
    const pfpUrl = `https://${gateway}/ipfs/${result.IpfsHash}`;

    await upsertWalletUser(session.walletAddress);
    await updateUserProfile(session.walletAddress, { pfpUrl });

    return NextResponse.json({ success: true, pfpUrl });
  } catch (error) {
    console.error('[profile/avatar]', error);
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 });
  }
}
