import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getStorage, ref, uploadBytes, getDownloadURL } from "firebase/storage";
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
  limitToLast,
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

// Initialize Firebase Storage
export const storage = getStorage(app);

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
// @param {object} replyTo - Optional parent message reference for replies
// @param {string} mediaURL - Optional URL for media attachments
export const sendMessage = async (chatId, senderId, content, replyTo = null, mediaURL = null) => {
  try {
    // Create a new message document in the "messages" subcollection of the chat
    const messageRef = doc(collection(db, "storedChats", chatId, "messages"));

    // Calculate expiration timestamp for 12 hours in the future for Firestore TTL auto-deletion
    const expireAtDate = new Date();
    expireAtDate.setHours(expireAtDate.getHours() + 12);

    const messageData = {
      senderId,
      content,
      timestamp: serverTimestamp(),
      expireAt: expireAtDate, // 12 hours from now
      read: false,
      delivered: false,
    };

    if (replyTo) {
      messageData.replyTo = replyTo;
    }

    if (mediaURL) {
      messageData.mediaURL = mediaURL;
    }

    // Add the message to Firestore
    await setDoc(messageRef, messageData);

    // Update the chat document with:
    // - lastMessage: The content of the latest message or photo placeholder
    // - lastUpdated: Timestamp of the message
    const displayMessage = content || (mediaURL ? "📷 Sent a photo" : "New message");

    const chatRef = doc(db, "storedChats", chatId);
    await setDoc(
      chatRef,
      {
        lastMessage: displayMessage,
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
// @param {function} [onError] - Optional error handler called when the listener fails
//   (e.g. network loss, phone lock, tab backgrounded). The caller is responsible
//   for deciding whether to restart the listener.
//
// NOTE: We use limitToLast(50) to fetch the most recent 50 messages.
// Because it's "to last", the real-time listener window slides forward
// automatically when new messages are added, allowing them to appear instantly,
// while protecting our database read quotas on the Firebase Free Spark Tier.
export const fetchMessages = (chatId, callback, onError) => {
  try {
    // Reference to the messages subcollection for the chat
    const messagesRef = collection(db, "storedChats", chatId, "messages");

    // Query the latest 50 messages chronologically (oldest → newest)
    const q = query(messagesRef, orderBy("timestamp", "asc"), limitToLast(50));

    // Set up a real-time listener for the messages.
    // The second (error) callback surfaces listener failures caused by network
    // drops or browser suspension — previously these were swallowed silently.
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        // Map the query results to an array of message objects
        // Each message includes its ID and data (senderId, content, etc.)
        const messages = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));

        // Call the provided callback with the messages
        callback(messages);
      },
      (error) => {
        console.error("[fetchMessages] Listener error:", error.code, error.message);
        if (onError) onError(error);
      }
    );

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

    // Update each message to set read: true and delivered: true
    snapshot.forEach((doc) => {
      batch.update(doc.ref, { read: true, delivered: true });
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

/**
 * Compresses an image client-side to keep storage footprint minimal on the Free Spark Tier.
 */
export const compressImage = (file, maxWidth = 1200, quality = 0.75) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target.result;
      img.onload = () => {
        const canvas = document.createElement("canvas");
        let width = img.width;
        let height = img.height;

        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        }

        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, width, height);

        canvas.toBlob(
          (blob) => {
            if (blob) {
              resolve(new File([blob], file.name, { type: "image/jpeg" }));
            } else {
              reject(new Error("Canvas to Blob conversion failed"));
            }
          },
          "image/jpeg",
          quality
        );
      };
      img.onerror = (err) => reject(err);
    };
    reader.onerror = (err) => reject(err);
  });
};

/**
 * Uploads a file (compressed if it's an image) to Firebase Storage and returns its download URL.
 */
export const uploadChatFile = async (chatId, file) => {
  try {
    let finalFile = file;
    if (file.type.startsWith("image/")) {
      finalFile = await compressImage(file);
    }
    const storageRef = ref(storage, `chats/${chatId}/${Date.now()}_${finalFile.name}`);
    const snapshot = await uploadBytes(storageRef, finalFile);
    const downloadUrl = await getDownloadURL(snapshot.ref);
    return downloadUrl;
  } catch (error) {
    console.error("Error uploading chat file:", error);
    throw error;
  }
};

/**
 * Toggles a reaction emoji on a specific message.
 */
export const toggleMessageReaction = async (chatId, messageId, userId, reaction) => {
  try {
    const msgRef = doc(db, "storedChats", chatId, "messages", messageId);
    const msgDoc = await getDoc(msgRef);
    if (!msgDoc.exists()) return;
    
    const data = msgDoc.data();
    const currentReactions = data.reactions || {};
    const usersWhoReacted = currentReactions[reaction] || [];
    
    let updatedUsers;
    if (usersWhoReacted.includes(userId)) {
      updatedUsers = usersWhoReacted.filter((id) => id !== userId);
    } else {
      updatedUsers = [...usersWhoReacted, userId];
    }
    
    const updatedReactions = {
      ...currentReactions,
      [reaction]: updatedUsers
    };
    
    // Clean up empty reaction keys to keep document size light
    if (updatedUsers.length === 0) {
      delete updatedReactions[reaction];
    }
    
    await updateDoc(msgRef, { reactions: updatedReactions });
  } catch (error) {
    console.error("Error toggling message reaction:", error);
    throw error;
  }
};

