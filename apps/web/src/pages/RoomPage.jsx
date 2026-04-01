import {
  Copy,
  Crown,
  Dice6,
  DoorOpen,
  RefreshCcw,
  Sparkles,
  Swords,
  Users
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
  createRoom,
  getRoom,
  joinRoom,
  resetRoomGame,
  rollRoomGame,
  setRoomToken
} from "../services/api.js";
import { useChatStore } from "../store/chatStore.js";

const tokenChoices = ["✨", "♥", "♟", "♞", "★", "⚽"];

function StatusPill({ online, label }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${
        online ? "bg-emerald-100 text-emerald-800" : "bg-slate-200 text-slate-700"
      }`}
    >
      {label}
    </span>
  );
}

function PlayerCard({ title, user, active, me, onTokenChange }) {
  return (
    <div className={`rounded-3xl border p-4 shadow-sm ${active ? "border-rose-300 bg-rose-50/80" : "border-border-soft bg-white/60"}`}>
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-2xl shadow-sm">
            {user?.tokenPiece || "•"}
          </div>
          <div>
            <p className="text-sm font-semibold text-text-main">{user?.name || "Waiting for player"}</p>
            <p className="text-xs text-text-muted">{title}</p>
          </div>
        </div>
        <StatusPill online={Boolean(user?.isOnline)} label={user ? (user.isOnline ? "online" : "offline") : "empty"} />
      </div>

      {me && user ? (
        <div className="mt-4 flex flex-wrap gap-2">
          {tokenChoices.map((token) => (
            <button
              key={token}
              type="button"
              onClick={() => onTokenChange(token)}
              className={`flex h-10 w-10 items-center justify-center rounded-2xl border text-lg ${
                token === user.tokenPiece ? "border-rose-400 bg-rose-100" : "border-border-soft bg-white"
              }`}
            >
              {token}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function BoardCell({ index, game }) {
  const redHere = game?.pieces?.red?.position === index;
  const blueHere = game?.pieces?.blue?.position === index;

  return (
    <div className="relative flex aspect-square min-h-14 items-center justify-center rounded-2xl border border-border-soft bg-white/75 text-sm font-semibold text-text-main shadow-sm">
      <span className="absolute left-2 top-2 text-[10px] font-medium text-text-muted">{index}</span>
      <div className="flex items-center gap-1 text-xl">
        {redHere ? <span>{game?.pieces?.red?.token || "✨"}</span> : null}
        {blueHere ? <span>{game?.pieces?.blue?.token || "♥"}</span> : null}
        {!redHere && !blueHere ? <span className="text-slate-300">·</span> : null}
      </div>
    </div>
  );
}

export default function RoomPage() {
  const { currentUser, roomState, setRoomState, socketSend, socketState } = useChatStore();
  const [roomName, setRoomName] = useState("Private game room");
  const [inviteCodeInput, setInviteCodeInput] = useState("");
  const [pageError, setPageError] = useState("");
  const [busyAction, setBusyAction] = useState("");

  const game = roomState?.game || null;
  const myRole = roomState?.participants?.owner?.id === currentUser?.id ? "owner" : roomState?.participants?.partner?.id === currentUser?.id ? "partner" : "guest";
  const canPlay = myRole === "owner" || myRole === "partner";
  const board = useMemo(() => Array.from({ length: game?.boardSize || 30 }, (_, index) => index), [game?.boardSize]);

  useEffect(() => {
    if (!roomState?.chat?.id || socketState !== "connected") return;
    socketSend({
      type: "room:join",
      chatId: roomState.chat.id
    });
  }, [roomState?.chat?.id, socketSend, socketState]);

  async function syncRoom(chatId) {
    const nextRoom = await getRoom(chatId);
    setRoomState(nextRoom);
    setPageError("");
    return nextRoom;
  }

  async function handleCreateRoom() {
    try {
      setBusyAction("create");
      const nextRoom = await createRoom(roomName);
      await syncRoom(nextRoom.chat.id);
      setPageError("");
    } catch (error) {
      setPageError("Room creation failed. You may already own a room.");
    } finally {
      setBusyAction("");
    }
  }

  async function handleJoinRoom() {
    try {
      setBusyAction("join");
      const nextRoom = await joinRoom(inviteCodeInput.trim().toUpperCase());
      await syncRoom(nextRoom.chat.id);
      setInviteCodeInput("");
    } catch (error) {
      setPageError("Join failed. Check the invite code or whether the room is already full.");
    } finally {
      setBusyAction("");
    }
  }

  async function handleTokenChange(token) {
    if (!roomState?.chat?.id) return;
    try {
      setBusyAction("token");
      const response = await setRoomToken(roomState.chat.id, token);
      setRoomState((prev) => (prev ? { ...prev, game: response.game } : prev));
      await syncRoom(roomState.chat.id);
    } catch {
      setPageError("Could not update your token piece.");
    } finally {
      setBusyAction("");
    }
  }

  async function handleGameAction(type) {
    if (!roomState?.chat?.id) return;
    try {
      setBusyAction(type);
      if (socketState === "connected") {
        await new Promise((resolve, reject) => {
          socketSend({
            type,
            chatId: roomState.chat.id,
            onResult(result) {
              if (result?.status === "error") {
                reject(new Error(result.error));
                return;
              }
              if (result?.game) {
                setRoomState((prev) => (prev ? { ...prev, game: result.game } : prev));
              }
              resolve(result);
            }
          });
        });
      } else if (type === "game:roll") {
        const response = await rollRoomGame(roomState.chat.id);
        setRoomState((prev) => (prev ? { ...prev, game: response.game } : prev));
      } else {
        const response = await resetRoomGame(roomState.chat.id);
        setRoomState((prev) => (prev ? { ...prev, game: response.game } : prev));
      }
      setPageError("");
    } catch (error) {
      setPageError(error.message || "Game action failed.");
    } finally {
      setBusyAction("");
    }
  }

  async function handleRefresh() {
    if (!roomState?.chat?.id) return;
    try {
      setBusyAction("refresh");
      await syncRoom(roomState.chat.id);
    } catch {
      setPageError("Room refresh failed.");
    } finally {
      setBusyAction("");
    }
  }

  async function handleCopyInvite() {
    if (!roomState?.inviteCode) return;
    try {
      await navigator.clipboard.writeText(roomState.inviteCode);
    } catch {
      setPageError("Could not copy invite code.");
    }
  }

  return (
    <section className="flex min-h-0 flex-1 flex-col bg-panel">
      <header className="border-b border-border-soft px-6 py-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold">Game Rooms</h2>
            <p className="text-sm text-text-muted">Create a private room, share the invite code, and play the live match together.</p>
          </div>
          <StatusPill online={socketState === "connected"} label={socketState} />
        </div>
      </header>

      <div className="flex-1 overflow-y-auto p-6">
        <div className="mx-auto grid max-w-6xl gap-6 xl:grid-cols-[360px_minmax(0,1fr)]">
          <div className="space-y-4">
            <div className="glass-surface rounded-3xl border border-border-soft p-5 shadow-sm">
              <div className="flex items-center gap-3">
                <Sparkles className="h-5 w-5 text-accent" />
                <div>
                  <p className="font-semibold">Create room</p>
                  <p className="text-sm text-text-muted">Open a room that another player can join with your code.</p>
                </div>
              </div>
              <input
                value={roomName}
                onChange={(event) => setRoomName(event.target.value)}
                className="mt-4 w-full rounded-2xl border border-border-soft bg-white px-4 py-3 text-sm outline-none"
                placeholder="Private game room"
              />
              <button
                type="button"
                onClick={handleCreateRoom}
                disabled={busyAction === "create"}
                className="mt-4 inline-flex w-full items-center justify-center rounded-2xl bg-accent px-4 py-3 text-sm font-semibold text-white disabled:opacity-60"
              >
                {busyAction === "create" ? "Creating..." : "Create room"}
              </button>
            </div>

            <div className="glass-surface rounded-3xl border border-border-soft p-5 shadow-sm">
              <div className="flex items-center gap-3">
                <DoorOpen className="h-5 w-5 text-accent" />
                <div>
                  <p className="font-semibold">Join room</p>
                  <p className="text-sm text-text-muted">Enter another player's invite code to connect to their room.</p>
                </div>
              </div>
              <input
                value={inviteCodeInput}
                onChange={(event) => setInviteCodeInput(event.target.value.toUpperCase())}
                className="mt-4 w-full rounded-2xl border border-border-soft bg-white px-4 py-3 text-sm uppercase tracking-[0.3em] outline-none"
                placeholder="AB12CD34"
              />
              <button
                type="button"
                onClick={handleJoinRoom}
                disabled={busyAction === "join"}
                className="mt-4 inline-flex w-full items-center justify-center rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white disabled:opacity-60"
              >
                {busyAction === "join" ? "Joining..." : "Join room"}
              </button>
            </div>

            {pageError ? (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-800">
                {pageError}
              </div>
            ) : null}
          </div>

          <div className="space-y-6">
            {roomState?.chat ? (
              <>
                <div className="glass-surface rounded-3xl border border-border-soft p-5 shadow-sm">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <p className="text-sm font-medium text-text-muted">Current room</p>
                      <h3 className="mt-1 text-2xl font-semibold text-text-main">{roomState.chat.title || "Private room"}</h3>
                      <p className="mt-2 text-sm text-text-muted">Share this code so the second player joins the same room.</p>
                    </div>
                    <div className="flex gap-2">
                      <button type="button" onClick={handleCopyInvite} className="inline-flex items-center gap-2 rounded-2xl border border-border-soft bg-white px-4 py-2 text-sm font-semibold">
                        <Copy className="h-4 w-4" />
                        {roomState.inviteCode}
                      </button>
                      <button type="button" onClick={handleRefresh} className="inline-flex items-center gap-2 rounded-2xl border border-border-soft bg-white px-4 py-2 text-sm font-semibold">
                        <RefreshCcw className={`h-4 w-4 ${busyAction === "refresh" ? "animate-spin" : ""}`} />
                        Refresh
                      </button>
                    </div>
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <PlayerCard
                    title="Red player"
                    user={roomState.participants?.owner}
                    active={game?.turn === "red"}
                    me={roomState.participants?.owner?.id === currentUser?.id}
                    onTokenChange={handleTokenChange}
                  />
                  <PlayerCard
                    title="Blue player"
                    user={roomState.participants?.partner}
                    active={game?.turn === "blue"}
                    me={roomState.participants?.partner?.id === currentUser?.id}
                    onTokenChange={handleTokenChange}
                  />
                </div>

                <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_300px]">
                  <div className="glass-surface rounded-3xl border border-border-soft p-5 shadow-sm">
                    <div className="flex items-center gap-3">
                      <Swords className="h-5 w-5 text-accent" />
                      <div>
                        <p className="font-semibold">Live board</p>
                        <p className="text-sm text-text-muted">{game?.status || "Create or join a room to start."}</p>
                      </div>
                    </div>
                    <div className="mt-5 grid grid-cols-5 gap-3 sm:grid-cols-6">
                      {board.map((index) => (
                        <BoardCell key={index} index={index} game={game} />
                      ))}
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="glass-surface rounded-3xl border border-border-soft p-5 shadow-sm">
                      <div className="flex items-center gap-3">
                        <Dice6 className="h-5 w-5 text-accent" />
                        <div>
                          <p className="font-semibold">Match controls</p>
                          <p className="text-sm text-text-muted">Only room members can roll and reset.</p>
                        </div>
                      </div>

                      <div className="mt-4 grid grid-cols-2 gap-3">
                        <div className="rounded-2xl bg-white px-4 py-3 text-center">
                          <p className="text-xs font-medium text-text-muted">Last dice</p>
                          <p className="mt-1 text-3xl font-semibold text-text-main">{game?.lastDice ?? "-"}</p>
                        </div>
                        <div className="rounded-2xl bg-white px-4 py-3 text-center">
                          <p className="text-xs font-medium text-text-muted">Turn</p>
                          <p className="mt-1 text-lg font-semibold capitalize text-text-main">{game?.turn || "-"}</p>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleGameAction("game:roll")}
                        disabled={!canPlay || busyAction === "game:roll"}
                        className="mt-4 inline-flex w-full items-center justify-center rounded-2xl bg-accent px-4 py-3 text-sm font-semibold text-white disabled:opacity-60"
                      >
                        {busyAction === "game:roll" ? "Rolling..." : "Roll dice"}
                      </button>

                      <button
                        type="button"
                        onClick={() => handleGameAction("game:reset")}
                        disabled={!canPlay || busyAction === "game:reset"}
                        className="mt-3 inline-flex w-full items-center justify-center rounded-2xl border border-border-soft bg-white px-4 py-3 text-sm font-semibold text-text-main disabled:opacity-60"
                      >
                        {busyAction === "game:reset" ? "Resetting..." : "Reset match"}
                      </button>
                    </div>

                    <div className="glass-surface rounded-3xl border border-border-soft p-5 shadow-sm">
                      <div className="flex items-center gap-3">
                        <Users className="h-5 w-5 text-accent" />
                        <div>
                          <p className="font-semibold">Room rules</p>
                          <p className="text-sm text-text-muted">Two players max. A second player must join before the match can fully start.</p>
                        </div>
                      </div>
                      {game?.winner ? (
                        <div className="mt-4 inline-flex items-center gap-2 rounded-2xl bg-emerald-100 px-3 py-2 text-sm font-semibold text-emerald-800">
                          <Crown className="h-4 w-4" />
                          Winner: {game.winner}
                        </div>
                      ) : null}
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <div className="glass-surface rounded-3xl border border-border-soft p-10 text-center shadow-sm">
                <p className="text-lg font-semibold text-text-main">No active room yet</p>
                <p className="mt-2 text-sm text-text-muted">Create a room from the left panel or join an existing one with an invite code.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
