import React, { useEffect, useRef } from "react";
import { useSelector, useDispatch } from "react-redux";
import { fetchChats } from "../firebase"; // Import fetchChats directly from Firebase utilities
import { setChats } from "../store/slices/chatSlice"; // Import action to update chats in Redux store
import { db } from "../firebase"; // Import Firestore database instance
import { doc, getDoc } from "firebase/firestore"; // Firestore functions for fetching documents
import { useState } from "react"; // Hook for managing local state
import { useNavigate } from "react-router-dom"; // Hook for programmatic navigation

// RecentChats component to display a list of the user's recent chats
const RecentChats = () => {
  // Hook to dispatch Redux actions
  const dispatch = useDispatch();

  // Hook for navigating to other routes
  const navigate = useNavigate();

  // Select auth state (current user) from Redux store (from authSlice)
  const { user } = useSelector((state) => state.auth);

  // Select chat state (chats, loading, error) from Redux store (from chatSlice)
  const { chats, loading, error } = useSelector((state) => state.chat);

  // State to store participant details (e.g., displayName, photoURL) for each chat
  const [chatParticipants, setChatParticipants] = useState({});

  // Ref to store the unsubscribe function for the Firebase listener
  const unsubscribeRef = useRef(null);

  // Effect to fetch chats in real-time when the user is authenticated
  useEffect(() => {
    // Only run if the user is authenticated (has a UID)
    if (user?.uid) {
      // Set up real-time listener for chats using Firebase fetchChats
      const unsubscribe = fetchChats(user.uid, (chats) => {
        // Serialize Firebase Timestamps to ISO strings for Redux
        // Redux requires serializable data, and Firebase Timestamps are objects
        const serializedChats = chats.map((chat) => ({
          ...chat, // Copy all chat properties
          lastUpdated:
            chat.lastUpdated && typeof chat.lastUpdated.toDate === "function"
              ? chat.lastUpdated.toDate().toISOString() // Convert to ISO string
              : null, // Use null if no valid timestamp
        }));
        // Dispatch serialized chats to Redux store using setChats action
        dispatch(setChats(serializedChats));
      });
      // Store the unsubscribe function to clean up later
      unsubscribeRef.current = unsubscribe;
    }

    // Cleanup function to unsubscribe from Firebase listener on unmount or user change
    return () => {
      if (unsubscribeRef.current) {
        unsubscribeRef.current(); // Stop the listener
        unsubscribeRef.current = null; // Clear the ref
      }
    };
  }, [user, dispatch]);

  // Effect to fetch participant details for each chat
  useEffect(() => {
    // Async function to fetch participant data from Firestore
    const fetchParticipants = async () => {
      const participantData = {};
      // Iterate through each chat
      for (const chat of chats) {
        // Find the other participant's ID (not the current user)
        const otherParticipantId = chat.participants.find(
          (id) => id !== user?.uid
        );
        // Only fetch if participant ID exists and hasn't been fetched yet
        if (otherParticipantId && !participantData[otherParticipantId]) {
          // Reference to the participant's user document in Firestore
          const userDoc = await getDoc(doc(db, "users", otherParticipantId));
          // If the document exists, store its data
          if (userDoc.exists()) {
            participantData[otherParticipantId] = userDoc.data();
          }
        }
      }
      // Update state with participant data
      setChatParticipants(participantData);
    };

    // Run if there are chats and the user is authenticated
    if (chats.length > 0 && user?.uid) {
      fetchParticipants();
    }
  }, [chats, user]);

  // Function to handle clicking a chat (navigate to ChatPage)
  const handleChatClick = (otherParticipantId, photoURL, displayName) => {
    // Navigate to the chat page for the selected participant
    // Pass photoURL and displayName in location state for ChatPage
    navigate(`/chat/${otherParticipantId}`, {
      state: { photoURL, displayName },
    });
  };

  // Render loading, error, or empty states
  if (!user) return <div>Please log in to view chats</div>;
  if (loading) return <div>Loading chats...</div>;
  if (error) return <div>Error: {error}</div>;
  if (chats.length === 0) return <div>No recent chats</div>;

  // Sort chats by lastUpdated timestamp (newest first)
  const sortedChats = [...chats].sort((a, b) => {
    const aTime = a.lastUpdated ? new Date(a.lastUpdated).getTime() : 0;
    const bTime = b.lastUpdated ? new Date(b.lastUpdated).getTime() : 0;
    return bTime - aTime; // Descending order
  });

  // Render the chat list
  return (
    <>
      <h2 className="users-page__title">Contacts</h2>
      <div className="recent-chats-container">
        <ul className="recent-chats-list">
          {sortedChats.map((chat) => {
            // Find the other participant's ID
            const otherParticipantId = chat.participants.find(
              (id) => id !== user?.uid
            );
            // Get participant details from state
            const participant = chatParticipants[otherParticipantId] || {};

            return (
              // Chat item (clickable to navigate to ChatPage)
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
                style={{ cursor: "pointer" }} // Indicate clickability
              >
                {/* Participant avatar */}
                <img
                  src={
                    participant.photoURL ||
                    // Fallback to a generated avatar if no photoURL
                    `https://ui-avatars.com/api/?name=${encodeURIComponent(
                      user.displayName || "User"
                    )}&size=40&rounded=true&background=random`
                  }
                  alt={participant.displayName || "User"}
                  className="recent-chat-avatar"
                />
                {/* Chat info (name and last message) */}
                <div className="recent-chat-info">
                  <p className="recent-chat-name">
                    {participant.displayName || "Unknown User"}
                  </p>
                  <p className="recent-chat-message">
                    {chat.lastMessage || "No messages yet"}
                  </p>
                </div>
                {/* Timestamp of last message */}
                <span className="recent-chat-time">
                  {chat.lastUpdated
                    ? new Date(chat.lastUpdated).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit", // Format as HH:MM
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

// Export the component
export default RecentChats;
