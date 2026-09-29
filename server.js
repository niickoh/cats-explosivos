const express = require("express");
const http = require("http");
const os = require("os");
const fs = require("fs");
const path = require("path");
const { Server } = require("socket.io");

const PORT = process.env.PORT || 3000;
const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static("public"));
app.use("/rules-assets", express.static(path.join(__dirname, "diseño de cartas y reglas")));

const rooms = new Map();
const RULES_ASSET_ROOT = path.join(__dirname, "diseño de cartas y reglas");
const CARD_BACK_URL = "/rules-assets/reverso%20de%20cartas.jpg";
const NOPE_ICON_URL = "/rules-assets/nope.png";

const CARD_INFO = {
  exploding: { name: "Gatito Explosivo", type: "danger", description: "Explota al robarla. Si tienes Desactivacion puedes salvarte y esconder este gatito en cualquier posicion del mazo; si no, quedas fuera de la partida." },
  defuse: { name: "Desactivacion", type: "defense", description: "Evita una explosion y permite esconder el gatito en cualquier posicion del mazo. Por defecto se propone dejarlo arriba, pero puedes moverlo o escribir una posicion exacta." },
  nope: { name: "Va a ser que NO", type: "action", description: "Cancela cualquier accion o combo excepto Gatito Explosivo y Desactivacion. Puede jugarse fuera de tu turno y tambien encima de otro NO, alternando entre cancelar y permitir la accion." },
  attack: { name: "Ataque", type: "action", description: "Termina tus turnos sin robar y fuerza al siguiente jugador a jugar 2 turnos. Si la victima responde con otro Ataque, sus turnos terminan y la deuda se acumula para la siguiente victima." },
  skip: { name: "Saltar", type: "action", description: "Termina uno de tus turnos sin robar." },
  favor: { name: "Favor", type: "action", description: "Elige a otro jugador. Ese jugador selecciona una carta de su mano y debe entregartela." },
  shuffle: { name: "Mezclar", type: "action", description: "Baraja todo el mazo de robo sin mirar las cartas." },
  seeFuture: { name: "Ver el Futuro", type: "action", description: "Mira en secreto las proximas 3 cartas del mazo, mostradas en orden desde la siguiente carta a robar." },
  seeFuture5: { name: "Ver el Futuro x5", type: "action", description: "Mira en secreto las proximas 5 cartas del mazo, mostradas en orden desde la siguiente carta a robar." },
  alterFuture: { name: "Alterar el Futuro", type: "action", description: "Mira las proximas 3 cartas del mazo y cambia su orden arrastrandolas antes de devolverlas." },
  alterFuture5: { name: "Alterar el Futuro x5", type: "action", description: "Mira las proximas 5 cartas del mazo y cambia su orden arrastrandolas antes de devolverlas." },
  catomicBomb: { name: "Bomba Gatomica", type: "action", description: "Retira los Gatitos Explosivos, mezcla el mazo y los deja arriba." },
  mark: { name: "Marca", type: "action", description: "Elige a un jugador y marca una carta de su mano. Esa carta queda visible para todos hasta que sea jugada o robada." },
  garbageCollection: { name: "Recogida de Basura", type: "action", description: "Cada jugador mete una carta secreta de su mano al mazo y luego se baraja." },
  swapTopBottom: { name: "Intercambiar Superior e Inferior", type: "action", description: "Intercambia la primera y la ultima carta del mazo sin mirarlas." },
  curse: { name: "Maldicion del Culo de Gato", type: "action", description: "El jugador objetivo queda ciego: sus cartas se ponen boca abajo y se mezclan. Hasta que robe una carta del mazo sin explotar, si juega una carta debe hacerlo al azar; si la carta no sirve, se descarta sin efecto." },
  reverse: { name: "Marcha Atras", type: "action", description: "Invierte el sentido y termina uno de tus turnos sin robar." },
  drawBottom: { name: "Robar del Fondo", type: "action", description: "Termina uno de tus turnos robando la carta inferior del mazo." },
  targetAttack: { name: "Ataque Dirigido", type: "action", description: "Termina tus turnos sin robar y elige cualquier jugador para que reciba 2 turnos. Si la victima responde con otro Ataque, los turnos pendientes se suman para el siguiente objetivo." },
  superSkip: { name: "Super Salto", type: "action", description: "Termina todos tus turnos pendientes sin robar." },
  imploding: { name: "Gatito Implosivo", type: "danger", description: "La primera vez que aparece se esconde boca arriba en el mazo y no se puede cancelar ni desactivar. La siguiente persona que lo robe queda eliminada inmediatamente." },
  streaking: { name: "Gatito Fugitivo", type: "defense", description: "Permite conservar un Gatito Explosivo en la mano sin explotar. Si el Gatito Fugitivo sale de tu mano mientras aun tienes un Explosivo, debes desactivarlo o perder. No protege contra el Gatito Implosivo." },
  feralCat: { name: "Gato Salvaje", type: "cat", description: "Comodin de gato para combos de cartas de gato." },
  cat: { name: "Carta Gato", type: "cat", description: "Junta 2 cartas con el mismo icono para elegir una carta boca abajo de otro jugador." },
};

const CAT_CARD_DEFS = [
  { file: "Beard-Cat.jpg", name: "Gato Barbudo" },
  { file: "Bikini-Cat.jpg", name: "Gato en Bikini" },
  { file: "Cat-Henge.jpg", name: "Gato Henge" },
  { file: "Cat-O-Lantern.jpg", name: "Gato Calabaza" },
  { file: "Cats-Schrodinger.jpg", name: "Gato de Schrodinger" },
  { file: "Cattermelon.jpg", name: "Gato Sandia" },
  { file: "De-Cat-Ipated.jpg", name: "Gato Decapitado" },
  { file: "Electrocat.jpg", name: "Electrogato" },
  { file: "Momma-Cat.jpg", name: "Mama Gata" },
  { file: "Shy-Bladder-Cat.jpg", name: "Gato Vejiga Timida" },
  { file: "Troll-Cat.jpg", name: "Gato Troll" },
  { file: "Vampire-Cat.jpg", name: "Gato Vampiro" },
  { file: "Zombie-Cat.jpg", name: "Gato Zombie" }
];
const ASSET_FOLDERS = {
  attack: "img/cartas/attack-2x",
  defuse: "img/cartas/defuse",
  favor: "img/cartas/favor",
  exploding: "img/cartas/exploding-kitten",
  cat: "img/cartas/cat-card",
  shuffle: "img/cartas/shuffle",
  skip: "img/cartas/skip",
  nope: "img/cartas/nope",
  seeFuture: "img/cartas/see-the-future-3x",
  seeFuture5: "img/cartas/see-the-future-5x",
  alterFuture: "img/cartas/alter-the-future-3x",
  alterFuture5: "img/cartas/alter-the-future-5x",
  catomicBomb: "img/cartas/catomic-bomb",
  mark: "img/cartas/mark",
  garbageCollection: "img/cartas/garbage-collection",
  swapTopBottom: "img/cartas/swap-top-and-bottom",
  curse: "img/cartas/curse-of-the-cat-butt",
  reverse: "img/cartas/reverse",
  drawBottom: "img/cartas/draw-from-the-bottom",
  targetAttack: "img/cartas/targeted-attack-2x",
  superSkip: "img/cartas/super-skip",
  imploding: "img/cartas/imploding-kitten",
  streaking: "img/cartas/streaking-kitten",
  feralCat: "img/cartas/feral-cat"
};
const AVAILABLE_EXPANSIONS = {
  imploding: {
    name: "Imploding Kittens",
    rules: "03-imploding-kittens.md",
    description: "Agrega Marcha Atras, Robar del Fondo, Gato Salvaje, Alterar el Futuro y Ataque Dirigido. El Gatito Implosivo se agrega durante la preparacion.",
    cards: [
      ["reverse", 4],
      ["drawBottom", 4],
      ["feralCat", 4],
      ["alterFuture", 4],
      ["targetAttack", 3]
    ]
  },
  streaking: {
    name: "Streaking Kittens",
    rules: "04-streaking-kittens.md",
    description: "Agrega Gatito Fugitivo y un Gato Explosivo extra durante la preparacion.",
    cards: [
      ["streaking", 1],
      ["superSkip", 1],
      ["seeFuture5", 1],
      ["alterFuture5", 1],
      ["catomicBomb", 1],
      ["mark", 3],
      ["garbageCollection", 1],
      ["swapTopBottom", 3],
      ["curse", 2]
    ]
  }
};
const cardAssets = loadCardAssets();
const assetCursors = {};

