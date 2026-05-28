import { useCallback, useEffect, useRef, useState } from "react";
import { useLocation, useParams, useNavigate } from "react-router-dom";
import { useSelector } from "react-redux";
import {
  createChat,
  sendMessage,
  fetchMessages,
  setTypingStatus,
  deleteMessage,
  markMessagesAsRead,
  toggleMessageReaction,
  deleteChatCompletely,
  cleanupExpiredMessages,
  uploadChatFile,
  db,
  auth
} from "../firebase";
import { doc, onSnapshot, getDoc, setDoc, deleteDoc } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { 
  BsPaperclip, 
  BsEmojiSmile, 
  BsReply, 
  BsX, 
  BsTrash, 
  BsFiles, 
  BsThreeDotsVertical, 
  BsSend, 
  BsChevronLeft,
  BsTelephone,
  BsCameraVideo,
  BsPencilSquare,
  BsSun,
  BsMoonStars
} from "react-icons/bs"; // Modern React Icons
import { useCall } from "../components/contexts/CallContext";
import { useTheme } from "../components/contexts/ThemeContext"; // Theme context hook
import { useAvatarView } from "../components/contexts/AvatarViewContext"; // Avatar view hook

// Standalone utility for smart, brand-aware client-side URL linkification
const renderMessageText = (text) => {
  if (!text) return "";
  
  // URL matching Regex
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  const parts = text.split(urlRegex);
  
  return parts.map((part, index) => {
    if (part.match(urlRegex)) {
      let displayLabel = part;
      // Brand-aware clean visual labels
      if (part.includes("instagram.com")) {
        displayLabel = "📷 Instagram Link";
      } else if (part.includes("facebook.com")) {
        displayLabel = "🔵 Facebook Link";
      } else if (part.includes("youtube.com") || part.includes("youtu.be")) {
        displayLabel = "🎥 YouTube Link";
      } else {
        // truncate general link nicely
        try {
          const urlObj = new URL(part);
          const pathname = urlObj.pathname;
          const displayPath = pathname.length > 15 ? pathname.substring(0, 15) + "..." : pathname;
          displayLabel = `🔗 ${urlObj.hostname}${displayPath === "/" ? "" : displayPath}`;
        } catch {
          displayLabel = "🔗 Link";
        }
      }
      
      return (
        <a
          key={index}
          href={part}
          target="_blank"
          rel="noopener noreferrer"
          className="chat-message-link"
          onClick={(e) => e.stopPropagation()} // Prevent options menu toggle on bubble click
        >
          {displayLabel}
        </a>
      );
    }
    return part;
  });
};
// Standalone utility for professional relative last seen formatting
const getLastSeenText = (lastActive) => {
  if (!lastActive) return "Offline";
  
  const date = lastActive.toDate ? lastActive.toDate() : new Date(lastActive);
  const now = new Date();
  const diffMs = now - date;
  
  if (diffMs < 5 * 60 * 1000) {
    return "Online";
  }
  
  const diffMins = Math.floor(diffMs / (60 * 1000));
  if (diffMins < 60) {
    return `Last seen ${diffMins}m ago`;
  }
  
  const diffHours = Math.floor(diffMs / (60 * 60 * 1000));
  if (diffHours < 24) {
    return `Last seen ${diffHours}h ago`;
  }
  
  return `Last seen ${date.toLocaleDateString([], { month: "short", day: "numeric" })} at ${date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
};

const ChatPage = () => {
  const { theme, resolvedTheme, setTheme } = useTheme();
  const { openAvatar } = useAvatarView();

  const handleCycleTheme = (e) => {
    e.stopPropagation();
    if (theme === "light") {
      setTheme("dark");
    } else if (theme === "dark") {
      setTheme("system");
    } else {
      setTheme("light");
    }
  };

  const { userId } = useParams();
  const { state } = useLocation();
  const { photoURL, displayName } = state || {};

  const { user, isAuthenticated } = useSelector(
    (state) => ({
      user: state.auth.user,
      isAuthenticated: state.auth.isAuthenticated,
    }),
    (prev, next) =>
      prev.user === next.user && prev.isAuthenticated === next.isAuthenticated
  );

  const navigate = useNavigate();
  const { initiateCall } = useCall();
  const chatContainerRef = useRef(null);
  const fileInputRef = useRef(null);

  // Core Chat States
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState("");
  const [chatId, setChatId] = useState(null);
  const [isTyping, setIsTyping] = useState(false);
  const [recipientProfile, setRecipientProfile] = useState(null);

  // Modern UI States
  const [activeMenuId, setActiveMenuId] = useState(null);
  const [customReactionMsgId, setCustomReactionMsgId] = useState(null);
  const [replyTo, setReplyTo] = useState(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [filePreview, setFilePreview] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [showEmojiGrid, setShowEmojiGrid] = useState(false);
  const [loading, setLoading] = useState(true);

  // Custom Local Nicknames States
  const [customNickname, setCustomNickname] = useState("");
  const [isNicknameModalOpen, setIsNicknameModalOpen] = useState(false);
  const [nicknameInput, setNicknameInput] = useState("");

  const messagesUnsubscribeRef = useRef(null);
  const typingUnsubscribeRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  // Mirrors chatId in a ref so reconnect callbacks always read the latest value
  // without needing to be in their own dependency arrays (avoids stale closures).
  const chatIdRef = useRef(null);

  const popularEmojis = ["👍", "❤️", "😂", "🎉", "😮", "😢"];

  // Helper to generate chatId
  const generateChatId = () => {
    if (!user || !userId) return null;
    const participants = [user.uid, userId].sort();
    return `chat_${participants[0]}_${participants[1]}`;
  };

  // Auth synchronization effect
  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (currentUser) => {
      if (!currentUser || !isAuthenticated) {
        cleanupListeners();
        setMessages([]);
        setChatId(null);
        setIsTyping(false);
        navigate("/login");
      }
    });

    return () => unsubscribeAuth();
  }, [navigate, isAuthenticated]);

  // Clean up helper
  const cleanupListeners = () => {
    if (messagesUnsubscribeRef.current) {
      messagesUnsubscribeRef.current();
      messagesUnsubscribeRef.current = null;
    }
    if (typingUnsubscribeRef.current) {
      typingUnsubscribeRef.current();
      typingUnsubscribeRef.current = null;
    }
  };

  // Cleanup typing status timeout and reset Firestore status on chat change or unmount
  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      if (chatId && user?.uid) {
        setTypingStatus(chatId, user.uid, false);
      }
    };
  }, [chatId, user?.uid]);

  // Sync recipient presence profile details in real-time
  useEffect(() => {
    if (userId) {
      const userRef = doc(db, "users", userId);
      const unsubscribe = onSnapshot(userRef, (snapshot) => {
        if (snapshot.exists()) {
          setRecipientProfile(snapshot.data());
        }
      });
      return () => unsubscribe();
    }
  }, [userId]);

  // Sync custom local nickname in real-time
  useEffect(() => {
    if (user?.uid && userId) {
      const docId = `${user.uid}_${userId}`;
      const docRef = doc(db, "customNicknames", docId);
      const unsubscribe = onSnapshot(docRef, (docSnapshot) => {
        if (docSnapshot.exists()) {
          const name = docSnapshot.data().nickname;
          setCustomNickname(name);
          setNicknameInput(name);
        } else {
          setCustomNickname("");
          setNicknameInput("");
        }
      });
      return () => unsubscribe();
    }
  }, [user?.uid, userId]);

  // Check/create chat and fetch messages
  useEffect(() => {
    if (!isAuthenticated || !user || !userId) return;

    const checkAndInitChat = async () => {
      const generatedChatId = generateChatId();
      if (!generatedChatId) return;

      const chatRef = doc(db, "storedChats", generatedChatId);
      const chatDoc = await getDoc(chatRef);

      if (chatDoc.exists()) {
        setChatId(generatedChatId);
      } else {
        setLoading(false); // If no chat exists yet, immediately display empty
      }
    };

    checkAndInitChat().catch((error) => {
      console.error("Error initializing chat:", error);
      setLoading(false);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.uid, userId, isAuthenticated]);

  // ─── startMessagesListener ───────────────────────────────────────────────
  // Reusable, self-healing messages listener.
  // • Tears down any existing subscription before creating a new one so it is
  //   safe to call multiple times (reconnect events, error recovery).
  // • Passes an onError handler to fetchMessages: if Firestore silently drops
  //   the WebSocket (phone lock, network loss, browser background-throttling)
  //   the error surfaces here and we schedule an automatic 3-second restart.
  // • `showSpinner` defaults to true for initial mount; reconnects pass false
  //   so existing messages remain visible while the new subscription settles.
  // ─────────────────────────────────────────────────────────────────────────
  const startMessagesListener = useCallback((resolvedChatId, showSpinner = true) => {
    if (!resolvedChatId || !isAuthenticated) return;

    // Always clean up the previous subscriber before attaching a new one.
    if (messagesUnsubscribeRef.current) {
      messagesUnsubscribeRef.current();
      messagesUnsubscribeRef.current = null;
    }

    // Only blank the UI with a spinner on initial/intentional loads.
    // Silent reconnects keep existing messages visible until the new snapshot arrives.
    if (showSpinner) {
      setLoading(true);
    }

    const unsubscribe = fetchMessages(
      resolvedChatId,
      // ── success callback ──
      (fetchedMessages) => {
        setMessages(fetchedMessages);
        setLoading(false);

        // Client-side auto-delete cleanup (privacy TTL replacement for Spark tier)
        if (fetchedMessages.length > 0) {
          cleanupExpiredMessages(resolvedChatId, fetchedMessages);
        }

        // Mark unread messages as read
        if (fetchedMessages.some((msg) => msg.senderId !== user?.uid && !msg.read)) {
          markMessagesAsRead(resolvedChatId, user.uid);
        }
      },
      // ── error callback ──
      (error) => {
        // The listener was silently killed (network drop, browser suspension, etc.).
        // Schedule a restart — only if this chatId is still active.
        console.warn(
          "[ChatPage] Message listener failed (", error?.code, "), restarting in 3s…"
        );
        setLoading(false);
        setTimeout(() => {
          // Read from the ref to get the latest chatId without a stale closure.
          const currentChatId = chatIdRef.current;
          // Silent restart — don't blank messages during auto-recovery.
          if (currentChatId) startMessagesListener(currentChatId, false);
        }, 3000);
      }
    );

    messagesUnsubscribeRef.current = unsubscribe;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, user?.uid]);

  // Keep chatIdRef in sync with chatId state so reconnect callbacks always
  // reference the correct value without triggering extra re-renders.
  useEffect(() => {
    chatIdRef.current = chatId;
  }, [chatId]);

  // Initial listener mount — runs whenever chatId becomes available.
  useEffect(() => {
    if (!chatId || !isAuthenticated) return;
    startMessagesListener(chatId);
    return () => {
      if (messagesUnsubscribeRef.current) {
        messagesUnsubscribeRef.current();
        messagesUnsubscribeRef.current = null;
      }
    };
  }, [chatId, isAuthenticated, startMessagesListener]);

  // ── Reconnect on visibility change (phone unlock / tab foreground) ────────
  // The browser fires "visibilitychange" when the user returns to the tab
  // after locking their phone, switching apps, or backgrounding the browser.
  // We restart the listener so messages sent during the gap appear immediately.
  useEffect(() => {
    if (!chatId) return;
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        const currentChatId = chatIdRef.current;
        if (currentChatId) {
          console.log("[ChatPage] Tab visible — restarting message listener.");
          startMessagesListener(currentChatId, false); // silent: keep existing messages visible
        }
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, [chatId, startMessagesListener]);

  // ── Reconnect on network restore (internet off → on) ─────────────────────
  // The browser fires "online" when the network connection is re-established
  // (airplane mode off, WiFi reconnected, cellular handover).
  useEffect(() => {
    if (!chatId) return;
    const handleOnline = () => {
      const currentChatId = chatIdRef.current;
      if (currentChatId) {
        console.log("[ChatPage] Network back online — restarting message listener.");
        startMessagesListener(currentChatId, false); // silent: keep existing messages visible
      }
    };
    window.addEventListener("online", handleOnline);
    return () => window.removeEventListener("online", handleOnline);
  }, [chatId, startMessagesListener]);

  // Real-time typing status listener
  useEffect(() => {
    if (!chatId || !isAuthenticated) return;

    const chatRef = doc(db, "storedChats", chatId);
    const unsubscribe = onSnapshot(chatRef, (doc) => {
      const data = doc.data();
      if (!data) return;
      const otherUserId = data.participants.find((id) => id !== user?.uid);
      setIsTyping(data.typing?.[otherUserId] || false);
    });

    typingUnsubscribeRef.current = unsubscribe;

    return () => {
      if (typingUnsubscribeRef.current) {
        typingUnsubscribeRef.current();
        typingUnsubscribeRef.current = null;
      }
    };
  }, [chatId, user?.uid, isAuthenticated]);

  // Autoscroll to bottom with transition tracking
  useEffect(() => {
    if (chatContainerRef.current) {
      // Scroll instantly first
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;

      // If typing started, run staggered scrolls to follow the 0.35s height transition
      if (isTyping) {
        const timer1 = setTimeout(() => {
          if (chatContainerRef.current) {
            chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
          }
        }, 150);

        const timer2 = setTimeout(() => {
          if (chatContainerRef.current) {
            chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
          }
        }, 350);

        return () => {
          clearTimeout(timer1);
          clearTimeout(timer2);
        };
      }
    }
  }, [messages, isTyping]);

  const getFormattedTime = (timestamp) => {
    if (!timestamp) return "";
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  const isOnline = (lastActive) => {
    if (!lastActive) return false;
    const activeDate = lastActive.toDate ? lastActive.toDate() : new Date(lastActive);
    return new Date() - activeDate < 5 * 60 * 1000;
  };

  const handleSaveNickname = async () => {
    if (!user?.uid || !userId) return;
    const trimmed = nicknameInput.trim();
    if (!trimmed) return;

    try {
      const docId = `${user.uid}_${userId}`;
      const docRef = doc(db, "customNicknames", docId);
      await setDoc(docRef, {
        ownerUid: user.uid,
        targetUid: userId,
        nickname: trimmed
      });
      setIsNicknameModalOpen(false);
    } catch (error) {
      console.error("Failed to save nickname:", error);
    }
  };

  const handleResetNickname = async () => {
    if (!user?.uid || !userId) return;

    const confirmReset = window.confirm("Are you sure you want to remove this custom nickname?");
    if (!confirmReset) return;

    try {
      const docId = `${user.uid}_${userId}`;
      const docRef = doc(db, "customNicknames", docId);
      await deleteDoc(docRef);
      setCustomNickname("");
      setNicknameInput("");
      setIsNicknameModalOpen(false);
    } catch (error) {
      console.error("Failed to remove nickname:", error);
    }
  };

  // Main Send Function (Supports text, replies, and attachments)
  const handleSendMessage = async () => {
    if (!newMessage.trim() && !selectedFile) return;
    if (!isAuthenticated || !user || !userId) return;

    try {
      let currentChatId = chatId;

      // Create new chat document if not established
      if (!currentChatId) {
        currentChatId = generateChatId();
        if (currentChatId) {
          await createChat(user.uid, userId);
          setChatId(currentChatId);
        }
      }

      let fileUrl = null;
      if (selectedFile) {
        setIsUploading(true);
        fileUrl = await uploadChatFile(currentChatId, selectedFile);
        setIsUploading(false);
        closeAttachmentDrawer();
      }

      const contentText = newMessage.trim();
      setNewMessage("");

      // Package reply details if active
      let replyPayload = null;
      if (replyTo) {
        replyPayload = {
          messageId: replyTo.id,
          senderId: replyTo.senderId,
          senderName: replyTo.senderName,
          contentPreview: replyTo.content || "📷 Attachment"
        };
        setReplyTo(null); // Clear reply state
      }

      await sendMessage(currentChatId, user.uid, contentText, replyPayload, fileUrl);
    } catch (error) {
      console.error("Failed to send message:", error);
      setIsUploading(false);
    }
  };

  const handleTyping = async () => {
    if (!chatId || !user || !isAuthenticated) return;

    if (!typingTimeoutRef.current) {
      // Only set status to true in Firestore if we are starting a typing session
      // This avoids redundant updates and network thrashing on every keystroke
      await setTypingStatus(chatId, user.uid, true);
    } else {
      // If we are already typing, just clear the previous clear-timeout to keep the session active
      clearTimeout(typingTimeoutRef.current);
    }

    // Schedule a new timeout to set typing status to false after 2.5s of inactivity
    typingTimeoutRef.current = setTimeout(async () => {
      await setTypingStatus(chatId, user.uid, false);
      typingTimeoutRef.current = null;
    }, 2500);
  };

  const handleDeleteMessage = async (messageId) => {
    if (!chatId || !isAuthenticated) return;
    try {
      await deleteMessage(chatId, messageId);
      setActiveMenuId(null);
    } catch (error) {
      console.error("Failed to delete message:", error);
    }
  };

  const handleDeleteChatCompletely = async () => {
    if (!chatId || !isAuthenticated) return;
    if (
      window.confirm(
        "Are you sure you want to completely delete this conversation? This will delete all history from Firestore for all participants with no history remaining."
      )
    ) {
      try {
        await deleteChatCompletely(chatId);
        navigate("/dashboard");
      } catch (error) {
        console.error("Failed to delete chat completely:", error);
      }
    }
  };

  const handleCopyMessage = (text) => {
    navigator.clipboard.writeText(text);
    setActiveMenuId(null);
  };

  const handleReplyMessage = (msg) => {
    setReplyTo({
      id: msg.id,
      senderId: msg.senderId,
      senderName: msg.senderId === user.uid ? "You" : (customNickname || recipientProfile?.displayName || displayName || "User"),
      content: msg.content || (msg.mediaURL ? "Photo Attachment" : "")
    });
    setActiveMenuId(null);
  };

  const handleScrollToMessage = (messageId) => {
    if (!messageId) return;
    const element = document.getElementById(`msg-${messageId}`);
    if (element) {
      element.scrollIntoView({ behavior: "smooth", block: "center" });
      element.classList.add("highlighted-message");
      setTimeout(() => {
        element.classList.remove("highlighted-message");
      }, 1500);
    }
  };

  const handleToggleReaction = async (messageId, emoji) => {
    if (!chatId || !user?.uid) return;
    try {
      await toggleMessageReaction(chatId, messageId, user.uid, emoji);
      setActiveMenuId(null);
      setCustomReactionMsgId(null);
    } catch (err) {
      console.error("Reaction failed:", err);
    }
  };

  // Attachment Previews & Handlers
  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setSelectedFile(file);
      setFilePreview(URL.createObjectURL(file));
    }
  };

  const handlePaste = (e) => {
    const items = e.clipboardData.items;
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf("image") !== -1) {
        const blob = items[i].getAsFile();
        setSelectedFile(blob);
        setFilePreview(URL.createObjectURL(blob));
        setIsDrawerOpen(true); // Auto-open attachment drawer
      }
    }
  };

  const closeAttachmentDrawer = () => {
    setIsDrawerOpen(false);
    setSelectedFile(null);
    if (filePreview) {
      URL.revokeObjectURL(filePreview);
      setFilePreview(null);
    }
  };

  // Close menus when clicking outside
  useEffect(() => {
    const handleOutsideClick = () => {
      setActiveMenuId(null);
      setShowEmojiGrid(false);
      setCustomReactionMsgId(null);
    };
    document.addEventListener("click", handleOutsideClick);
    return () => document.removeEventListener("click", handleOutsideClick);
  }, []);

  if (!isAuthenticated) {
    return <div className="chats-auth-fallback">Please log in to access chats.</div>;
  }

  const userOnline = recipientProfile ? isOnline(recipientProfile.lastActive) : false;

  return (
    <div className="total-chat-wrapper" onPaste={handlePaste}>
      <div className="chat-wrapper-outer">
        {/* Modern Header */}
        <div className="chat-header">
          <button className="chat-header-back-btn" onClick={() => navigate("/dashboard")}>
            <BsChevronLeft />
          </button>
          <div 
            className="avatar-wrapper"
            onClick={() => {
              const displayNameText = customNickname || recipientProfile?.displayName || displayName || "User";
              const targetPhotoURL = photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(displayNameText)}&size=128&rounded=true&background=random`;
              openAvatar(targetPhotoURL, displayNameText);
            }}
            style={{ cursor: "zoom-in" }}
          >
            <img
              src={
                photoURL ||
                `https://ui-avatars.com/api/?name=${encodeURIComponent(
                  displayName || "User"
                )}&size=40&rounded=true&background=random`
              }
              alt={displayName || "User"}
              className="chat-header-img"
            />
            {userOnline && <span className="online-presence-dot header-dot" />}
          </div>
          <div className="chat-header-info">
            <h2 className="chat-header-title">{customNickname || recipientProfile?.displayName || displayName || "User"}</h2>
            <p className="chat-header-status-subtitle">
              {recipientProfile ? getLastSeenText(recipientProfile.lastActive) : "Offline"}
            </p>
          </div>

          <div className="chat-header-actions">
            <button
              onClick={handleCycleTheme}
              className="chat-header-action-btn"
              title={`Active Theme: ${theme}. Click to switch.`}
            >
              {resolvedTheme === "light" ? (
                <BsSun style={{ color: "#f59e0b" }} />
              ) : (
                <BsMoonStars style={{ color: "#a78bfa" }} />
              )}
            </button>
            <button
              onClick={() => setIsNicknameModalOpen(true)}
              className="chat-header-action-btn"
              title="Set local nickname"
            >
              <BsPencilSquare />
            </button>
            <button
              onClick={() => initiateCall(userId, customNickname || recipientProfile?.displayName || displayName, photoURL, false)}
              className="chat-header-action-btn"
              title="Voice Call"
            >
              <BsTelephone />
            </button>
            <button
              onClick={() => initiateCall(userId, customNickname || recipientProfile?.displayName || displayName, photoURL, true)}
              className="chat-header-action-btn"
              title="Video Call"
            >
              <BsCameraVideo />
            </button>
            {chatId && (
              <button
                onClick={handleDeleteChatCompletely}
                className="chat-header-action-btn chat-header-delete-btn"
                title="Delete conversation completely"
              >
                <BsTrash />
              </button>
            )}
          </div>
        </div>

        {/* Message Container */}
        <div className="middle-of-chats" ref={chatContainerRef}>
          {loading ? (
            <div className="chat-viewport-spinner-container">
              <div className="modern-spinner"></div>
            </div>
          ) : messages.length === 0 ? (
            <div className="chat-viewport-empty">
              <p>No messages yet. Start the conversation!</p>
            </div>
          ) : (
            <div className="chat-list">
              {messages.map((msg) => {
                const isMyMessage = msg.senderId === user.uid;
                const isMenuOpen = activeMenuId === msg.id;

                return (
                  <div
                    key={msg.id}
                    id={`msg-${msg.id}`}
                    className={`chat-item-wrapper ${isMyMessage ? "my-chat-wrapper" : "user-chat-wrapper"}`}
                  >
                    <div className={`chat-item ${isMyMessage ? "my-chat" : "user-chat"}`}>
                      <div className="chat-item-message">
                        
                        {/* Quoted Reply Display */}
                        {msg.replyTo && (
                          <div 
                            className="message-quoted-bubble"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleScrollToMessage(msg.replyTo.messageId);
                            }}
                          >
                            <p className="quoted-sender">
                              {msg.replyTo.senderId
                                ? (msg.replyTo.senderId === user.uid
                                  ? "You"
                                  : (customNickname || recipientProfile?.displayName || displayName || "User"))
                                : msg.replyTo.senderName}
                            </p>
                            <p className="quoted-preview">{msg.replyTo.contentPreview}</p>
                          </div>
                        )}

                        {/* Photo Attachment Inline */}
                        {msg.mediaURL && (
                          <div className="message-image-attachment">
                            <img src={msg.mediaURL} alt="Shared Attachment" className="shared-media-img" />
                          </div>
                        )}

                        {/* Text Content */}
                        {msg.content && (
                          <p className="chat-content-text">
                            {renderMessageText(msg.content)}
                          </p>
                        )}

                        {/* Meta Details Row */}
                        <span className="chat-item-time">
                          {getFormattedTime(msg.timestamp)}
                          {isMyMessage && (
                            <span className={`tick-indicator ${msg.read ? "seen" : msg.delivered ? "delivered" : "sent"}`}>
                              {msg.read || msg.delivered ? " ✓✓" : " ✓"}
                            </span>
                          )}
                        </span>

                        {/* Emoji Reactions Badges */}
                        {msg.reactions && Object.keys(msg.reactions).length > 0 && (
                          <div className="reactions-badges-row">
                            {Object.entries(msg.reactions).map(([emoji, uids]) => (
                              <button
                                key={emoji}
                                className={`reaction-badge-pill ${uids.includes(user.uid) ? "active-reaction" : ""}`}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleToggleReaction(msg.id, emoji);
                                }}
                              >
                                {emoji} <span className="reaction-badge-count">{uids.length}</span>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Always-Visible Options Menu Button */}
                    <div className="message-dropdown-container">
                      <button
                        className="message-options-trigger"
                        onClick={(e) => {
                          e.stopPropagation();
                          setActiveMenuId(isMenuOpen ? null : msg.id);
                          setCustomReactionMsgId(null);
                        }}
                      >
                        <BsThreeDotsVertical />
                      </button>

                      {isMenuOpen && (
                        <div className="message-dropdown-menu" onClick={(e) => e.stopPropagation()}>
                          {/* Custom or Quick Reactions bar */}
                          {customReactionMsgId === msg.id ? (
                            <div className="custom-reaction-input-wrapper">
                              <input
                                type="text"
                                className="custom-reaction-input"
                                placeholder="Type emoji from keyboard..."
                                autoFocus
                                value=""
                                onChange={(e) => {
                                  const val = e.target.value;
                                  if (val) {
                                    const emoji = val.trim();
                                    if (emoji) {
                                      handleToggleReaction(msg.id, emoji);
                                    }
                                  }
                                }}
                                onBlur={() => {
                                  // Soft delay to allow clicks on cancel button before blur triggers collapse
                                  setTimeout(() => {
                                    setCustomReactionMsgId(null);
                                  }, 150);
                                }}
                              />
                              <button 
                                className="custom-reaction-cancel-btn"
                                onClick={() => setCustomReactionMsgId(null)}
                                title="Cancel"
                              >
                                ✕
                              </button>
                            </div>
                          ) : (
                            <div className="quick-reactions-bar">
                              {popularEmojis.map((emoji) => (
                                <button
                                  key={emoji}
                                  className="reaction-option-btn"
                                  onClick={() => handleToggleReaction(msg.id, emoji)}
                                >
                                  {emoji}
                                </button>
                              ))}
                              <button
                                className="reaction-option-btn custom-reaction-trigger"
                                onClick={() => setCustomReactionMsgId(msg.id)}
                                title="Use keyboard emojis"
                              >
                                +
                              </button>
                            </div>
                          )}

                          {/* Options list */}
                          <div className="menu-options-list">
                            <button className="dropdown-menu-item" onClick={() => handleReplyMessage(msg)}>
                              <BsReply className="menu-icon" /> Reply
                            </button>
                            {msg.content && (
                              <button className="dropdown-menu-item" onClick={() => handleCopyMessage(msg.content)}>
                                <BsFiles className="menu-icon" /> Copy
                              </button>
                            )}
                            {isMyMessage && (
                              <button className="dropdown-menu-item delete-option" onClick={() => handleDeleteMessage(msg.id)}>
                                <BsTrash className="menu-icon" /> Delete
                              </button>
                            )}
                          </div>
                        </div>
                      )}
                    </div>

                  </div>
                );
              })}
              {/* Redesigned Typing Indicator */}
              <div className={`chat-item-wrapper user-chat-wrapper typing-indicator-wrapper ${isTyping ? "visible" : ""}`}>
                <div className="chat-item user-chat typing-indicator-bubble">
                  <div className="chat-item-message typing-indicator-content">
                    <div className="typing-dots">
                      <span className="typing-dot"></span>
                      <span className="typing-dot"></span>
                      <span className="typing-dot"></span>
                    </div>
                    <span className="typing-text">
                      {customNickname || recipientProfile?.displayName || displayName || "User"} is typing
                    </span>
                  </div>
                </div>
              </div>

              <div className="chat-bottom-spacer" />
            </div>
          )}
        </div>

        {/* Reply Bar Overlay */}
        {replyTo && (
          <div className="reply-preview-bar">
            <div className="reply-preview-content">
              <p className="reply-title">
                Replying to {replyTo.senderId === user.uid
                  ? "You"
                  : (customNickname || recipientProfile?.displayName || displayName || "User")}
              </p>
              <p className="reply-body">{replyTo.content}</p>
            </div>
            <button className="reply-close-btn" onClick={() => setReplyTo(null)}>
              <BsX />
            </button>
          </div>
        )}

        {/* Modern Interactive Footer */}
        <div className="chat-footer">
          {/* Plus/Paperclip Trigger for Attachment Drawer */}
          <button className="chat-action-btn" onClick={() => setIsDrawerOpen(true)}>
            <BsPaperclip />
          </button>

          {/* Emojis Selector Overlay Trigger */}
          <div className="emoji-trigger-wrapper">
            <button className="chat-action-btn" onClick={(e) => {
              e.stopPropagation();
              setShowEmojiGrid(!showEmojiGrid);
            }}>
              <BsEmojiSmile />
            </button>
            {showEmojiGrid && (
              <div className="keyboard-emoji-grid" onClick={(e) => e.stopPropagation()}>
                {popularEmojis.map((emoji) => (
                  <button
                    key={emoji}
                    className="grid-emoji-btn"
                    onClick={() => {
                      setNewMessage((prev) => prev + emoji);
                      setShowEmojiGrid(false);
                    }}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Dynamic Auto-Resizing Textarea */}
          <textarea
            rows={Math.min(4, newMessage.split("\n").length || 1)}
            placeholder="Type your message..."
            className="chat-input-textarea"
            value={newMessage}
            onChange={(e) => {
              setNewMessage(e.target.value);
              handleTyping();
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSendMessage();
              }
            }}
          />

          <button className="chat-send-btn-modern" onClick={handleSendMessage}>
            <BsSend />
          </button>
        </div>
      </div>

      {/* Minimalist Pop-up Attachment Drawer */}
      {isDrawerOpen && (
        <div className="glass-modal-overlay" onClick={closeAttachmentDrawer}>
          <div className="glass-drawer-panel" onClick={(e) => e.stopPropagation()}>
            <div className="drawer-header">
              <h3>Send Attachment</h3>
              <button className="drawer-close-btn" onClick={closeAttachmentDrawer}>
                <BsX />
              </button>
            </div>

            {/* Target Area */}
            <div
              className="drawer-dropzone"
              onClick={() => fileInputRef.current?.click()}
            >
              <input
                type="file"
                ref={fileInputRef}
                style={{ display: "none" }}
                accept="image/*,application/pdf"
                onChange={handleFileChange}
              />
              
              {filePreview ? (
                <div className="drawer-preview-box">
                  <img src={filePreview} alt="Upload Preview" className="preview-media" />
                  <p className="preview-file-name">{selectedFile?.name}</p>
                </div>
              ) : (
                <div className="dropzone-empty">
                  <span className="dropzone-icon">📷</span>
                  <p>Click or drag image here to attach</p>
                  <span className="dropzone-subtext">Images are compressed automatically</span>
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="drawer-actions-row">
              {isUploading ? (
                <div className="uploading-state">
                  <div className="modern-spinner small-spinner"></div>
                  <span>Compressing & Uploading...</span>
                </div>
              ) : (
                <>
                  <button className="drawer-btn cancel-btn" onClick={closeAttachmentDrawer}>
                    Cancel
                  </button>
                  <button
                    className="drawer-btn send-btn"
                    disabled={!selectedFile}
                    onClick={handleSendMessage}
                  >
                    Send File
                  </button>
                </>
              )}
            </div>

          </div>
        </div>
      )}

      {/* 2. Glassmorphic Local Nickname Modal */}
      {isNicknameModalOpen && (
        <div className="glass-modal-overlay" onClick={() => setIsNicknameModalOpen(false)}>
          <div className="glass-drawer-panel" onClick={(e) => e.stopPropagation()}>
            <div className="drawer-header">
              <h3>Set Local Nickname</h3>
              <button className="drawer-close-btn" onClick={() => setIsNicknameModalOpen(false)}>
                <BsX />
              </button>
            </div>

            <div className="nickname-modal-body">
              {/* Glowing Live Preview */}
              <div className="nickname-live-preview">
                <p>
                  Preview: <span>{nicknameInput.trim() || recipientProfile?.displayName || displayName || "User"}</span>
                </p>
              </div>

              <p className="nickname-modal-subtitle">
                This nickname will only be visible to you in your chat and contact lists.
              </p>
              
              <input
                type="text"
                className="nickname-modal-input"
                placeholder="Enter custom nickname..."
                value={nicknameInput}
                onChange={(e) => setNicknameInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && nicknameInput.trim()) {
                    handleSaveNickname();
                  }
                }}
                maxLength={20}
                autoFocus
              />

              {/* Inline Quick Emojis Grid */}
              <div className="nickname-emojis-grid">
                {["👍", "❤️", "😂", "🎉", "😮", "😢", "😎", "🔥", "✨", "👀", "🤫", "👑"].map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    className="nickname-emoji-chip"
                    onClick={() => setNicknameInput((prev) => (prev + emoji).substring(0, 20))}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </div>

            <div className="drawer-actions-row">
              <button className="drawer-btn cancel-btn" onClick={() => setIsNicknameModalOpen(false)}>
                Cancel
              </button>
              {customNickname && (
                <button className="drawer-btn reset-btn" onClick={handleResetNickname}>
                  Reset Nickname
                </button>
              )}
              <button
                className="drawer-btn send-btn"
                onClick={handleSaveNickname}
                disabled={!nicknameInput.trim()}
              >
                Save Nickname
              </button>
            </div>

          </div>
        </div>
      )}
    </div>
  );
};

export default ChatPage;
