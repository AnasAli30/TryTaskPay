// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/cryptography/EIP712.sol";

/**
 * @title CustomTaskPay
 * @notice USDC escrow for custom on-chain bounty tasks.
 *         Creators deposit USDC tied to a task ID.
 *         After server verification, eligible users claim via backend-signed EIP-712 messages.
 *         Creators reclaim unspent funds after expiry via a separate signed reclaim flow.
 */
contract CustomTaskPay is Ownable, ReentrancyGuard, EIP712 {
    using SafeERC20 for IERC20;
    using ECDSA for bytes32;

    struct DepositLimits {
        uint256 minAmount;
        uint256 maxAmount;
    }

    bytes32 private constant CLAIM_TYPEHASH =
        keccak256(
            "Claim(bytes32 taskId,address creator,address claimer,uint256 amount,uint256 nonce)"
        );

    bytes32 private constant RECLAIM_TYPEHASH =
        keccak256(
            "Reclaim(bytes32 taskId,address creator,uint256 amount,uint256 nonce)"
        );

    uint256 public constant MAX_PLATFORM_FEE_BPS = 1000; // 10% cap

    address public signer;
    uint256 public platformFeeBps;

    mapping(address => mapping(bytes32 => uint256)) public deposits;
    mapping(address => mapping(bytes32 => address)) public depositToken;
    mapping(address => mapping(uint256 => bool)) public usedNonces;
    mapping(address => mapping(bytes32 => bool)) public hasClaimed;
    mapping(address => DepositLimits) public depositLimits;
    mapping(address => uint256) public collectedFees;
    mapping(address => bool) public supportedTokens;

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

    event Reclaimed(
        address indexed creator,
        bytes32 indexed taskId,
        uint256 amount
    );

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

    constructor(
        address _signer,
        address _usdc
    ) Ownable(msg.sender) EIP712("CustomTaskPay", "1") {
        if (_signer == address(0)) revert ZeroAddress();
        if (_usdc == address(0)) revert ZeroAddress();

        signer = _signer;
        platformFeeBps = 0;

        supportedTokens[_usdc] = true;
        depositLimits[_usdc] = DepositLimits({
            minAmount: 1e6,
            maxAmount: 50e6
        });

        emit TokenSupported(_usdc, true);
        emit DepositLimitsUpdated(_usdc, 1e6, 50e6);
    }

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

        uint256 fee = (amount * platformFeeBps) / 10000;
        uint256 netAmount = amount - fee;

        IERC20(token).safeTransferFrom(msg.sender, address(this), amount);

        address existingToken = depositToken[msg.sender][taskId];
        if (existingToken != address(0) && existingToken != token) revert TokenNotSupported();
        if (existingToken == address(0)) depositToken[msg.sender][taskId] = token;

        deposits[msg.sender][taskId] += netAmount;
        if (fee > 0) {
            collectedFees[token] += fee;
        }

        emit Deposited(msg.sender, taskId, netAmount, fee, token);
    }

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

        uint256 available = deposits[creator][taskId];
        if (amount > available) revert InsufficientDeposit(amount, available);
        address storedToken = depositToken[creator][taskId];
        if (storedToken != address(0)) {
            if (storedToken != token) revert ClaimTokenMismatch();
        } else {
            if (!supportedTokens[token]) revert TokenNotSupported();
        }

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

        usedNonces[msg.sender][nonce] = true;
        hasClaimed[msg.sender][taskId] = true;

        deposits[creator][taskId] -= amount;

        IERC20(token).safeTransfer(msg.sender, amount);

        emit Claimed(msg.sender, taskId, creator, amount);
    }

    function reclaim(
        address token,
        bytes32 taskId,
        uint256 amount,
        uint256 nonce,
        bytes calldata signature
    ) external nonReentrant {
        if (amount == 0) revert ZeroAmount();
        if (signer == address(0)) revert SignerNotSet();
        if (usedNonces[msg.sender][nonce]) revert NonceAlreadyUsed(nonce);

        uint256 available = deposits[msg.sender][taskId];
        if (amount > available) revert InsufficientDeposit(amount, available);

        address storedToken = depositToken[msg.sender][taskId];
        if (storedToken != address(0)) {
            if (storedToken != token) revert ClaimTokenMismatch();
        } else {
            if (!supportedTokens[token]) revert TokenNotSupported();
        }

        bytes32 structHash = keccak256(
            abi.encode(RECLAIM_TYPEHASH, taskId, msg.sender, amount, nonce)
        );
        bytes32 digest = _hashTypedDataV4(structHash);
        address recovered = ECDSA.recover(digest, signature);
        if (recovered != signer) revert InvalidSignature();

        usedNonces[msg.sender][nonce] = true;
        deposits[msg.sender][taskId] -= amount;

        IERC20(token).safeTransfer(msg.sender, amount);

        emit Reclaimed(msg.sender, taskId, amount);
    }

    function setSigner(address _signer) external onlyOwner {
        if (_signer == address(0)) revert ZeroAddress();
        emit SignerUpdated(signer, _signer);
        signer = _signer;
    }

    function setPlatformFee(uint256 _feeBps) external onlyOwner {
        if (_feeBps > MAX_PLATFORM_FEE_BPS) revert FeeTooHigh(_feeBps);
        emit PlatformFeeUpdated(platformFeeBps, _feeBps);
        platformFeeBps = _feeBps;
    }

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

    function setTokenSupported(address token, bool supported) external onlyOwner {
        if (token == address(0)) revert ZeroAddress();
        supportedTokens[token] = supported;
        emit TokenSupported(token, supported);
    }

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

    function emergencyWithdraw(
        address token,
        uint256 amount,
        address to
    ) external onlyOwner {
        if (to == address(0)) revert ZeroAddress();
        IERC20(token).safeTransfer(to, amount);
        emit EmergencyWithdraw(token, amount, to);
    }

    function getDeposit(
        address creator,
        bytes32 taskId
    ) external view returns (uint256) {
        return deposits[creator][taskId];
    }

    function getDepositToken(
        address creator,
        bytes32 taskId
    ) external view returns (address) {
        return depositToken[creator][taskId];
    }

    function getDepositLimits(
        address token
    ) external view returns (uint256 minAmount, uint256 maxAmount) {
        DepositLimits memory limits = depositLimits[token];
        return (limits.minAmount, limits.maxAmount);
    }

    function isNonceUsed(
        address claimer,
        uint256 nonce
    ) external view returns (bool) {
        return usedNonces[claimer][nonce];
    }

    function hasClaimedTask(
        address claimer,
        bytes32 taskId
    ) external view returns (bool) {
        return hasClaimed[claimer][taskId];
    }

    function getDomainSeparator() external view returns (bytes32) {
        return _domainSeparatorV4();
    }
}