function rulesAssetUrl(...parts) {
  return `/rules-assets/${parts.map((part) => encodeURIComponent(part)).join("/")}`;
}

function loadCardAssets() {
  const assets = {};
  for (const [type, folder] of Object.entries(ASSET_FOLDERS)) {
    const absolute = path.join(RULES_ASSET_ROOT, ...folder.split("/"));
    try {
      assets[type] = fs.readdirSync(absolute)
        .filter((file) => /\.(png|jpe?g|webp)$/i.test(file))
        .map((file) => rulesAssetUrl(...folder.split("/"), file));
    } catch {
      assets[type] = [];
    }
  }
  return assets;
}

function imageForType(type) {
  const images = cardAssets[type] || [];
  if (!images.length) return null;
  assetCursors[type] = (assetCursors[type] || 0) % images.length;
  const selected = images[assetCursors[type]];
  assetCursors[type] += 1;
  return selected;
}

function imageForCatFile(file) {
  return rulesAssetUrl("img", "cartas", "cat-card", file);
}

function id(prefix = "c") {
  return `${prefix}_${Math.random().toString(36).slice(2, 9)}`;
}

function createRoom(code) {
  return {
    code,
    status: "lobby",
    players: [],
    spectators: [],
    deck: [],
    discard: [],
    currentPlayerId: null,
    direction: 1,
    pendingTurns: {},
    pendingDefuse: null,
    pendingFavor: null,
    pendingSteal: null,
    pendingMark: null,
    pendingAlter: null,
    pendingPeek: null,
    pendingImploding: null,
    pendingGarbage: null,
    pendingNope: null,
    nopeTimer: null,
    implodingArmed: false,
    expansions: [],
    hostId: null,
    winnerId: null,
    log: [],
    messages: []
  };
}

function ensureLobbyHost(room) {
  if (!room || room.status !== "lobby") return;
  const currentHost = room.players.find((player) => player.id === room.hostId);
  if (currentHost?.connected) return;
  const nextHost = room.players.find((player) => player.connected);
  room.hostId = nextHost?.id || null;
}

function publicPlayer(player, room) {
  return {
    id: player.id,
    name: player.name,
    host: player.id === room.hostId,
    alive: player.alive,
    connected: player.connected,
    handCount: player.hand.length,
    blind: Boolean(player.blind),
    tableHand: player.hand.map((card) => card.marked
      ? { marked: true, image: card.image, name: cardNameForLog(card) }
      : { marked: false })
  };
}

function privateState(room, socketId) {
  const player = room.players.find((p) => p.id === socketId);
  const hasNope = Boolean(player?.alive && player.hand.some((card) => card.type === "nope"));
  const canPlayNope = Boolean(room.pendingNope && hasNope && (
    room.pendingNope.nopeCount === 0
      ? room.pendingNope.actorId !== socketId
      : room.pendingNope.lastNopePlayerId !== socketId
  ));
  const base = {
    code: room.code,
    status: room.status,
    players: room.players.map((item) => publicPlayer(item, room)),
    deckCount: room.deck.length,
    discard: room.discard.slice(-8),
    currentPlayerId: room.currentPlayerId,
    direction: room.direction,
    pendingTurns: room.pendingTurns,
    winnerId: room.winnerId,
    log: room.log.slice(-12),
    messages: room.messages.slice(-80),
    cardInfo: CARD_INFO,
    availableExpansions: Object.entries(AVAILABLE_EXPANSIONS).map(([key, expansion]) => ({
      key,
      name: expansion.name,
      description: expansion.description,
      rules: expansion.rules
    })),
    selectedExpansions: room.expansions,
    hostId: room.hostId,
    isHost: room.hostId === socketId,
    cardBack: CARD_BACK_URL,
    nopeIcon: NOPE_ICON_URL,
    you: player ? player.id : null,
    pendingFavor: room.pendingFavor,
    pendingSteal: room.pendingSteal
      ? {
          fromId: room.pendingSteal.fromId,
          targetId: room.pendingSteal.targetId,
          targetName: playerById(room, room.pendingSteal.targetId)?.name,
          handCount: playerById(room, room.pendingSteal.targetId)?.hand.length || 0,
          handPreview: room.pendingSteal.fromId === socketId
            ? (playerById(room, room.pendingSteal.targetId)?.hand || []).map((card) => card.marked
              ? { marked: true, image: card.image, name: cardNameForLog(card) }
              : { marked: false })
            : []
        }
      : null,
    pendingMark: room.pendingMark
      ? {
          fromId: room.pendingMark.fromId,
          targetId: room.pendingMark.targetId,
          targetName: playerById(room, room.pendingMark.targetId)?.name,
          handCount: playerById(room, room.pendingMark.targetId)?.hand.length || 0,
          handPreview: room.pendingMark.fromId === socketId
            ? (playerById(room, room.pendingMark.targetId)?.hand || []).map((card) => card.marked
              ? { marked: true, image: card.image, name: cardNameForLog(card) }
              : { marked: false })
            : []
        }
      : null,
    pendingDefuse: room.pendingDefuse && room.pendingDefuse.playerId === socketId
      ? { deckSlots: room.deck.length + 1, cardId: room.pendingDefuse.card.id, card: room.pendingDefuse.card, showAfter: room.pendingDefuse.showAfter }
      : null,
    pendingImploding: room.pendingImploding && room.pendingImploding.playerId === socketId
      ? { deckSlots: room.deck.length + 1, cardId: room.pendingImploding.card.id, card: room.pendingImploding.card, showAfter: room.pendingImploding.showAfter }
      : null,
    pendingGarbage: room.pendingGarbage
      ? {
          active: true,
          contributed: room.pendingGarbage.contributions.map((item) => item.playerId),
          youMustChoose: Boolean(player?.alive && player.hand.length && !room.pendingGarbage.contributions.some((item) => item.playerId === socketId))
        }
      : null,
    pendingAlter: room.pendingAlter && room.pendingAlter.playerId === socketId
      ? room.pendingAlter
      : null,
    pendingPeek: room.pendingPeek && room.pendingPeek.playerId === socketId
      ? room.pendingPeek
      : null,
    discardPile: room.discard,
    claimableCards: claimableCards(),
    pendingNope: room.pendingNope
      ? {
          id: room.pendingNope.id,
          summary: room.pendingNope.summary,
          actorId: room.pendingNope.actorId,
          lastNopePlayerId: room.pendingNope.lastNopePlayerId,
          nopeCount: room.pendingNope.nopeCount,
          resolvesAt: room.pendingNope.resolvesAt
        }
      : null,
    hasNope,
    canNope: canPlayNope,
    lastDiscard: room.discard.at(-1) || null
  };
  if (player) {
    base.hand = player.blind
      ? player.hand.map((card) => ({ id: card.id, type: "blind", marked: card.marked, image: card.marked ? card.image : null, realType: card.marked ? card.type : null, catName: card.marked ? card.catName : null }))
      : player.hand;
    base.alive = player.alive;
    base.blind = Boolean(player.blind);
  }
  return base;
}

