import { useEffect, useRef, useState } from "react";
import { useLocation, useParams, useNavigate } from "react-router-dom";
import { useSelector } from "react-redux";
import {
  createChat,
  sendMessage,
  fetchMessages,
  setTypingStatus,
  deleteMessage,
  markMessagesAsRead,
} from "../firebase";
import { doc, onSnapshot, getDoc } from "firebase/firestore";
import { db, auth } from "../firebase";
import { onAuthStateChanged } from "firebase/auth";

// ChatPage component for rendering a chat interface between two users
const ChatPage = () => {
  // Extract the recipient's user ID from URL parameters (e.g., /chat/:userId)
  const { userId } = useParams();

  // Access location state for recipient's details (passed via navigation)
  const { state } = useLocation();

  // Destructure photoURL and displayName from location state (for recipient)
  const { photoURL, displayName } = state || {};

  // Select auth state from Redux store (from authSlice)
  // Includes current user and authentication status
  const { user, isAuthenticated } = useSelector(
    (state) => ({
      user: state.auth.user, // Current user object (e.g., Firebase Auth user)
      isAuthenticated: state.auth.isAuthenticated, // Login status
    }),
    // Equality comparison to prevent unnecessary re-renders
    (prev, next) =>
      prev.user === next.user && prev.isAuthenticated === next.isAuthenticated
  );

  // Hook for programmatic navigation
  const navigate = useNavigate();

  // Ref for the chat messages container (for auto-scrolling)
  const chatContainerRef = useRef(null);

  // State for storing messages in the chat
  const [messages, setMessages] = useState([]);

  // State for the new message input field
  const [newMessage, setNewMessage] = useState("");

  // State for the chat ID (e.g., "chat_uid1_uid2")
  const [chatId, setChatId] = useState(null);

  // State for tracking if the other user is typing
  const [isTyping, setIsTyping] = useState(false);

  // Refs to store unsubscribe functions for Firebase listeners
  const messagesUnsubscribeRef = useRef(null);
  const typingUnsubscribeRef = useRef(null);

  // Function to generate a consistent chat ID based on participant IDs
  const generateChatId = () => {
    // Return null if user or userId is missing
    if (!user || !userId) {
      return null;
    }
    // Sort participant IDs to ensure consistent chat ID
    const participants = [user.uid, userId].sort();
    // Format: "chat_uid1_uid2"
    return `chat_${participants[0]}_${participants[1]}`;
  };

  // Effect to monitor authentication state and clean up on logout
  useEffect(() => {
    // Listen for changes in Firebase Auth state
    const unsubscribeAuth = onAuthStateChanged(auth, (currentUser) => {
      // If no user is logged in or not authenticated, clean up and redirect
      if (!currentUser || !isAuthenticated) {
        // Unsubscribe from messages listener
        if (messagesUnsubscribeRef.current) {
          messagesUnsubscribeRef.current();
          messagesUnsubscribeRef.current = null;
        }
        // Unsubscribe from typing listener
        if (typingUnsubscribeRef.current) {
          typingUnsubscribeRef.current();
          typingUnsubscribeRef.current = null;
        }
        // Clear local state
        setMessages([]);
        setChatId(null);
        setIsTyping(false);
        // Redirect to login page
        navigate("/login");
      }
    });

    // Clean up auth listener on component unmount
    return () => unsubscribeAuth();
  }, [navigate, isAuthenticated]);

  // Effect to check for an existing chat on component mount
  useEffect(() => {
    // Skip if not authenticated or missing user/userId
    if (!isAuthenticated || !user || !userId) {
      return;
    }

    // Async function to check if chat exists
    const checkChat = async () => {
      const generatedChatId = generateChatId();
      if (!generatedChatId) return;

      // Reference to the chat document in Firestore
      const chatRef = doc(db, "storedChats", generatedChatId);
      // Fetch the chat document
      const chatDoc = await getDoc(chatRef);

      // If chat exists, set the chatId state
      if (chatDoc.exists()) {
        setChatId(generatedChatId);
      }
    };

    // Run check and handle errors
    checkChat().catch((error) => {
      console.error("Error checking chat:", error);
    });
  }, [user?.uid, userId, isAuthenticated]);

  // Effect to fetch messages and mark them as read
  useEffect(() => {
    // Skip if no chatId or not authenticated
    if (!chatId || !isAuthenticated) {
      return;
    }

    // Fetch messages using Firebase function (real-time listener)
    const unsubscribe = fetchMessages(chatId, (fetchedMessages) => {
      // Update messages state
      setMessages(fetchedMessages);
      // Check for unread messages from the other user
      if (
        fetchedMessages.some((msg) => msg.senderId !== user.uid && !msg.read)
      ) {
        // Mark messages as read for the current user
        markMessagesAsRead(chatId, user.uid);
      }
    });

    // Store unsubscribe function to clean up later
    messagesUnsubscribeRef.current = unsubscribe;

    // Clean up messages listener on unmount or chatId change
    return () => {
      if (messagesUnsubscribeRef.current) {
        messagesUnsubscribeRef.current();
        messagesUnsubscribeRef.current = null;
      }
    };
  }, [chatId, user?.uid, isAuthenticated]);

  // Effect to monitor typing status of the other user
  useEffect(() => {
    // Skip if no chatId or not authenticated
    if (!chatId || !isAuthenticated) {
      return;
    }

    // Reference to the chat document
    const chatRef = doc(db, "storedChats", chatId);
    // Set up real-time listener for chat document
    const unsubscribe = onSnapshot(chatRef, (doc) => {
      const data = doc.data();
      if (!data) {
        return;
      }
      // Find the other participant's ID
      const otherUserId = data.participants.find((id) => id !== user?.uid);
      // Update typing state based on the other user's status
      setIsTyping(data.typing?.[otherUserId] || false);
    });

    // Store unsubscribe function
    typingUnsubscribeRef.current = unsubscribe;

    // Clean up typing listener on unmount or chatId change
    return () => {
      if (typingUnsubscribeRef.current) {
        typingUnsubscribeRef.current();
        typingUnsubscribeRef.current = null;
      }
    };
  }, [chatId, user?.uid, isAuthenticated]);

  // Effect to auto-scroll to the latest message
  useEffect(() => {
    // Check if chat container exists
    if (chatContainerRef.current) {
      // Scroll to the bottom of the container
      chatContainerRef.current.scrollTop =
        chatContainerRef.current.scrollHeight;
    }
  }, [messages]);

  // Function to format message timestamp
  const getFormattedTime = (timestamp) => {
    // Return empty string if no timestamp
    if (!timestamp) return "";
    // Convert Firebase Timestamp to Date and format as HH:MM
    const date = timestamp.toDate();
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  // Function to send a message and create chat if needed
  const handleSendMessage = async () => {
    // Skip if no message, not authenticated, or missing user/userId
    if (!newMessage || !isAuthenticated || !user || !userId) {
      return;
    }

    try {
      let currentChatId = chatId;

      // If no chatId, create a new chat
      if (!currentChatId) {
        currentChatId = generateChatId();
        if (currentChatId) {
          await createChat(user.uid, userId); // Create chat in Firestore
          setChatId(currentChatId); // Update state
        }
      }

      // Send the message using Firebase function
      await sendMessage(currentChatId, user.uid, newMessage);
      // Clear the input field
      setNewMessage("");
    } catch (error) {
      console.error("Error sending message:", error);
    }
  };

  // Function to handle typing indicator
  const handleTyping = async () => {
    // Skip if no chatId, user, or not authenticated
    if (!chatId || !user || !isAuthenticated) {
      return;
    }
    // Set typing status to true
    await setTypingStatus(chatId, user.uid, true);
    // Reset typing status to false after 3 seconds
    setTimeout(() => setTypingStatus(chatId, user.uid, false), 3000);
  };

  // Function to delete a message
  const handleDeleteMessage = async (messageId) => {
    // Skip if no chatId or not authenticated
    if (!chatId || !isAuthenticated) {
      return;
    }
    try {
      // Delete the message using Firebase function
      await deleteMessage(chatId, messageId);
    } catch (error) {
      console.error("Error deleting message:", error);
    }
  };

  // Render a login prompt if not authenticated
  if (!isAuthenticated) {
    return <div>Please log in to access chats.</div>;
  }

  // Render the chat interface
  return (
    <div className="total-chat-wrapper">
      <div className="chat-wrapper-outer">
        {/* Chat header with recipient's photo and name */}
        <div className="chat-header">
          {photoURL && (
            <img
              src={photoURL}
              alt={displayName || "User"}
              className="chat-header-img"
            />
          )}
          <div>
            <h2 className="chat-header-title">
              Chat with {displayName || "User"}
            </h2>
            <p className="chat-header-userid">{userId}</p>
          </div>
        </div>
        {/* Chat messages container */}
        <div className="middle-of-chats" ref={chatContainerRef}>
          <div className="chat-list">
            {messages.length === 0 ? (
              // Show prompt if no messages
              <p>No messages yet. Start the conversation!</p>
            ) : (
              // Render messages
              messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`chat-item ${
                    msg.senderId === user.uid ? "my-chat" : "user-chat"
                  }`}
                >
                  <div className="chat-item-message">
                    {msg.content}
                    <span className="chat-item-time">
                      {getFormattedTime(msg.timestamp)}
                      {msg.senderId === user.uid && (
                        <>
                          {/* Show read/unread indicators */}
                          <span className="tick-indicator">
                            {msg.read ? "✓✓" : "✓"}
                          </span>
                          {/* Delete button for sender's messages */}
                          <button
                            onClick={() => handleDeleteMessage(msg.id)}
                            className="delete-btn"
                          >
                            Delete
                          </button>
                        </>
                      )}
                    </span>
                  </div>
                </div>
              ))
            )}
            <div className="chat-bottom-spacer" />
          </div>
          {/* Typing indicator */}
          {isTyping && (
            <p className="typing-indicator">
              {displayName || "User"} is typing
              <span className="ellipsis">
                <span>.</span>
                <span>.</span>
                <span>.</span>
              </span>
            </p>
          )}
        </div>
        {/* Message input and send button */}
        <div className="chat-footer">
          <input
            type="text"
            placeholder="Type your message..."
            className="chat-input"
            value={newMessage}
            onChange={(e) => {
              setNewMessage(e.target.value); // Update input value
              handleTyping(); // Trigger typing indicator
            }}
            onKeyPress={(e) => e.key === "Enter" && handleSendMessage()} // Send on Enter
          />
          <button className="chat-send-btn" onClick={handleSendMessage}>
            Send
          </button>
        </div>
      </div>
    </div>
  );
};

// Export the component
export default ChatPage;
