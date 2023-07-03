import WHEPClient from "./WebRTC/WHEPClient.js";
const socket_url = "http://localhost:3000";

let socket;

function joinRoom(roomId) {
    console.log("hi");
    // get room id from input
    if (typeof roomId !== "string") {
        roomId = document.getElementById("room-id").value;
    }
    // save room id to storage
    localStorage.setItem("room_id", roomId);
    // init socket with headers
    socket = io(socket_url, {
        extraHeaders: {
            room: roomId
        }
    });
    socket.on("connect", handleConnect);
    socket.on("disconnect", handleDisconnect);
    socket.on("message", handleMessage);
    socket.on("webrtcurl", createWebRTCConnection);
}

function handleConnect() {
    // hide setup view, show video view
    document.getElementById("setup-view").style.display = "none";
    document.getElementById("video-view").style.display = "block";
    reportScreenWidth();
    requestWebRTCURL();
}

function handleDisconnect() {
    // show setup view, hide video view
    document.getElementById("setup-view").style.display = "flex";
    document.getElementById("video-view").style.display = "none";
    // get room id from storage
    const roomId = localStorage.getItem("room_id");
    self.client = undefined;
    const videoElement = document.getElementById("remote-video");
    videoElement.srcObject = undefined;
}

function requestWebRTCURL() {
    socket.send("request_webrtc_url");
}

function createWebRTCConnection(url) {
    console.log(url);
    const videoElement = document.getElementById("remote-video");
    videoElement.srcObject = undefined;
    self.client = new WHEPClient(url, videoElement, socket, () => {
        createWebRTCConnection(url);
    });
}

function handleMessage(message) {
    switch(message) {
        case "invalid_room":
            alert("Invalid room");
            // remove room id from storage
            localStorage.removeItem("room_id");
            break;
        case "duplicate_connection":
            alert("Duplicate connection");
            // remove room id from storage
            localStorage.removeItem("room_id");
            break;
        case "logout":
            // remove room id from storage
            localStorage.removeItem("room_id");
            location.reload();
            break;

    }


}

// auto connect if room id is saved in storage
/*const roomId = localStorage.getItem("room_id");
if (roomId) {
    joinRoom(roomId);
}*/

// add event listener to "remote-video" element when it starts playing
document.getElementById("remote-video").addEventListener("play", () => {
    console.log("play");
    if (socket !== undefined) {
        socket.emit("update_playing_status", true);
    }
});

document.getElementById("remote-video").addEventListener("pause", () => {
    console.log("pause");
    if (socket !== undefined) {
        socket.emit("update_playing_status", false);
    }
});

// add event listener for when screen width changes
window.addEventListener("resize", reportScreenWidth);

document.getElementById("join-button").addEventListener("click", joinRoom);

function reportScreenWidth() {
    console.log("reporting screen width of " + window.innerWidth);
    // report to socket wheter screen width is equal to 1920px
    const is1920 = window.innerWidth === 1920;
    if (socket !== undefined) {
        socket.emit("update_screen_width", is1920);
    }
}