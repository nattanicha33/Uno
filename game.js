/* ==========================================================
   COLOR CLASH PARTY - Game Logic
   Rewritten to match the actual element IDs/classes in index.html
   ========================================================== */

const COLORS = ["red", "yellow", "green", "blue"];
const COLOR_NAMES = { red: "แดง", yellow: "เหลือง", green: "เขียว", blue: "น้ำเงิน" };
const ACTIONS = ["skip", "reverse", "draw2"];
const BOT_NAMES = ["Nova", "Max", "Luna"];

let state = {
  playerName: "คุณ",
  players: [],
  deck: [],
  discard: [],
  turn: 0,
  direction: 1,
  currentColor: "red",
  pendingDraw: 0,
  unoCalled: false,
  busy: false,
  sound: true
};

const $ = (s) => document.querySelector(s);
const $$ = (s) => document.querySelectorAll(s);

const SCORE_IDS = ["playerScore", "bot1Score", "bot2Score", "bot3Score"];
const CARD_COUNT_IDS = [null, "bot1Cards", "bot2Cards", "bot3Cards"];

const SCREENS = ["menuScreen", "howScreen", "gameScreen"];
function showScreen(id) {
  SCREENS.forEach((x) => $("#" + x).classList.toggle("active", x === id));
}

/* ---------- deck ---------- */

function makeDeck() {
  const deck = [];
  for (const color of COLORS) {
    deck.push({ color, value: "0" });
    for (let n = 1; n <= 9; n++) {
      deck.push({ color, value: String(n) });
      deck.push({ color, value: String(n) });
    }
    for (const a of ACTIONS) {
      deck.push({ color, value: a });
      deck.push({ color, value: a });
    }
  }
  for (let i = 0; i < 4; i++) {
    deck.push({ color: "wild", value: "wild" });
    deck.push({ color: "wild", value: "wild4" });
  }
  return shuffle(deck);
}