function emitRoom(room) {
  for (const socket of io.sockets.sockets.values()) {
    if (socket.data.roomCode === room.code) socket.emit("state", privateState(room, socket.id));
  }
}

function emitToPlayer(playerId, event, payload) {
  const targetSocket = io.sockets.sockets.get(playerId);
  targetSocket?.emit(event, payload);
}

function log(room, text) {
  room.log.push({ id: id("log"), text, at: Date.now() });
}

function card(type, extra = {}) {
  return { id: id(), type, image: extra.image || imageForType(type), backImage: CARD_BACK_URL, ...extra };
}

function shuffle(items) {
  for (let i = items.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [items[i], items[j]] = [items[j], items[i]];
  }
  return items;
}

function livingPlayers(room) {
  return room.players.filter((p) => p.alive);
}

function nextLiving(room, fromId = room.currentPlayerId) {
  const alive = livingPlayers(room);
  if (alive.length <= 1) return alive[0]?.id || null;
  const startIndex = room.players.findIndex((p) => p.id === fromId);
  let idx = startIndex;
  for (let i = 0; i < room.players.length; i += 1) {
    idx = (idx + room.direction + room.players.length) % room.players.length;
    if (room.players[idx].alive) return room.players[idx].id;
  }
  return null;
}

function ensureTurn(room, playerId) {
  if (!room.pendingTurns[playerId]) room.pendingTurns[playerId] = 1;
}

function advanceTurn(room, forcedNextId = null) {
  if (room.status !== "active") return;
  const alive = livingPlayers(room);
  if (alive.length <= 1) {
    room.status = "finished";
    room.winnerId = alive[0]?.id || null;
    if (room.winnerId) log(room, `${alive[0].name} gana la partida.`);
    return;
  }

  let nextId = forcedNextId || nextLiving(room);
  room.currentPlayerId = nextId;
  ensureTurn(room, nextId);
}

function sanitizeExpansions(expansions) {
  return [...new Set(Array.isArray(expansions) ? expansions : [])]
    .filter((key) => Object.hasOwn(AVAILABLE_EXPANSIONS, key));
}

function maxPlayersFor(expansions) {
  return 5 + (expansions.includes("imploding") ? 1 : 0) + (expansions.includes("streaking") ? 1 : 0);
}

function addCards(deck, type, count, extraFactory = () => ({})) {
  for (let i = 0; i < count; i += 1) deck.push(card(type, extraFactory(i)));
}

function buildCatDeck(types = 5, copies = 4) {
  return CAT_CARD_DEFS.slice(0, types).flatMap((cat) =>
    Array.from({ length: copies }, () => card("cat", { catName: cat.name, image: imageForCatFile(cat.file) }))
  );
}

function buildMixedCatDeck(count) {
  return Array.from({ length: count }, (_, index) => {
    const cat = CAT_CARD_DEFS[index % CAT_CARD_DEFS.length];
    return card("cat", { catName: cat.name, image: imageForCatFile(cat.file) });
  });
}

function extraDefuseCount(playerCount) {
  return 1;
}

function dangerousKittenCounts(playerCount, expansions) {
  const hasImploding = expansions.includes("imploding") || expansions.includes("streaking");
  const totalDangerKittens = expansions.includes("streaking") ? playerCount : playerCount - 1;
  const imploding = hasImploding ? 1 : 0;
  return {
    imploding,
    exploding: Math.max(0, totalDangerKittens - imploding)
  };
}

function buildDeck(playerCount, expansions = []) {
  const deck = [];

  addCards(deck, "nope", 5);
  addCards(deck, "attack", 4);
  addCards(deck, "skip", 4);
  addCards(deck, "favor", 4);
  addCards(deck, "shuffle", 4);
  addCards(deck, "seeFuture", 5);
  deck.push(...buildCatDeck(5, 4));

  for (const key of expansions) {
    const expansion = AVAILABLE_EXPANSIONS[key];
    if (!expansion) continue;
    for (const [type, count] of expansion.cards || []) addCards(deck, type, count);
    if (expansion.cats) deck.push(...buildMixedCatDeck(expansion.cats));
  }

  return shuffle(deck);
}

function startGame(room, options = {}) {
  if (room.players.length < 2) throw new Error("Necesitas al menos 2 jugadores.");
  const expansions = sanitizeExpansions(options.expansions ?? room.expansions);
  const maxPlayers = maxPlayersFor(expansions);
  if (room.players.length > maxPlayers) throw new Error(`Con esta seleccion el maximo recomendado es ${maxPlayers} jugadores.`);

  room.status = "active";
  room.expansions = expansions;
  room.deck = buildDeck(room.players.length, expansions);
  room.discard = [];
  room.direction = 1;
  room.pendingTurns = {};
  room.pendingDefuse = null;
  room.pendingFavor = null;
  room.pendingSteal = null;
  room.pendingMark = null;
  room.pendingAlter = null;
  room.pendingPeek = null;
  room.pendingImploding = null;
  room.pendingGarbage = null;
  room.pendingNope = null;
  clearNopeTimer(room);
  room.implodingArmed = false;
  room.winnerId = null;
  room.log = [];

  for (const player of room.players) {
    player.alive = true;
    player.blind = false;
    player.hand = [card("defuse")];
    for (let i = 0; i < 7; i += 1) {
      const dealt = room.deck.pop();
      if (!dealt) throw new Error("No hay cartas suficientes para repartir 8 a cada jugador.");
      player.hand.push(dealt);
    }
  }

  const dangerous = dangerousKittenCounts(room.players.length, expansions);
  if (dangerous.imploding) room.deck.push(card("imploding"));
  for (let i = 0; i < dangerous.exploding; i += 1) room.deck.push(card("exploding"));
  addCards(room.deck, "defuse", extraDefuseCount(room.players.length));
  shuffle(room.deck);

  room.currentPlayerId = room.players[0].id;
  room.pendingTurns[room.currentPlayerId] = 1;
  const expansionNames = expansions.map((key) => AVAILABLE_EXPANSIONS[key].name).join(", ");
  log(room, expansionNames ? `La partida comenzo con expansiones: ${expansionNames}.` : "La partida comenzo. Eviten robar gatitos explosivos.");
}

function playerById(room, playerId) {
  return room.players.find((p) => p.id === playerId);
}

function removeCard(player, cardId) {
  const idx = player.hand.findIndex((c) => c.id === cardId);
  if (idx === -1) return null;
  return player.hand.splice(idx, 1)[0];
}

function pairKey(card) {
  if (!card) return "";
  if (card.type === "cat" || card.type === "feralCat") return `cat:${card.catName || CARD_INFO.feralCat.name}`;
  return card.type;
}

function isCatComboCard(card) {
  return card?.type === "cat" || card?.type === "feralCat";
}

function pairCompatible(first, second) {
  if (!first || !second) return false;
  if (pairKey(first) === pairKey(second)) return true;
  return isCatComboCard(first) && isCatComboCard(second) && (first.type === "feralCat" || second.type === "feralCat");
}

function titleKey(card) {
  return pairKey(card);
}

function cardNameForLog(card) {
  const base = CARD_INFO[card.type]?.name || card.type;
  return card.catName ? `${base}: ${card.catName}` : base;
}

