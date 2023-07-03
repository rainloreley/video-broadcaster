import express from "express";
import http from "http";
import { Server, Socket } from "socket.io";
import {createHash} from "crypto";

// setup dotenv
import dotenv from "dotenv";
dotenv.config();

const roomIds = ["004", "006", "007", "101", "102", "103", "107", "108", "109", "110", "111", "208", "209", "210", "211", "213", "214", "215", "301", "303", "304", "306", "307", "308", "309", "310", "311", "401", "402", "501", "503", "504", "505", "506", "507", "603", "604", "612", "F01", "F02", "F03", "F04"];

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST", "OPTIONS"],
        allowedHeaders: ["authorization", "room"],
    }
});

let connectedUsers: ConnectedUser[] = [];

let connectedStreamComputer: Socket | undefined;

io.on("connection", (socket) => {

    // only check room key when no auth is provided
    if (typeof socket.handshake.headers.authorization !== "string") {

        // check key "room" in header
        const room = socket.handshake.headers.room as string | undefined
        if (room === undefined || !roomIds.includes(room)) {
            console.log("Room " + room + " rejected");
            socket.send("invalid_room");
            socket.disconnect();
            return;
        }
        // check if room is already connected
        else if (connectedUsers.find((user) => user.room === room) !== undefined) {
            // disconnect already existing socket
            console.log("Room " + room + " already connected");
            const socketToDisconnect = connectedUsers.find((user) => user.room === room)?.socket;
            socketToDisconnect?.send("duplicate_connection");
            socketToDisconnect?.disconnect();
            // remove user from connectedUsers
            connectedUsers = connectedUsers.filter((user) => user.socket.id !== socketToDisconnect?.id);
            // add new socket to connectedUsers
            connectedUsers.push({socket: socket, room: room, rtcloaded: false, playing: false, onprojector: false});
            if (connectedStreamComputer) {
                connectedStreamComputer?.emit("client_connected", room);
            }
        }
        else {
            console.log("Room " + room + " connected");
            connectedUsers.push({socket: socket, room: room, rtcloaded: false, playing: false, onprojector: false});
            if (connectedStreamComputer !== undefined) {
                connectedStreamComputer.emit("client_connected", room);
            }
        }
    }
    else {
        const tokenValid = isSenderComputer(socket.handshake.headers.authorization);
        if (!tokenValid) {
            console.log("Invalid token");
            socket.send("invalid_token");
            socket.disconnect();
            return;
        }
        else {
            // check if stream computer is already connected
            if (connectedStreamComputer != undefined) {
                connectedStreamComputer.disconnect();
            }
            // set stream computer
            connectedStreamComputer = socket;
            // send room ids and whether they're connected
            const rooms: Room[] = roomIds.map((id) => {
                return {room_id: id, connected: connectedUsers.find((user) => user.room === id) !== undefined,
                    playing: connectedUsers.find((user) => user.room === id)?.playing ?? false,
                    rtcloaded: connectedUsers.find((user) => user.room === id)?.rtcloaded ?? false,
                    onprojector: connectedUsers.find((user) => user.room === id)?.onprojector ?? false};
            });
            connectedStreamComputer.emit("clients", JSON.stringify(rooms));
            console.log("Stream computer connected");
        }
    }

    socket.on("streamer_message", (message) => {
        // check if socket id matches streamer id
        if (socket.id === connectedStreamComputer?.id) {
            const splittedMessage = message.split("_");
            const verb = splittedMessage[0];
            switch (verb) {
                case "logout":
                    const room = splittedMessage[1];
                    if (typeof room !== "string") break;
                    // find connected room with id
                    const connectedRoom = connectedUsers.find((user) => user.room === room);
                    // send logout message to connected room
                    connectedRoom?.socket.send("logout");
                    // disconnect room
                    connectedRoom?.socket.disconnect();
                    // remove room from connectedUsers
                    connectedUsers = connectedUsers.filter((user) => user.room !== room);
                    break;

            }
        }
        else {
            return;
        }

    });

    // handle rtc status update
    socket.on("update_rtc_status", (message: boolean) => {
        // update "playing" variable for the user that sent that message
        const user = connectedUsers.find((user) => user.socket.id === socket.id);
        if (user) {
            user.rtcloaded = message;
            if (connectedStreamComputer) {
                connectedStreamComputer?.emit("client_rtc_toggle", JSON.stringify({room: user.room, rtcloaded: message}));
            }
        }

    });

    // handle playing status update
    socket.on("update_playing_status", (message: boolean) => {
        // update "playing" variable for the user that sent that message
        const user = connectedUsers.find((user) => user.socket.id === socket.id);
        if (user) {
            user.playing = message;
            if (connectedStreamComputer) {
                connectedStreamComputer?.emit("client_playing_toggle", JSON.stringify({room: user.room, playing: message}));
            }
        }
    });

    //handle client screen width change (for projector)
    socket.on("update_screen_width", (isProjectorWidth: boolean) => {
        // update "onprojector" variable for the user that sent that message
        const user = connectedUsers.find((user) => user.socket.id === socket.id);
        if (user) {
            user.onprojector = isProjectorWidth;
            if (connectedStreamComputer) {
                connectedStreamComputer?.emit("client_projector_change", JSON.stringify({room: user.room, onprojector: isProjectorWidth}));
            }
        }
    });

    socket.on("message", (message) => {
       if (message == "request_webrtc_url") {
           // get url from env
           const whep = process.env.WEBRTC_WHEP
           socket.emit("webrtcurl", whep);
       }
    });

    socket.on("disconnect", () => {
        // check if socket is stream computer
        if (connectedStreamComputer?.id === socket.id) {
            connectedStreamComputer = undefined;
            console.log("Stream computer disconnected");
            return;
        }
        else {
            // get room id
            const room = connectedUsers.find((user) => user.socket.id === socket.id)?.room;
            console.log(`Room ${room} disconnected`);
            // remove user from connectedUsers
            connectedUsers = connectedUsers.filter((user) => user.socket.id !== socket.id);
            // notify stream computer if connected
            if (connectedStreamComputer) {
                connectedStreamComputer?.emit("client_disconnected", room);
            }
        }
    });
});

server.listen(3000, () => {
    console.log("listening on *:3000");
});

const isSenderComputer = (key: string): boolean => {
    const hash = createHash("sha256").update(key).digest("hex");
    return hash === process.env.SOCKET_AUTHUSER_PASS;
};
// Room struct, used for stream computer to send information about rooms
interface Room {
    room_id: string;
    connected: boolean;
    rtcloaded: boolean;
    playing: boolean;
    onprojector: boolean;
}

// Connected User struct to keep track of connected users
interface ConnectedUser {
    socket: Socket;
    room: string;
    rtcloaded: boolean;
    playing: boolean;
    onprojector: boolean;
}