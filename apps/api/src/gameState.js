const FINISH_INDEX = 29;
const sessions = new Map();

function emptyState() {
  return {
    boardSize: 30,
    turn: "red",
    lastDice: 1,
    winner: null,
    status: "Roll a 6 to enter the board.",
    slots: {
      red: null,
      blue: null
    },
    pieces: {
      red: { position: -1, token: "\u2728" },
      blue: { position: -1, token: "\u2665" }
    }
  };
}

function nextTurn(turn) {
  return turn === "red" ? "blue" : "red";
}

function freshBoard(state) {
  state.turn = "red";
  state.lastDice = 1;
  state.winner = null;
  state.status = "Roll a 6 to enter the board.";
  state.pieces.red.position = -1;
  state.pieces.blue.position = -1;
  return state;
}

export function syncLudoPlayers(chatState) {
  const chatId = chatState.chat.id;
  if (!sessions.has(chatId)) {
    sessions.set(chatId, emptyState());
  }
  const state = sessions.get(chatId);
  state.slots.red = chatState.participants.owner?.id || null;
  state.slots.blue = chatState.participants.partner?.id || null;
  state.pieces.red.token = chatState.participants.owner?.tokenPiece || "\u2728";
  state.pieces.blue.token = chatState.participants.partner?.tokenPiece || "\u2665";
  return state;
}

export function getLudoState(chatState) {
  return syncLudoPlayers(chatState);
}

export function updatePlayerToken(chatState, userId, token) {
  const state = syncLudoPlayers(chatState);
  if (state.slots.red === userId) state.pieces.red.token = token;
  if (state.slots.blue === userId) state.pieces.blue.token = token;
  return state;
}

export function rollLudo(chatState, userId) {
  const state = syncLudoPlayers(chatState);
  const myColor =
    state.slots.red === userId ? "red" : state.slots.blue === userId ? "blue" : null;

  if (!myColor) {
    return { ...state, status: "Only room members can play this match." };
  }
  if (!state.slots.red || !state.slots.blue) {
    return { ...state, status: "Waiting for both players to enter the room." };
  }
  if (state.winner) {
    return { ...state, status: `${state.winner} already won.` };
  }
  if (state.turn !== myColor) {
    return { ...state, status: `It is ${state.turn}'s turn.` };
  }

  const dice = Math.floor(Math.random() * 6) + 1;
  state.lastDice = dice;
  const piece = state.pieces[myColor];
  const opponentColor = nextTurn(myColor);
  const opponentPiece = state.pieces[opponentColor];

  if (piece.position === -1) {
    if (dice === 6) {
      piece.position = 0;
      state.status = `${myColor} entered the board and gets another roll.`;
    } else {
      state.turn = opponentColor;
      state.status = `${myColor} needs a 6 to leave home.`;
    }
    return state;
  }

  const nextPosition = piece.position + dice;
  if (nextPosition > FINISH_INDEX) {
    state.turn = opponentColor;
    state.status = `${myColor} needs an exact roll to finish.`;
    return state;
  }

  piece.position = nextPosition;
  if (piece.position === opponentPiece.position && opponentPiece.position !== FINISH_INDEX) {
    opponentPiece.position = -1;
    state.status = `${myColor} sent ${opponentColor} back home.`;
  } else {
    state.status = `${myColor} moved ${dice} steps.`;
  }

  if (piece.position === FINISH_INDEX) {
    state.winner = myColor;
    state.status = `${myColor} wins the match.`;
    return state;
  }

  if (dice !== 6) {
    state.turn = opponentColor;
  } else {
    state.status = `${myColor} rolled a 6 and keeps the turn.`;
  }

  return state;
}

export function resetLudo(chatState, userId) {
  const state = syncLudoPlayers(chatState);
  const isPlayer = state.slots.red === userId || state.slots.blue === userId;
  if (!isPlayer) {
    return { ...state, status: "Only room members can restart the match." };
  }
  return freshBoard(state);
}