function claimableCards() {
  const excluded = new Set(["exploding", "imploding"]);
  const actionCards = Object.entries(CARD_INFO)
    .filter(([key]) => !excluded.has(key) && key !== "cat")
    .map(([key, info]) => ({ key, name: info.name }));
  return [
    ...actionCards,
    ...CAT_CARD_DEFS.map((cat) => ({ key: `cat:${cat.name}`, name: `${CARD_INFO.cat.name}: ${cat.name}` }))
  ];
}

function clearNopeTimer(room) {
  if (room.nopeTimer) clearTimeout(room.nopeTimer);
  room.nopeTimer = null;
}

function openNopeWindow(room, action, summary, actorId) {
  clearNopeTimer(room);
  room.pendingNope = {
    id: id("nope"),
    action,
    summary,
    actorId,
    nopeCount: 0,
    lastNopePlayerId: null,
    resolvesAt: Date.now() + 7000
  };
  log(room, `${summary}. Ventana para Va a ser que NO abierta.`);
  scheduleNopeResolution(room);
}

function scheduleNopeResolution(room) {
  clearNopeTimer(room);
  const waitMs = Math.max(0, room.pendingNope.resolvesAt - Date.now());
  room.nopeTimer = setTimeout(() => {
    resolveNopeWindow(room);
    emitRoom(room);
  }, waitMs);
}

function resolveNopeWindow(room) {
  if (!room.pendingNope) return;
  const pending = room.pendingNope;
  clearNopeTimer(room);
  room.pendingNope = null;

  if (pending.nopeCount % 2 === 1) {
    log(room, `Va a ser que NO cancela: ${pending.summary}.`);
    return;
  }

  log(room, `La accion se resuelve: ${pending.summary}.`);
  applyResolvedAction(room, pending.action);
}

function applyResolvedAction(room, action) {
  const player = playerById(room, action.playerId);
  if (!player) return;

  if (action.type === "attack") {
    const nextId = nextLiving(room, player.id);
    const passedTurns = action.owedTurns > 1 ? action.owedTurns + 2 : 2;
    delete room.pendingTurns[player.id];
    room.pendingTurns[nextId] = (room.pendingTurns[nextId] || 0) + passedTurns;
    advanceTurn(room, nextId);
  } else if (action.type === "skip") {
    endOneTurn(room, player.id);
  } else if (action.type === "favor") {
    room.pendingFavor = { fromId: player.id, toId: action.targetId };
  } else if (action.type === "shuffle") {
    shuffle(room.deck);
    io.to(room.code).emit("deckShuffleAnimation");
  } else if (action.type === "seeFuture") {
    room.pendingPeek = { playerId: player.id, cards: room.deck.slice(-(action.count || 3)).reverse() };
  } else if (action.type === "alterFuture") {
    room.pendingAlter = { playerId: player.id, cards: room.deck.slice(-(action.count || 3)).reverse() };
  } else if (action.type === "catomicBomb") {
    const exploding = room.deck.filter((card) => card.type === "exploding");
    room.deck = room.deck.filter((card) => card.type !== "exploding");
    shuffle(room.deck);
    room.deck.push(...exploding);
    log(room, `${player.name} activa Bomba Gatomica. Los Gatitos Explosivos quedan sobre el mazo.`);
    endOneTurn(room, player.id);
  } else if (action.type === "mark") {
    const target = playerById(room, action.targetId);
    if (!target?.alive || !target.hand.length) return;
    room.pendingMark = { fromId: player.id, targetId: target.id };
    log(room, `${player.name} debe elegir una carta de ${target.name} para marcar.`);
  } else if (action.type === "garbageCollection") {
    room.pendingGarbage = { playerId: player.id, contributions: [] };
    log(room, "Recogida de Basura: cada jugador debe aportar una carta secreta al mazo.");
  } else if (action.type === "swapTopBottom") {
    if (room.deck.length >= 2) {
      const top = room.deck.length - 1;
      [room.deck[0], room.deck[top]] = [room.deck[top], room.deck[0]];
      io.to(room.code).emit("deckSwapAnimation");
    }
    log(room, `${player.name} intercambia la carta superior e inferior del mazo.`);
  } else if (action.type === "curse") {
    const target = playerById(room, action.targetId);
    if (!target?.alive) return;
    target.blind = true;
    shuffle(target.hand);
    log(room, `${target.name} queda con la mano a ciegas.`);
  } else if (action.type === "reverse") {
    room.direction *= -1;
    endOneTurn(room, player.id);
  } else if (action.type === "drawBottom") {
    drawCard(room, player, true);
  } else if (action.type === "superSkip") {
    delete room.pendingTurns[player.id];
    advanceTurn(room);
  } else if (action.type === "targetAttack") {
    const target = playerById(room, action.targetId);
    if (!target?.alive) return;
    const owedTurns = action.owedTurns > 1 ? action.owedTurns + 2 : 2;
    delete room.pendingTurns[player.id];
    room.pendingTurns[target.id] = (room.pendingTurns[target.id] || 0) + owedTurns;
    advanceTurn(room, target.id);
  } else if (action.type === "pairSteal") {
    room.pendingSteal = { fromId: player.id, targetId: action.targetId };
  } else if (action.type === "threeKind") {
    const target = playerById(room, action.targetId);
    if (!target) return;
    const targetCard = target.hand.find((card) => titleKey(card) === action.requestedKey);
    if (targetCard) {
      const moved = removeCard(target, targetCard.id);
      emitToPlayer(target.id, "receiveCardAnimation", { card: moved, fromName: player.name, reason: "lost" });
      resolveTransferredCard(room, { card: moved, from: target, to: player, reason: "steal" });
      log(room, `${player.name} recibe ${cardNameForLog(targetCard)} de ${target.name}.`);
    } else {
      log(room, `${target.name} no tenia la carta solicitada.`);
    }
  } else if (action.type === "fiveDifferent") {
    const claimedIndex = room.discard.findIndex((card) => card.id === action.claimedCardId);
    if (claimedIndex < 0) return;
    const claimed = room.discard.splice(claimedIndex, 1)[0];
    player.hand.push(claimed);
    log(room, `${player.name} recupera ${cardNameForLog(claimed)} del descarte.`);
  }
}

function endOneTurn(room, playerId) {
  room.pendingTurns[playerId] = Math.max(0, (room.pendingTurns[playerId] || 1) - 1);
  if (room.pendingTurns[playerId] <= 0) {
    delete room.pendingTurns[playerId];
    advanceTurn(room);
  }
}

function eliminate(room, player, reason) {
  player.alive = false;
  player.hand = [];
  delete room.pendingTurns[player.id];
  log(room, `${player.name} queda eliminado: ${reason}.`);
  if (room.currentPlayerId === player.id) {
    advanceTurn(room);
  } else {
    const alive = livingPlayers(room);
    if (alive.length <= 1) advanceTurn(room);
  }
}

function explodeStreakingHolderIfNeeded(room, player) {
  if (!player?.alive) return false;
  const explodingIndex = player.hand.findIndex((card) => card.type === "exploding");
  if (explodingIndex < 0) return false;
  const exploding = player.hand.splice(explodingIndex, 1)[0];
  triggerHandExplosion(room, player, exploding, "perdio su Gatito Fugitivo mientras tenia un Gatito Explosivo");
  return true;
}

function triggerHandExplosion(room, player, exploding, reason) {
  emitToPlayer(player.id, "drawAnimation", { card: exploding, explosive: true });
  const defuseIndex = player.hand.findIndex((card) => card.type === "defuse");
  if (defuseIndex >= 0) {
    const defuse = player.hand.splice(defuseIndex, 1)[0];
    room.discard.push(defuse);
    room.pendingDefuse = { playerId: player.id, card: exploding, showAfter: Date.now() + 3000, source: "hand" };
    log(room, `${player.name} debe desactivar un Gatito Explosivo recibido desde una mano.`);
    return true;
  }
  room.discard.push(exploding);
  eliminate(room, player, reason);
  return false;
}

