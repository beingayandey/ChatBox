import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import {
  getFirestore,
  collection,
  doc,
  setDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
  getDoc,
  getDocs,
  writeBatch,
  arrayUnion,
  arrayRemove,
} from "firebase/firestore";

// Firebase configuration object using environment variables for security
// These values are stored in a .env file and accessed via import.meta.env
const firebaseConfig = {
  apiKey: import.meta.env.VITE_API_KEY, // Unique key for Firebase API access
  authDomain: import.meta.env.VITE_AUTH_DOMAIN, // Domain for authentication
  projectId: import.meta.env.VITE_PROJECT_ID, // Unique ID for your Firebase project
  storageBucket: import.meta.env.VITE_STORAGE_BUCKET, // Storage for files
  messagingSenderId: import.meta.env.VITE_MESSAGING_SENDER_ID, // ID for messaging
  appId: import.meta.env.VITE_APP_ID, // Unique ID for the Firebase app
};

// Initialize Firebase app with the configuration
// This sets up the connection to Firebase services
const app = initializeApp(firebaseConfig);

// Initialize Firebase Authentication
// This allows user sign-in (e.g., with Google)
const auth = getAuth(app);

// Set up Google Auth provider for Google sign-in
// This enables users to log in using their Google accounts
const provider = new GoogleAuthProvider();

// Initialize Firestore database
// This is the database where chats and messages are stored
export const db = getFirestore(app);

/**
 * Creates a new chat between two users.
 * @param {string} participant1Id - The ID of the first user.
 * @param {string} participant2Id - The ID of the second user.
 * @returns {Promise<string>} The ID of the new chat, or null if it fails.
 */
export const createChat = async (participant1Id, participant2Id) => {
  try {
    // Sort participant IDs alphabetically to create a consistent chat ID
    // This ensures the same chat ID is generated regardless of who is participant1 or participant2
    const participants = [participant1Id, participant2Id].sort();

    // Create a unique chat ID by combining sorted participant IDs
    // Format: "chat_userId1_userId2" (e.g., "chat_abc123_xyz789")
    const chatId = `chat_${participants[0]}_${participants[1]}`;

    // Reference to the chat document in the "storedChats" collection
    const chatRef = doc(db, "storedChats", chatId);

    // Object to store details (name, photo) for both participants
    const participantDetails = {};

    // Loop through each participant to fetch their details
    for (const userId of participants) {
      // Reference to the user's document in the "users" collection
      const userRef = doc(db, "users", userId);

      // Fetch the user document
      const userDoc = await getDoc(userRef);

      // Check if the user document exists in Firestore
      if (userDoc.exists()) {
        // Get user data (displayName, photoURL)
        const userData = userDoc.data();

        // Store user details in participantDetails
        participantDetails[userId] = {
          displayName: userData.displayName || "Unknown User", // Fallback if no name
          photoURL: userData.photoURL || "", // Fallback if no photo
        };
      } else {
        // If user document doesn't exist, try to get details from Firebase Auth
        // This is a fallback for cases where the user hasn't been fully set up in Firestore
        const user =
          auth.currentUser && auth.currentUser.uid === userId
            ? auth.currentUser
            : null;
        participantDetails[userId] = {
          displayName: user?.displayName || "Unknown User",
          photoURL: user?.photoURL || "",
        };
      }
    }

    // Create the chat document in Firestore with the following structure:
    // - participants: Array of user IDs
    // - participantDetails: Object with user names and photos
    // - lastMessage: Initially empty
    // - lastUpdated: Timestamp of chat creation
    // - typing: Object tracking typing status for each user
    await setDoc(chatRef, {
      participants,
      participantDetails,
      lastMessage: "",
      lastUpdated: serverTimestamp(), // Firebase server timestamp
      typing: {
        [participant1Id]: false, // Is participant1 typing?
        [participant2Id]: false, // Is participant2 typing?
      },
    });

    // Return the chat ID for use in the app
    return chatId;
  } catch (error) {
    // Log any errors and rethrow for handling elsewhere
    console.error("Error creating chat:", error);
    throw error;
  }
};

// Function to send a message in a chat
// @param {string} chatId - The ID of the chat
// @param {string} senderId - The ID of the user sending the message
// @param {string} content - The text content of the message
export const sendMessage = async (chatId, senderId, content) => {
  try {
    // Create a new message document in the "messages" subcollection of the chat
    const messageRef = doc(collection(db, "storedChats", chatId, "messages"));

    // Add the message to Firestore with:
    // - senderId: Who sent it
    // - content: The message text
    // - timestamp: When it was sent
    // - read: Whether the recipient has read it (initially false)
    await setDoc(messageRef, {
      senderId,
      content,
      timestamp: serverTimestamp(),
      read: false,
    });

    // Update the chat document with:
    // - lastMessage: The content of the latest message
    // - lastUpdated: Timestamp of the message
    // { merge: true } ensures we only update these fields, not overwrite the entire document
    const chatRef = doc(db, "storedChats", chatId);
    await setDoc(
      chatRef,
      {
        lastMessage: content,
        lastUpdated: serverTimestamp(),
      },
      { merge: true }
    );

    // Get the recipient's ID (the other participant)
    // Fetch the chat document to get the participants array
    const chatDoc = await getDoc(chatRef);
    const participants = chatDoc.data().participants;

    // Find the recipient (the participant who isn't the sender)
    const recipientId = participants.find((id) => id !== senderId);

    // Add this chat to the recipient's unreadChats array in their user document
    // This helps track which chats have unread messages
    const recipientRef = doc(db, "users", recipientId);
    await updateDoc(recipientRef, {
      unreadChats: arrayUnion(chatId), // Add chatId to unreadChats array
    });

    // Return the ID of the new message
    return messageRef.id;
  } catch (error) {
    console.error("Error sending message:", error);
    throw error;
  }
};