/**
 * Toggles pinning a specific chat for a user.
 */
export const togglePinChat = async (userId, chatId) => {
  try {
    const userRef = doc(db, "users", userId);
    const userDoc = await getDoc(userRef);
    if (!userDoc.exists()) return;
    
    const userData = userDoc.data();
    const currentPinned = userData.pinnedChats || [];
    
    let updatedPinned;
    if (currentPinned.includes(chatId)) {
      updatedPinned = currentPinned.filter((id) => id !== chatId);
    } else {
      updatedPinned = [...currentPinned, chatId];
    }
    
    await updateDoc(userRef, { pinnedChats: updatedPinned });
  } catch (error) {
    console.error("Error toggling pin chat:", error);
    throw error;
  }
};

/**
 * Clears all messages in a chat and resets the lastMessage status.
 */
export const clearChatMessages = async (chatId) => {
  try {
    const messagesRef = collection(db, "storedChats", chatId, "messages");
    const snapshot = await getDocs(messagesRef);
    const batch = writeBatch(db);
    
    snapshot.forEach((doc) => {
      batch.delete(doc.ref);
    });
    
    await batch.commit();
    
    // Reset lastMessage on the chat document
    await updateDoc(doc(db, "storedChats", chatId), {
      lastMessage: "",
      lastUpdated: serverTimestamp()
    });
  } catch (error) {
    console.error("Error clearing chat messages:", error);
    throw error;
  }
};

/**
 * Scans a list of messages, identifies any that have expired client-side based on their `expireAt` field,
 * and deletes them from Firestore in a single efficient writeBatch call.
 */
export const cleanupExpiredMessages = async (chatId, messages) => {
  try {
    const now = new Date();
    const expired = messages.filter((msg) => {
      if (!msg.expireAt) return false;
      const expireTime = msg.expireAt.toDate ? msg.expireAt.toDate() : new Date(msg.expireAt);
      return expireTime < now;
    });

    if (expired.length === 0) return;

    const batch = writeBatch(db);
    expired.forEach((msg) => {
      const msgRef = doc(db, "storedChats", chatId, "messages", msg.id);
      batch.delete(msgRef);
    });

    await batch.commit();

    // After deleting, check if we need to update the lastMessage in the chat document
    const remaining = messages.filter(m => !expired.some(e => e.id === m.id));
    const lastMsg = remaining[remaining.length - 1] || { content: "" };
    
    await updateDoc(doc(db, "storedChats", chatId), {
      lastMessage: lastMsg.content || (lastMsg.mediaURL ? "📷 Sent a photo" : ""),
      lastUpdated: serverTimestamp()
    });
  } catch (error) {
    console.error("Error cleaning up expired messages:", error);
  }
};

/**
 * Deletes a chat completely from Firestore (both messages subcollection and parent chat doc), leaving no history.
 */
export const deleteChatCompletely = async (chatId) => {
  try {
    // 1. Delete all messages inside the subcollection first
    const messagesRef = collection(db, "storedChats", chatId, "messages");
    const snapshot = await getDocs(messagesRef);
    const batch = writeBatch(db);
    
    snapshot.forEach((doc) => {
      batch.delete(doc.ref);
    });
    
    await batch.commit();
    
    // 2. Delete the parent chat document
    await deleteDoc(doc(db, "storedChats", chatId));
  } catch (error) {
    console.error("Error deleting chat completely:", error);
    throw error;
  }
};

/**
 * Updates user presence boolean (isOnline) and lastActive time in Firestore.
 */
export const updateUserPresence = async (userId, isOnline) => {
  try {
    const userRef = doc(db, "users", userId);
    await updateDoc(userRef, {
      isOnline,
      lastActive: serverTimestamp()
    });
  } catch (error) {
    console.error("Error updating user presence:", error);
  }
};

/**
 * Marks all unread incoming messages in a chat as delivered.
 */
export const markMessagesAsDelivered = async (chatId, userId) => {
  try {
    const messagesRef = collection(db, "storedChats", chatId, "messages");
    const q = query(
      messagesRef,
      where("senderId", "!=", userId),
      where("delivered", "==", false)
    );
    const snapshot = await getDocs(q);
    const batch = writeBatch(db);
    
    snapshot.forEach((doc) => {
      batch.update(doc.ref, { delivered: true });
    });
    
    await batch.commit();
  } catch (error) {
    console.error("Error marking messages as delivered:", error);
  }
};

// Export auth and provider for use in other parts of the app
export { auth, provider };