function finishGarbageIfReady(room) {
  if (!room.pendingGarbage || room.pendingDefuse) return false;
  const waiting = livingPlayers(room).filter((item) => item.hand.length && !room.pendingGarbage.contributions.some((entry) => entry.playerId === item.id));
  if (waiting.length) return false;
  room.deck.push(...room.pendingGarbage.contributions.map((item) => item.card));
  room.pendingGarbage = null;
  shuffle(room.deck);
  io.to(room.code).emit("deckShuffleAnimation");
  log(room, "Las cartas de Recogida de Basura se mezclan en el mazo.");
  return true;
}

function resolveTransferredCard(room, { card: movedCard, from, to, reason }) {
  movedCard.marked = false;
  if (movedCard.type === "exploding") {
    emitToPlayer(to.id, "receiveCardAnimation", { card: movedCard, fromName: from?.name, reason });
    triggerHandExplosion(room, to, movedCard, "recibio un Gatito Explosivo de otra mano");
    return { delivered: false };
  }

  to.hand.push(movedCard);
  emitToPlayer(to.id, "receiveCardAnimation", { card: movedCard, fromName: from?.name, reason });

  if (movedCard.type === "streaking") {
    explodeStreakingHolderIfNeeded(room, from);
  }

  return { delivered: true };
}

function retirePlayer(room, player) {
  if (!player?.alive) throw new Error("Ya estas fuera de la partida.");
  room.discard.push(...player.hand);
  player.hand = [];
  player.alive = false;
  delete room.pendingTurns[player.id];
  if (room.pendingDefuse?.playerId === player.id) room.pendingDefuse = null;
  if (room.pendingImploding?.playerId === player.id) room.pendingImploding = null;
  if (room.pendingFavor?.fromId === player.id || room.pendingFavor?.toId === player.id) room.pendingFavor = null;
  if (room.pendingSteal?.fromId === player.id || room.pendingSteal?.targetId === player.id) room.pendingSteal = null;
  if (room.pendingMark?.fromId === player.id || room.pendingMark?.targetId === player.id) room.pendingMark = null;
  if (room.pendingPeek?.playerId === player.id) room.pendingPeek = null;
  if (room.pendingAlter?.playerId === player.id) room.pendingAlter = null;
  if (room.pendingGarbage?.playerId === player.id) room.pendingGarbage = null;
  if (room.pendingNope?.actorId === player.id || room.pendingNope?.lastNopePlayerId === player.id) {
    resolveNopeWindow(room);
  }
  log(room, `${player.name} se retira y descarta su mano.`);
  if (room.currentPlayerId === player.id) {
    advanceTurn(room);
  } else {
    const alive = livingPlayers(room);
    if (alive.length <= 1) advanceTurn(room);
  }
}

function drawCard(room, player, fromBottom = false) {
  if (!room.deck.length) {
    log(room, "El mazo se agoto. Se mezclan los descartes para continuar.");
    room.deck = shuffle(room.discard.splice(0, room.discard.length - 1));
  }
  const drawn = fromBottom ? room.deck.shift() : room.deck.pop();
  if (!drawn) return;

  if (drawn.type === "exploding") {
    const hasStreaking = player.hand.some((c) => c.type === "streaking");
    const defuseIndex = player.hand.findIndex((c) => c.type === "defuse");
    if (hasStreaking) {
      player.hand.push(drawn);
      emitToPlayer(player.id, "drawAnimation", { card: drawn, explosive: false });
      endOneTurn(room, player.id);
      return;
    }
    emitToPlayer(player.id, "drawAnimation", { card: drawn, explosive: true });
    if (defuseIndex >= 0) {
      const defuse = player.hand.splice(defuseIndex, 1)[0];
      room.discard.push(defuse);
      room.pendingDefuse = { playerId: player.id, card: drawn, showAfter: Date.now() + 3000 };
      log(room, `${player.name} uso Desactivacion. Debe esconder el Gatito Explosivo en el mazo.`);
      return;
    }
    eliminate(room, player, "robo un Gatito Explosivo sin Desactivacion");
    return;
  }

  if (drawn.type === "imploding") {
    if (!room.implodingArmed) {
      room.implodingArmed = true;
      emitToPlayer(player.id, "drawAnimation", { card: drawn, explosive: true, imploding: true });
      room.pendingImploding = { playerId: player.id, card: { ...drawn, faceUp: true }, showAfter: Date.now() + 3000 };
      log(room, `${player.name} encontro el Gatito Implosivo. Debe esconderlo boca arriba en el mazo.`);
    } else {
      emitToPlayer(player.id, "drawAnimation", { card: drawn, explosive: true, imploding: true });
      eliminate(room, player, "robo el Gatito Implosivo armado");
    }
    return;
  }

  player.hand.push(drawn);
  if (player.blind) {
    player.blind = false;
    log(room, `${player.name} deja de estar a ciegas tras robar sin explotar.`);
  }
  emitToPlayer(player.id, "drawAnimation", { card: drawn, explosive: false });
  log(room, `${player.name} robo una carta.`);
  endOneTurn(room, player.id);
}

function requireCurrent(room, socket) {
  if (room.status !== "active") throw new Error("La partida no esta activa.");
  if (room.currentPlayerId !== socket.id) throw new Error("No es tu turno.");
  if (room.pendingDefuse || room.pendingImploding || room.pendingFavor || room.pendingSteal || room.pendingMark || room.pendingAlter || room.pendingGarbage || room.pendingNope) throw new Error("Hay una accion pendiente.");
}

