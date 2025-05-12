import { useEffect, useRef, useState } from "react";
import { useLocation, useParams } from "react-router-dom";
import { useSelector } from "react-redux";
import { createChat, sendMessage, fetchMessages } from "../firebase";

const ChatPage = () => {
  const { userId } = useParams();
  const { state } = useLocation();
  const { photoURL, displayName } = state || {};
  const { user, isAuthenticated } = useSelector((state) => state.auth);

  const chatContainerRef = useRef(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState("");
  const [chatId, setChatId] = useState(null);

  // Generate chat ID based on the two users
  const generateChatId = () => {
    if (!user || !userId) return null;
    const participants = [user.uid, userId].sort();
    return `chat_${participants[0]}_${participants[1]}`;
  };

  // Create or ensure chat exists, and set chatId
  useEffect(() => {
    if (!isAuthenticated || !user || !userId) return;

    const initializeChat = async () => {
      const generatedChatId = generateChatId();
      if (!generatedChatId) return;

      try {
        await createChat(user.uid, userId); // Ensure chat exists in Firestore
        setChatId(generatedChatId);
      } catch (error) {
        console.error("Error initializing chat:", error);
      }
    };

    initializeChat();
  }, [user, userId, isAuthenticated]);

  // Fetch messages for the chat
  useEffect(() => {
    if (!chatId) return;

    const unsubscribe = fetchMessages(chatId, (fetchedMessages) => {
      setMessages(fetchedMessages);
    });

    return () => unsubscribe();
  }, [chatId]);

  // Scroll to bottom whenever messages update
  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop =
        chatContainerRef.current.scrollHeight;
    }
  }, [messages]);

  // Format timestamp for display
  const getFormattedTime = (timestamp) => {
    if (!timestamp) return "";
    const date = timestamp.toDate();
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  // Send a new message
  const handleSendMessage = async () => {
    if (!newMessage || !chatId || !isAuthenticated) return;

    try {
      await sendMessage(chatId, user.uid, newMessage);
      setNewMessage("");
    } catch (error) {
      console.error("Error sending message:", error);
    }
  };

  if (!isAuthenticated) {
    return <div>Please log in to access chats.</div>;
  }
  // Inside ChatPage.jsx, add to the useEffect for fetching messages
  useEffect(() => {
    if (!chatId) return;

    const unsubscribe = fetchMessages(chatId, (fetchedMessages) => {
      setMessages(fetchedMessages);
      // Mark messages as read when the other user views them
      if (
        fetchedMessages.some((msg) => msg.senderId !== user.uid && !msg.read)
      ) {
        markMessagesAsRead(chatId, user.uid);
      }
    });

    return () => unsubscribe();
  }, [chatId, user.uid]);

  return (
    <>
      <div className="total-chat-wrapper">
        <div className="chat-wrapper-outer">
          <div className="chat-header">
            {photoURL && (
              <img
                src={photoURL}
                alt={displayName}
                className="chat-header-img"
              />
            )}
            <div>
              <h2 className="chat-header-title">Chat with {displayName}</h2>
              <p className="chat-header-userid">{userId}</p>
            </div>
          </div>
          <div className="middle-of-chats" ref={chatContainerRef}>
            <div className="chat-list">
              {messages.map((msg) => (
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
                        <span className="tick-indicator">
                          {msg.read ? "✓✓" : "✓"}
                        </span>
                      )}
                    </span>
                  </div>
                </div>
              ))}
              <div className="chat-bottom-spacer" />
            </div>
          </div>

          <div className="chat-footer">
            <input
              type="text"
              placeholder="Type your message..."
              className="chat-input"
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              onKeyPress={(e) => e.key === "Enter" && handleSendMessage()}
            />
            <button className="chat-send-btn" onClick={handleSendMessage}>
              Send
            </button>
          </div>
        </div>
      </div>
    </>
  );
};

export default ChatPage;