// Function to fetch all chats for a user in real-time
// @param {string} userId - The ID of the user
// @param {function} callback - Function to handle the fetched chats
export const fetchChats = (userId, callback) => {
  try {
    // Create a query to find chats where the user is a participant
    // "array-contains" checks if userId is in the participants array
    const q = query(
      collection(db, "storedChats"),
      where("participants", "array-contains", userId)
    );

    // Set up a real-time listener for the query
    // onSnapshot runs the callback whenever the chats change
    const unsubscribe = onSnapshot(q, (snapshot) => {
      // Map the query results to an array of chat objects
      // Each chat includes its ID and data (participants, lastMessage, etc.)
      const chats = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));

      // Call the provided callback with the chats
      callback(chats);
    });

    // Return the unsubscribe function to stop listening when needed
    return unsubscribe;
  } catch (error) {
    console.error("Error fetching chats:", error);
    throw error;
  }
};

// Function to fetch messages for a specific chat in real-time
// @param {string} chatId - The ID of the chat
// @param {function} callback - Function to handle the fetched messages
// @param {number} limitNum - Number of messages to fetch (default: 20)
export const fetchMessages = (chatId, callback, limitNum = 20) => {
  try {
    // Reference to the messages subcollection for the chat
    const messagesRef = collection(db, "storedChats", chatId, "messages");

    // Create a query to fetch messages:
    // - Ordered by timestamp (ascending, oldest first)
    // - Limited to limitNum messages
    const q = query(messagesRef, orderBy("timestamp", "asc"), limit(limitNum));

    // Set up a real-time listener for the messages
    const unsubscribe = onSnapshot(q, (snapshot) => {
      // Map the query results to an array of message objects
      // Each message includes its ID and data (senderId, content, etc.)
      const messages = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));

      // Call the provided callback with the messages
      callback(messages);
    });

    // Return the unsubscribe function to stop listening
    return unsubscribe;
  } catch (error) {
    console.error("Error fetching messages:", error);
    throw error;
  }
};

// Function to mark messages as read for a user in a chat
// @param {string} chatId - The ID of the chat
// @param {string} userId - The ID of the user reading the messages
export const markMessagesAsRead = async (chatId, userId) => {
  try {
    // Reference to the messages subcollection
    const messagesRef = collection(db, "storedChats", chatId, "messages");

    // Query to finde unread messages not sent by the user
    // - senderId != userId: Messages sent by the other participant
    // - read == false: Messages that haven't been read
    const q = query(
      messagesRef,
      where("senderId", "!=", userId),
      where("read", "==", false)
    );

    // Fetch the matching messages
    const snapshot = await getDocs(q);

    // Create a batch to update multiple documents efficiently
    const batch = writeBatch(db);

    // Update each message to set read: true
    snapshot.forEach((doc) => {
      batch.update(doc.ref, { read: true });
    });

    // Remove the chatId from the user's unreadChats array
    const userRef = doc(db, "users", userId);
    batch.update(userRef, {
      unreadChats: arrayRemove(chatId),
    });

    // Commit all updates at once
    await batch.commit();
  } catch (error) {
    console.error("Error marking messages as read:", error);
    throw error;
  }
};

// Function to update a user's typing status in a chat
// @param {string} chatId - The ID of the chat
// @param {string} userId - The ID of the user
// @param {boolean} isTyping - Whether the user is typing
export const setTypingStatus = async (chatId, userId, isTyping) => {
  try {
    // Reference to the chat document
    const chatRef = doc(db, "storedChats", chatId);

    // Update the typing status for the user
    // Uses dynamic key syntax: typing.userId = isTyping
    await updateDoc(chatRef, {
      [`typing.${userId}`]: isTyping,
    });
  } catch (error) {
    console.error("Error setting typing status:", error);
    throw error;
  }
};

// Function to delete a message from a chat
// @param {string} chatId - The ID of the chat
// @param {string} messageId - The ID of the message to delete
export const deleteMessage = async (chatId, messageId) => {
  try {
    // Reference to the specific message document
    const messageRef = doc(db, "storedChats", chatId, "messages", messageId);

    // Delete the message
    await deleteDoc(messageRef);

    // Check if the deleted message was the last one
    // Fetch the latest remaining message to update lastMessage
    const messagesRef = collection(db, "storedChats", chatId, "messages");
    const q = query(messagesRef, orderBy("timestamp", "desc"), limit(1));
    const snapshot = await getDocs(q);

    // Get the content of the latest message (or empty string if none)
    const lastMsg = snapshot.docs[0]?.data() || { content: "" };

    // Update the chat document with the new lastMessage and timestamp
    await updateDoc(doc(db, "storedChats", chatId), {
      lastMessage: lastMsg.content,
      lastUpdated: serverTimestamp(),
    });
  } catch (error) {
    console.error("Error deleting message:", error);
    throw error;
  }
};

// Export auth and provider for use in other parts of the app
export { auth, provider };