function playCard(room, socket, payload) {
  requireCurrent(room, socket);
  const player = playerById(room, socket.id);
  const preview = player.hand.find((c) => c.id === payload.cardId);
  if (!preview) throw new Error("No tienes esa carta.");

  if (payload.mode === "pair") {
    const pair = player.hand.find((c) => c.id === payload.pairCardId);
    const target = playerById(room, payload.targetId);
    if (!pair || pair.id === preview.id || !pairCompatible(pair, preview)) {
      throw new Error("Necesitas dos cartas con el mismo icono.");
    }
    if (!target || !target.alive || target.id === player.id || target.hand.length === 0) throw new Error("Objetivo invalido.");

    const first = removeCard(player, preview.id);
    const second = removeCard(player, pair.id);
    room.discard.push(first, second);
    openNopeWindow(
      room,
      { type: "pairSteal", playerId: player.id, targetId: target.id },
      `${player.name} juega un par de ${cardNameForLog(first)} contra ${target.name}`,
      player.id
    );
    return;
  }

  if (["defuse", "exploding", "streaking", "imploding", "feralCat", "nope"].includes(preview.type)) {
    throw new Error("Esa carta no se juega manualmente en esta version.");
  }

  if (preview.type === "favor" || preview.type === "targetAttack" || preview.type === "mark" || preview.type === "curse") {
    const target = playerById(room, payload.targetId);
    if (!target || !target.alive || target.id === player.id || (["favor", "mark"].includes(preview.type) && target.hand.length === 0)) {
      throw new Error("Objetivo invalido.");
    }
  }

  const played = removeCard(player, payload.cardId);
  room.discard.push(played);
  log(room, `${player.name} juega ${CARD_INFO[played.type].name}.`);

  if (played.type === "attack") {
    const owedTurns = room.pendingTurns[player.id] || 1;
    openNopeWindow(room, { type: "attack", playerId: player.id, owedTurns }, `${player.name} juega Ataque`, player.id);
  } else if (played.type === "skip") {
    openNopeWindow(room, { type: "skip", playerId: player.id }, `${player.name} juega Saltar`, player.id);
  } else if (played.type === "superSkip") {
    openNopeWindow(room, { type: "superSkip", playerId: player.id }, `${player.name} juega Super Salto`, player.id);
  } else if (played.type === "reverse") {
    openNopeWindow(room, { type: "reverse", playerId: player.id }, `${player.name} juega Marcha Atras`, player.id);
  } else if (played.type === "drawBottom") {
    openNopeWindow(room, { type: "drawBottom", playerId: player.id }, `${player.name} juega Robar del Fondo`, player.id);
  } else if (played.type === "favor") {
    const target = playerById(room, payload.targetId);
    openNopeWindow(room, { type: "favor", playerId: player.id, targetId: target.id }, `${player.name} pide Favor a ${target.name}`, player.id);
  } else if (played.type === "targetAttack") {
    const target = playerById(room, payload.targetId);
    const owedTurns = room.pendingTurns[player.id] || 1;
    openNopeWindow(room, { type: "targetAttack", playerId: player.id, targetId: target.id, owedTurns }, `${player.name} dirige un Ataque contra ${target.name}`, player.id);
  } else if (played.type === "shuffle") {
    openNopeWindow(room, { type: "shuffle", playerId: player.id }, `${player.name} juega Mezclar`, player.id);
  } else if (played.type === "seeFuture" || played.type === "seeFuture5") {
    const count = played.type === "seeFuture5" ? 5 : 3;
    openNopeWindow(room, { type: "seeFuture", playerId: player.id, count }, `${player.name} juega ${CARD_INFO[played.type].name}`, player.id);
  } else if (played.type === "alterFuture" || played.type === "alterFuture5") {
    const count = played.type === "alterFuture5" ? 5 : 3;
    openNopeWindow(room, { type: "alterFuture", playerId: player.id, count }, `${player.name} juega ${CARD_INFO[played.type].name}`, player.id);
  } else if (played.type === "catomicBomb") {
    openNopeWindow(room, { type: "catomicBomb", playerId: player.id }, `${player.name} juega Bomba Gatomica`, player.id);
  } else if (played.type === "mark") {
    const target = playerById(room, payload.targetId);
    openNopeWindow(room, { type: "mark", playerId: player.id, targetId: target.id }, `${player.name} juega Marca contra ${target.name}`, player.id);
  } else if (played.type === "garbageCollection") {
    openNopeWindow(room, { type: "garbageCollection", playerId: player.id }, `${player.name} juega Recogida de Basura`, player.id);
  } else if (played.type === "swapTopBottom") {
    openNopeWindow(room, { type: "swapTopBottom", playerId: player.id }, `${player.name} juega Intercambiar Superior e Inferior`, player.id);
  } else if (played.type === "curse") {
    const target = playerById(room, payload.targetId);
    openNopeWindow(room, { type: "curse", playerId: player.id, targetId: target.id }, `${player.name} maldice a ${target.name}`, player.id);
  }
}

function playBlindCard(room, socket) {
  requireCurrent(room, socket);
  const player = playerById(room, socket.id);
  if (!player.blind) throw new Error("No estas a ciegas.");
  if (!player.hand.length) throw new Error("No tienes cartas.");
  const randomIndex = Math.floor(Math.random() * player.hand.length);
  const played = player.hand.splice(randomIndex, 1)[0];
  played.marked = false;

  if (played.type === "exploding") {
    triggerHandExplosion(room, player, played, "jugo un Gatito Explosivo a ciegas");
    return;
  }

  const blindPlayable = new Set(["attack", "skip", "shuffle", "seeFuture", "seeFuture5", "alterFuture", "alterFuture5", "reverse", "drawBottom", "superSkip", "catomicBomb", "garbageCollection", "swapTopBottom"]);
  room.discard.push(played);

  if (!blindPlayable.has(played.type)) {
    log(room, `${player.name} juega a ciegas ${cardNameForLog(played)}, pero se pierde sin efecto.`);
    return;
  }

  log(room, `${player.name} juega a ciegas ${CARD_INFO[played.type].name}.`);
  const owedTurns = room.pendingTurns[player.id] || 1;
  const blindActions = {
    attack: { type: "attack", playerId: player.id, owedTurns },
    skip: { type: "skip", playerId: player.id },
    shuffle: { type: "shuffle", playerId: player.id },
    seeFuture: { type: "seeFuture", playerId: player.id },
    seeFuture5: { type: "seeFuture", playerId: player.id, count: 5 },
    alterFuture: { type: "alterFuture", playerId: player.id },
    alterFuture5: { type: "alterFuture", playerId: player.id, count: 5 },
    reverse: { type: "reverse", playerId: player.id },
    drawBottom: { type: "drawBottom", playerId: player.id },
    superSkip: { type: "superSkip", playerId: player.id },
    catomicBomb: { type: "catomicBomb", playerId: player.id },
    garbageCollection: { type: "garbageCollection", playerId: player.id },
    swapTopBottom: { type: "swapTopBottom", playerId: player.id }
  };
  openNopeWindow(room, blindActions[played.type], `${player.name} juega a ciegas ${CARD_INFO[played.type].name}`, player.id);
}

function cardsFromHand(player, cardIds) {
  const ids = Array.isArray(cardIds) ? cardIds : [];
  const uniqueIds = [...new Set(ids)];
  return uniqueIds.map((cardId) => player.hand.find((card) => card.id === cardId)).filter(Boolean);
}

function playThreeOfAKind(room, socket, payload) {
  requireCurrent(room, socket);
  const player = playerById(room, socket.id);
  const chosen = cardsFromHand(player, payload.cardIds);
  if (chosen.length !== 3) throw new Error("Debes elegir 3 cartas.");
  if (new Set(chosen.map(titleKey)).size !== 1) throw new Error("Las 3 cartas deben ser identicas.");
  const target = playerById(room, payload.targetId);
  if (!target || !target.alive || target.id === player.id) throw new Error("Objetivo invalido.");
  const requestedKey = String(payload.requestedKey || "");
  if (!claimableCards().some((item) => item.key === requestedKey)) throw new Error("Carta solicitada invalida.");

  for (const chosenCard of chosen) room.discard.push(removeCard(player, chosenCard.id));
  const requestedName = claimableCards().find((item) => item.key === requestedKey)?.name || requestedKey;
  openNopeWindow(
    room,
    { type: "threeKind", playerId: player.id, targetId: target.id, requestedKey },
    `${player.name} juega 3 identicas y pide ${requestedName} a ${target.name}`,
    player.id
  );
}

function playFiveDifferent(room, socket, payload) {
  requireCurrent(room, socket);
  const player = playerById(room, socket.id);
  const chosen = cardsFromHand(player, payload.cardIds);
  if (chosen.length !== 5) throw new Error("Debes elegir 5 cartas.");
  if (chosen.some((card) => ["streaking", "exploding"].includes(card.type))) throw new Error("Streaking Kitten y Gatito Explosivo no sirven para el combo de 5 diferentes.");
  if (new Set(chosen.map(titleKey)).size !== 5) throw new Error("Las 5 cartas deben tener titulos diferentes.");
  const discardIndex = Number(payload.discardIndex);
  if (!Number.isInteger(discardIndex) || discardIndex < 0 || discardIndex >= room.discard.length) throw new Error("Carta de descarte invalida.");

  const claimed = room.discard[discardIndex];
  if (["streaking", "exploding"].includes(claimed.type)) throw new Error("No puedes recuperar Streaking Kitten ni Gatito Explosivo del descarte.");
  for (const chosenCard of chosen) room.discard.push(removeCard(player, chosenCard.id));
  openNopeWindow(
    room,
    { type: "fiveDifferent", playerId: player.id, claimedCardId: claimed.id },
    `${player.name} juega 5 diferentes para recuperar ${cardNameForLog(claimed)} del descarte`,
    player.id
  );
}

