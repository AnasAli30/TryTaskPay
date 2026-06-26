'use client'

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faTimes, faPaperPlane, faTrash, faThumbtack, faCrown,
  faEllipsisV, faChevronDown, faAt, faUsers, faSpinner,
  faBan, faArrowDown, faCircle, faUserPlus, faLink, faCheckCircle, faReply
} from '@fortawesome/free-solid-svg-icons'
import axios from 'axios'
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt } from 'wagmi'
import { TASKPAY_CHAT_ADDRESS, TASKPAY_CHAT_ABI } from '@/lib/contracts'

const OWNER_FID = 249702
const POLL_INTERVAL = 3000
const MAX_MESSAGE_LENGTH = 500

interface ChatMessage {
  _id: string
  fid: number
  username: string
  displayName: string
  pfpUrl: string
  content: string
  mentions: number[]
  isPinned: boolean
  isOwner: boolean
  createdAt: string
  replyTo?: {
    _id: string
    username: string
    displayName: string
    content: string
    isOwner: boolean
  }
}

interface PinnedMessage {
  _id: string
  fid: number
  username: string
  displayName: string
  content: string
  isOwner: boolean
  createdAt: string
  pinnedAt?: string
}

/* ── Time formatter ── */
function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'now'
  if (mins < 60) return `${mins}m`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h`
  const days = Math.floor(hrs / 24)
  if (days < 7) return `${days}d`
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

/* ── URL regex ── */
const URL_REGEX = /(https?:\/\/[^\s]+)/g

/* ── Render message content with highlighted @mentions and clickable admin links ── */
function RenderContent({ content, currentFid, isOwnerMessage, onOpenUrl }: { content: string; currentFid?: number; isOwnerMessage?: boolean; onOpenUrl?: (url: string) => void }) {
  // For non-admin messages, strip URLs entirely
  const displayContent = isOwnerMessage ? content : content.replace(URL_REGEX, '').replace(/\s{2,}/g, ' ').trim()

  // Split by both @mentions and URLs
  const parts = displayContent.split(/(@\w+|https?:\/\/[^\s]+)/g)
  return (
    <span>
      {parts.map((part, i) => {
        if (part.startsWith('@')) {
          return (
            <span
              key={i}
              className="font-semibold text-violet-600 bg-violet-50 px-1 py-0.5 rounded-md text-[13px]"
            >
              {part}
            </span>
          )
        }
        if (isOwnerMessage && /^https?:\/\//.test(part)) {
          return (
            <button
              key={i}
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                onOpenUrl?.(part)
              }}
              className="text-blue-600 underline underline-offset-2 decoration-blue-400/50 hover:text-blue-700 hover:decoration-blue-600 transition-colors font-medium break-all text-left"
            >
              {part}
            </button>
          )
        }
        return <span key={i}>{part}</span>
      })}
    </span>
  )
}

/* ── Message Context Menu (owner only) ── */
function MessageContextMenu({
  message,
  position,
  onClose,
  onDelete,
  onPin,
  onUnpin,
  onBan,
}: {
  message: ChatMessage
  position: { x: number; y: number }
  onClose: () => void
  onDelete: (id: string) => void
  onPin: (id: string) => void
  onUnpin: (id: string) => void
  onBan: (fid: number) => void
}) {
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose()
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [onClose])

  // Adjust position to stay in viewport
  const adjustedY = Math.min(position.y, window.innerHeight - 200)
  const adjustedX = Math.min(position.x, window.innerWidth - 180)

  return (
    <motion.div
      ref={menuRef}
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      transition={{ duration: 0.15 }}
      className="fixed z-[100] w-44 bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden"
      style={{ top: adjustedY, left: adjustedX }}
    >
      <button
        onClick={() => { onDelete(message._id); onClose() }}
        className="w-full px-4 py-3 text-left text-sm font-medium text-red-600 hover:bg-red-50 flex items-center gap-3 transition-colors"
      >
        <FontAwesomeIcon icon={faTrash} className="text-xs" />
        Delete Message
      </button>
      {message.isPinned ? (
        <button
          onClick={() => { onUnpin(message._id); onClose() }}
          className="w-full px-4 py-3 text-left text-sm font-medium text-gray-700 hover:bg-gray-50 flex items-center gap-3 transition-colors"
        >
          <FontAwesomeIcon icon={faThumbtack} className="text-xs rotate-45" />
          Unpin Message
        </button>
      ) : (
        <button
          onClick={() => { onPin(message._id); onClose() }}
          className="w-full px-4 py-3 text-left text-sm font-medium text-amber-700 hover:bg-amber-50 flex items-center gap-3 transition-colors"
        >
          <FontAwesomeIcon icon={faThumbtack} className="text-xs" />
          Pin Message
        </button>
      )}
      {message.fid !== OWNER_FID && (
        <button
          onClick={() => { onBan(message.fid); onClose() }}
          className="w-full px-4 py-3 text-left text-sm font-medium text-orange-600 hover:bg-orange-50 flex items-center gap-3 transition-colors border-t border-gray-50"
        >
          <FontAwesomeIcon icon={faBan} className="text-xs" />
          Ban User
        </button>
      )}
    </motion.div>
  )
}

/* ── Pinned Messages Banner ── */
function PinnedBanner({ pinned, onUnpin, isOwner, onOpenUrl }: { pinned: PinnedMessage[]; onUnpin: (id: string) => void; isOwner: boolean; onOpenUrl?: (url: string) => void }) {
  const [currentIndex, setCurrentIndex] = useState(0)

  if (pinned.length === 0) return null

  const current = pinned[currentIndex % pinned.length]

  return (
    <motion.div
      initial={{ height: 0, opacity: 0 }}
      animate={{ height: 'auto', opacity: 1 }}
      exit={{ height: 0, opacity: 0 }}
      className="border-b border-amber-100 bg-gradient-to-r from-amber-50 via-yellow-50 to-amber-50"
    >
      <div className="px-4 py-2.5 flex items-start gap-3">
        <FontAwesomeIcon icon={faThumbtack} className="text-amber-500 text-xs mt-1 shrink-0" />
        <div className="flex-1 min-w-0">
          <span className="text-[11px] font-bold text-amber-600 uppercase tracking-wider">
            Pinned{pinned.length > 1 ? ` · ${currentIndex + 1}/${pinned.length}` : ''}
          </span>
          <p className="text-sm text-gray-800 leading-snug mt-0.5">
            <RenderContent content={current.content} isOwnerMessage={current.isOwner} onOpenUrl={onOpenUrl} />
          </p>
          <span className="text-[10px] text-amber-500 font-medium">— {current.displayName || current.username}</span>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {pinned.length > 1 && (
            <button
              onClick={() => setCurrentIndex(i => (i + 1) % pinned.length)}
              className="w-6 h-6 rounded-full bg-amber-100 flex items-center justify-center text-amber-600 hover:bg-amber-200 transition-colors"
            >
              <FontAwesomeIcon icon={faChevronDown} className="text-[10px]" />
            </button>
          )}
          {isOwner && (
            <button
              onClick={() => onUnpin(current._id)}
              className="w-6 h-6 rounded-full bg-amber-100/50 flex items-center justify-center text-amber-400 hover:text-red-500 hover:bg-red-50 transition-colors"
            >
              <FontAwesomeIcon icon={faTimes} className="text-[10px]" />
            </button>
          )}
        </div>
      </div>
    </motion.div>
  )
}

/* ══════════════════════════════════════════
   MAIN GROUP CHAT COMPONENT
   ══════════════════════════════════════════ */
export default function GroupChat({
  isOpen,
  onClose,
  userFid,
  userProfile,
  onOpenUrl,
}: {
  isOpen: boolean
  onClose: () => void
  userFid?: number
  userProfile?: { username?: string; displayName?: string; pfpUrl?: string }
  onOpenUrl?: (url: string) => void
}) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [pinned, setPinned] = useState<PinnedMessage[]>([])
  const [inputValue, setInputValue] = useState('')
  const [sending, setSending] = useState(false)
  const [loading, setLoading] = useState(true)
  const [contextMenu, setContextMenu] = useState<{ message: ChatMessage; x: number; y: number } | null>(null)
  const [showScrollBtn, setShowScrollBtn] = useState(false)
  const [memberCount, setMemberCount] = useState(0)
  const [mentionSuggestions, setMentionSuggestions] = useState<string[]>([])
  const [showMentions, setShowMentions] = useState(false)
  const [newMessageIndicator, setNewMessageIndicator] = useState(0)
  const [justRegistered, setJustRegistered] = useState(false)
  const [replyTo, setReplyTo] = useState<ChatMessage | null>(null)

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const lastMessageTime = useRef<string | null>(null)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const isAtBottom = useRef(true)

  const isOwnerUser = userFid === OWNER_FID

  /* ── On-chain registration check ── */
  const { address, isConnected } = useAccount()

  const { data: isUserRegistered, isLoading: checkingRegistration, refetch: refetchRegistration } = useReadContract({
    address: TASKPAY_CHAT_ADDRESS,
    abi: TASKPAY_CHAT_ABI,
    functionName: 'checkRegistered',
    args: address ? [address] : undefined,
    query: { enabled: isOpen && !!address },
  })

  const { data: onChainMemberCount } = useReadContract({
    address: TASKPAY_CHAT_ADDRESS,
    abi: TASKPAY_CHAT_ABI,
    functionName: 'memberCount',
    query: { enabled: isOpen },
  })

  const { writeContract, data: registerTxHash, isPending: isRegistering, error: registerError } = useWriteContract()

  const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({
    hash: registerTxHash,
  })

  // After tx confirms, refresh registration status
  useEffect(() => {
    if (isConfirmed) {
      setJustRegistered(true)
      refetchRegistration()
    }
  }, [isConfirmed, refetchRegistration])

  const handleRegister = () => {
    writeContract({
      address: TASKPAY_CHAT_ADDRESS,
      abi: TASKPAY_CHAT_ABI,
      functionName: 'register',
    })
  }

  const userIsRegistered = isUserRegistered === true || justRegistered

  /* ── Scroll helpers ── */
  const scrollToBottom = useCallback((smooth = true) => {
    messagesEndRef.current?.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto' })
    setNewMessageIndicator(0)
  }, [])

  const handleScroll = useCallback(() => {
    if (!scrollContainerRef.current) return
    const el = scrollContainerRef.current
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 60
    isAtBottom.current = atBottom
    setShowScrollBtn(!atBottom)
  }, [])

  /* ── Fetch messages (initial + polling) ── */
  const fetchMessages = useCallback(async (isPolling = false) => {
    try {
      const params: any = { limit: 80 }
      if (isPolling && lastMessageTime.current) {
        params.after = lastMessageTime.current
      }

      const res = await axios.get('/api/chat/messages', { params })
      const data = res.data

      if (isPolling) {
        if (data.messages.length > 0) {
          setMessages(prev => {
            const existingIds = new Set(prev.map((m: ChatMessage) => m._id))
            const newMsgs = data.messages.filter((m: ChatMessage) => !existingIds.has(m._id))
            if (newMsgs.length === 0) return prev
            const updated = [...prev, ...newMsgs]
            lastMessageTime.current = newMsgs[newMsgs.length - 1].createdAt
            if (!isAtBottom.current) {
              setNewMessageIndicator(c => c + newMsgs.length)
            }
            return updated
          })
          if (isAtBottom.current) {
            setTimeout(() => scrollToBottom(), 50)
          }
        }
      } else {
        setMessages(data.messages || [])
        setPinned(data.pinned || [])
        if (data.messages?.length > 0) {
          lastMessageTime.current = data.messages[data.messages.length - 1].createdAt
        }
        // Get unique user count
        const uniqueFids = new Set(data.messages?.map((m: ChatMessage) => m.fid) || [])
        setMemberCount(uniqueFids.size)
        setLoading(false)
        setTimeout(() => scrollToBottom(false), 100)
      }
    } catch (err) {
      console.error('[GroupChat] fetch error:', err)
      if (!isPolling) setLoading(false)
    }
  }, [scrollToBottom])

  /* ── Start/stop polling (only after registered) ── */
  useEffect(() => {
    if (!isOpen || !userIsRegistered) return

    fetchMessages(false)

    pollRef.current = setInterval(() => {
      fetchMessages(true)
    }, POLL_INTERVAL)

    return () => {
      if (pollRef.current) clearInterval(pollRef.current)
    }
  }, [isOpen, fetchMessages, userIsRegistered])

  /* ── Mark mentions as read when opening chat ── */
  useEffect(() => {
    if (isOpen && userFid) {
      axios.post('/api/chat/mentions', { fid: userFid }).catch(() => {})
    }
  }, [isOpen, userFid])

  /* ── Build mention suggestions from recent chatters ── */
  const recentUsernames = useMemo(() => {
    const names = new Map<string, boolean>()
    messages.forEach(m => {
      if (m.fid !== userFid) {
        names.set(m.username, true)
      }
    })
    return Array.from(names.keys())
  }, [messages, userFid])

  /* ── Handle input with @mention detection ── */
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value
    setInputValue(val)

    // Detect if user is typing @mention
    const lastAt = val.lastIndexOf('@')
    if (lastAt !== -1 && lastAt === val.length - 1 || (lastAt !== -1 && !val.slice(lastAt).includes(' '))) {
      const partial = val.slice(lastAt + 1).toLowerCase()
      const suggestions = recentUsernames.filter(u => u.toLowerCase().startsWith(partial)).slice(0, 5)
      setMentionSuggestions(suggestions)
      setShowMentions(suggestions.length > 0 && partial.length > 0)
    } else {
      setShowMentions(false)
    }
  }

  const selectMention = (username: string) => {
    const lastAt = inputValue.lastIndexOf('@')
    const newValue = inputValue.slice(0, lastAt) + '@' + username + ' '
    setInputValue(newValue)
    setShowMentions(false)
    inputRef.current?.focus()
  }

  /* ── Send message ── */
  const handleSend = async () => {
    if (!inputValue.trim() || sending || !userFid) return

    const content = inputValue.trim()
    const currentReply = replyTo
    setInputValue('')
    setShowMentions(false)
    setReplyTo(null)
    setSending(true)

    try {
      const payload: any = {
        fid: userFid,
        username: userProfile?.username || `fid:${userFid}`,
        displayName: userProfile?.displayName || userProfile?.username || `User ${userFid}`,
        pfpUrl: userProfile?.pfpUrl || '',
        content,
      }

      if (currentReply) {
        payload.replyTo = {
          _id: currentReply._id,
          username: currentReply.username,
          displayName: currentReply.displayName,
          content: currentReply.content,
          isOwner: currentReply.isOwner,
        }
      }

      const res = await axios.post('/api/chat/messages', payload)

      if (res.data?.message) {
        setMessages(prev => {
          const exists = prev.some(m => m._id === res.data.message._id)
          if (exists) return prev
          return [...prev, res.data.message]
        })
        lastMessageTime.current = res.data.message.createdAt
        setTimeout(() => scrollToBottom(), 50)
      }
    } catch (err: any) {
      console.error('[GroupChat] send error:', err)
      setInputValue(content)
      setReplyTo(currentReply)
    } finally {
      setSending(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  /* ── Admin actions ── */
  const handleDelete = async (messageId: string) => {
    try {
      await axios.post('/api/chat/admin', { fid: userFid, action: 'delete', messageId })
      setMessages(prev => prev.filter(m => m._id !== messageId))
      setPinned(prev => prev.filter(p => p._id !== messageId))
    } catch (err) {
      console.error('[GroupChat] delete error:', err)
    }
  }

  const handlePin = async (messageId: string) => {
    try {
      const res = await axios.post('/api/chat/admin', { fid: userFid, action: 'pin', messageId })
      if (res.data?.message) {
        setPinned(prev => [{ ...res.data.message, isPinned: true, pinnedAt: new Date().toISOString() }, ...prev])
        setMessages(prev => prev.map(m => m._id === messageId ? { ...m, isPinned: true } : m))
      }
    } catch (err) {
      console.error('[GroupChat] pin error:', err)
    }
  }

  const handleUnpin = async (messageId: string) => {
    try {
      await axios.post('/api/chat/admin', { fid: userFid, action: 'unpin', messageId })
      setPinned(prev => prev.filter(p => p._id !== messageId))
      setMessages(prev => prev.map(m => m._id === messageId ? { ...m, isPinned: false } : m))
    } catch (err) {
      console.error('[GroupChat] unpin error:', err)
    }
  }

  const handleBan = async (targetFid: number) => {
    try {
      await axios.post('/api/chat/admin', { fid: userFid, action: 'ban', targetFid })
    } catch (err) {
      console.error('[GroupChat] ban error:', err)
    }
  }

  /* ── Context menu handler ── */
  const handleContextMenu = (e: React.MouseEvent | React.TouchEvent, message: ChatMessage) => {
    if (!isOwnerUser) return
    e.preventDefault()
    const clientX = 'touches' in e ? e.touches[0]?.clientX || 0 : e.clientX
    const clientY = 'touches' in e ? e.touches[0]?.clientY || 0 : e.clientY
    setContextMenu({ message, x: clientX, y: clientY })
  }

  if (!isOpen) return null

  /* ── Registration Gate Screen ── */
  if (!userIsRegistered && !checkingRegistration) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.25 }}
        className="fixed inset-0 z-[80] flex flex-col bg-white"
      >
        {/* Header */}
        <header className="shrink-0 z-10 glass-light border-b border-gray-100/50 px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-violet-500 via-purple-500 to-blue-500 flex items-center justify-center shadow-lg shadow-purple-500/20">
                <FontAwesomeIcon icon={faUsers} className="text-white text-sm" />
              </div>
              <h2 className="text-[15px] font-black text-black tracking-tight">TaskPay Community</h2>
            </div>
            <button
              onClick={onClose}
              className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 hover:bg-gray-200 hover:text-black transition-all"
            >
              <FontAwesomeIcon icon={faTimes} className="text-sm" />
            </button>
          </div>
        </header>

        {/* Registration Content */}
        <div className="flex-1 flex flex-col items-center justify-center px-6">
          <motion.div
            initial={{ scale: 0, rotate: -10 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: 'spring', damping: 12, stiffness: 200 }}
            className="relative mb-6"
          >
            <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-violet-500 via-purple-500 to-blue-500 flex items-center justify-center shadow-2xl shadow-purple-500/30">
              <FontAwesomeIcon icon={faUsers} className="text-white text-3xl" />
            </div>
            <motion.div
              animate={{ scale: [1, 1.3, 1], opacity: [0.3, 0, 0.3] }}
              transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
              className="absolute inset-0 rounded-3xl border-2 border-violet-300"
            />
          </motion.div>

          <motion.h2
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="text-2xl font-black text-black mb-2 text-center tracking-tight"
          >
            Join the Community
          </motion.h2>

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.25 }}
            className="text-gray-500 text-sm text-center max-w-[300px] mb-8 leading-relaxed"
          >
            Register on-chain to unlock the TaskPay community chat. Free — only costs gas.
          </motion.p>

          {onChainMemberCount != null && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.3 }}
              className="flex items-center gap-2 px-4 py-2 rounded-2xl bg-violet-50 border border-violet-100 mb-6"
            >
              <FontAwesomeIcon icon={faUsers} className="text-violet-500 text-xs" />
              <span className="text-sm font-bold text-violet-700">
                {Number(onChainMemberCount).toLocaleString()} members registered
              </span>
            </motion.div>
          )}

          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.35 }}
            className="w-full max-w-sm space-y-3 mb-6"
          >
            <div className="flex items-center gap-3 p-3.5 rounded-2xl bg-gray-50 border border-gray-100">
              <div className="w-9 h-9 rounded-xl bg-green-100 flex items-center justify-center shrink-0">
                <FontAwesomeIcon icon={faCheckCircle} className="text-green-500 text-sm" />
              </div>
              <div>
                <span className="text-[13px] font-bold text-black">100% Free</span>
                <p className="text-[11px] text-gray-400">No fees — only a small gas cost for registration</p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3.5 rounded-2xl bg-gray-50 border border-gray-100">
              <div className="w-9 h-9 rounded-xl bg-violet-100 flex items-center justify-center shrink-0">
                <FontAwesomeIcon icon={faLink} className="text-violet-500 text-sm" />
              </div>
              <div>
                <span className="text-[13px] font-bold text-black">On-chain Identity</span>
                <p className="text-[11px] text-gray-400">Your membership is stored permanently on-chain</p>
              </div>
            </div>
          </motion.div>

          {isConfirmed || justRegistered ? (
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="flex flex-col items-center gap-3"
            >
              <div className="w-14 h-14 rounded-full bg-green-100 flex items-center justify-center">
                <FontAwesomeIcon icon={faCheckCircle} className="text-green-500 text-2xl" />
              </div>
              <span className="text-sm font-bold text-green-600">Welcome! You're registered ✓</span>
            </motion.div>
          ) : (
            <motion.button
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              whileTap={{ scale: 0.95 }}
              onClick={handleRegister}
              disabled={isRegistering || isConfirming || !isConnected}
              className="w-full max-w-sm py-3.5 rounded-2xl bg-gradient-to-r from-violet-600 via-purple-600 to-blue-600 text-white font-bold text-[15px] flex items-center justify-center gap-2.5 shadow-xl disabled:opacity-50 transition-all"
              style={{ boxShadow: '0 8px 24px rgba(124, 58, 237, 0.3)' }}
            >
              {isRegistering ? (
                <><FontAwesomeIcon icon={faSpinner} className="animate-spin" /> Confirm in wallet...</>
              ) : isConfirming ? (
                <><FontAwesomeIcon icon={faSpinner} className="animate-spin" /> Confirming tx...</>
              ) : (
                <><FontAwesomeIcon icon={faUserPlus} /> Join Community Chat</>
              )}
            </motion.button>
          )}

          {registerError && (
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="mt-3 text-xs text-red-500 text-center max-w-[300px]"
            >
              {(registerError as any)?.shortMessage || 'Registration failed. Please try again.'}
            </motion.p>
          )}
        </div>
      </motion.div>
    )
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.25 }}
      className="fixed inset-0 z-[80] flex flex-col bg-white"
    >
      {/* ── Header ── */}
      <header className="shrink-0 z-10 glass-light border-b border-gray-100/50 px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-violet-500 via-purple-500 to-blue-500 flex items-center justify-center shadow-lg shadow-purple-500/20">
              <FontAwesomeIcon icon={faUsers} className="text-white text-sm" />
            </div>
            <div>
              <h2 className="text-[15px] font-black text-black tracking-tight leading-none">
                TaskPay Community
              </h2>
              <div className="flex items-center gap-1.5 mt-0.5">
                <FontAwesomeIcon icon={faCircle} className="text-green-400 text-[6px]" />
                <span className="text-[11px] text-gray-400 font-medium">
                  {onChainMemberCount ? `${Number(onChainMemberCount).toLocaleString()} on-chain` : memberCount > 0 ? `${memberCount} members` : 'Global Chat'}
                </span>
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 hover:bg-gray-200 hover:text-black transition-all"
          >
            <FontAwesomeIcon icon={faTimes} className="text-sm" />
          </button>
        </div>
      </header>

      {/* ── Pinned Messages ── */}
      <AnimatePresence>
        {pinned.length > 0 && (
          <PinnedBanner pinned={pinned} onUnpin={handleUnpin} isOwner={isOwnerUser} onOpenUrl={onOpenUrl} />
        )}
      </AnimatePresence>

      {/* ── Messages Area ── */}
      <div
        ref={scrollContainerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto overflow-x-hidden px-4 py-3 relative"
      >
        {loading ? (
          <div className="flex-1 flex flex-col items-center justify-center h-full gap-3">
            <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center">
              <FontAwesomeIcon icon={faSpinner} className="text-gray-400 animate-spin" />
            </div>
            <span className="text-sm text-gray-400 font-medium">Loading messages...</span>
          </div>
        ) : messages.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center h-full gap-3 py-20">
            <div className="w-16 h-16 rounded-3xl bg-gradient-to-br from-violet-100 to-blue-100 flex items-center justify-center">
              <FontAwesomeIcon icon={faUsers} className="text-violet-400 text-2xl" />
            </div>
            <h3 className="text-lg font-bold text-black">Welcome to the Community!</h3>
            <p className="text-sm text-gray-400 text-center max-w-[250px]">
              Be the first to say something. Start a conversation!
            </p>
          </div>
        ) : (
          <div className="space-y-1">
            {messages.map((msg, idx) => {
              const isOwnMessage = msg.fid === userFid
              const isMentioned = userFid ? msg.mentions?.includes(userFid) : false
              const prevMsg = idx > 0 ? messages[idx - 1] : null
              const showAvatar = !prevMsg || prevMsg.fid !== msg.fid ||
                (new Date(msg.createdAt).getTime() - new Date(prevMsg.createdAt).getTime() > 120000)
              const showDate = !prevMsg ||
                new Date(msg.createdAt).toDateString() !== new Date(prevMsg.createdAt).toDateString()

              return (
                <React.Fragment key={msg._id}>
                  {/* Date separator */}
                  {showDate && (
                    <div className="flex items-center justify-center py-3">
                      <div className="px-3 py-1 rounded-full bg-gray-100 text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
                        {new Date(msg.createdAt).toLocaleDateString('en-US', {
                          weekday: 'short', month: 'short', day: 'numeric'
                        })}
                      </div>
                    </div>
                  )}

                  {/* Message bubble */}
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.2 }}
                    className={`group relative ${showAvatar ? 'mt-3' : 'mt-0.5'} ${
                      isMentioned ? 'bg-violet-50/60 -mx-2 px-2 py-1 rounded-xl border border-violet-100' : ''
                    }`}
                    onContextMenu={(e) => handleContextMenu(e, msg)}
                    onDoubleClick={() => {
                      setReplyTo(msg)
                      inputRef.current?.focus()
                    }}
                    onTouchStart={(e) => {
                      // Long-press for admin context menu
                      if (isOwnerUser) {
                        const timer = setTimeout(() => {
                          handleContextMenu(e, msg)
                        }, 500)
                        const clear = () => clearTimeout(timer)
                        e.currentTarget.addEventListener('touchend', clear, { once: true })
                        e.currentTarget.addEventListener('touchmove', clear, { once: true })
                      }
                    }}
                  >
                    <div className={`flex gap-2.5 ${isOwnMessage ? '' : ''}`}>
                      {/* Avatar */}
                      {showAvatar ? (
                        <div className="shrink-0">
                          {msg.pfpUrl ? (
                            <img
                              src={msg.pfpUrl}
                              alt={msg.username}
                              className="w-8 h-8 rounded-full object-cover ring-1 ring-gray-100"
                              onError={(e) => { (e.target as HTMLImageElement).src = '' ; (e.target as HTMLImageElement).className = 'w-8 h-8 rounded-full bg-gradient-to-br from-violet-200 to-blue-200' }}
                            />
                          ) : (
                            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-violet-200 to-blue-200 flex items-center justify-center">
                              <span className="text-xs font-bold text-violet-600">
                                {(msg.displayName || msg.username || '?')[0]?.toUpperCase()}
                              </span>
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="w-8 shrink-0" />
                      )}

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        {showAvatar && (
                          <div className="flex items-center gap-2 mb-0.5">
                            <span className="text-[13px] font-bold text-black leading-none">
                              {msg.displayName || msg.username}
                            </span>
                            {msg.isOwner && (
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-amber-50 border border-amber-200">
                                <FontAwesomeIcon icon={faCrown} className="text-[8px] text-amber-500" />
                                <span className="text-[9px] font-bold text-amber-600 uppercase tracking-wider">Owner</span>
                              </span>
                            )}
                            {msg.isPinned && (
                              <FontAwesomeIcon icon={faThumbtack} className="text-[9px] text-amber-400" />
                            )}
                            <span className="text-[11px] text-gray-300 font-medium">
                              {timeAgo(msg.createdAt)}
                            </span>
                          </div>
                        )}

                        {/* Reply quote bubble */}
                        {msg.replyTo && (
                          <div className="mb-1.5 flex items-stretch gap-0 max-w-[85%]">
                            <div className="w-[3px] rounded-full bg-violet-400 shrink-0" />
                            <div className="pl-2.5 py-1 min-w-0">
                              <span className={`text-[11px] font-bold leading-none ${
                                msg.replyTo.isOwner ? 'text-amber-600' : 'text-violet-600'
                              }`}>
                                {msg.replyTo.displayName || msg.replyTo.username}
                              </span>
                              <p className="text-[12px] text-gray-400 truncate leading-snug mt-0.5">
                                {msg.replyTo.content}
                              </p>
                            </div>
                          </div>
                        )}

                        <p className="text-[14px] text-gray-800 leading-relaxed break-words">
                          <RenderContent content={msg.content} currentFid={userFid} isOwnerMessage={msg.isOwner} onOpenUrl={onOpenUrl} />
                        </p>
                      </div>

                      {/* Reply + Admin quick actions */}
                      <div className="shrink-0 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-all">
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            setReplyTo(msg)
                            inputRef.current?.focus()
                          }}
                          className="w-6 h-6 rounded-full flex items-center justify-center text-gray-300 hover:bg-violet-50 hover:text-violet-500 transition-all"
                          aria-label="Reply"
                        >
                          <FontAwesomeIcon icon={faReply} className="text-[10px]" />
                        </button>
                        {isOwnerUser && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              setContextMenu({
                                message: msg,
                                x: e.clientX,
                                y: e.clientY,
                              })
                            }}
                            className="w-6 h-6 rounded-full flex items-center justify-center text-gray-300 hover:bg-gray-100 hover:text-gray-500 transition-all"
                          >
                            <FontAwesomeIcon icon={faEllipsisV} className="text-[10px]" />
                          </button>
                        )}
                      </div>
                    </div>
                  </motion.div>
                </React.Fragment>
              )
            })}
            <div ref={messagesEndRef} />
          </div>
        )}

        {/* Scroll to bottom button */}
        <AnimatePresence>
          {showScrollBtn && (
            <motion.button
              initial={{ opacity: 0, scale: 0.8, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.8, y: 10 }}
              onClick={() => scrollToBottom()}
              className="sticky bottom-3 left-1/2 -translate-x-1/2 w-10 h-10 rounded-full bg-black text-white shadow-xl flex items-center justify-center hover:bg-gray-800 transition-colors z-10"
              style={{ marginLeft: 'auto', marginRight: 'auto', display: 'block' }}
            >
              <FontAwesomeIcon icon={faArrowDown} className="text-xs" />
              {newMessageIndicator > 0 && (
                <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-violet-500 text-white text-[10px] font-bold flex items-center justify-center">
                  {newMessageIndicator > 9 ? '9+' : newMessageIndicator}
                </span>
              )}
            </motion.button>
          )}
        </AnimatePresence>
      </div>

      {/* ── @Mention Autocomplete ── */}
      <AnimatePresence>
        {showMentions && mentionSuggestions.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            className="border-t border-gray-100 bg-white px-4 py-2"
          >
            <div className="flex items-center gap-1.5 mb-1.5">
              <FontAwesomeIcon icon={faAt} className="text-[10px] text-violet-400" />
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Mention</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {mentionSuggestions.map(username => (
                <button
                  key={username}
                  onClick={() => selectMention(username)}
                  className="px-3 py-1.5 rounded-xl bg-violet-50 border border-violet-100 text-sm font-medium text-violet-700 hover:bg-violet-100 transition-colors"
                >
                  @{username}
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Reply Preview Bar ── */}
      <AnimatePresence>
        {replyTo && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="shrink-0 border-t border-gray-100 bg-gray-50/80 overflow-hidden"
          >
            <div className="px-4 py-2.5 flex items-start gap-3">
              <div className="w-[3px] rounded-full bg-violet-400 self-stretch shrink-0" />
              <div className="flex-1 min-w-0">
                <span className={`text-[11px] font-bold leading-none ${
                  replyTo.isOwner ? 'text-amber-600' : 'text-violet-600'
                }`}>
                  <FontAwesomeIcon icon={faReply} className="mr-1 text-[9px]" />
                  {replyTo.displayName || replyTo.username}
                </span>
                <p className="text-[12px] text-gray-500 truncate leading-snug mt-0.5">
                  {replyTo.content}
                </p>
              </div>
              <button
                onClick={() => setReplyTo(null)}
                className="shrink-0 w-6 h-6 rounded-full bg-gray-200/80 flex items-center justify-center text-gray-400 hover:bg-gray-300 hover:text-gray-600 transition-colors"
                aria-label="Cancel reply"
              >
                <FontAwesomeIcon icon={faTimes} className="text-[10px]" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Input Bar ── */}
      <div className="shrink-0 glass-light border-t border-gray-100/50 px-4 py-3">
        <div className="flex items-center gap-2">
          <div className="flex-1 relative">
            <input
              ref={inputRef}
              type="text"
              value={inputValue}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              placeholder="Type a message..."
              maxLength={MAX_MESSAGE_LENGTH}
              className="w-full px-4 py-2.5 rounded-2xl bg-gray-100 border border-gray-200 text-sm text-black placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-violet-200 focus:border-violet-300 transition-all"
            />
            {inputValue.length > MAX_MESSAGE_LENGTH * 0.8 && (
              <span className={`absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-medium ${
                inputValue.length >= MAX_MESSAGE_LENGTH ? 'text-red-500' : 'text-gray-300'
              }`}>
                {MAX_MESSAGE_LENGTH - inputValue.length}
              </span>
            )}
          </div>
          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={handleSend}
            disabled={!inputValue.trim() || sending}
            className={`w-10 h-10 rounded-2xl flex items-center justify-center transition-all duration-200 ${
              inputValue.trim()
                ? 'bg-gradient-to-r from-violet-600 to-purple-600 text-white shadow-lg shadow-violet-500/25 hover:shadow-xl'
                : 'bg-gray-100 text-gray-300'
            }`}
          >
            {sending ? (
              <FontAwesomeIcon icon={faSpinner} className="text-sm animate-spin" />
            ) : (
              <FontAwesomeIcon icon={faPaperPlane} className="text-sm" />
            )}
          </motion.button>
        </div>
      </div>

      {/* ── Context Menu ── */}
      <AnimatePresence>
        {contextMenu && (
          <MessageContextMenu
            message={contextMenu.message}
            position={{ x: contextMenu.x, y: contextMenu.y }}
            onClose={() => setContextMenu(null)}
            onDelete={handleDelete}
            onPin={handlePin}
            onUnpin={handleUnpin}
            onBan={handleBan}
          />
        )}
      </AnimatePresence>
    </motion.div>
  )
}
