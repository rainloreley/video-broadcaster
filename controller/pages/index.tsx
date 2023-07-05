import {signIn, signOut, useSession} from "next-auth/react";
import {useEffect, useState} from "react";
import {Socket, io} from "socket.io-client";
import {MaterialSymbol} from "react-material-symbols";
import {set} from "zod";

const socket_url = "http://localhost:3000";

interface Room {
    room_id: string;
    connected: boolean;
    rtcloaded: boolean;
    playing: boolean;
    onprojector: boolean;
    muted: boolean;
}

export default function Home() {
  const {data: session} = useSession();

  const [socketToken, setSocketToken] = useState("");
  const [connected, setConnected] = useState(false);
  const [allRooms, setAllRooms] = useState<Room[]>([]);

  const [socket, setSocket] = useState<Socket | undefined>(undefined);

  const connectToSocket = () => {
      console.log("connect to socket");
      const _socket = io(socket_url, {
          extraHeaders: {
              Authorization: `${socketToken}`
          }
      });
      _socket.on("connect", handleConnect);
      _socket.on("disconnect", handleDisconnect);
      _socket.on("message", handleMessage);
      _socket.on("clients", getClients);
      _socket.on("client_connected", handleClientConnected);
      _socket.on("client_disconnected", handleClientDisconnected);
      _socket.on("client_rtc_toggle", handleClientRTCToggle);
      _socket.on("client_playing_toggle", handleClientPlayingToggle);
      _socket.on("client_projector_change", handleClientProjectorChange);
      _socket.on("client_mute_toggle", handleClientMuteToggle);
      setSocket(_socket);
      /*setSocket((e) => {
          const _socket = io(socket_url, {
              extraHeaders: {
                  Authorization: `${socketToken}`
              }
          });
          _socket.on("connect", handleConnect);
          _socket.on("disconnect", handleDisconnect);
          //_socket.on("message", handleMessage);
          //_socket.on("clients", getClients);
          //_socket.on("client_connected", handleClientConnected);
          //_socket.on("client_disconnected", handleClientDisconnected);
          //_socket.on("client_rtc_toggle", handleClientRTCToggle);
          //_socket.on("client_playing_toggle", handleClientPlayingToggle);
          //_socket.on("client_projector_change", handleClientProjectorChange);
          return _socket;
      });*/

  };

  const handleConnect = () => {
      setConnected(true);
  };

  const handleDisconnect = () => {
      setConnected(false);
  };

  const handleMessage = (message: any) => {
      console.log(message);
  };

  const getClients = (clients: any) => {
      const array: Room[] = JSON.parse(clients);
      setAllRooms(array);
  };

  const handleClientConnected = (client: string) => {
      console.log(client + " connected");
        // update room to connected
          setAllRooms((e) => {
              const newArray = [... e];
              const index = newArray.findIndex((room) => room.room_id === client);
              console.log(index);
              if (index !== -1) {
                  newArray[index].connected = true;
              }
              return newArray;
          });
  }
  const handleClientDisconnected = (client: string) => {
      console.log(client + " disconnected");
        // update room to disconnected
      setAllRooms((e) => {
          const newArray = [... e];
          const index = newArray.findIndex((room) => room.room_id === client);
          console.log(index);
          if (index !== -1) {
              newArray[index].connected = false;
              newArray[index].rtcloaded = false;
              newArray[index].playing = false;
              newArray[index].onprojector = false;
          }
          return newArray;
      });
  }

  const handleClientRTCToggle = (message: any) => {
      const data = JSON.parse(message) as {room: string, rtcloaded: boolean};
        // update room to playing
        setAllRooms((e) => {
            const newArray = [... e];
            const index = newArray.findIndex((room) => room.room_id === data.room);
            console.log(index);
            if (index !== -1) {
                newArray[index].rtcloaded = data.rtcloaded;
            }
            return newArray;
        });
  }

  const handleClientPlayingToggle = (message: any) => {
        const data = JSON.parse(message) as {room: string, playing: boolean};
            // update room to playing
            setAllRooms((e) => {
                const newArray = [... e];
                const index = newArray.findIndex((room) => room.room_id === data.room);
                console.log(index);
                if (index !== -1) {
                    newArray[index].playing = data.playing;
                }
                return newArray;
            });
  };

  const handleClientProjectorChange = (message: any) => {
    const data = JSON.parse(message) as {room: string, onprojector: boolean};
    console.log(data.onprojector);
        // update room to playing
        setAllRooms((e) => {
            const newArray = [... e];
            const index = newArray.findIndex((room) => room.room_id === data.room);
            console.log(index);
            if (index !== -1) {
                newArray[index].onprojector = data.onprojector;
            }
            return newArray;
        });
  }

  const handleClientMuteToggle = (message: any) => {
    const data = JSON.parse(message) as {room: string, muted: boolean};
        // update room to playing
        setAllRooms((e) => {
            const newArray = [... e];
            const index = newArray.findIndex((room) => room.room_id === data.room);
            console.log(index);
            if (index !== -1) {
                newArray[index].muted = data.muted;
            }
            return newArray;
        });
  }

  const logoutRoom = (room: string) => {
      socket!.emit("streamer_message", "logout_" + room);
  }

  const muteToggleRoom = (room: string, muted: boolean) => {
      socket?.emit("streamer_message", "mute_" + muted + "_" + room);
  }

  if (!session) {
    return (
        <div className={"w-full dark:bg-gray-900 h-full flex justify-center items-center"}>
          <button className={"px-10 py-3 rounded-lg bg-gray-100 dark:bg-gray-800 shadow-2xl border-2 dark:border-gray-600 text-3xl font-semibold"} onClick={() => {signIn("authentik")}}>Sign In</button>
        </div>
    )
  }

  if (!connected) {
    return (
        <div className={"flex flex-col items-center m-8 dark:text-white"}>
            <h1>Token eingeben</h1>
            <input className={"px-2 py-1 bg-gray-200 dark:bg-gray-600 rounded-md mt-2"} placeholder={"Token"} value={socketToken} onChange={(e) => {
                setSocketToken(e.target.value);
            }} />
            <button className={"mt-2 bg-blue-500 rounded-md px-4 py-2 text-white"} onClick={() => connectToSocket()}>Anmelden</button>
        </div>
    )
  }

  return (
  <main>
    <div className={"m-8 grid lg:grid-cols-4 md:grid-cols-3 xm:grid-cols-1 gap-4 dark:text-white"}>
        {allRooms.map((room) => (
            <div key={room.room_id} className={`${room.connected ? "justify-between" : ""} items-center p-4 bg-gray-200 dark:bg-gray-800 rounded-md`}>
                <h1 className={"font-semibold text-lg mb-1"}>Raum {room.room_id}</h1>
                <div className={"flex items-center justify-between"}>
                    <div className={"flex items-center"}>
                        <div className={`w-4 h-4 rounded-full ${room.connected ? "bg-green-500" : "bg-red-500"} mr-2`} />
                        <MaterialSymbol icon={`${room.rtcloaded ? "sensors" : "sensors_off"}`} size={25} color={`${room.rtcloaded ? "green" : "red"}`} className={"ml-0.5"} />
                        <MaterialSymbol icon={`${room.playing ? "play_arrow": "play_disabled"}`} size={25} color={`${room.playing ? "green" : "red"}`} className={"ml-0.5"} />
                        <MaterialSymbol icon={"connected_tv"} size={25} color={`${room.onprojector ? "green" : "red"}`} className={"ml-0.5"} />
                        {room.connected ? (
                            <button className={"w-[25px] h-[25px]"} onClick={() => {
                                muteToggleRoom(room.room_id, !room.muted);
                            }}><MaterialSymbol icon={`${room.muted ? "volume_off" : "volume_up"}`} size={25} color={`${room.muted ? "red" : "green"}`} className={"ml-0.5"} />
                            </button>
                        ) : (<div />)}
                    </div>
                    {room.connected ? (
                        <button className={"w-[20px] h-[20px]"} onClick={() => {
                            logoutRoom(room.room_id);
                        }}><MaterialSymbol icon={"logout"} size={20} color={"red"} /></button>
                    ) : (
                        <div />)}
                </div>
            </div>
        ))}
    </div>
  </main>
  )
}
