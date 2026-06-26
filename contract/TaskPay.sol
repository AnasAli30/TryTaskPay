// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/cryptography/EIP712.sol";

/**
 * @title TaskPay
 * @notice USDC escrow for Farcaster bounty tasks.
 *         Creators deposit USDC tied to a task ID.
 *         After admin verification, eligible users claim their share via backend-signed messages.
 */
contract TaskPay is Ownable, ReentrancyGuard, EIP712 {
    using SafeERC20 for IERC20;
    using ECDSA for bytes32;

    // ─── Types ───────────────────────────────────────────────────────────
    struct DepositLimits {
        uint256 minAmount;
        uint256 maxAmount;
    }

    // ─── Constants ───────────────────────────────────────────────────────
    bytes32 private constant CLAIM_TYPEHASH =
        keccak256(
            "Claim(bytes32 taskId,address creator,address claimer,uint256 amount,uint256 nonce)"
        );

    uint256 public constant MAX_PLATFORM_FEE_BPS = 1000; // 10% cap

    // ─── State ───────────────────────────────────────────────────────────
    address public signer; // Backend signer address
    uint256 public platformFeeBps; // Platform fee in basis points (0 = 0%)

    // deposits[creator][taskId] = net deposited amount (after fee)
    mapping(address => mapping(bytes32 => uint256)) public deposits;

    // token used for each (creator, taskId) — must match on claim
    mapping(address => mapping(bytes32 => address)) public depositToken;

    // usedNonces[claimer][nonce] = true if nonce has been used
    mapping(address => mapping(uint256 => bool)) public usedNonces;

    // hasClaimed[claimer][taskId] = true if user has claimed for this task
    mapping(address => mapping(bytes32 => bool)) public hasClaimed;

    // Per-token deposit limits
    mapping(address => DepositLimits) public depositLimits;

    // Accumulated platform fees per token
    mapping(address => uint256) public collectedFees;

    // Supported tokens whitelist
    mapping(address => bool) public supportedTokens;

    // ─── Events ──────────────────────────────────────────────────────────
    event Deposited(
        address indexed creator,
        bytes32 indexed taskId,
        uint256 amount,
        uint256 fee,
        address token
    );

    event Claimed(
        address indexed claimer,
        bytes32 indexed taskId,
        address indexed creator,
        uint256 amount
    );

    event TaskVerified(bytes32 indexed taskId, address indexed verifier);

    event SignerUpdated(address indexed oldSigner, address indexed newSigner);
    event PlatformFeeUpdated(uint256 oldFeeBps, uint256 newFeeBps);
    event DepositLimitsUpdated(
        address indexed token,
        uint256 minAmount,
        uint256 maxAmount
    );
    event TokenSupported(address indexed token, bool supported);
    event FeesWithdrawn(address indexed token, uint256 amount, address indexed to);
    event EmergencyWithdraw(address indexed token, uint256 amount, address indexed to);

    // ─── Errors ──────────────────────────────────────────────────────────
    error ZeroAddress();
    error ZeroAmount();
    error TokenNotSupported();
    error BelowMinDeposit(uint256 amount, uint256 min);
    error AboveMaxDeposit(uint256 amount, uint256 max);
    error InsufficientDeposit(uint256 requested, uint256 available);
    error NonceAlreadyUsed(uint256 nonce);
    error AlreadyClaimed(address claimer, bytes32 taskId);
    error InvalidSignature();
    error SignerNotSet();
    error FeeTooHigh(uint256 feeBps);
    error ClaimTokenMismatch();

    // ─── Constructor ─────────────────────────────────────────────────────
    constructor(
        address _signer,
        address _usdc
    ) Ownable(msg.sender) EIP712("TaskPay", "1") {
        if (_signer == address(0)) revert ZeroAddress();
        if (_usdc == address(0)) revert ZeroAddress();

        signer = _signer;
        platformFeeBps = 0; // Default 0% platform fee

        // Setup USDC as the first supported token with limits
        supportedTokens[_usdc] = true;
        depositLimits[_usdc] = DepositLimits({
            minAmount: 1e6,  // 1 USDC (6 decimals)
            maxAmount: 50e6  // 50 USDC
        });

        emit TokenSupported(_usdc, true);
        emit DepositLimitsUpdated(_usdc, 1e6, 50e6);
    }

    // ─── Core Functions ──────────────────────────────────────────────────

    /**
     * @notice Creator deposits USDC for a task. Must approve this contract first.
     * @param token  The ERC-20 token address (must be supported)
     * @param taskId Unique identifier for the task (bytes32)
     * @param amount Gross deposit amount (before platform fee)
     */
    function deposit(
        address token,
        bytes32 taskId,
        uint256 amount
    ) external nonReentrant {
        if (amount == 0) revert ZeroAmount();
        if (!supportedTokens[token]) revert TokenNotSupported();

        DepositLimits memory limits = depositLimits[token];
        if (limits.minAmount > 0 && amount < limits.minAmount)
            revert BelowMinDeposit(amount, limits.minAmount);
        if (limits.maxAmount > 0 && amount > limits.maxAmount)
            revert AboveMaxDeposit(amount, limits.maxAmount);

        // Calculate platform fee
        uint256 fee = (amount * platformFeeBps) / 10000;
        uint256 netAmount = amount - fee;

        // Transfer full amount from creator to this contract
        IERC20(token).safeTransferFrom(msg.sender, address(this), amount);

        // Enforce same token if re-depositing for same taskId
        address existingToken = depositToken[msg.sender][taskId];
        if (existingToken != address(0) && existingToken != token) revert TokenNotSupported();
        if (existingToken == address(0)) depositToken[msg.sender][taskId] = token;

        // Track deposit and fee separately
        deposits[msg.sender][taskId] += netAmount;
        if (fee > 0) {
            collectedFees[token] += fee;
        }

        emit Deposited(msg.sender, taskId, netAmount, fee, token);
    }

    /**
     * @notice User claims their reward share after admin verification.
     *         Requires a valid EIP-712 signature from the backend signer.
     * @param token   The ERC-20 token to receive
     * @param taskId  Task identifier
     * @param creator Address of the task creator
     * @param amount  Amount to claim (in token units)
     * @param nonce   Unique nonce to prevent replay
     * @param signature Backend-generated EIP-712 signature
     */
    function claim(
        address token,
        bytes32 taskId,
        address creator,
        uint256 amount,
        uint256 nonce,
        bytes calldata signature
    ) external nonReentrant {
        if (amount == 0) revert ZeroAmount();
        if (signer == address(0)) revert SignerNotSet();
        if (usedNonces[msg.sender][nonce]) revert NonceAlreadyUsed(nonce);
        if (hasClaimed[msg.sender][taskId]) revert AlreadyClaimed(msg.sender, taskId);

        // Verify deposit balance and token
        uint256 available = deposits[creator][taskId];
        if (amount > available) revert InsufficientDeposit(amount, available);
        address storedToken = depositToken[creator][taskId];
        if (storedToken != address(0)) {
            if (storedToken != token) revert ClaimTokenMismatch();
        } else {
            // Backward compat: tasks deposited before depositToken existed must use a supported token
            if (!supportedTokens[token]) revert TokenNotSupported();
        }

        // Verify EIP-712 signature
        bytes32 structHash = keccak256(
            abi.encode(
                CLAIM_TYPEHASH,
                taskId,
                creator,
                msg.sender,
                amount,
                nonce
            )
        );
        bytes32 digest = _hashTypedDataV4(structHash);
        address recovered = ECDSA.recover(digest, signature);
        if (recovered != signer) revert InvalidSignature();

        // Mark nonce as used and task as claimed
        usedNonces[msg.sender][nonce] = true;
        hasClaimed[msg.sender][taskId] = true;

        // Deduct from creator's deposit
        deposits[creator][taskId] -= amount;

        // Transfer reward to claimer
        IERC20(token).safeTransfer(msg.sender, amount);

        emit Claimed(msg.sender, taskId, creator, amount);
    }

    /**
     * @notice Emits a TaskVerified event. Called by admin/backend to signal
     *         on-chain that a task has been verified.
     * @param taskId The task identifier
     */
    function verifyTask(bytes32 taskId) external {
        emit TaskVerified(taskId, msg.sender);
    }

    // ─── Admin Functions ─────────────────────────────────────────────────

    /**
     * @notice Update the backend signer address
     */
    function setSigner(address _signer) external onlyOwner {
        if (_signer == address(0)) revert ZeroAddress();
        emit SignerUpdated(signer, _signer);
        signer = _signer;
    }

    /**
     * @notice Set platform fee in basis points (100 bps = 1%)
     * @param _feeBps Fee in basis points. Max 1000 (10%)
     */
    function setPlatformFee(uint256 _feeBps) external onlyOwner {
        if (_feeBps > MAX_PLATFORM_FEE_BPS) revert FeeTooHigh(_feeBps);
        emit PlatformFeeUpdated(platformFeeBps, _feeBps);
        platformFeeBps = _feeBps;
    }

    /**
     * @notice Set min and max deposit amounts for a token
     * @param token  Token address
     * @param _min   Minimum deposit (in token's smallest unit, e.g. 1e6 for 1 USDC)
     * @param _max   Maximum deposit (in token's smallest unit, e.g. 50e6 for 50 USDC)
     */
    function setDepositLimits(
        address token,
        uint256 _min,
        uint256 _max
    ) external onlyOwner {
        if (token == address(0)) revert ZeroAddress();
        require(_min <= _max, "min > max");
        depositLimits[token] = DepositLimits({ minAmount: _min, maxAmount: _max });
        emit DepositLimitsUpdated(token, _min, _max);
    }

    /**
     * @notice Add or remove a token from the supported list
     */
    function setTokenSupported(address token, bool supported) external onlyOwner {
        if (token == address(0)) revert ZeroAddress();
        supportedTokens[token] = supported;
        emit TokenSupported(token, supported);
    }

    /**
     * @notice Withdraw accumulated platform fees
     */
    function withdrawFees(
        address token,
        uint256 amount,
        address to
    ) external onlyOwner {
        if (to == address(0)) revert ZeroAddress();
        require(amount <= collectedFees[token], "Exceeds collected fees");
        collectedFees[token] -= amount;
        IERC20(token).safeTransfer(to, amount);
        emit FeesWithdrawn(token, amount, to);
    }

    /**
     * @notice Emergency withdrawal — owner can pull any token
     */
    function emergencyWithdraw(
        address token,
        uint256 amount,
        address to
    ) external onlyOwner {
        if (to == address(0)) revert ZeroAddress();
        IERC20(token).safeTransfer(to, amount);
        emit EmergencyWithdraw(token, amount, to);
    }

    // ─── View Functions ──────────────────────────────────────────────────

    /**
     * @notice Get the remaining deposit balance for a creator's task
     */
    function getDeposit(
        address creator,
        bytes32 taskId
    ) external view returns (uint256) {
        return deposits[creator][taskId];
    }

    /**
     * @notice Get the token address used for a creator's task deposit
     */
    function getDepositToken(
        address creator,
        bytes32 taskId
    ) external view returns (address) {
        return depositToken[creator][taskId];
    }

    /**
     * @notice Get the deposit limits for a token
     */
    function getDepositLimits(
        address token
    ) external view returns (uint256 minAmount, uint256 maxAmount) {
        DepositLimits memory limits = depositLimits[token];
        return (limits.minAmount, limits.maxAmount);
    }

    /**
     * @notice Check if a nonce has been used for a claimer
     */
    function isNonceUsed(
        address claimer,
        uint256 nonce
    ) external view returns (bool) {
        return usedNonces[claimer][nonce];
    }

    /**
     * @notice Check if a user has already claimed for a specific task
     */
    function hasClaimedTask(
        address claimer,
        bytes32 taskId
    ) external view returns (bool) {
        return hasClaimed[claimer][taskId];
    }

    /**
     * @notice Get the domain separator (useful for frontend signature construction)
     */
    function getDomainSeparator() external view returns (bytes32) {
        return _domainSeparatorV4();
    }
}
