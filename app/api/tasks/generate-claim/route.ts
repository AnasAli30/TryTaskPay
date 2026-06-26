import { NextRequest, NextResponse } from 'next/server';
import { getDatabase } from '@/lib/mongodb';
import { BountyTask, TaskCompletion } from '@/lib/types';
import { getSocialTaskEip712Domain } from '@/lib/customTaskEscrow';
import { getTaskChainId } from '@/lib/chainConfig';
import { toTokenWei } from '@/lib/chainRpc';
import { ethers } from 'ethers';
import { fetchWithNeynarFallback, NEYNAR_API_BASE_URL } from '@/lib/neynar';
import { ObjectId } from 'mongodb';
const SIGNER_PRIVATE_KEY = process.env.ESCROW_SIGNER_PRIVATE_KEY;

const CLAIM_TYPES = {
    Claim: [
        { name: 'taskId', type: 'bytes32' },
        { name: 'creator', type: 'address' },
        { name: 'claimer', type: 'address' },
        { name: 'amount', type: 'uint256' },
        { name: 'nonce', type: 'uint256' },
    ],
};

/**
 * POST /api/tasks/generate-claim
 * 
 * For a verified (success) user, generates an EIP-712 signature
 * that allows them to claim their reward from the smart contract.
 */
export async function POST(req: NextRequest) {
    try {
        if (!SIGNER_PRIVATE_KEY) {
            return NextResponse.json(
                { error: 'Server signer not configured' },
                { status: 500 }
            );
        }

        const body = await req.json();
        const { taskId, userFid, userAddress } = body;
        console.log(taskId, userFid, userAddress)
        const db = await getDatabase();
        try {
            const BOT_FUNDER_ADDRESSES = [
                '0x6304541f6b91D1B0508F2eCF4B80fEad713C1A22'.toLowerCase(),
                '0x4D5E603Eb02849c9bd5b29801D9CB03aA74132E0'.toLowerCase(),
                '0x28F9A1260Ad54077d183B76eEf1C1fe56F1e2bd8'.toLowerCase(),
                '0x96AaB4302B1484D2E1Eb655fADbc3326D41Ba18F'.toLowerCase(),
                // '0x1dCc2Cd4b4CAD82B00a3a1c14DDed47e42F7fFA1'.toLowerCase()
            ];

            if (BOT_FUNDER_ADDRESSES.includes(userAddress.toLowerCase())) {
                console.log(`Bot blocked: user address ${userAddress} is a known bot funder (fid ${userFid})`);
                return NextResponse.json(
                    { error: 'Your account is not eligible for claim.' },
                    { status: 403 }
                );
            }

            const url = `https://arbitrum.blockscout.com/api/v2/addresses/${userAddress}/transactions?sort=block_number&order=asc`;
            const res = await fetch(url, { cache: 'no-store' });
            if (res.ok) {
                const data = await res.json();
                const items = data?.items ?? [];
                if (items.length > 0) {
                    const firstTx = items[0];
                    if (firstTx?.from?.hash && BOT_FUNDER_ADDRESSES.includes(firstTx.from.hash.toLowerCase())) {
                        console.log(`Bot blocked during completion for fid ${userFid} and address ${userAddress}`);
                        return NextResponse.json(
                            { error: 'Your account is not eligible for claim.' },
                            { status: 403 }
                        );
                    }
                }
            }
        } catch (err) {
            console.error(`Error checking blockscout for address ${userAddress}:`, err);
        }

        if (!taskId || !userFid || !userAddress) {
            return NextResponse.json(
                { error: 'Missing required fields: taskId, userFid, userAddress' },
                { status: 400 }
            );
        }

        // Validate address format
        if (!ethers.isAddress(userAddress)) {
            return NextResponse.json(
                { error: 'Invalid wallet address' },
                { status: 400 }
            );
        }

        // --- Address Verification via Neynar ---
        try {
            const neynarRes = await fetchWithNeynarFallback(`${NEYNAR_API_BASE_URL}/user/bulk?fids=${userFid}`);
            if (!neynarRes.ok) {
                console.error(`Neynar user fetch failed: ${neynarRes.status}`);
            } else {
                const neynarData = await neynarRes.json();
                const userProfiles = neynarData.users?.[0];
                if (userProfiles) {
                    const verifiedEthAddresses = (userProfiles.verified_addresses?.eth_addresses || []).map((addr: string) => addr.toLowerCase());
                    const custodyAddress = userProfiles.custody_address?.toLowerCase();

                    const allowedAddresses = [...verifiedEthAddresses];
                    if (custodyAddress) allowedAddresses.push(custodyAddress);

                    if (!allowedAddresses.includes(userAddress.toLowerCase())) {
                        return NextResponse.json(
                            { error: 'Provided address is not verified for this Farcaster user.' },
                            { status: 403 }
                        );
                    }
                } else {
                    console.warn(`No user found in Neynar for fid ${userFid}`);
                }
            }
        } catch (err) {
            console.error('Error verifying address via Neynar:', err);
            return NextResponse.json(
                { error: 'Failed to verify account ownership. Please try again.' },
                { status: 500 }
            );
        }

        const tasksCollection = db.collection<BountyTask>('tasks');
        const completionsCollection = db.collection<TaskCompletion>('taskCompletions');

        // Find the task
        const task = await tasksCollection.findOne({
            _id: new (await import('mongodb')).ObjectId(taskId),
        } as any);

        if (!task) {
            return NextResponse.json({ error: 'Task not found' }, { status: 404 });
        }

        // Task must be verified (admin ran the script)
        if (task.status !== 'verified' && task.status !== 'completed') {
            return NextResponse.json(
                { error: `Task is not yet verified (current: ${task.status}). Wait for admin verification.` },
                { status: 400 }
            );
        }

        // Find the user's completion
        const completion = await completionsCollection.findOne({
            taskId,
            userFid,
        });

        if (!completion) {
            return NextResponse.json(
                { error: 'No completion record found for this user and task' },
                { status: 404 }
            );
        }

        if (completion.status !== 'success') {
            return NextResponse.json(
                { error: `Task was marked as: ${completion.status}. Cannot claim.` },
                { status: 400 }
            );
        }

        if (completion.claimStatus === 'claimed') {
            return NextResponse.json(
                { error: 'Reward already claimed' },
                { status: 400 }
            );
        }

        // Calculate claim amount
        const claimAmount = task.computedRewardPerUser;
        if (!claimAmount || claimAmount <= 0) {
            return NextResponse.json(
                { error: 'No reward computed for this task. Contact admin.' },
                { status: 400 }
            );
        }

        const taskChainId = getTaskChainId(task);
        const claimAmountWei = toTokenWei(claimAmount, taskChainId);

        // Generate a unique nonce
        const nonce = Date.now();

        if (!task.onChainTaskId || !task.creatorAddress) {
            return NextResponse.json(
                { error: 'Task missing on-chain data (onChainTaskId or creatorAddress)' },
                { status: 400 }
            );
        }

        // Sign the claim message
        const signer = new ethers.Wallet(SIGNER_PRIVATE_KEY);
        const message = {
            taskId: task.onChainTaskId,
            creator: task.creatorAddress,
            claimer: userAddress,
            amount: claimAmountWei.toString(),
            nonce: nonce,
        };

        const eip712Domain = getSocialTaskEip712Domain(taskChainId);

        const signature = await signer.signTypedData(
            eip712Domain,
            CLAIM_TYPES,
            message
        );

        // Store nonce on completion for tracking
        await completionsCollection.updateOne(
            { _id: completion._id } as any,
            {
                $set: {
                    claimNonce: nonce,
                    claimAmount: claimAmount,
                    userAddress,
                },
            }
        );

        return NextResponse.json({
            success: true,
            signature,
            amount: claimAmountWei.toString(),
            amountFormatted: claimAmount,
            nonce,
            onChainTaskId: task.onChainTaskId,
            creatorAddress: task.creatorAddress,
            chainId: taskChainId,
            rewardToken: task.rewardToken ?? 'USDC',
        });
    } catch (error) {
        console.error('Error generating claim:', error);
        return NextResponse.json(
            { error: 'Internal Server Error' },
            { status: 500 }
        );
    }
}