function shuffle(a) {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function cardLabel(c) {
  return { skip: "⊘", reverse: "↻", draw2: "+2", wild: "W", wild4: "+4" }[c.value] ?? c.value;
}

function topCard() {
  return state.discard[state.discard.length - 1];
}

function cardPlayable(c) {
  if (state.pendingDraw > 0) return c.value === "draw2" || c.value === "wild4";
  return c.color === "wild" || c.color === state.currentColor || c.value === topCard().value;
}

/* ---------- setup / round ---------- */

function deal() {
  state.deck = makeDeck();
  state.discard = [];
  state.turn = 0;
  state.direction = 1;
  state.pendingDraw = 0;
  state.unoCalled = false;
  state.busy = false;

  const prevScores = state.players.length
    ? state.players.map((p) => p.score || 0)
    : [0, 0, 0, 0];

  state.players = [
    { name: state.playerName, avatar: "👤", hand: [], human: true, score: prevScores[0] || 0 },
    { name: BOT_NAMES[0], avatar: "🤖", hand: [], human: false, score: prevScores[1] || 0 },
    { name: BOT_NAMES[1], avatar: "🤖", hand: [], human: false, score: prevScores[2] || 0 },
    { name: BOT_NAMES[2], avatar: "🤖", hand: [], human: false, score: prevScores[3] || 0 }
  ];

  for (let r = 0; r < 7; r++) {
    for (const p of state.players) p.hand.push(state.deck.pop());
  }

  let first = state.deck.pop();
  while (first.color === "wild") {
    state.deck.unshift(first);
    first = state.deck.pop();
  }
  state.discard.push(first);
  state.currentColor = first.color;
  if (first.value === "draw2") state.pendingDraw = 2;
  if (first.value === "skip") advanceTurn();

  render();
  setMessage("เกมเริ่มแล้ว — ถึงตาคุณ เลือกการ์ดที่ลงได้");

  if (!state.players[state.turn].human) setTimeout(botTurn, 650);
}

function advanceTurn() {
  state.turn = (state.turn + state.direction + state.players.length) % state.players.length;
}

function nextTurn() {
  advanceTurn();
  dispatchTurn();
}

function dispatchTurn() {
  render();
  if (!state.players[state.turn].human) {
    setTimeout(botTurn, 650);
  } else {
    state.busy = false;
    setMessage("ถึงตาคุณ — เลือกการ์ดที่ลงได้");
  }
}

/* ---------- playing cards ---------- */

function playCard(playerIndex, cardIndex, chosenColor = null) {
  const p = state.players[playerIndex];
  const c = p.hand[cardIndex];
  if (!c || !cardPlayable(c) || state.busy) return false;

  p.hand.splice(cardIndex, 1);
  state.discard.push(c);

  if (c.color !== "wild") state.currentColor = c.color;
  if (chosenColor) state.currentColor = chosenColor;

  if (c.value === "draw2") state.pendingDraw += 2;
  else if (c.value === "wild4") state.pendingDraw += 4;
  if (c.value === "reverse") state.direction *= -1;
  const skipExtra = c.value === "skip";

  if (p.hand.length !== 1) state.unoCalled = false;
  else if (!p.human) state.unoCalled = true; // bots always "call" uno for themselves

  if (p.hand.length === 0) {
    endRound(playerIndex);
    return true;
  }

  if (playerIndex === state.turn) {
    advanceTurn();
    if (skipExtra) advanceTurn(); // skip: move one extra player
    dispatchTurn();
  } else {
    render();
  }
  return true;
}

function drawFor(playerIndex) {
  if (state.busy) return;
  const p = state.players[playerIndex];
  const amount = state.pendingDraw > 0 ? state.pendingDraw : 1;
  for (let i = 0; i < amount; i++) p.hand.push(drawOne());
  state.pendingDraw = 0;
  render();
  if (playerIndex === state.turn) nextTurn();
}

function drawOne() {
  if (state.deck.length === 0) {
    const keep = state.discard.pop();
    state.deck = shuffle(state.discard);
    state.discard = [keep];
  }
  return state.deck.pop();
}

/* ---------- bot AI ---------- */

function botTurn() {
  if (state.players[state.turn].human || state.busy) return;
  state.busy = true;
  const p = state.players[state.turn];
  setMessage(`${p.name} กำลังคิด...`);
  render();

  setTimeout(() => {
    const playable = p.hand
      .map((c, i) => ({ c, i }))
      .filter((x) => cardPlayable(x.c));

    if (playable.length) {
      playable.sort((a, b) => {
        const wa = ["wild4", "draw2", "skip", "reverse"].includes(a.c.value) ? 2 : 0;
        const wb = ["wild4", "draw2", "skip", "reverse"].includes(b.c.value) ? 2 : 0;
        return wb - wa;
      });
      const pick = playable[0];
      const chosen = pick.c.color === "wild" ? bestColorFor(p) : null;
      state.busy = false;
      playCard(state.turn, pick.i, chosen);
    } else {
      state.busy = false;
      drawFor(state.turn);
    }
  }, 700);
}

function bestColorFor(p) {
  const counts = { red: 0, yellow: 0, green: 0, blue: 0 };
  p.hand.forEach((c) => {
    if (counts[c.color] !== undefined) counts[c.color]++;
  });
  return COLORS.reduce((a, b) => (counts[b] > counts[a] ? b : a), COLORS[0]);
}

/* ---------- round end ---------- */

function cardPoints(c) {
  if (["wild", "wild4"].includes(c.value)) return 50;
  if (["draw2", "reverse", "skip"].includes(c.value)) return 20;
  return Number(c.value);
}

function endRound(winnerIndex) {
  const winner = state.players[winnerIndex];
  const points = state.players.reduce(
    (sum, p) => sum + p.hand.reduce((s, c) => s + cardPoints(c), 0),
    0
  );
  winner.score += points;
  state.busy = true;
  render();

  $("#resultIcon").textContent = winner.human ? "🏆" : "🤖";
  $("#resultTitle").textContent = winner.human ? "คุณชนะ!" : "รอบนี้ " + winner.name + " ชนะ";
  $("#resultText").textContent = winner.human
    ? `เก็บคะแนนเพิ่ม ${points} คะแนน`
    : `ลองอีกครั้งเพื่อเอาคืน ${winner.name}!`;
  $("#finalScore").textContent = state.players[0].score;

  if (winner.human) localStorage.setItem("cc_score", state.players[0].score);

  setTimeout(() => $("#resultModal").classList.remove("hidden"), 400);
}

/* ---------- rendering ---------- */

function render() {
  $("#playerNameDisplay").textContent = state.playerName;
  $("#turnStatus").textContent = state.players[state.turn]?.human
    ? "ถึงตาคุณ"
    : `ตาของ ${state.players[state.turn]?.name || ""}`;

  state.players.forEach((p, i) => {
    const scoreEl = $("#" + SCORE_IDS[i]);
    if (scoreEl) scoreEl.textContent = p.score;
    if (i > 0) {
      const countEl = $("#" + CARD_COUNT_IDS[i]);
      if (countEl) countEl.textContent = p.hand.length + " ใบ";
    }
  });

  $("#deckCount").textContent = state.deck.length;

  renderDiscard();
  renderHand();
}

function renderDiscard() {
  const slot = $("#discardPile");
  slot.innerHTML = "";
  if (!state.discard.length) return;
  slot.appendChild(cardElement(topCard()));

  const colorSpan = $("#currentColor span");
  if (colorSpan) {
    colorSpan.textContent = COLOR_NAMES[state.currentColor];
    colorSpan.style.background = colorSwatch(state.currentColor);
  }
}

function colorSwatch(color) {
  return { red: "#e52335", yellow: "#f4cf22", green: "#28a64a", blue: "#2477df" }[color] || "#fff";
}

function renderHand() {
  const wrap = $("#playerHand");
  wrap.innerHTML = "";
  const hand = state.players[0]?.hand || [];
  hand.forEach((c, i) => {
    const el = cardElement(c);
    if (!cardPlayable(c) || state.turn !== 0 || state.busy) el.classList.add("disabled");
    el.addEventListener("click", () => handlePlayerCard(i));
    wrap.appendChild(el);
  });
}

function cardElement(c) {
  const el = document.createElement("div");
  el.className = `card ${c.color === "wild" ? "wild" : c.color}`;
  const oval = document.createElement("div");
  oval.className = "oval";
  oval.textContent = cardLabel(c);
  el.appendChild(oval);
  const a = document.createElement("small");
  a.textContent = cardLabel(c);
  el.appendChild(a);
  const b = document.createElement("small");
  b.textContent = cardLabel(c);
  el.appendChild(b);
  return el;
}

function setMessage(t) {
  $("#gameMessage").textContent = t;
}

/* ---------- player interaction ---------- */

function handlePlayerCard(i) {
  if (state.turn !== 0 || state.busy) return;
  const c = state.players[0].hand[i];
  if (!cardPlayable(c)) {
    setMessage("ลงใบนี้ไม่ได้ ลองเลือกสีหรือเลขให้ตรงกัน");
    return;
  }
  if (c.color === "wild") {
    state.busy = true;
    $("#colorModal").classList.remove("hidden");
    $("#colorModal").dataset.index = i;
  } else {
    playCard(0, i);
  }
}

/* ---------- draw pile ---------- */

$("#drawPile").addEventListener("click", () => {
  if (state.turn !== 0 || state.busy) return;
  drawFor(0);
});

/* ---------- uno button ---------- */

$("#unoButton").addEventListener("click", () => {
  if (state.players[0].hand.length === 1) {
    state.unoCalled = true;
    setMessage("คุณกด UNO! แล้ว");
  } else {
    setMessage("กด UNO! ได้ตอนเหลือการ์ดใบเดียวเท่านั้น");
  }
});

/* ---------- color modal ---------- */

$$(".color-choice").forEach((btn) => {
  btn.addEventListener("click", () => {
    const color = btn.dataset.color;
    const index = Number($("#colorModal").dataset.index);
    $("#colorModal").classList.add("hidden");
    state.busy = false;
    playCard(0, index, color);
  });
});

/* ---------- menu / navigation buttons ---------- */

function startGame() {
  const nameInput = $("#playerName");
  state.playerName = nameInput.value.trim() || "คุณ";
  showScreen("gameScreen");
  deal();
}

$("#startButton").addEventListener("click", startGame);
$("#howStartButton").addEventListener("click", startGame);

$("#howButton").addEventListener("click", () => {
  showScreen("howScreen");
});

$("#backMenuButton").addEventListener("click", () => {
  showScreen("menuScreen");
});

$("#restartButton").addEventListener("click", () => {
  deal();
});

$("#menuButton").addEventListener("click", () => {
  showScreen("menuScreen");
});

$("#playAgainButton").addEventListener("click", () => {
  $("#resultModal").classList.add("hidden");
  deal();
});

$("#resultMenuButton").addEventListener("click", () => {
  $("#resultModal").classList.add("hidden");
  showScreen("menuScreen");
});

