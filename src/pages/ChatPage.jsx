import { useEffect, useRef, useState } from "react";
import { useLocation, useParams } from "react-router-dom";
import { useSelector } from "react-redux";
import {
  createChat,
  sendMessage,
  fetchMessages,
  setTypingStatus,
  deleteMessage,
  markMessagesAsRead,
} from "../firebase";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "../firebase";

const ChatPage = () => {
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

  const chatContainerRef = useRef(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState("");
  const [chatId, setChatId] = useState(null);
  const [isTyping, setIsTyping] = useState(false);

  const generateChatId = () => {
    if (!user || !userId) {
      return null;
    }
    const participants = [user.uid, userId].sort();
    return `chat_${participants[0]}_${participants[1]}`;
  };

  useEffect(() => {
    if (!isAuthenticated || !user || !userId) {
      return;
    }

    const initializeChat = async () => {
      const generatedChatId = generateChatId();

      if (!generatedChatId) return;

      try {
        await createChat(user.uid, userId);
        setChatId(generatedChatId);
      } catch (error) {
        console.error("Error initializing chat:", error);
      }
    };

    initializeChat().catch((error) => {
      console.error("Error in initializeChat:", error);
    });
  }, [user?.uid, userId, isAuthenticated]);

  useEffect(() => {
    if (!chatId) {
      return;
    }
    console.log("ChatPage is rendered");

    const unsubscribe = fetchMessages(chatId, (fetchedMessages) => {
      setMessages(fetchedMessages);
      if (
        fetchedMessages.some((msg) => msg.senderId !== user.uid && !msg.read)
      ) {
        markMessagesAsRead(chatId, user.uid);
      }
    });

    return () => unsubscribe();
  }, [chatId, user?.uid]);

  useEffect(() => {
    if (!chatId) {
      return;
    }

    const chatRef = doc(db, "storedChats", chatId);
    const unsubscribe = onSnapshot(chatRef, (doc) => {
      const data = doc.data();
      if (!data) {
        return;
      }
      const otherUserId = data.participants.find((id) => id !== user?.uid);
      setIsTyping(data.typing?.[otherUserId] || false);
    });

    return () => unsubscribe();
  }, [chatId, user?.uid]);

  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop =
        chatContainerRef.current.scrollHeight;
    }
  }, [messages]);

  const getFormattedTime = (timestamp) => {
    if (!timestamp) return "";
    const date = timestamp.toDate();
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  const handleSendMessage = async () => {
    if (!newMessage || !chatId || !isAuthenticated) {
      return;
    }

    try {
      await sendMessage(chatId, user.uid, newMessage);
      setNewMessage("");
    } catch (error) {
      console.error("Error sending message:", error);
    }
  };

  const handleTyping = async () => {
    if (!chatId || !user) {
      return;
    }
    await setTypingStatus(chatId, user.uid, true);
    setTimeout(() => setTypingStatus(chatId, user.uid, false), 3000);
  };

  const handleDeleteMessage = async (messageId) => {
    if (!chatId) {
      return;
    }
    try {
      await deleteMessage(chatId, messageId);
    } catch (error) {
      console.error("Error deleting message:", error);
    }
  };

  if (!isAuthenticated) {
    return <div>Please log in to access chats.</div>;
  }

  return (
    <div className="total-chat-wrapper">
      <div className="chat-wrapper-outer">
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
        <div className="middle-of-chats" ref={chatContainerRef}>
          <div className="chat-list">
            {messages.length === 0 ? (
              <p>No messages yet. Start the conversation!</p>
            ) : (
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
                          <span className="tick-indicator">
                            {msg.read ? "✓✓" : "✓"}
                          </span>
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
        <div className="chat-footer">
          <input
            type="text"
            placeholder="Type your message..."
            className="chat-input"
            value={newMessage}
            onChange={(e) => {
              setNewMessage(e.target.value);
              handleTyping();
            }}
            onKeyPress={(e) => e.key === "Enter" && handleSendMessage()}
          />
          <button className="chat-send-btn" onClick={handleSendMessage}>
            Send
          </button>
        </div>
      </div>
    </div>
  );
};

export default ChatPage;
