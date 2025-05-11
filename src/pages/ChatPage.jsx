import { useEffect, useRef } from "react";
import { useLocation, useParams } from "react-router-dom";

const ChatPage = () => {
  const { userId } = useParams();
  const { state } = useLocation();
  const { photoURL, displayName } = state || {};

  const chatContainerRef = useRef(null);

  // Scroll to bottom on mount
  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop =
        chatContainerRef.current.scrollHeight;
    }
  }, []);

  // Mock timestamp and tick status for demonstration
  const getFormattedTime = () => {
    const now = new Date();
    return now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

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
              {Array.from({ length: 50 }).map((_, i) => (
                <>
                  <div key={`user-${i}`} className="chat-item user-chat">
                    <div className="chat-item-message">
                      This is a chat message {i + 1}
                      <span className="chat-item-time">
                        {getFormattedTime()}
                      </span>
                    </div>
                  </div>
                  <div key={`my-${i}`} className="chat-item my-chat">
                    <div className="chat-item-message">
                      Response to message {i + 1}
                      <span className="chat-item-time">
                        {getFormattedTime()}
                        <span className="tick-indicator">
                          {i % 2 === 0 ? "✓✓" : "✓"}
                        </span>
                      </span>
                    </div>
                  </div>
                </>
              ))}
              <div className="chat-bottom-spacer" />
            </div>
          </div>

          <div className="chat-footer">
            <input
              type="text"
              placeholder="Type your message..."
              className="chat-input"
            />
            <button className="chat-send-btn">Send</button>
          </div>
        </div>
      </div>
    </>
  );
};

export default ChatPage;
