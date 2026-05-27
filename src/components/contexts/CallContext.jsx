import React, { createContext, useContext, useEffect, useRef, useState } from "react";
import { useSelector } from "react-redux";
import { 
  collection, 
  doc, 
  setDoc, 
  updateDoc, 
  onSnapshot, 
  getDoc, 
  addDoc, 
  serverTimestamp 
} from "firebase/firestore";
import { db } from "../../firebase";
import { 
  BsTelephoneFill, 
  BsTelephoneXFill, 
  BsMicFill, 
  BsMicMuteFill, 
  BsCameraVideoFill, 
  BsCameraVideoOffFill,
  BsTv,
  BsLaptop
} from "react-icons/bs";
import "./CallUI.css";

const CallContext = createContext(null);

const ICE_SERVERS = {
  iceServers: [
    {
      urls: [
        "stun:stun.l.google.com:19302",
        "stun:stun1.l.google.com:19302",
        "stun:stun2.l.google.com:19302",
      ],
    },
  ],
};

export const CallProvider = ({ children }) => {
  const { user } = useSelector((state) => state.auth);
  
  // Call State Management
  const [callId, setCallId] = useState(null);
  const [callInfo, setCallInfo] = useState(null); // active call doc data
  const [incomingCall, setIncomingCall] = useState(null); // ringing call doc data
  const [callStatus, setCallStatus] = useState("idle"); // idle, dialing, ringing, connected, ended
  
  // Media Streams and Connections
  const [localStream, setLocalStream] = useState(null);
  const [remoteStream, setRemoteStream] = useState(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isCameraOff, setIsCameraOff] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);

  // Refs for tracking connections & stream states across renders
  const pcRef = useRef(null);
  const localStreamRef = useRef(null);
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const ringtoneRef = useRef(null);
  
  // Unsubscribe listeners refs
  const callDocListenerRef = useRef(null);
  const callerCandidatesListenerRef = useRef(null);
  const calleeCandidatesListenerRef = useRef(null);

  // Dynamic Ringtone Synthesizer (No assets dependency, 100% reliable)
  const startRingtoneSynth = () => {
    try {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextClass) return null;
      
      const audioCtx = new AudioContextClass();
      const osc1 = audioCtx.createOscillator();
      const osc2 = audioCtx.createOscillator();
      const gain = audioCtx.createGain();

      osc1.type = "sine";
      osc1.frequency.setValueAtTime(440, audioCtx.currentTime); // Standard ring frequency A
      osc2.type = "sine";
      osc2.frequency.setValueAtTime(480, audioCtx.currentTime); // Standard ring frequency B (dual-tone)

      gain.gain.setValueAtTime(0, audioCtx.currentTime);
      
      // Schedule standard dual-tone ring pulses: 1.2s ring, 2s silence
      let time = audioCtx.currentTime;
      for (let i = 0; i < 15; i++) {
        gain.gain.setValueAtTime(0.2, time + 0.1);
        gain.gain.setValueAtTime(0, time + 1.3);
        time += 3.2;
      }

      osc1.connect(gain);
      osc2.connect(gain);
      gain.connect(audioCtx.destination);
      
      osc1.start();
      osc2.start();

      return {
        stop: () => {
          try {
            osc1.stop();
            osc2.stop();
            audioCtx.close();
          } catch (e) {
            console.error("Error stopping synth ringtone:", e);
          }
        }
      };
    } catch (err) {
      console.error("Failed to start synthetic ringtone:", err);
      return null;
    }
  };

  // Stop Ringtone Helper
  const stopRingtone = () => {
    if (ringtoneRef.current) {
      ringtoneRef.current.stop();
      ringtoneRef.current = null;
    }
  };

  // Global incoming call listener
  useEffect(() => {
    if (!user?.uid) {
      setIncomingCall(null);
      setCallStatus("idle");
      return;
    }

    // Listen to calls collection where status is 'ringing' and receiver is current user
    const callsCol = collection(db, "calls");
    const unsubscribe = onSnapshot(callsCol, (snapshot) => {
      snapshot.docChanges().forEach((change) => {
        const data = change.doc.data();
        if (change.type === "added" || change.type === "modified") {
          if (data.receiverId === user.uid && data.status === "ringing") {
            setIncomingCall({ id: change.doc.id, ...data });
            setCallId(change.doc.id);
            setCallStatus("ringing");
            
            // Start ringtone
            stopRingtone();
            ringtoneRef.current = startRingtoneSynth();
          } else if (data.receiverId === user.uid && data.status === "ended" && incomingCall?.id === change.doc.id) {
            // Caller canceled call
            stopRingtone();
            setIncomingCall(null);
            setCallStatus("idle");
            cleanupMediaAndConnections();
          }
        }
      });
    });

    return () => {
      unsubscribe();
      stopRingtone();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.uid, incomingCall?.id]);

  // Handle local video element binding when localStream updates
  useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream;
    }
  }, [localStream, callStatus]);

  // Handle remote video element binding when remoteStream updates
  useEffect(() => {
    if (remoteVideoRef.current && remoteStream) {
      remoteVideoRef.current.srcObject = remoteStream;
    }
  }, [remoteStream, callStatus]);

  // Cleanup helper for all connections and streams
  const cleanupMediaAndConnections = () => {
    stopRingtone();
    
    // Stop local tracks
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => track.stop());
      localStreamRef.current = null;
    }
    setLocalStream(null);
    setRemoteStream(null);
    setIsMuted(false);
    setIsCameraOff(false);
    setIsScreenSharing(false);

    // Close PeerConnection
    if (pcRef.current) {
      pcRef.current.close();
      pcRef.current = null;
    }

    // Unsubscribe listeners
    if (callDocListenerRef.current) {
      callDocListenerRef.current();
      callDocListenerRef.current = null;
    }
    if (callerCandidatesListenerRef.current) {
      callerCandidatesListenerRef.current();
      callerCandidatesListenerRef.current = null;
    }
    if (calleeCandidatesListenerRef.current) {
      calleeCandidatesListenerRef.current();
      calleeCandidatesListenerRef.current = null;
    }

    setCallId(null);
    setCallInfo(null);
    setIncomingCall(null);
    setCallStatus("idle");
  };

  // INITIATE CALL (Outbound)
  const initiateCall = async (receiverId, receiverName, receiverPhoto, isVideoCall = true) => {
    if (!user) return;
    cleanupMediaAndConnections();

    setCallStatus("dialing");
    
    // Play ringback tone Synth (lower pitch pulse)
    stopRingtone();
    
    try {
      // 1. Get local user media stream
      const stream = await navigator.mediaDevices.getUserMedia({
        video: isVideoCall,
        audio: true
      });
      setLocalStream(stream);
      localStreamRef.current = stream;

      // 2. Create peer connection
      const pc = new RTCPeerConnection(ICE_SERVERS);
      pcRef.current = pc;

      // 3. Add tracks
      stream.getTracks().forEach((track) => pc.addTrack(track, stream));

      // 4. Remote track listener
      pc.ontrack = (event) => {
        if (event.streams && event.streams[0]) {
          setRemoteStream(event.streams[0]);
        }
      };

      // 5. Create Firestore call document
      const tempCallId = `call_${user.uid}_${Date.now()}`;
      setCallId(tempCallId);

      const callRef = doc(db, "calls", tempCallId);
      const newCallData = {
        callerId: user.uid,
        callerName: user.displayName || "Unknown User",
        callerPhoto: user.photoURL || "",
        receiverId,
        receiverName,
        receiverPhoto,
        isVideo: isVideoCall,
        status: "ringing",
        timestamp: serverTimestamp(),
      };
      setCallInfo(newCallData);
      await setDoc(callRef, newCallData);

      // 6. Write ICE candidates to callerCandidates subcollection
      pc.onicecandidate = (event) => {
        if (event.candidate) {
          const candCol = collection(db, "calls", tempCallId, "callerCandidates");
          addDoc(candCol, event.candidate.toJSON());
        }
      };

      // 7. Create SDP offer and set local description
      const offerDescription = await pc.createOffer();
      await pc.setLocalDescription(offerDescription);
      
      const offer = {
        sdp: offerDescription.sdp,
        type: offerDescription.type,
      };
      await updateDoc(callRef, { offer });

      // 8. Listen for call responses in Firestore
      callDocListenerRef.current = onSnapshot(callRef, async (snapshot) => {
        const data = snapshot.data();
        if (!data) return;
        setCallInfo(data);

        if (data.status === "accepted" && data.answer && !pc.currentRemoteDescription) {
          stopRingtone();
          setCallStatus("connected");
          const answerDescription = new RTCSessionDescription(data.answer);
          await pc.setRemoteDescription(answerDescription);
        } else if (data.status === "rejected" || data.status === "ended") {
          cleanupMediaAndConnections();
        }
      });

      // 9. Listen for callee ICE candidates
      const calleeCandidatesCol = collection(db, "calls", tempCallId, "calleeCandidates");
      calleeCandidatesListenerRef.current = onSnapshot(calleeCandidatesCol, (snapshot) => {
        snapshot.docChanges().forEach(async (change) => {
          if (change.type === "added") {
            const data = change.doc.data();
            const candidate = new RTCIceCandidate(data);
            if (pcRef.current) {
              await pcRef.current.addIceCandidate(candidate);
            }
          }
        });
      });

    } catch (error) {
      console.error("Failed to initiate call:", error);
      cleanupMediaAndConnections();
    }
  };

  // ACCEPT CALL (Inbound)
  const acceptCall = async () => {
    if (!incomingCall) return;
    stopRingtone();
    
    setCallStatus("dialing"); // connecting phase
    const targetCallId = incomingCall.id;
    setIncomingCall(null);

    try {
      // 1. Get media streams
      const stream = await navigator.mediaDevices.getUserMedia({
        video: incomingCall.isVideo,
        audio: true
      });
      setLocalStream(stream);
      localStreamRef.current = stream;

      // 2. Create peer connection
      const pc = new RTCPeerConnection(ICE_SERVERS);
      pcRef.current = pc;

      // 3. Add tracks
      stream.getTracks().forEach((track) => pc.addTrack(track, stream));

      // 4. Remote track listener
      pc.ontrack = (event) => {
        if (event.streams && event.streams[0]) {
          setRemoteStream(event.streams[0]);
        }
      };

      // 5. Read remote offer from Firestore call document
      const callRef = doc(db, "calls", targetCallId);
      const callDoc = await getDoc(callRef);
      const callData = callDoc.data();
      setCallInfo(callData);

      // Write ICE candidates to calleeCandidates subcollection
      pc.onicecandidate = (event) => {
        if (event.candidate) {
          const candCol = collection(db, "calls", targetCallId, "calleeCandidates");
          addDoc(candCol, event.candidate.toJSON());
        }
      };

      // Set remote offer session description
      const offerDescription = new RTCSessionDescription(callData.offer);
      await pc.setRemoteDescription(offerDescription);

      // 6. Create SDP answer and set local description
      const answerDescription = await pc.createAnswer();
      await pc.setLocalDescription(answerDescription);

      const answer = {
        sdp: answerDescription.sdp,
        type: answerDescription.type,
      };

      // 7. Update Firestore call document to accepted status with answer
      await updateDoc(callRef, {
        answer,
        status: "accepted"
      });

      setCallStatus("connected");

      // 8. Listen for any call updates (e.g., hanging up)
      callDocListenerRef.current = onSnapshot(callRef, (snapshot) => {
        const data = snapshot.data();
        if (!data) return;
        setCallInfo(data);
        if (data.status === "ended") {
          cleanupMediaAndConnections();
        }
      });

      // 9. Listen for caller ICE candidates
      const callerCandidatesCol = collection(db, "calls", targetCallId, "callerCandidates");
      callerCandidatesListenerRef.current = onSnapshot(callerCandidatesCol, (snapshot) => {
        snapshot.docChanges().forEach(async (change) => {
          if (change.type === "added") {
            const data = change.doc.data();
            const candidate = new RTCIceCandidate(data);
            if (pcRef.current) {
              await pcRef.current.addIceCandidate(candidate);
            }
          }
        });
      });

    } catch (error) {
      console.error("Failed to accept call:", error);
      cleanupMediaAndConnections();
    }
  };

  // DECLINE INCOMING CALL
  const rejectCall = async () => {
    if (!incomingCall) return;
    stopRingtone();
    
    const targetCallId = incomingCall.id;
    setIncomingCall(null);
    setCallStatus("idle");

    try {
      const callRef = doc(db, "calls", targetCallId);
      await updateDoc(callRef, { status: "rejected" });
    } catch (error) {
      console.error("Failed to reject call:", error);
    }
    
    cleanupMediaAndConnections();
  };

  // END ACTIVE CALL (Hang up)
  const endCall = async () => {
    if (!callId) return;

    try {
      const callRef = doc(db, "calls", callId);
      await updateDoc(callRef, { status: "ended" });
    } catch (error) {
      console.error("Failed to end call in firestore:", error);
    }

    cleanupMediaAndConnections();
  };

  // CONTROLS TOGGLES
  const toggleMute = () => {
    if (localStreamRef.current) {
      const audioTrack = localStreamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsMuted(!audioTrack.enabled);
      }
    }
  };

  const toggleCamera = () => {
    if (localStreamRef.current) {
      const videoTrack = localStreamRef.current.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setIsCameraOff(!videoTrack.enabled);
      }
    }
  };

  const toggleScreenShare = async () => {
    if (!pcRef.current || !localStreamRef.current) return;

    try {
      if (!isScreenSharing) {
        // Start screen sharing
        const screenStream = await navigator.mediaDevices.getDisplayMedia({
          video: true
        });

        const screenTrack = screenStream.getVideoTracks()[0];
        
        // Find video sender to replace track
        const videoSender = pcRef.current.getSenders().find(
          (sender) => sender.track && sender.track.kind === "video"
        );

        if (videoSender) {
          await videoSender.replaceTrack(screenTrack);
        }

        // Keep local display updated
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = screenStream;
        }

        // Handle screen share stop clicking on native browser banner
        screenTrack.onended = () => {
          stopScreenShare(localStreamRef.current.getVideoTracks()[0]);
        };

        setIsScreenSharing(true);
      } else {
        // Stop screen sharing and revert to camera
        const cameraTrack = localStreamRef.current.getVideoTracks()[0];
        await stopScreenShare(cameraTrack);
      }
    } catch (err) {
      console.error("Screen sharing failed:", err);
    }
  };

  const stopScreenShare = async (revertTrack) => {
    if (!pcRef.current) return;
    
    const videoSender = pcRef.current.getSenders().find(
      (sender) => sender.track && sender.track.kind === "video"
    );

    if (videoSender && revertTrack) {
      await videoSender.replaceTrack(revertTrack);
    }

    if (localVideoRef.current && localStreamRef.current) {
      localVideoRef.current.srcObject = localStreamRef.current;
    }

    setIsScreenSharing(false);
  };

  // Handle window unload and popstate (navigation) cleanly to terminate call
  useEffect(() => {
    const handleNavigationOrExit = () => {
      if (callId && callStatus !== "idle") {
        endCall();
      }
    };

    window.addEventListener("popstate", handleNavigationOrExit);
    window.addEventListener("beforeunload", handleNavigationOrExit);

    return () => {
      window.removeEventListener("popstate", handleNavigationOrExit);
      window.removeEventListener("beforeunload", handleNavigationOrExit);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [callId, callStatus]);

  return (
    <CallContext.Provider
      value={{
        initiateCall,
        acceptCall,
        rejectCall,
        endCall,
        toggleMute,
        toggleCamera,
        toggleScreenShare,
        callStatus,
        incomingCall,
        callInfo,
        localStream,
        remoteStream,
        isMuted,
        isCameraOff,
        isScreenSharing,
      }}
    >
      {children}

      {/* 1. Incoming Call Notification Popup */}
      {callStatus === "ringing" && incomingCall && (
        <div className="incoming-call-banner">
          <div className="incoming-call-info">
            <div className="incoming-call-avatar-wrapper">
              <img 
                src={incomingCall.callerPhoto || `https://ui-avatars.com/api/?name=${encodeURIComponent(incomingCall.callerName)}&size=56&rounded=true&background=random`} 
                alt={incomingCall.callerName} 
                className="incoming-call-avatar"
              />
              <div className="incoming-call-pulse"></div>
            </div>
            <div className="incoming-call-details">
              <h3 className="incoming-call-name">{incomingCall.callerName}</h3>
              <p className="incoming-call-type">
                {incomingCall.isVideo ? (
                  <>🎥 Incoming Video Call</>
                ) : (
                  <>📞 Incoming Audio Call</>
                )}
              </p>
            </div>
          </div>
          <div className="incoming-call-actions">
            <button className="incoming-btn incoming-btn-decline" onClick={rejectCall}>
              <BsTelephoneXFill /> Decline
            </button>
            <button className="incoming-btn incoming-btn-accept" onClick={acceptCall}>
              <BsTelephoneFill /> Answer
            </button>
          </div>
        </div>
      )}

      {/* 2. Fullscreen Video / Audio Call Overlay */}
      {callStatus !== "idle" && callStatus !== "ringing" && callInfo && (
        <div className="call-overlay-fullscreen">
          
          {/* Header Status (Floating) */}
          <div className="call-header-status-floating">
            <img 
              src={
                user?.uid === callInfo.callerId 
                  ? (callInfo.receiverPhoto || `https://ui-avatars.com/api/?name=${encodeURIComponent(callInfo.receiverName)}&size=32&rounded=true`)
                  : (callInfo.callerPhoto || `https://ui-avatars.com/api/?name=${encodeURIComponent(callInfo.callerName)}&size=32&rounded=true`)
              } 
              alt="Remote participant avatar"
              className="call-header-avatar"
            />
            <div className="call-header-details">
              <h4>{user?.uid === callInfo.callerId ? callInfo.receiverName : callInfo.callerName}</h4>
              <p>
                {callStatus === "dialing" && "Connecting..."}
                {callStatus === "connected" && "Active Call"}
                {isScreenSharing && " • Sharing screen"}
              </p>
            </div>
          </div>

          {/* Core Body Container */}
          <div className="call-video-grid">
            {callInfo.isVideo ? (
              // VIDEO CALL UI
              <div className="remote-video-container">
                {/* Floating Self Video (PiP) */}
                {!isCameraOff && (
                  <div className="local-video-container-floating">
                    <video 
                      ref={localVideoRef} 
                      autoPlay 
                      playsInline 
                      muted 
                      className="local-video"
                    />
                  </div>
                )}
                
                {/* Remote Participant Video */}
                {remoteStream ? (
                  <video 
                    ref={remoteVideoRef} 
                    autoPlay 
                    playsInline 
                    className="remote-video"
                  />
                ) : (
                  // Dialing/Ringing State Remote Avatar
                  <div className="audio-call-center">
                    <div className="audio-avatar-pulsator">
                      <div className="pulsator-wave wave-1"></div>
                      <div className="pulsator-wave wave-2"></div>
                      <div className="pulsator-wave wave-3"></div>
                      <img 
                        src={
                          user?.uid === callInfo.callerId 
                            ? (callInfo.receiverPhoto || `https://ui-avatars.com/api/?name=${encodeURIComponent(callInfo.receiverName)}&size=128&rounded=true`)
                            : (callInfo.callerPhoto || `https://ui-avatars.com/api/?name=${encodeURIComponent(callInfo.callerName)}&size=128&rounded=true`)
                        } 
                        alt="Remote Avatar" 
                        className="audio-avatar"
                      />
                    </div>
                    <p className="audio-call-status">Connecting video stream...</p>
                  </div>
                )}
              </div>
            ) : (
              // AUDIO ONLY CALL UI
              <div className="audio-call-center">
                <div className="audio-avatar-pulsator">
                  <div className="pulsator-wave wave-1"></div>
                  <div className="pulsator-wave wave-2"></div>
                  <div className="pulsator-wave wave-3"></div>
                  <img 
                    src={
                      user?.uid === callInfo.callerId 
                        ? (callInfo.receiverPhoto || `https://ui-avatars.com/api/?name=${encodeURIComponent(callInfo.receiverName)}&size=128&rounded=true`)
                        : (callInfo.callerPhoto || `https://ui-avatars.com/api/?name=${encodeURIComponent(callInfo.callerName)}&size=128&rounded=true`)
                    } 
                    alt="Audio Avatar" 
                    className="audio-avatar"
                  />
                </div>
                <h3 className="audio-call-name">
                  {user?.uid === callInfo.callerId ? callInfo.receiverName : callInfo.callerName}
                </h3>
                <p className="audio-call-status">
                  {callStatus === "dialing" && "Calling..."}
                  {callStatus === "connected" && "Connected Audio Call"}
                </p>
              </div>
            )}
          </div>

          {/* Action Control Panel */}
          <div className="call-control-bar">
            {/* Microphone Mute Toggle */}
            <button 
              className={`control-btn ${isMuted ? "control-btn-disabled" : "control-btn-active"}`} 
              onClick={toggleMute}
              title={isMuted ? "Unmute Mic" : "Mute Mic"}
            >
              {isMuted ? <BsMicMuteFill /> : <BsMicFill />}
            </button>

            {/* Video Camera Toggle (Only available in Video Calls) */}
            {callInfo.isVideo && (
              <button 
                className={`control-btn ${isCameraOff ? "control-btn-disabled" : "control-btn-active"}`} 
                onClick={toggleCamera}
                title={isCameraOff ? "Turn Camera On" : "Turn Camera Off"}
              >
                {isCameraOff ? <BsCameraVideoOffFill /> : <BsCameraVideoFill />}
              </button>
            )}

            {/* Screen Share Toggle (Only available in Video Calls) */}
            {callInfo.isVideo && (
              <button 
                className={`control-btn ${isScreenSharing ? "control-btn-active" : ""}`} 
                onClick={toggleScreenShare}
                title={isScreenSharing ? "Stop Screen Share" : "Share Screen"}
              >
                {isScreenSharing ? <BsLaptop /> : <BsTv />}
              </button>
            )}

            {/* Hangup/End Call Button */}
            <button 
              className="control-btn control-btn-hangup" 
              onClick={endCall}
              title="Hang Up"
            >
              <BsTelephoneXFill />
            </button>
          </div>

        </div>
      )}
    </CallContext.Provider>
  );
};

export const useCall = () => {
  const context = useContext(CallContext);
  if (!context) {
    throw new Error("useCall must be used within a CallProvider");
  }
  return context;
};
