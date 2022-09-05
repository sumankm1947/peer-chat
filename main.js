const APP_ID = {{ secrets.APP_ID }};
const TOKEN = null;

// Local => this user video stream, remote => video stream of other user
let localStream, remoteStream;

// FOR AGORA
let client, channel;
let peerConnection;

// Stun server for ICE candidates
const servers = {
  iceServers: [
    {
      urls: ["stun:stun1.l.google.com:19302", "stun:stun2.l.google.com:19302"],
    },
  ],
};

const constraints = {
  video: {
    width: { min: 640, ideal: 1920, max: 1920 },
    height: { min: 480, ideal: 1080, max: 1080 },
  },
  audio: true,
};

const uid = String(Math.floor(Math.random() * 100000));


// Get the roomId for forming rooms
const queryString = window.location.search
const urlParams = new URLSearchParams(queryString)
const roomId = urlParams.get('room')

if(!roomId){
    window.location = 'lobby.html'
}

const init = async () => {
  client = await AgoraRTM.createInstance(APP_ID);
  await client.login({ uid, TOKEN });

  channel = client.createChannel(roomId);
  await channel.join();

  channel.on("MemberJoined", userJoinHandler);
  channel.on("MemberLeft", userLeftHandler);
  client.on("MessageFromPeer", messageFromPeerHandler);

  localStream = await navigator.mediaDevices.getUserMedia(constraints);
  document.getElementById("user-1").srcObject = localStream;
};

const userLeftHandler = () => {
  document.getElementById("user-2").style.display = "none";
  document.getElementById("user-1").classList.remove("small-frame");
};

const messageFromPeerHandler = async (message, memberId) => {
    const data = JSON.parse(message.text);
    switch (data.type) {
      case "offer":
        createAnswer(data.offer, memberId);
        break;
      case "answer":
        addAnswer(data.answer);
        break;
      case "candidate":
        if (peerConnection) {
          peerConnection.addIceCandidate(data.candidate);
        }
        break;

      default:
        break;
    }
};

const userJoinHandler = async (memberId) => {
  console.log("A new user joined the channel:", memberId);
  createOffer(memberId);
};

const createPeerConnection = async (memberId) => {
  peerConnection = new RTCPeerConnection(servers);

  remoteStream = new MediaStream();
  document.getElementById("user-2").srcObject = remoteStream;
  document.getElementById("user-2").style.display = "block";

  document.getElementById("user-1").classList.add("small-frame");

  if (!localStream) {
    localStream = await navigator.mediaDevices.getUserMedia(constraints);
    document.getElementById("user-1").srcObject = localStream;
  }

  localStream.getTracks().forEach((track) => {
    peerConnection.addTrack(track, localStream);
  });

  peerConnection.ontrack = (event) => {
    event.streams[0].getTracks().forEach((track) => {
      remoteStream.addTrack(track);
    });
  };

  peerConnection.onicecandidate = async (event) => {
    if (event.candidate) {
      client.sendMessageToPeer(
        {
          text: JSON.stringify({
            type: "candidate",
            candidate: event.candidate,
          }),
        },
        memberId
      );
    }
  };
};

const createOffer = async (memberId) => {
  await createPeerConnection(memberId);

  const offer = await peerConnection.createOffer();
  await peerConnection.setLocalDescription(offer);

  client.sendMessageToPeer(
    { text: JSON.stringify({ type: "offer", offer: offer }) },
    memberId
  );
};

const createAnswer = async (offer, memberId) => {
  await createPeerConnection(memberId);

  await peerConnection.setRemoteDescription(offer);

  const answer = await peerConnection.createAnswer();
  await peerConnection.setLocalDescription(answer);

  client.sendMessageToPeer(
    { text: JSON.stringify({ type: "answer", answer: answer }) },
    memberId
  );
};

const addAnswer = async (answer) => {
  if (!peerConnection.currentRemoteDescription) {
    peerConnection.setRemoteDescription(answer);
  }
};

const leaveChannel = async () => {
  await channel.leave();
  await client.logout();
};

const toggleCamera = async () => {
  const videoTrack = localStream
    .getTracks()
    .find((track) => track.kind === "video");

  if (videoTrack.enabled) {
    videoTrack.enabled = false;
    document.getElementById("camera-btn").children[0].src="./images/no-video.png";
  } else {
    videoTrack.enabled = true;
    document.getElementById("camera-btn").children[0].src="./images/camera.png";
  }
};

const toggleMic = async () => {
  const audioTrack = localStream
    .getTracks()
    .find((track) => track.kind === "audio");

  if (audioTrack.enabled) {
    audioTrack.enabled = false;
    document.getElementById("mic-btn").children[0].src = "./images/mute.png"
  } else {
    audioTrack.enabled = true;
    document.getElementById("mic-btn").children[0].src = "./images/mic.png"

  }
};

window.addEventListener("beforeunload", leaveChannel);
document.getElementById("mic-btn").addEventListener("click", toggleMic);
document.getElementById("camera-btn").addEventListener("click", toggleCamera);

document.getElementById("leave-btn").addEventListener("click", () => {
  leaveChannel();
  window.location = 'lobby.html'
})

init();
