import React, { useEffect, useState } from "react";
import { collection, query, where, onSnapshot } from "firebase/firestore"; // Firestore functions for querying data
import { db, auth } from "../firebase"; // Firebase database and auth instances
import { useNavigate } from "react-router-dom"; // Hook for programmatic navigation
import { onAuthStateChanged } from "firebase/auth"; // Firebase auth state listener

// UsersPage component to display a list of users for starting chats
const UsersPage = ({ searchQuery }) => {
  // State to store the list of users fetched from Firestore
  const [users, setUsers] = useState([]);

  // State to track loading status while fetching users
  const [loading, setLoading] = useState(true);

  // Hook for navigating to other routes (e.g., ChatPage)
  const navigate = useNavigate();

  // Effect to fetch users in real-time and handle authentication
  useEffect(() => {
    // Set up Firebase Auth state listener
    const unsubscribeAuth = onAuthStateChanged(auth, (currentUser) => {
      // If no user is logged in, clear state and stop
      if (!currentUser) {
        setUsers([]); // Clear users list
        setLoading(false); // Stop loading
        return;
      }

      // User is logged in, set up Firestore real-time listener
      setLoading(true); // Start loading
      const usersRef = collection(db, "users"); // Reference to users collection
      let q = usersRef; // Default query (all users)

      // If searchQuery is provided, filter users by displayNameLower
      if (searchQuery) {
        const lowerQuery = searchQuery.toLowerCase();
        // Query users where displayNameLower is within the search range
        // \uf8ff ensures the query includes all strings starting with lowerQuery
        q = query(
          usersRef,
          where("displayNameLower", ">=", lowerQuery),
          where("displayNameLower", "<=", lowerQuery + "\uf8ff")
        );
      }

      // Set up real-time listener for the users query
      const unsubscribeSnapshot = onSnapshot(
        q,
        (snapshot) => {
          try {
            // Map Firestore documents to user objects, excluding the current user
            const usersList = snapshot.docs
              .map((doc) => ({
                id: doc.id, // User ID
                ...doc.data(), // User data (displayName, photoURL, email, etc.)
              }))
              .filter((user) => user.id !== currentUser.uid); // Exclude current user
            setUsers(usersList); // Update state with users
            setLoading(false); // Stop loading
          } catch (error) {
            console.error("Error fetching users:", error); // Log error
            setUsers([]); // Clear users list
            setLoading(false); // Stop loading
          }
        },
        (error) => {
          console.error("Snapshot error:", error); // Log snapshot error
          setUsers([]); // Clear users list
          setLoading(false); // Stop loading
        }
      );

      // Return cleanup function for the snapshot listener
      return () => unsubscribeSnapshot();
    });

    // Cleanup auth listener on component unmount
    return () => unsubscribeAuth();
  }, [searchQuery]); // Re-run effect when searchQuery changes

  // Function to navigate to the chat page for a selected user
  const goToChat = (userId, photoURL, displayName) => {
    // Navigate to ChatPage with userId and pass photoURL, displayName in state
    navigate(`/chat/${userId}`, {
      state: { photoURL, displayName },
    });
  };

  // Render login prompt if not authenticated
  if (!auth.currentUser) {
    return <p className="loading-text">Please log in to view users.</p>;
  }

  // Render loading state
  if (loading) return <p className="loading-text">Loading users...</p>;

  // Render users list
  return (
    <div className="users-page">
      <h2 className="users-page__title">Contacts</h2>
      <ul className="users-page__list">
        {users.length > 0 ? (
          // Map users to clickable list items
          users.map((user) => (
            <li
              key={user.id}
              onClick={() => goToChat(user.id, user.photoURL, user.displayName)} // Navigate to chat on click
              className="user-card"
            >
              {/* User avatar */}
              <img
                src={
                  user.photoURL ||
                  // Fallback to generated avatar if no photoURL
                  `https://ui-avatars.com/api/?name=${encodeURIComponent(
                    user.displayName || "User"
                  )}&size=40&rounded=true&background=random`
                }
                alt={user.displayName}
                className="user-card__avatar"
              />
              {/* User info */}
              <div className="user-card__info">
                <p className="user-card__name">{user.displayName}</p>
                <p className="user-card__email">{user.email}</p>
              </div>
            </li>
          ))
        ) : (
          // Show message if no users found
          <p>No users found</p>
        )}
      </ul>
    </div>
  );
};

// Export the component
export default UsersPage;
