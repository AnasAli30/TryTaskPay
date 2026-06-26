import { NextRequest, NextResponse } from 'next/server';
import { getDatabase } from '@/lib/mongodb';
import { BountyTask } from '@/lib/types';
import { getSocialEscrowAddress, getTaskChainId } from '@/lib/chainConfig';
import { fromTokenWei, getRpcUrl } from '@/lib/chainRpc';
import { getSocialTaskEip712Domain } from '@/lib/customTaskEscrow';
import { ethers } from 'ethers';
import { ObjectId } from 'mongodb';
import { fetchWithNeynarFallback, NEYNAR_API_BASE_URL } from '@/lib/neynar';

const SIGNER_PRIVATE_KEY = process.env.ESCROW_SIGNER_PRIVATE_KEY;
const RECLAIM_WINDOW_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

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
 * POST /api/tasks/generate-reclaim
 *
 * Generates an EIP-712 signature that allows the task CREATOR to reclaim
 * unclaimed USDC from the escrow contract after the 7-day claim window.
 * Uses the same Claim struct so the contract's existing claim() function works.
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
        const { taskId, creatorFid, creatorAddress } = body;

        if (!taskId || !creatorFid || !creatorAddress) {
            return NextResponse.json(
                { error: 'Missing required fields: taskId, creatorFid, creatorAddress' },
                { status: 400 }
            );
        }

        if (!ethers.isAddress(creatorAddress)) {
            return NextResponse.json(
                { error: 'Invalid wallet address' },
                { status: 400 }
            );
        }

        // --- Address Verification via Neynar ---
        try {
            const neynarRes = await fetchWithNeynarFallback(`${NEYNAR_API_BASE_URL}/user/bulk?fids=${creatorFid}`);
            if (!neynarRes.ok) {
                console.error(`Neynar user fetch failed: ${neynarRes.status}`);
            } else {
                const neynarData = await neynarRes.json();
                const user = neynarData.users?.[0];
                if (user) {
                    const verifiedEthAddresses = (user.verified_addresses?.eth_addresses || []).map((addr: string) => addr.toLowerCase());
                    const custodyAddress = user.custody_address?.toLowerCase();

                    const allowedAddresses = [...verifiedEthAddresses];
                    if (custodyAddress) allowedAddresses.push(custodyAddress);

                    if (!allowedAddresses.includes(creatorAddress.toLowerCase())) {
                        return NextResponse.json(
                            { error: 'Provided address is not verified for this Farcaster user.' },
                            { status: 403 }
                        );
                    }
                } else {
                    console.warn(`No user found in Neynar for fid ${creatorFid}`);
                }
            }
        } catch (err) {
            console.error('Error verifying address via Neynar:', err);
            // Optionally decide if we want to fail hard here or continue.
            // Failing hard is safer.
            return NextResponse.json(
                { error: 'Failed to verify account ownership. Please try again.' },
                { status: 500 }
            );
        }

        const db = await getDatabase();
        const tasksCollection = db.collection<BountyTask>('tasks');

        const task = await tasksCollection.findOne({
            _id: new ObjectId(taskId),
        } as any);

        if (!task) {
            return NextResponse.json({ error: 'Task not found' }, { status: 404 });
        }

        // Must belong to this creator
        if (task.creatorFid !== Number(creatorFid)) {
            return NextResponse.json({ error: 'Not the task creator' }, { status: 403 });
        }

        // Task must be verified
        if (task.status !== 'verified') {
            return NextResponse.json(
                { error: `Task is not verified (current: ${task.status})` },
                { status: 400 }
            );
        }

        // Already reclaimed
        if (task.reclaimedAt) {
            return NextResponse.json(
                { error: 'Task has already been reclaimed' },
                { status: 400 }
            );
        }

        // Check 7-day window
        if (!task.verifiedAt) {
            return NextResponse.json(
                { error: 'Task has no verification timestamp. Please contact admin.' },
                { status: 400 }
            );
        }

        const verifiedTime = new Date(task.verifiedAt).getTime();
        if (Date.now() < verifiedTime + RECLAIM_WINDOW_MS) {
            const remaining = verifiedTime + RECLAIM_WINDOW_MS - Date.now();
            const hoursLeft = Math.ceil(remaining / (1000 * 60 * 60));
            return NextResponse.json(
                { error: `Reclaim not available yet. ${hoursLeft}h remaining until the claim window expires.` },
                { status: 400 }
            );
        }

        // Read actual remaining deposit from the on-chain contract (single source of truth)
        const taskChainId = getTaskChainId(task);
        const escrowAddress = getSocialEscrowAddress(taskChainId);
        const provider = new ethers.JsonRpcProvider(getRpcUrl(taskChainId));
        const escrowContract = new ethers.Contract(
            escrowAddress,
            ['function getDeposit(address creator, bytes32 taskId) external view returns (uint256)'],
            provider
        );

        const onChainDeposit: bigint = await escrowContract.getDeposit(
            task.creatorAddress,
            task.onChainTaskId
        );

        if (onChainDeposit <= BigInt(0)) {
            return NextResponse.json(
                { error: 'No unclaimed tokens to reclaim. Contract deposit is 0.' },
                { status: 400 }
            );
        }

        // Use the exact on-chain amount — no rounding issues
        const reclaimAmountWei = onChainDeposit;

        // Generate a unique nonce
        const nonce = Date.now();

        if (!task.onChainTaskId || !task.creatorAddress) {
            return NextResponse.json(
                { error: 'Task missing on-chain data (onChainTaskId or creatorAddress)' },
                { status: 400 }
            );
        }

        // Sign the claim message (creator claims back to themselves)
        const signer = new ethers.Wallet(SIGNER_PRIVATE_KEY);
        const message = {
            taskId: task.onChainTaskId,
            creator: task.creatorAddress,
            claimer: creatorAddress, // Creator is the claimer
            amount: reclaimAmountWei.toString(),
            nonce: nonce,
        };

        const eip712Domain = getSocialTaskEip712Domain(taskChainId);

        const signature = await signer.signTypedData(
            eip712Domain,
            CLAIM_TYPES,
            message
        );

        return NextResponse.json({
            success: true,
            signature,
            amount: reclaimAmountWei.toString(),
            amountFormatted: fromTokenWei(onChainDeposit, taskChainId),
            nonce,
            onChainTaskId: task.onChainTaskId,
            creatorAddress: task.creatorAddress,
            chainId: taskChainId,
            rewardToken: task.rewardToken ?? 'USDC',
        });
    } catch (error) {
        console.error('Error generating reclaim:', error);
        return NextResponse.json(
            { error: 'Internal Server Error' },
            { status: 500 }
        );
    }
}
