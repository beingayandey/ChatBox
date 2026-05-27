import React, { useEffect, useRef, useState } from "react";
import { useSelector, useDispatch } from "react-redux";
import { fetchChats, togglePinChat, deleteChatCompletely, markMessagesAsDelivered, db } from "../firebase"; // Import directly from Firebase utilities
import { setChats } from "../store/slices/chatSlice"; // Import action to update chats in Redux store
import { doc, getDoc, onSnapshot } from "firebase/firestore"; // Firestore functions
import { useNavigate } from "react-router-dom"; // Hook for navigation
import { BsPinAngle, BsPinFill, BsTrash } from "react-icons/bs"; // Pinned chat and trash icons

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

  // State to store Firestore profile of current user (for real-time pinned/unread updates)
  const [currentUserProfile, setCurrentUserProfile] = useState(null);

  // Ref to store the unsubscribe function for the Firebase listener
  const unsubscribeRef = useRef(null);

  // Sync current user's profile from Firestore in real-time
  useEffect(() => {
    if (user?.uid) {
      const userRef = doc(db, "users", user.uid);
      const unsubscribe = onSnapshot(
        userRef,
        (docSnapshot) => {
          if (docSnapshot.exists()) {
            setCurrentUserProfile(docSnapshot.data());
          }
        },
        (err) => {
          console.error("Error watching user profile:", err);
        }
      );
      return () => unsubscribe();
    }
  }, [user?.uid]);

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

  // Effect to automatically mark unread incoming conversations as delivered
  useEffect(() => {
    if (user?.uid && chats.length > 0) {
      const unreadChatsList = currentUserProfile?.unreadChats || [];
      chats.forEach((chat) => {
        if (unreadChatsList.includes(chat.id)) {
          markMessagesAsDelivered(chat.id, user.uid);
        }
      });
    }
  }, [chats, currentUserProfile?.unreadChats, user?.uid]);

  // Function to handle clicking a chat (navigate to ChatPage)
  const handleChatClick = (otherParticipantId, photoURL, displayName) => {
    // Navigate to the chat page for the selected participant
    // Pass photoURL and displayName in location state for ChatPage
    navigate(`/chat/${otherParticipantId}`, {
      state: { photoURL, displayName },
    });
  };

  // Function to toggle pin state on a chat
  const handlePinToggle = async (e, chatId) => {
    e.stopPropagation(); // Avoid triggering chat click
    if (user?.uid) {
      try {
        await togglePinChat(user.uid, chatId);
      } catch (err) {
        console.error("Pin action failed:", err);
      }
    }
  };

  // Function to delete chat completely from Firestore
  const handleDeleteChatCompletely = async (e, chatId) => {
    e.stopPropagation(); // Avoid triggering chat click
    if (
      window.confirm(
        "Are you sure you want to completely delete this conversation? This will delete all history from Firestore for all participants with no history remaining."
      )
    ) {
      try {
        await deleteChatCompletely(chatId);
      } catch (err) {
        console.error("Delete conversation failed:", err);
      }
    }
  };

  // 5 minutes active presence check (completely browser-side, zero billing writes)
  const isOnline = (lastActive) => {
    if (!lastActive) return false;
    let activeDate;
    if (typeof lastActive.toDate === "function") {
      activeDate = lastActive.toDate();
    } else {
      activeDate = new Date(lastActive);
    }
    return new Date() - activeDate < 5 * 60 * 1000;
  };

  // Render loading, error, or empty states with flat minimalist elements
  if (!user) return <div className="chats-auth-fallback">Please log in to view chats.</div>;

  if (loading) {
    return (
      <div className="chats-loading-container">
        <div className="modern-spinner"></div>
        <p className="loading-text">Retrieving conversations...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="chats-error-container">
        <p className="chats-error-text">Failed to load conversations: {error}</p>
      </div>
    );
  }

  if (chats.length === 0) {
    return (
      <div className="chats-empty-container">
        <div className="chats-empty-illustration">💬</div>
        <p className="chats-empty-text">No recent conversations.</p>
        <p className="chats-empty-subtext">Select users from directory to start chatting!</p>
      </div>
    );
  }

  // Get current user's pinned and unread lists
  const pinnedChatsList = currentUserProfile?.pinnedChats || [];
  const unreadChatsList = currentUserProfile?.unreadChats || [];

  // Sort chats: Pinned first, then sorted by lastUpdated timestamp
  const sortedChats = [...chats].sort((a, b) => {
    const aPinned = pinnedChatsList.includes(a.id);
    const bPinned = pinnedChatsList.includes(b.id);

    if (aPinned && !bPinned) return -1;
    if (!aPinned && bPinned) return 1;

    const aTime = a.lastUpdated ? new Date(a.lastUpdated).getTime() : 0;
    const bTime = b.lastUpdated ? new Date(b.lastUpdated).getTime() : 0;
    return bTime - aTime; // Newest first
  });

  // Render the chat list
  return (
    <div className="dashboard-chats-wrapper">
      <h2 className="users-page__title">Conversations</h2>
      <div className="recent-chats-container">
        <ul className="recent-chats-list">
          {sortedChats.map((chat) => {
            // Find the other participant's ID
            const otherParticipantId = chat.participants.find(
              (id) => id !== user?.uid
            );
            // Get participant details from state
            const participant = chatParticipants[otherParticipantId] || {};
            const isPinned = pinnedChatsList.includes(chat.id);
            const isUnread = unreadChatsList.includes(chat.id);
            const userOnline = isOnline(participant.lastActive);

            return (
              // Chat item (clickable to navigate to ChatPage)
              <li
                key={chat.id}
                className={`recent-chat-card ${isPinned ? "pinned-chat" : ""} ${
                  isUnread ? "unread-card" : ""
                }`}
                onClick={() =>
                  handleChatClick(
                    otherParticipantId,
                    participant.photoURL,
                    participant.displayName
                  )
                }
              >
                {/* Participant avatar and presence dot */}
                <div className="avatar-wrapper">
                  <img
                    src={
                      participant.photoURL ||
                      // Fallback to a generated avatar if no photoURL
                      `https://ui-avatars.com/api/?name=${encodeURIComponent(
                        participant.displayName || "User"
                      )}&size=40&rounded=true&background=random`
                    }
                    alt={participant.displayName || "User"}
                    className="recent-chat-avatar"
                  />
                  {userOnline && <span className="online-presence-dot" />}
                </div>

                {/* Chat info (name, message preview, timestamp, pin, and badge) */}
                <div className="recent-chat-info">
                  <div className="chat-card-top-row">
                    <p className="recent-chat-name">
                      {participant.displayName || "Unknown User"}
                    </p>
                    <span className="recent-chat-time">
                      {chat.lastUpdated
                        ? new Date(chat.lastUpdated).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit", // Format as HH:MM
                          })
                        : "N/A"}
                    </span>
                  </div>
                  <div className="chat-card-bottom-row">
                    <p className="recent-chat-message">
                      {chat.lastMessage || "No messages yet"}
                    </p>
                    <div className="chat-card-actions">
                      {/* Pinned Icon Toggle */}
                      <button
                        onClick={(e) => handlePinToggle(e, chat.id)}
                        className={`pin-action-btn ${isPinned ? "is-pinned" : ""}`}
                        title={isPinned ? "Unpin chat" : "Pin chat"}
                      >
                        {isPinned ? <BsPinFill /> : <BsPinAngle />}
                      </button>

                      {/* Delete Conversation Button */}
                      <button
                        onClick={(e) => handleDeleteChatCompletely(e, chat.id)}
                        className="delete-chat-card-btn"
                        title="Delete conversation completely"
                      >
                        <BsTrash />
                      </button>

                      {/* Unread circle indicator badge */}
                      {isUnread && <span className="unread-dot-badge" />}
                    </div>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
};

// Export the component
export default RecentChats;
