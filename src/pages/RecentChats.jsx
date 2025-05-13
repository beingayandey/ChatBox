import React, { useEffect, useRef } from "react";
import { useSelector, useDispatch } from "react-redux";
import { fetchChats } from "../firebase"; // Import fetchChats directly
import { setChats } from "../store/slices/chatSlice"; // You'll need to add this action
import { db } from "../firebase";
import { doc, getDoc } from "firebase/firestore";
import { useState } from "react";
import { useNavigate } from "react-router-dom";

const RecentChats = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { user } = useSelector((state) => state.auth);
  const { chats, loading, error } = useSelector((state) => state.chat);
  const [chatParticipants, setChatParticipants] = useState({});
  const unsubscribeRef = useRef(null); // Store unsubscribe function

  useEffect(() => {
    if (user?.uid) {
      // Set up the Firebase listener directly
      const unsubscribe = fetchChats(user.uid, (chats) => {
        // Serialize Timestamps
        const serializedChats = chats.map((chat) => ({
          ...chat,
          lastUpdated:
            chat.lastUpdated && typeof chat.lastUpdated.toDate === "function"
              ? chat.lastUpdated.toDate().toISOString()
              : null,
        }));
        // Dispatch the chats to the Redux store
        dispatch(setChats(serializedChats));
      });
      unsubscribeRef.current = unsubscribe; // Store the unsubscribe function
    }

    // Cleanup on unmount or user change
    return () => {
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
        unsubscribeRef.current = null;
      }
    };
  }, [user, dispatch]);

  useEffect(() => {
    const fetchParticipants = async () => {
      const participantData = {};
      for (const chat of chats) {
        const otherParticipantId = chat.participants.find(
          (id) => id !== user?.uid
        );
        if (otherParticipantId && !participantData[otherParticipantId]) {
          const userDoc = await getDoc(doc(db, "users", otherParticipantId));
          if (userDoc.exists()) {
            participantData[otherParticipantId] = userDoc.data();
          }
        }
      }
      setChatParticipants(participantData);
    };

    if (chats.length > 0 && user?.uid) {
      fetchParticipants();
    }
  }, [chats, user]);

  const handleChatClick = (otherParticipantId, photoURL, displayName) => {
    navigate(`/chat/${otherParticipantId}`, {
      state: { photoURL, displayName },
    });
  };

  if (!user) return <div>Please log in to view chats</div>;
  if (loading) return <div>Loading chats...</div>;
  if (error) return <div>Error: {error}</div>;
  if (chats.length === 0) return <div>No recent chats</div>;

  const sortedChats = [...chats].sort((a, b) => {
    const aTime = a.lastUpdated ? new Date(a.lastUpdated).getTime() : 0;
    const bTime = b.lastUpdated ? new Date(b.lastUpdated).getTime() : 0;
    return bTime - aTime;
  });

  return (
    <>
      <h2 className="users-page__title">Contacts</h2>
      <div className="recent-chats-container">
        <ul className="recent-chats-list">
          {sortedChats.map((chat) => {
            const otherParticipantId = chat.participants.find(
              (id) => id !== user?.uid
            );
            const participant = chatParticipants[otherParticipantId] || {};

            return (
              <li
                key={chat.id}
                className="recent-chat-card"
                onClick={() =>
                  handleChatClick(
                    otherParticipantId,
                    participant.photoURL,
                    participant.displayName
                  )
                }
                style={{ cursor: "pointer" }}
              >
                <img
                  src={
                    participant.photoURL ||
                    `https://ui-avatars.com/api/?name=${encodeURIComponent(
                      user.displayName || "User"
                    )}&size=40&rounded=true&background=random`
                  }
                  alt={participant.displayName || "User"}
                  className="recent-chat-avatar"
                />
                <div className="recent-chat-info">
                  <p className="recent-chat-name">
                    {participant.displayName || "Unknown User"}
                  </p>
                  <p className="recent-chat-message">
                    {chat.lastMessage || "No messages yet"}
                  </p>
                </div>
                <span className="recent-chat-time">
                  {chat.lastUpdated
                    ? new Date(chat.lastUpdated).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })
                    : "N/A"}
                </span>
              </li>
            );
          })}
        </ul>
      </div>
    </>
  );
};

export default RecentChats;
