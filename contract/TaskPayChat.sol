// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/**
 * @title TaskPayChat
 * @notice Free on-chain group chat for TaskPay community
 * @dev All messaging is free (zero fees). Owner has full admin control
 *      including message deletion and pinning. Built for Base/Arbitrum L2.
 *
 *      NOTE: This contract is provided as a reference for future on-chain
 *      anchoring. The live TaskPay chat runs off-chain via MongoDB for
 *      instant, gas-free messaging.
 */
contract TaskPayChat {

    // ── Errors ──
    error NotOwner();
    error NotAdmin();
    error EmptyContent();
    error MessageNotFound();
    error AlreadyPinned();
    error NotPinned();
    error UserBanned();
    error UserNotBanned();
    error CannotBanAdmin();
    error AlreadyRegistered();
    error NotRegistered();

    // ── Structs ──
    struct ChatMessage {
        address sender;
        uint40  timestamp;
        bool    isDeleted;
        bool    isPinned;
        string  content;
    }

    // ── State ──
    address public immutable owner;
    mapping(address => bool) public admins;
    mapping(address => bool) public banned;

    ChatMessage[] private _messages;
    uint256 public pinnedCount;

    // ── Registration State ──
    mapping(address => bool) public isRegistered;
    mapping(address => uint40) public registeredAt;
    address[] private _members;
    uint256 public memberCount;

    // ── Events ──
    event MessageSent(uint256 indexed id, address indexed sender, string content);
    event MessageDeleted(uint256 indexed id, address indexed deletedBy);
    event MessagePinned(uint256 indexed id, address indexed pinnedBy);
    event MessageUnpinned(uint256 indexed id, address indexed unpinnedBy);
    event UserBannedEvt(address indexed user, address indexed bannedBy);
    event UserUnbannedEvt(address indexed user, address indexed unbannedBy);
    event AdminAdded(address indexed admin);
    event AdminRemoved(address indexed admin);
    event MemberRegistered(address indexed user, uint256 indexed memberIndex);

    // ── Modifiers ──
    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    modifier onlyAdmin() {
        if (msg.sender != owner && !admins[msg.sender]) revert NotAdmin();
        _;
    }

    modifier notBanned() {
        if (banned[msg.sender]) revert UserBanned();
        _;
    }

    modifier onlyRegistered() {
        if (!isRegistered[msg.sender]) revert NotRegistered();
        _;
    }

    // ── Constructor ──
    constructor() {
        owner = msg.sender;
        // Auto-register owner
        isRegistered[msg.sender] = true;
        registeredAt[msg.sender] = uint40(block.timestamp);
        _members.push(msg.sender);
        memberCount = 1;
        emit MemberRegistered(msg.sender, 0);
    }

    // ── Messaging (FREE) ──

    /**
     * @notice Send a message to the global chat (zero cost beyond gas)
     * @param content The message text
     */
    function sendMessage(string calldata content) external notBanned onlyRegistered {
        if (bytes(content).length == 0) revert EmptyContent();

        uint256 id = _messages.length;
        _messages.push(ChatMessage({
            sender: msg.sender,
            timestamp: uint40(block.timestamp),
            isDeleted: false,
            isPinned: false,
            content: content
        }));

        emit MessageSent(id, msg.sender, content);
    }

    // ── Admin: Delete ──

    /**
     * @notice Delete any message (owner/admin only)
     * @param messageId Index of message to delete
     */
    function deleteMessage(uint256 messageId) external onlyAdmin {
        if (messageId >= _messages.length) revert MessageNotFound();
        ChatMessage storage m = _messages[messageId];
        if (m.isPinned) {
            m.isPinned = false;
            pinnedCount--;
        }
        m.isDeleted = true;
        emit MessageDeleted(messageId, msg.sender);
    }

    // ── Admin: Pin / Unpin ──

    /**
     * @notice Pin a message (owner/admin only)
     */
    function pinMessage(uint256 messageId) external onlyAdmin {
        if (messageId >= _messages.length) revert MessageNotFound();
        ChatMessage storage m = _messages[messageId];
        if (m.isPinned) revert AlreadyPinned();
        m.isPinned = true;
        pinnedCount++;
        emit MessagePinned(messageId, msg.sender);
    }

    /**
     * @notice Unpin a message (owner/admin only)
     */
    function unpinMessage(uint256 messageId) external onlyAdmin {
        if (messageId >= _messages.length) revert MessageNotFound();
        ChatMessage storage m = _messages[messageId];
        if (!m.isPinned) revert NotPinned();
        m.isPinned = false;
        pinnedCount--;
        emit MessageUnpinned(messageId, msg.sender);
    }

    // ── Admin: Ban / Unban ──

    function banUser(address user) external onlyAdmin {
        if (user == owner || admins[user]) revert CannotBanAdmin();
        if (banned[user]) revert UserBanned();
        banned[user] = true;
        emit UserBannedEvt(user, msg.sender);
    }

    function unbanUser(address user) external onlyAdmin {
        if (!banned[user]) revert UserNotBanned();
        banned[user] = false;
        emit UserUnbannedEvt(user, msg.sender);
    }

    // ── Owner: Manage Admins ──

    function addAdmin(address admin) external onlyOwner {
        admins[admin] = true;
        emit AdminAdded(admin);
    }

    function removeAdmin(address admin) external onlyOwner {
        admins[admin] = false;
        emit AdminRemoved(admin);
    }

    // ── Registration ──

    /**
     * @notice Register to join TaskPay Community Chat (free, one-time)
     * @dev No fees — only costs gas. Must register before sending messages.
     */
    function register() external notBanned {
        if (isRegistered[msg.sender]) revert AlreadyRegistered();

        isRegistered[msg.sender] = true;
        registeredAt[msg.sender] = uint40(block.timestamp);
        _members.push(msg.sender);
        memberCount++;

        emit MemberRegistered(msg.sender, memberCount - 1);
    }

    /**
     * @notice Check if an address is registered
     */
    function checkRegistered(address user) external view returns (bool) {
        return isRegistered[user];
    }

    /**
     * @notice Get all registered members with pagination
     */
    function getMembers(uint256 offset, uint256 limit)
        external view returns (address[] memory members)
    {
        if (offset >= memberCount) return new address[](0);
        uint256 end = offset + limit;
        if (end > memberCount) end = memberCount;
        uint256 count = end - offset;
        members = new address[](count);
        for (uint256 i = 0; i < count; i++) {
            members[i] = _members[offset + i];
        }
    }

    // ── View Functions ──

    function getMessageCount() external view returns (uint256) {
        return _messages.length;
    }

    function getMessage(uint256 id) external view returns (ChatMessage memory) {
        if (id >= _messages.length) revert MessageNotFound();
        return _messages[id];
    }

    /**
     * @notice Get latest messages (newest first, skips deleted)
     */
    function getLatestMessages(uint256 offset, uint256 limit)
        external view returns (ChatMessage[] memory msgs, uint256[] memory ids)
    {
        uint256 total = _messages.length;
        if (total == 0 || offset >= total) {
            return (new ChatMessage[](0), new uint256[](0));
        }

        // Collect non-deleted messages from end
        ChatMessage[] memory buf = new ChatMessage[](limit);
        uint256[] memory idBuf = new uint256[](limit);
        uint256 found = 0;
        uint256 skipped = 0;

        for (uint256 i = total; i > 0 && found < limit; ) {
            unchecked { --i; }
            if (_messages[i].isDeleted) continue;
            if (skipped < offset) { skipped++; continue; }
            buf[found] = _messages[i];
            idBuf[found] = i;
            found++;
        }

        // Trim to actual size
        msgs = new ChatMessage[](found);
        ids = new uint256[](found);
        for (uint256 j = 0; j < found; j++) {
            msgs[j] = buf[j];
            ids[j] = idBuf[j];
        }
    }

    /**
     * @notice Get all currently pinned messages
     */
    function getPinnedMessages()
        external view returns (ChatMessage[] memory msgs, uint256[] memory ids)
    {
        uint256 total = _messages.length;
        uint256 count = pinnedCount;
        if (count == 0) return (new ChatMessage[](0), new uint256[](0));

        msgs = new ChatMessage[](count);
        ids = new uint256[](count);
        uint256 found = 0;

        for (uint256 i = 0; i < total && found < count; i++) {
            if (_messages[i].isPinned && !_messages[i].isDeleted) {
                msgs[found] = _messages[i];
                ids[found] = i;
                found++;
            }
        }
    }
}