io.on("connection", (socket) => {
  socket.on("join", ({ roomCode, name, expansions }, cb) => {
    try {
      const cleanCode = String(roomCode || "SALA").trim().toUpperCase().slice(0, 16) || "SALA";
      const cleanName = String(name || "Jugador").trim().slice(0, 24) || "Jugador";
      if (!rooms.has(cleanCode)) rooms.set(cleanCode, createRoom(cleanCode));
      const room = rooms.get(cleanCode);
      const selectedExpansions = sanitizeExpansions(expansions);
      const hadConnectedPlayers = room.players.some((player) => player.connected);
      socket.data.roomCode = cleanCode;
      socket.join(cleanCode);
      if (!room.players.some((p) => p.id === socket.id)) {
        room.players.push({ id: socket.id, name: cleanName, hand: [], alive: true, connected: true });
      }
      ensureLobbyHost(room);
      if (!room.hostId) {
        room.hostId = socket.id;
        if (room.status === "lobby") room.expansions = selectedExpansions;
        log(room, `${cleanName} entro a la sala como Host.`);
      } else if (room.hostId === socket.id) {
        if (room.status === "lobby" && !hadConnectedPlayers) room.expansions = selectedExpansions;
        log(room, `${cleanName} entro a la sala como Host.`);
      } else {
        log(room, `${cleanName} entro a la sala.`);
      }
      cb?.({ ok: true, code: cleanCode });
      emitRoom(room);
    } catch (err) {
      cb?.({ ok: false, error: err.message });
    }
  });

  socket.on("updateExpansions", ({ expansions }, cb) => {
    const room = rooms.get(socket.data.roomCode);
    try {
      if (!room) throw new Error("Sala no encontrada.");
      if (room.hostId !== socket.id) throw new Error("Solo el Host puede configurar expansiones.");
      if (room.status !== "lobby") throw new Error("Las expansiones solo se configuran antes de iniciar.");
      const selectedExpansions = sanitizeExpansions(expansions);
      const maxPlayers = maxPlayersFor(selectedExpansions);
      if (room.players.length > maxPlayers) throw new Error(`Esa configuracion permite hasta ${maxPlayers} jugadores.`);
      room.expansions = selectedExpansions;
      cb?.({ ok: true });
      emitRoom(room);
    } catch (err) {
      cb?.({ ok: false, error: err.message });
      if (room) emitRoom(room);
    }
  });

  socket.on("startGame", (payload, cb) => {
    const room = rooms.get(socket.data.roomCode);
    try {
      if (!room) throw new Error("Sala no encontrada.");
      if (room.hostId !== socket.id) throw new Error("Solo el Host puede iniciar la partida.");
      startGame(room, { expansions: room.expansions || [] });
      cb?.({ ok: true });
      emitRoom(room);
    } catch (err) {
      cb?.({ ok: false, error: err.message });
    }
  });

  socket.on("playCard", (payload, cb) => {
    const room = rooms.get(socket.data.roomCode);
    try {
      playCard(room, socket, payload || {});
      cb?.({ ok: true });
      emitRoom(room);
    } catch (err) {
      cb?.({ ok: false, error: err.message });
      emitRoom(room);
    }
  });

  socket.on("playBlindCard", (_payload, cb) => {
    const room = rooms.get(socket.data.roomCode);
    try {
      playBlindCard(room, socket);
      cb?.({ ok: true });
      emitRoom(room);
    } catch (err) {
      cb?.({ ok: false, error: err.message });
      emitRoom(room);
    }
  });

  socket.on("playNope", ({ cardId }, cb) => {
    const room = rooms.get(socket.data.roomCode);
    try {
      if (!room?.pendingNope) throw new Error("No hay una accion para cancelar.");
      if (room.pendingNope.nopeCount === 0 && room.pendingNope.actorId === socket.id) {
        throw new Error("No puedes jugar Va a ser que NO sobre tu propia jugada.");
      }
      if (room.pendingNope.nopeCount > 0 && room.pendingNope.lastNopePlayerId === socket.id) {
        throw new Error("No puedes jugar Va a ser que NO sobre tu propio Va a ser que NO.");
      }
      const player = playerById(room, socket.id);
      if (!player?.alive) throw new Error("Jugador invalido.");
      const nope = cardId
        ? player.hand.find((card) => card.id === cardId && card.type === "nope")
        : player.hand.find((card) => card.type === "nope");
      if (!nope) throw new Error("No tienes Va a ser que NO.");
      room.discard.push(removeCard(player, nope.id));
      room.pendingNope.nopeCount += 1;
      room.pendingNope.lastNopePlayerId = socket.id;
      room.pendingNope.resolvesAt = Date.now() + 5000;
      log(room, `${player.name} juega Va a ser que NO.`);
      scheduleNopeResolution(room);
      cb?.({ ok: true });
      emitRoom(room);
    } catch (err) {
      cb?.({ ok: false, error: err.message });
    }
  });

  socket.on("shuffleHand", (_payload, cb) => {
    const room = rooms.get(socket.data.roomCode);
    try {
      const player = playerById(room, socket.id);
      if (!player) throw new Error("Jugador no encontrado.");
      shuffle(player.hand);
      cb?.({ ok: true });
      emitRoom(room);
    } catch (err) {
      cb?.({ ok: false, error: err.message });
    }
  });

  socket.on("retire", (_payload, cb) => {
    const room = rooms.get(socket.data.roomCode);
    try {
      if (!room || room.status !== "active") throw new Error("La partida no esta activa.");
      const player = playerById(room, socket.id);
      retirePlayer(room, player);
      cb?.({ ok: true });
      emitRoom(room);
    } catch (err) {
      cb?.({ ok: false, error: err.message });
      if (room) emitRoom(room);
    }
  });

  socket.on("playComboThree", (payload, cb) => {
    const room = rooms.get(socket.data.roomCode);
    try {
      playThreeOfAKind(room, socket, payload || {});
      cb?.({ ok: true });
      emitRoom(room);
    } catch (err) {
      cb?.({ ok: false, error: err.message });
      emitRoom(room);
    }
  });

  socket.on("playComboFive", (payload, cb) => {
    const room = rooms.get(socket.data.roomCode);
    try {
      playFiveDifferent(room, socket, payload || {});
      cb?.({ ok: true });
      emitRoom(room);
    } catch (err) {
      cb?.({ ok: false, error: err.message });
      emitRoom(room);
    }
  });

  socket.on("draw", (payload, cb) => {
    const room = rooms.get(socket.data.roomCode);
    try {
      requireCurrent(room, socket);
      drawCard(room, playerById(room, socket.id), payload?.bottom);
      cb?.({ ok: true });
      emitRoom(room);
    } catch (err) {
      cb?.({ ok: false, error: err.message });
    }
  });

  socket.on("closePeek", (_payload, cb) => {
    const room = rooms.get(socket.data.roomCode);
    try {
      if (room?.pendingPeek?.playerId === socket.id) room.pendingPeek = null;
      cb?.({ ok: true });
      emitRoom(room);
    } catch (err) {
      cb?.({ ok: false, error: err.message });
    }
  });

  socket.on("placeExploding", ({ index }, cb) => {
    const room = rooms.get(socket.data.roomCode);
    try {
      if (!room.pendingDefuse || room.pendingDefuse.playerId !== socket.id) throw new Error("No tienes gatito pendiente.");
      const safeIndex = Math.max(0, Math.min(Number(index), room.deck.length));
      room.deck.splice(safeIndex, 0, room.pendingDefuse.card);
      const player = playerById(room, socket.id);
      const cancelledTurns = room.pendingTurns[socket.id] || 1;
      log(room, `${player.name} escondio el Gatito Explosivo en una posicion secreta.`);
      const source = room.pendingDefuse.source || "deck";
      room.pendingDefuse = null;
      if (source === "deck") {
        if (cancelledTurns > 1) log(room, `Los ${cancelledTurns} turnos pendientes de ${player.name} se cancelan por el Gatito Explosivo.`);
        player.blind = false;
        delete room.pendingTurns[socket.id];
        advanceTurn(room);
      } else {
        log(room, `${player.name} continua su turno tras desactivar el Gatito Explosivo.`);
        finishGarbageIfReady(room);
      }
      cb?.({ ok: true });
      emitRoom(room);
    } catch (err) {
      cb?.({ ok: false, error: err.message });
    }
  });

  socket.on("placeImploding", ({ index }, cb) => {
    const room = rooms.get(socket.data.roomCode);
    try {
      if (!room.pendingImploding || room.pendingImploding.playerId !== socket.id) throw new Error("No tienes Gatito Implosivo pendiente.");
      const safeIndex = Math.max(0, Math.min(Number(index), room.deck.length));
      room.deck.splice(safeIndex, 0, room.pendingImploding.card);
      const player = playerById(room, socket.id);
      log(room, `${player.name} escondio el Gatito Implosivo boca arriba en una posicion secreta.`);
      room.pendingImploding = null;
      endOneTurn(room, socket.id);
      cb?.({ ok: true });
      emitRoom(room);
    } catch (err) {
      cb?.({ ok: false, error: err.message });
    }
  });

  socket.on("contributeGarbage", ({ cardId }, cb) => {
    const room = rooms.get(socket.data.roomCode);
    try {
      if (!room.pendingGarbage) throw new Error("No hay Recogida de Basura pendiente.");
      const player = playerById(room, socket.id);
      if (!player?.alive || !player.hand.length) throw new Error("No tienes cartas para aportar.");
      if (room.pendingGarbage.contributions.some((item) => item.playerId === socket.id)) throw new Error("Ya aportaste una carta.");
      const chosen = removeCard(player, cardId);
      if (!chosen) throw new Error("Carta invalida.");
      chosen.marked = false;
      room.pendingGarbage.contributions.push({ playerId: player.id, card: chosen });
      if (chosen.type === "streaking") explodeStreakingHolderIfNeeded(room, player);

      finishGarbageIfReady(room);
      cb?.({ ok: true });
      emitRoom(room);
    } catch (err) {
      cb?.({ ok: false, error: err.message });
      if (room) emitRoom(room);
    }
  });

  socket.on("giveFavor", ({ cardId }, cb) => {
    const room = rooms.get(socket.data.roomCode);
    try {
      if (!room.pendingFavor || room.pendingFavor.toId !== socket.id) throw new Error("No tienes favor pendiente.");
      const giver = playerById(room, socket.id);
      const receiver = playerById(room, room.pendingFavor.fromId);
      const chosen = removeCard(giver, cardId);
      if (!chosen) throw new Error("Carta invalida.");
      log(room, `${giver.name} entrega una carta a ${receiver.name}.`);
      resolveTransferredCard(room, { card: chosen, from: giver, to: receiver, reason: "favor" });
      room.pendingFavor = null;
      cb?.({ ok: true });
      emitRoom(room);
    } catch (err) {
      cb?.({ ok: false, error: err.message });
    }
  });

  socket.on("stealCard", ({ index }, cb) => {
    const room = rooms.get(socket.data.roomCode);
    try {
      if (!room.pendingSteal || room.pendingSteal.fromId !== socket.id) throw new Error("No tienes robo pendiente.");
      const thief = playerById(room, socket.id);
      const target = playerById(room, room.pendingSteal.targetId);
      if (!target || !target.hand.length) throw new Error("El objetivo no tiene cartas.");
      const safeIndex = Math.max(0, Math.min(Number(index), target.hand.length - 1));
      const stolen = target.hand.splice(safeIndex, 1)[0];
      log(room, `${thief.name} roba una carta de la mano de ${target.name}.`);
      emitToPlayer(target.id, "receiveCardAnimation", { card: stolen, fromName: thief.name, reason: "lost" });
      resolveTransferredCard(room, { card: stolen, from: target, to: thief, reason: "steal" });
      room.pendingSteal = null;
      cb?.({ ok: true });
      emitRoom(room);
    } catch (err) {
      cb?.({ ok: false, error: err.message });
    }
  });

  socket.on("markCard", ({ index }, cb) => {
    const room = rooms.get(socket.data.roomCode);
    try {
      if (!room.pendingMark || room.pendingMark.fromId !== socket.id) throw new Error("No tienes marca pendiente.");
      const marker = playerById(room, socket.id);
      const target = playerById(room, room.pendingMark.targetId);
      if (!target || !target.hand.length) throw new Error("El objetivo no tiene cartas.");
      const safeIndex = Math.max(0, Math.min(Number(index), target.hand.length - 1));
      target.hand[safeIndex].marked = true;
      log(room, `${marker.name} marca una carta de ${target.name}.`);
      room.pendingMark = null;
      cb?.({ ok: true });
      emitRoom(room);
    } catch (err) {
      cb?.({ ok: false, error: err.message });
      if (room) emitRoom(room);
    }
  });

  socket.on("alterFuture", ({ cardIds }, cb) => {
    const room = rooms.get(socket.data.roomCode);
    try {
      if (!room.pendingAlter || room.pendingAlter.playerId !== socket.id) throw new Error("No puedes alterar el futuro ahora.");
      const ids = Array.isArray(cardIds) ? cardIds : [];
      const cards = ids.map((cid) => room.pendingAlter.cards.find((c) => c.id === cid)).filter(Boolean);
      if (cards.length !== room.pendingAlter.cards.length) throw new Error("Orden invalido.");
      room.deck.splice(-cards.length, cards.length);
      room.deck.push(...cards.reverse());
      room.pendingAlter = null;
      cb?.({ ok: true });
      emitRoom(room);
    } catch (err) {
      cb?.({ ok: false, error: err.message });
    }
  });

  socket.on("chat", ({ text }) => {
    const room = rooms.get(socket.data.roomCode);
    const player = room && playerById(room, socket.id);
    const clean = String(text || "").trim().slice(0, 240);
    if (!room || !player || !clean) return;
    room.messages.push({ id: id("m"), playerId: player.id, name: player.name, text: clean, at: Date.now() });
    emitRoom(room);
  });

  socket.on("disconnect", () => {
    const room = rooms.get(socket.data.roomCode);
    if (!room) return;
    const player = playerById(room, socket.id);
    if (player) {
      player.connected = false;
      log(room, `${player.name} se desconecto.`);
      ensureLobbyHost(room);
      emitRoom(room);
    }
  });
});

server.listen(PORT, "0.0.0.0", () => {
  const urls = Object.values(os.networkInterfaces())
    .flat()
    .filter((net) => net && net.family === "IPv4" && !net.internal)
    .map((net) => `http://${net.address}:${PORT}`);
  console.log(`Servidor listo en http://localhost:${PORT}`);
  if (urls.length) console.log(`Red local: ${urls.join("  ")}`);
});
