const socket = io();

let state = null;
let selectedCard = null;
let toastTimer = null;
let handView = localStorage.getItem("gatitos.handView") || "fan";
let lastTurnPlayerId = null;
let turnAlertTimer = null;

const EXPANSION_OPTIONS = [
  { key: "imploding", name: "Imploding Kittens", description: "Gatito Implosivo y cartas como Marcha Atras, Robar del Fondo y Ataque Dirigido." },
  { key: "streaking", name: "Streaking Kittens", description: "Gatito Fugitivo y cartas compatibles de la expansion." }
];

const $ = (id) => document.getElementById(id);
const joinPanel = $("joinPanel");
const gamePanel = $("gamePanel");
const modal = $("modal");
const modalTitle = $("modalTitle");
const modalBody = $("modalBody");
const modalActions = $("modalActions");
const cardViewer = $("cardViewer");
const cardViewerTitle = $("cardViewerTitle");
const cardViewerType = $("cardViewerType");
const cardViewerDescription = $("cardViewerDescription");
const cardViewerImage = $("cardViewerImage");
const customTooltip = $("customTooltip");

function cardInfo(card) {
  if (!card) return {};
  const type = card.type === "blind" && card.marked ? card.realType : card.type;
  return state?.cardInfo?.[type] || {};
}

function cardName(card) {
  if (!card) return "";
  if (card.type === "blind" && !card.marked) return "Carta ciega";
  if (card.type === "blind" && card.marked) {
    const base = state?.cardInfo?.[card.realType]?.name || card.realType;
    return card.catName ? `${base}: ${card.catName}` : base;
  }
  const base = state?.cardInfo?.[card.type]?.name || card.type;
  return card.catName ? `${base}: ${card.catName}` : base;
}

function cardDescription(card) {
  if (!card) return "";
  if (card.type === "blind" && !card.marked) return "Carta oculta por la Maldicion del Culo de Gato. Debes jugarla al azar hasta poder volver a mirar tu mano.";
  const info = cardInfo(card);
  if (card.catName && (card.type === "cat" || card.type === "feralCat")) {
    return `${info.description || ""} Esta carta comparte icono de gato para combos de pares, trios y jugadas especiales cuando corresponda.`;
  }
  return info.description || "Carta lista para jugar segun las reglas de la partida.";
}

function cardTip(card) {
  const description = cardDescription(card);
  return description ? `${cardName(card)}: ${description}` : cardName(card);
}

function setTip(el, text) {
  if (text) el.dataset.tip = text;
}

function showCardViewer(card) {
  if (!card) return;
  const info = cardInfo(card);
  cardViewerTitle.textContent = cardName(card);
  cardViewerType.textContent = info.type ? info.type.toUpperCase() : "CARTA";
  cardViewerDescription.textContent = cardDescription(card);
  const image = card.image || (card.type === "blind" ? state?.cardBack : "");
  cardViewerImage.style.backgroundImage = image ? `url("${image}")` : "";
  cardViewerImage.classList.toggle("viewer-back", !card.image && card.type === "blind");
  if (!cardViewer.open) cardViewer.showModal();
}

function attachCardInspect(control, card, label = "Ver carta") {
  setTip(control, cardTip(card));
  control.addEventListener("dblclick", (event) => {
    event.preventDefault();
    event.stopPropagation();
    showCardViewer(card);
  });
  control.addEventListener("contextmenu", (event) => {
    event.preventDefault();
    showCardViewer(card);
  });
  if (label) control.setAttribute("aria-label", `${label}: ${cardName(card)}`);
}

function inspectButton(card) {
  const zoom = document.createElement("button");
  zoom.type = "button";
  zoom.className = "card-inspect";
  zoom.textContent = "i";
  setTip(zoom, `Ampliar ${cardName(card)}`);
  zoom.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    showCardViewer(card);
  });
  return zoom;
}

function moveTooltip(event) {
  if (!customTooltip || customTooltip.classList.contains("hidden")) return;
  const margin = 16;
  const maxLeft = window.innerWidth - customTooltip.offsetWidth - margin;
  const left = Math.max(margin, Math.min(maxLeft, event.clientX + 14));
  const below = event.clientY + customTooltip.offsetHeight + 20 < window.innerHeight;
  customTooltip.style.left = `${left}px`;
  customTooltip.style.top = `${below ? event.clientY + 14 : event.clientY - customTooltip.offsetHeight - 14}px`;
}

document.addEventListener("pointerover", (event) => {
  const target = event.target.closest("[data-tip]");
  if (!target || !customTooltip) return;
  customTooltip.textContent = target.dataset.tip;
  customTooltip.classList.remove("hidden");
  moveTooltip(event);
});

document.addEventListener("pointermove", moveTooltip);

document.addEventListener("pointerout", (event) => {
  if (!customTooltip || !event.target.closest("[data-tip]")) return;
  customTooltip.classList.add("hidden");
});

$("cardViewerClose")?.addEventListener("click", () => {
  if (cardViewer.open) cardViewer.close();
});

function pairKey(card) {
  if (!card) return "";
  if (card.type === "cat" || card.type === "feralCat") return `cat:${card.catName || state?.cardInfo?.feralCat?.name || "Gato Salvaje"}`;
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

function groupByTitle(cards) {
  const groups = new Map();
  cards.forEach((card) => {
    const key = pairKey(card);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(card);
  });
  return groups;
}

function showToast(text) {
  const toast = $("toast");
  toast.textContent = text;
  toast.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("show"), 2800);
}

function showTurnAlert(nextState) {
  if (nextState.status !== "active" || !nextState.currentPlayerId) return;
  if (lastTurnPlayerId === nextState.currentPlayerId) return;
  lastTurnPlayerId = nextState.currentPlayerId;
  const player = nextState.players.find((item) => item.id === nextState.currentPlayerId);
  if (!player) return;
  const alert = $("turnAlert");
  alert.textContent = nextState.currentPlayerId === nextState.you ? "Es tu turno" : `Turno de ${player.name}`;
  alert.classList.toggle("mine", nextState.currentPlayerId === nextState.you);
  alert.classList.remove("hidden", "show");
  clearTimeout(turnAlertTimer);
  void alert.offsetWidth;
  alert.classList.add("show");
  turnAlertTimer = setTimeout(() => {
    alert.classList.remove("show");
    setTimeout(() => alert.classList.add("hidden"), 260);
  }, 2300);
}

function ask(title, bodyNode, actions = []) {
  modalTitle.textContent = title;
  modal.querySelector(".modal-card").className = `modal-card ${
    bodyNode.classList.contains("favor-fan") || bodyNode.classList.contains("select-fan") || bodyNode.classList.contains("card-fan") || bodyNode.classList.contains("future-fan") || bodyNode.classList.contains("deck-position-picker")
      ? "wide"
      : "compact"
  }`;
  modalBody.replaceChildren(bodyNode);
  modalActions.replaceChildren(...actions);
  if (!modal.open) modal.showModal();
}

function closeModal() {
  if (modal.open) modal.close();
}

function api(event, payload = {}) {
  return new Promise((resolve) => {
    socket.emit(event, payload, (res) => {
      if (res && !res.ok) showToast(res.error || "No se pudo completar la accion.");
      resolve(res);
    });
  });
}

function render() {
  if (!state) return;
  joinPanel.classList.add("hidden");
  gamePanel.classList.remove("hidden");

  $("roomCode").textContent = state.code;
  const current = state.players.find((p) => p.id === state.currentPlayerId);
  const winner = state.players.find((p) => p.id === state.winnerId);
  $("statusTitle").textContent = state.status === "finished"
    ? `Gana ${winner?.name || "alguien con suerte"}`
    : state.status === "active"
      ? state.pendingNope
        ? "Esperando Va a ser que NO"
        : `Turno de ${current?.name || "..."}`
      : "Esperando jugadores";

  const isYourTurn = state.currentPlayerId === state.you && state.status === "active";
  $("startBtn").disabled = !state.isHost || state.status !== "lobby" || state.players.length < 2;
  $("drawBtn").disabled = !isYourTurn || Boolean(state.pendingDefuse || state.pendingImploding || state.pendingFavor || state.pendingSteal || state.pendingMark || state.pendingAlter || state.pendingGarbage || state.pendingNope);
  $("retireBtn").disabled = state.status !== "active" || !state.alive;
  $("deckButton").disabled = $("drawBtn").disabled;
  $("deckCount").textContent = state.deckCount;
  renderDeck(isYourTurn);
  $("nopeBtn").disabled = !state.hasNope;
  $("nopeBtn").classList.toggle("ready", Boolean(state.hasNope));
  $("nopeBtn").classList.toggle("playable", Boolean(state.canNope));
  if (state.nopeIcon) $("nopeBtn").style.backgroundImage = `url("${state.nopeIcon}")`;
  renderHostSummary();
  renderExpansionSummary();
  renderLobbyExpansionPanel();
  renderNopeBanner();
  renderHandActions(isYourTurn);

  renderPlayers();
  renderHand();
  renderLog();
  renderChat();
  renderDiscard();
  renderPending();
}

function renderDeck(isYourTurn) {
  const deck = $("deckButton");
  deck.style.backgroundImage = state.cardBack ? `url("${state.cardBack}")` : "";
  deck.style.removeProperty("--face-up-card");
  deck.classList.toggle("alert", isYourTurn);
  deck.classList.remove("face-up-top", "has-face-up");
  setTip(deck, "Robar del mazo");
}

function renderExpansionOptions(panel, { selected = [], readonly = false, onChange = null } = {}) {
  const selectedSet = new Set(selected);
  const options = state?.availableExpansions || EXPANSION_OPTIONS;
  panel.replaceChildren(...options.map((expansion) => {
    const label = document.createElement("label");
    setTip(label, expansion.description || "");
    const input = document.createElement("input");
    input.type = "checkbox";
    input.value = expansion.key;
    input.checked = selectedSet.has(expansion.key);
    input.disabled = readonly;
    if (onChange) input.addEventListener("change", onChange);
    label.append(input, document.createTextNode(expansion.name));
    return label;
  }));
}

function renderJoinExpansionPanel() {
  renderExpansionOptions($("joinExpansionPanel"), {
    selected: selectedExpansions(),
    onChange: null
  });
  $("joinExpansionPanel").querySelectorAll("input").forEach((input) => {
    input.dataset.joinExpansion = input.value;
  });
}

function renderLobbyExpansionPanel() {
  const fieldset = $("lobbyExpansions");
  const panel = $("lobbyExpansionPanel");
  const selected = state.selectedExpansions || [];
  const readonly = !state.isHost || state.status !== "lobby";
  fieldset.classList.toggle("readonly", readonly);
  fieldset.disabled = readonly;
  renderExpansionOptions(panel, {
    selected,
    readonly,
    onChange: async () => {
      const expansions = [...panel.querySelectorAll("input:checked")].map((input) => input.value);
      const res = await api("updateExpansions", { expansions });
      if (!res?.ok) renderLobbyExpansionPanel();
    }
  });
}

function renderHostSummary() {
  const summary = $("hostSummary");
  const host = state.players.find((player) => player.id === state.hostId);
  summary.textContent = host
    ? state.isHost
      ? "Eres el Host de esta sala"
      : `Host: ${host.name}`
    : "Host pendiente";
}

function renderExpansionSummary() {
  const summary = $("expansionSummary");
  const selected = state.selectedExpansions || [];
  if (!selected.length) {
    summary.textContent = "Sin expansiones";
    return;
  }
  const available = new Map((state.availableExpansions || EXPANSION_OPTIONS).map((item) => [item.key, item.name]));
  summary.textContent = `Expansiones: ${selected.map((key) => available.get(key) || key).join(", ")}`;
}

function selectedExpansions() {
  return [...document.querySelectorAll("[data-join-expansion]:checked")].map((input) => input.value);
}

function renderPlayers() {
  $("players").replaceChildren(...state.players.map((p, index) => {
    const el = document.createElement("div");
    el.className = `player seat-${index} ${p.id === state.currentPlayerId ? "current" : ""} ${p.alive ? "" : "dead"} ${p.id === state.you ? "you" : ""}`;
    const turns = state.pendingTurns[p.id] ? ` · ${state.pendingTurns[p.id]} turno(s)` : "";
    const fan = document.createElement("div");
    fan.className = "table-hand";
    for (let i = 0; i < p.handCount; i += 1) {
      const preview = p.tableHand?.[i];
      const back = document.createElement("span");
      back.className = `table-card-back ${preview?.marked ? "marked" : ""}`;
      const spread = Math.max(5, Math.min(11, 86 / Math.max(1, p.handCount - 1)));
      back.style.setProperty("--mini-tilt", `${(i - (p.handCount - 1) / 2) * 3}deg`);
      back.style.setProperty("--mini-offset", `${(i - (p.handCount - 1) / 2) * spread}px`);
      if (preview?.marked && preview.image) {
        back.style.backgroundImage = `url("${preview.image}")`;
        setTip(back, preview.name);
      } else if (state.cardBack) {
        back.style.backgroundImage = `url("${state.cardBack}")`;
      }
      fan.append(back);
    }
    const label = document.createElement("div");
    label.className = "player-label";
    label.innerHTML = `<strong>${escapeHtml(p.name)}${p.host ? " · Host" : ""}</strong><small>${p.alive ? `${p.handCount} cartas${turns}` : "eliminado"}${p.connected ? "" : " · desconectado"}</small>`;
    el.append(fan, label);
    return el;
  }));
}

function renderHand() {
  const cards = state.hand || [];
  $("hand").className = `hand hand-${handView}`;
  $("hand").replaceChildren(...cards.map((card, index) => {
    const info = state.cardInfo[card.type] || {};
    const el = document.createElement("button");
    el.className = `card ${info.type || ""}`;
    if (card.type === "blind" && !card.marked) {
      el.classList.add("image-card", "blind-card");
      el.style.backgroundImage = state.cardBack ? `url("${state.cardBack}")` : "";
      el.innerHTML = `<span class="sr-only">Carta ciega</span>`;
    } else if (card.image) {
      el.classList.add("image-card");
      if (card.marked) el.classList.add("marked-card");
      el.style.backgroundImage = `url("${card.image}")`;
      el.innerHTML = `<span class="sr-only">${escapeHtml(cardName(card))}</span>`;
    } else {
      el.innerHTML = `<h4>${escapeHtml(cardName(card))}</h4><p>${escapeHtml(info.description || "")}</p><small>${escapeHtml(info.type || "")}</small>`;
    }
    attachCardInspect(el, card, "Jugar carta");
    el.addEventListener("click", () => chooseCard(card));
    const slot = document.createElement("div");
    slot.className = "hand-card-slot";
    if (handView === "fan") slot.style.setProperty("--fan-tilt", `${(index - (cards.length - 1) / 2) * 4}deg`);
    slot.append(el, inspectButton(card));
    return slot;
  }));
}

function renderHandActions(isYourTurn) {
  const cards = state.hand || [];
  const comboCards = cards.filter((card) => card.type !== "blind");
  const groups = [...groupByTitle(comboCards).values()];
  const blocked = Boolean(state.pendingDefuse || state.pendingImploding || state.pendingFavor || state.pendingSteal || state.pendingMark || state.pendingAlter || state.pendingGarbage || state.pendingNope);
  const fiveEligible = cards.filter((card) => !["streaking", "exploding", "blind"].includes(card.type));
  $("shuffleHandBtn").disabled = !cards.length;
  $("comboThreeBtn").disabled = !isYourTurn || blocked || !groups.some((group) => group.length >= 3);
  $("comboFiveBtn").disabled = !isYourTurn || blocked || new Set(fiveEligible.map(pairKey)).size < 5 || !state.discardPile?.some((card) => !["streaking", "exploding"].includes(card.type));
  document.querySelectorAll("[data-view]").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.view === handView);
  });
}

function renderNopeBanner() {
  const banner = $("nopeBanner");
  if (!state.pendingNope) {
    banner.classList.add("hidden");
    banner.textContent = "";
    return;
  }
  const effect = state.pendingNope.nopeCount % 2 === 1 ? "cancelada por ahora" : "activa por ahora";
  banner.classList.remove("hidden");
  banner.textContent = `${state.pendingNope.summary} · ${state.pendingNope.nopeCount} NO · ${effect}`;
}

function renderLog() {
  $("log").replaceChildren(...state.log.map((entry) => {
    const p = document.createElement("p");
    p.textContent = entry.text;
    return p;
  }));
  $("log").scrollTop = $("log").scrollHeight;
}

function renderChat() {
  $("messages").replaceChildren(...state.messages.map((message) => {
    const el = document.createElement("div");
    el.className = "message";
    el.innerHTML = `<strong>${escapeHtml(message.name)}:</strong> <span>${escapeHtml(message.text)}</span>`;
    return el;
  }));
  $("messages").scrollTop = $("messages").scrollHeight;
}

function renderDiscard() {
  const last = state.lastDiscard;
  const discard = $("discardPile");
  if (last?.image) {
    discard.classList.add("discard-image");
    discard.style.backgroundImage = `url("${last.image}")`;
    discard.textContent = "";
    setTip(discard, `Ultima: ${cardTip(last)}`);
    discard.onclick = () => showCardViewer(last);
  } else {
    discard.classList.remove("discard-image");
    discard.style.backgroundImage = "";
    discard.textContent = last ? `Ultima: ${cardName(last)}` : "Descartes";
    delete discard.dataset.tip;
    discard.onclick = null;
  }
}

function buildDeckPositionPicker({ pending, message, confirmText, eventName, faceUp = false }) {
  const slots = Math.max(1, Number(pending.deckSlots || 1));
  const max = slots - 1;
  const currentCardCount = Math.max(0, slots - 1);
  const wrap = document.createElement("div");
  wrap.className = "deck-position-picker";

  const copy = document.createElement("p");
  copy.textContent = message;

  const visual = document.createElement("div");
  visual.className = "deck-position-visual";
  const strip = document.createElement("div");
  strip.className = "deck-position-strip";
  const marker = document.createElement("div");
  marker.className = "deck-position-marker";
  const fragment = document.createDocumentFragment();
  for (let i = 0; i < currentCardCount; i += 1) {
    const card = document.createElement("span");
    card.className = "position-mini-card";
    card.style.backgroundImage = state.cardBack ? `url("${state.cardBack}")` : "";
    fragment.append(card);
  }
  if (!currentCardCount) {
    const empty = document.createElement("span");
    empty.className = "position-empty";
    empty.textContent = "Mazo vacio";
    fragment.append(empty);
  }
  strip.append(fragment, marker);

  const controls = document.createElement("div");
  controls.className = "deck-position-controls";
  const range = document.createElement("input");
  range.type = "range";
  range.min = "0";
  range.max = String(max);
  range.value = String(max);
  range.className = "position-range";
  setTip(range, "Arriba deja la carta en la parte superior del mazo. Abajo la deja al fondo.");

  const number = document.createElement("input");
  number.type = "number";
  number.min = "0";
  number.max = String(max);
  number.value = range.value;
  number.className = "position-number";
  setTip(number, "Tambien puedes escribir la posicion exacta.");

  const label = document.createElement("strong");
  label.className = "position-label";
  const preview = document.createElement("div");
  preview.className = `position-card-preview ${faceUp ? "face-up" : ""}`;
  if (pending.card?.image) preview.style.backgroundImage = `url("${pending.card.image}")`;
  preview.append(inspectButton(pending.card || { type: faceUp ? "imploding" : "exploding" }));

  const paint = () => {
    const value = Math.max(0, Math.min(max, Number(range.value) || 0));
    range.value = String(value);
    number.value = String(value);
    const percent = max === 0 ? 100 : (value / max) * 100;
    strip.style.setProperty("--marker-x", `${percent}%`);
    label.textContent = `Posicion ${value} de ${max} (${value === max ? "arriba" : value === 0 ? "abajo" : "entre cartas"})`;
    [...strip.querySelectorAll(".position-mini-card")].forEach((card, index) => {
      const distance = Math.abs(index - value);
      const lift = Math.max(0, 13 - distance * 6);
      const lean = Math.max(-7, Math.min(7, value - index));
      card.style.setProperty("--lift", `${lift}px`);
      card.style.setProperty("--lean", `${lean}deg`);
    });
  };

  const nudge = () => {
    strip.classList.add("adjusting");
    clearTimeout(strip._adjustTimer);
    strip._adjustTimer = setTimeout(() => strip.classList.remove("adjusting"), 180);
  };

  range.addEventListener("input", () => {
    paint();
    nudge();
  });
  number.addEventListener("input", () => {
    range.value = String(Math.max(0, Math.min(max, Number(number.value) || 0)));
    paint();
    nudge();
  });

  controls.append(range, number, label);
  visual.append(strip, controls, preview);
  wrap.append(copy, visual);
  paint();

  const ok = button(confirmText, async () => {
    const res = await api(eventName, { index: Number(range.value) });
    if (res?.ok) closeModal();
  });
  return { wrap, ok };
}

function renderPending() {
  if (state.pendingImploding) {
    const waitMs = Math.max(0, (state.pendingImploding.showAfter || 0) - Date.now());
    if (waitMs > 0) {
      closeModal();
      setTimeout(renderPending, waitMs + 20);
      return;
    }
    const { wrap, ok } = buildDeckPositionPicker({
      pending: state.pendingImploding,
      message: `El Gatito Implosivo vuelve al mazo boca arriba. Elige una posicion secreta: 0 es abajo; ${state.pendingImploding.deckSlots - 1} es arriba.`,
      confirmText: "Esconder boca arriba",
      eventName: "placeImploding",
      faceUp: true
    });
    ask("Gatito Implosivo", wrap, [ok]);
    return;
  }

  if (state.pendingDefuse) {
    const waitMs = Math.max(0, (state.pendingDefuse.showAfter || 0) - Date.now());
    if (waitMs > 0) {
      closeModal();
      setTimeout(renderPending, waitMs + 20);
      return;
    }
    const { wrap, ok } = buildDeckPositionPicker({
      pending: state.pendingDefuse,
      message: `Elige una posicion secreta del mazo. 0 es abajo; ${state.pendingDefuse.deckSlots - 1} es arriba.`,
      confirmText: "Esconder gatito",
      eventName: "placeExploding"
    });
    ask("Desactivacion usada", wrap, [ok]);
    return;
  }

  if (state.pendingGarbage?.youMustChoose) {
    const list = document.createElement("div");
    list.className = "favor-fan";
    (state.hand || []).forEach((card) => {
      const cardBtn = document.createElement("button");
      cardBtn.type = "button";
      cardBtn.className = "favor-card";
      if (card.image) {
        cardBtn.style.backgroundImage = `url("${card.image}")`;
      } else {
        cardBtn.style.backgroundImage = state.cardBack ? `url("${state.cardBack}")` : "";
      }
      attachCardInspect(cardBtn, card, "Entregar carta");
      cardBtn.innerHTML = `<span class="sr-only">${escapeHtml(cardName(card))}</span>`;
      cardBtn.addEventListener("click", async () => {
        const res = await api("contributeGarbage", { cardId: card.id });
        if (res?.ok) closeModal();
      });
      list.append(cardBtn);
    });
    ask("Recogida de Basura", list, []);
    return;
  }

  if (state.pendingFavor?.toId === state.you) {
    const list = document.createElement("div");
    list.className = "favor-fan";
    (state.hand || []).forEach((card) => {
      const cardBtn = document.createElement("button");
      cardBtn.type = "button";
      cardBtn.className = "favor-card";
      if (card.image) cardBtn.style.backgroundImage = `url("${card.image}")`;
      attachCardInspect(cardBtn, card, "Entregar carta");
      cardBtn.innerHTML = `<span class="sr-only">${escapeHtml(cardName(card))}</span>`;
      cardBtn.addEventListener("click", async () => {
        const res = await api("giveFavor", { cardId: card.id });
        if (res?.ok) closeModal();
      });
      list.append(cardBtn);
    });
    ask("Debes entregar una carta", list, []);
    return;
  }

  if (state.pendingSteal?.fromId === state.you) {
    const fan = document.createElement("div");
    fan.className = "card-fan";
    for (let i = 0; i < state.pendingSteal.handCount; i += 1) {
      const preview = state.pendingSteal.handPreview?.[i];
      const back = document.createElement("button");
      back.type = "button";
      back.className = `card-back ${preview?.marked ? "marked" : ""}`;
      back.style.setProperty("--tilt", `${(i - (state.pendingSteal.handCount - 1) / 2) * 5}deg`);
      back.style.backgroundImage = preview?.marked && preview.image ? `url("${preview.image}")` : state.cardBack ? `url("${state.cardBack}")` : "";
      setTip(back, preview?.marked ? preview.name : `Carta ${i + 1}`);
      back.innerHTML = `<span class="sr-only">Carta ${i + 1}</span>`;
      back.addEventListener("click", async () => {
        const res = await api("stealCard", { index: i });
        if (res?.ok) closeModal();
      });
      fan.append(back);
    }
    const wrap = document.createElement("div");
    wrap.innerHTML = `<p>Elige una carta boca abajo de ${escapeHtml(state.pendingSteal.targetName || "otro jugador")}.</p>`;
    wrap.append(fan);
    ask("Robo por par", wrap, []);
    return;
  }

  if (state.pendingMark?.fromId === state.you) {
    const fan = document.createElement("div");
    fan.className = "card-fan";
    for (let i = 0; i < state.pendingMark.handCount; i += 1) {
      const preview = state.pendingMark.handPreview?.[i];
      const back = document.createElement("button");
      back.type = "button";
      back.className = `card-back ${preview?.marked ? "marked" : ""}`;
      back.style.setProperty("--tilt", `${(i - (state.pendingMark.handCount - 1) / 2) * 5}deg`);
      back.style.backgroundImage = preview?.marked && preview.image ? `url("${preview.image}")` : state.cardBack ? `url("${state.cardBack}")` : "";
      setTip(back, preview?.marked ? preview.name : `Carta ${i + 1}`);
      back.innerHTML = `<span class="sr-only">Carta ${i + 1}</span>`;
      back.addEventListener("click", async () => {
        const res = await api("markCard", { index: i });
        if (res?.ok) closeModal();
      });
      fan.append(back);
    }
    const wrap = document.createElement("div");
    wrap.innerHTML = `<p>Elige una carta de ${escapeHtml(state.pendingMark.targetName || "otro jugador")} para marcarla.</p>`;
    wrap.append(fan);
    ask("Marcar carta", wrap, []);
    return;
  }

  if (state.pendingPeek?.playerId === state.you) {
    const body = document.createElement("div");
    body.className = "future-fan";
    state.pendingPeek.cards.forEach((card, index) => {
      const cardEl = document.createElement("div");
      cardEl.className = "future-card";
      cardEl.style.setProperty("--tilt", `${(index - 1) * 8}deg`);
      if (card.image) cardEl.style.backgroundImage = `url("${card.image}")`;
      attachCardInspect(cardEl, card, "Ver carta");
      cardEl.innerHTML = `<span class="sr-only">${index + 1}. ${escapeHtml(cardName(card))}</span>`;
      cardEl.addEventListener("click", () => showCardViewer(card));
      body.append(cardEl);
    });
    ask(`Primeras ${state.pendingPeek.cards.length} cartas del mazo`, body, [button("Cerrar", async () => {
      const res = await api("closePeek");
      if (res?.ok) closeModal();
    })]);
    return;
  }

  if (state.pendingAlter?.playerId === state.you) {
    const order = [...state.pendingAlter.cards];
    const body = document.createElement("div");
    body.className = "future-fan alter-fan";
    let draggedId = null;
    const paint = () => {
      body.replaceChildren(...order.map((card, index) => {
        const cardEl = document.createElement("div");
        cardEl.className = "future-card draggable-card";
        cardEl.draggable = true;
        cardEl.style.setProperty("--tilt", `${(index - (order.length - 1) / 2) * 8}deg`);
        if (card.image) cardEl.style.backgroundImage = `url("${card.image}")`;
        attachCardInspect(cardEl, card, "Ver carta");
        cardEl.innerHTML = `<span class="sr-only">${index + 1}. ${escapeHtml(cardName(card))}</span>`;
        cardEl.addEventListener("dragstart", (event) => {
          draggedId = card.id;
          cardEl.classList.add("dragging");
          event.dataTransfer.effectAllowed = "move";
          event.dataTransfer.setData("text/plain", card.id);
        });
        cardEl.addEventListener("dragend", () => {
          draggedId = null;
          cardEl.classList.remove("dragging");
        });
        cardEl.addEventListener("dragover", (event) => {
          event.preventDefault();
          cardEl.classList.add("drop-target");
        });
        cardEl.addEventListener("dragleave", () => cardEl.classList.remove("drop-target"));
        cardEl.addEventListener("drop", (event) => {
          event.preventDefault();
          cardEl.classList.remove("drop-target");
          const sourceId = draggedId || event.dataTransfer.getData("text/plain");
          if (!sourceId || sourceId === card.id) return;
          const fromIndex = order.findIndex((item) => item.id === sourceId);
          const toIndex = order.findIndex((item) => item.id === card.id);
          if (fromIndex < 0 || toIndex < 0) return;
          const [moved] = order.splice(fromIndex, 1);
          order.splice(toIndex, 0, moved);
          paint();
        });
        return cardEl;
      }));
    };
    paint();
    ask("Alterar el futuro", body, [button("Confirmar orden", async () => {
      const res = await api("alterFuture", { cardIds: order.map((c) => c.id) });
      if (res?.ok) closeModal();
    })]);
    return;
  }

  closeModal();
}

function chooseCard(card) {
  if (card.type === "blind") {
    const yourTurn = state.currentPlayerId === state.you && state.status === "active";
    if (!yourTurn) return showToast("Espera tu turno.");
    api("playBlindCard");
    return;
  }
  if (card.type === "nope" && state.canNope) {
    api("playNope", { cardId: card.id });
    return;
  }
  const yourTurn = state.currentPlayerId === state.you && state.status === "active";
  if (!yourTurn) return showToast("Espera tu turno.");
  selectedCard = card;

  const compatiblePairs = state.hand.filter((c) => c.id !== card.id && pairCompatible(c, card));
  const canPlaySingle = !["defuse", "exploding", "streaking", "cat", "feralCat", "nope"].includes(card.type);

  if (compatiblePairs.length && canPlaySingle) {
    const body = document.createElement("div");
    body.className = "choice-list";
    body.append(
      button(`Jugar efecto: ${cardName(card)}`, () => {
        closeModal();
        playSingle(card);
      }),
      button("Jugar como par para robar", () => {
        closeModal();
        choosePair(card, compatiblePairs);
      })
    );
    ask("Elige jugada", body, [button("Cancelar", closeModal)]);
    return;
  }

  if (compatiblePairs.length) {
    choosePair(card, compatiblePairs);
    return;
  }

  if (!canPlaySingle) return showToast("Esa carta funciona automaticamente o necesita un par.");
  playSingle(card);
}

function playSingle(card) {
  const needsTarget = ["favor", "targetAttack", "mark", "curse"].includes(card.type);
  if (!needsTarget) {
    api("playCard", { cardId: card.id });
    return;
  }
  chooseTarget(card);
}

function choosePair(card, compatiblePairs) {
  const body = document.createElement("div");
  body.className = "choice-list";
  const pairTitle = document.createElement("p");
  pairTitle.textContent = "Elige la segunda carta con el mismo icono.";
  body.append(pairTitle, ...compatiblePairs.map((pair) => button(cardName(pair), () => chooseTarget(card, pair))));
  ask("Jugar par", body, [button("Cancelar", closeModal)]);
}

function chooseTarget(card, pair = null) {
  const body = document.createElement("div");
  body.className = "choice-list";
  const targets = state.players.filter((p) => p.alive && p.id !== state.you && (!["favor", "mark"].includes(card.type) || p.handCount > 0));
  if (!targets.length) return showToast("No hay objetivos validos.");
  targets.forEach((target) => {
    body.append(button(target.name, async () => {
      const res = await api("playCard", { cardId: card.id, pairCardId: pair?.id, targetId: target.id, mode: pair ? "pair" : "single" });
      if (res?.ok) closeModal();
    }));
  });
  ask("Elige objetivo", body, [button("Cancelar", closeModal)]);
}

function chooseThreeCombo() {
  const groups = [...groupByTitle(state.hand || []).values()].filter((group) => group.length >= 3);
  if (!groups.length) return showToast("No tienes 3 cartas identicas.");
  const body = document.createElement("div");
  body.className = "choice-list";
  groups.forEach((group) => {
    body.append(button(cardName(group[0]), () => chooseThreeTarget(group.slice(0, 3))));
  });
  ask("Combo 3 identicas", body, [button("Cancelar", closeModal)]);
}

function chooseThreeTarget(cards) {
  const targets = state.players.filter((p) => p.alive && p.id !== state.you);
  if (!targets.length) return showToast("No hay objetivos validos.");
  const body = document.createElement("div");
  body.className = "choice-list";
  targets.forEach((target) => {
    body.append(button(target.name, () => chooseThreeClaim(cards, target)));
  });
  ask("Elige jugador", body, [button("Cancelar", closeModal)]);
}

function chooseThreeClaim(cards, target) {
  const body = document.createElement("div");
  body.className = "choice-list";
  (state.claimableCards || []).forEach((claim) => {
    body.append(button(claim.name, async () => {
      const res = await api("playComboThree", {
        cardIds: cards.map((card) => card.id),
        targetId: target.id,
        requestedKey: claim.key
      });
      if (res?.ok) closeModal();
    }));
  });
  ask("Nombra la carta", body, [button("Cancelar", closeModal)]);
}

function chooseFiveCombo() {
  const hand = (state.hand || []).filter((card) => !["streaking", "exploding", "blind"].includes(card.type));
  if (new Set(hand.map(pairKey)).size < 5) return showToast("No tienes 5 cartas diferentes.");
  if (!state.discardPile?.length) return showToast("La pila de descarte esta vacia.");
  const selected = [];
  const body = document.createElement("div");
  body.className = "select-fan";
  const status = document.createElement("p");
  status.className = "select-status";
  const fan = document.createElement("div");
  fan.className = "favor-fan";

  const paint = () => {
    status.textContent = `Selecciona 5 cartas diferentes (${selected.length}/5).`;
    fan.replaceChildren(...hand.map((card) => {
      const cardBtn = document.createElement("button");
      cardBtn.type = "button";
      cardBtn.className = `favor-card selectable-card ${selected.includes(card.id) ? "selected" : ""}`;
      if (card.image) cardBtn.style.backgroundImage = `url("${card.image}")`;
      attachCardInspect(cardBtn, card, "Seleccionar carta");
      cardBtn.innerHTML = `<span class="sr-only">${escapeHtml(cardName(card))}</span>`;
      cardBtn.addEventListener("click", () => {
        const existingIndex = selected.indexOf(card.id);
        if (existingIndex >= 0) {
          selected.splice(existingIndex, 1);
        } else {
          const selectedCards = selected.map((id) => hand.find((item) => item.id === id));
          if (selectedCards.some((item) => pairKey(item) === pairKey(card))) return showToast("Las 5 cartas deben tener titulos diferentes.");
          if (selected.length >= 5) return showToast("Ya elegiste 5 cartas.");
          selected.push(card.id);
        }
        paint();
      });
      return cardBtn;
    }));
  };

  body.append(status, fan);
  paint();
  ask("Elige 5 cartas diferentes", body, [
    button("Continuar", () => {
      if (selected.length !== 5) return showToast("Debes elegir exactamente 5 cartas.");
      chooseFiveDiscard(selected);
    }),
    button("Cancelar", closeModal)
  ]);
}

function chooseFiveDiscard(cardIds) {
  const body = document.createElement("div");
  body.className = "choice-list";
  state.discardPile.forEach((card, index) => {
    if (["streaking", "exploding"].includes(card.type)) return;
    body.append(button(`${index + 1}. ${cardName(card)}`, async () => {
      const res = await api("playComboFive", { cardIds, discardIndex: index });
      if (res?.ok) closeModal();
    }));
  });
  ask("Recuperar del descarte", body, [button("Cancelar", closeModal)]);
}

function button(text, onClick) {
  const el = document.createElement("button");
  el.type = "button";
  el.textContent = text;
  el.addEventListener("click", onClick);
  return el;
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[ch]));
}

function playDrawAnimation({ card, explosive, imploding }) {
  const stage = $("drawStage");
  const drawCard = $("drawCard");
  const boom = $("boom");
  drawCard.className = `draw-card ${explosive ? "explosive" : ""} ${imploding ? "imploding" : ""}`;
  drawCard.style.backgroundImage = card?.image ? `url("${card.image}")` : "";
  setTip(drawCard, cardTip(card));
  drawCard.onclick = () => showCardViewer(card);
  boom.classList.toggle("active", Boolean(explosive));
  stage.classList.remove("hidden");
  stage.classList.remove("done");
  void stage.offsetWidth;
  stage.classList.add(explosive ? "explode-run" : "draw-run");
  setTimeout(() => {
    stage.classList.add("done");
  }, explosive ? 3000 : 1250);
  setTimeout(() => {
    stage.classList.add("hidden");
    stage.classList.remove("draw-run", "explode-run", "done");
    boom.classList.remove("active");
    drawCard.style.backgroundImage = "";
    delete drawCard.dataset.tip;
    drawCard.onclick = null;
  }, explosive ? 3350 : 1800);
}

function playReceiveCardAnimation({ card, fromName, reason }) {
  const stage = $("drawStage");
  const drawCard = $("drawCard");
  const boom = $("boom");
  drawCard.className = "draw-card received";
  drawCard.style.backgroundImage = card?.image ? `url("${card.image}")` : "";
  setTip(drawCard, cardTip(card));
  drawCard.onclick = () => showCardViewer(card);
  drawCard.dataset.caption = reason === "favor"
    ? `${fromName || "Otro jugador"} te entrego ${cardName(card)}`
    : reason === "lost"
      ? `${fromName || "Otro jugador"} robo ${cardName(card)} de tu mano`
    : `Robaste ${cardName(card)} de ${fromName || "otro jugador"}`;
  boom.classList.remove("active");
  stage.classList.remove("hidden", "draw-run", "explode-run", "done");
  void stage.offsetWidth;
  stage.classList.add("receive-run");
  setTimeout(() => stage.classList.add("done"), 1650);
  setTimeout(() => {
    stage.classList.add("hidden");
    stage.classList.remove("receive-run", "done");
    drawCard.style.backgroundImage = "";
    drawCard.dataset.caption = "";
    delete drawCard.dataset.tip;
    drawCard.onclick = null;
  }, 2100);
}

function playDeckShuffleAnimation() {
  const deck = $("deckButton");
  const tableCore = document.querySelector(".table-core");
  const burst = document.createElement("div");
  burst.className = "shuffle-burst";
  for (let i = 0; i < 10; i += 1) {
    const card = document.createElement("span");
    card.className = "shuffle-card";
    card.style.setProperty("--i", i);
    card.style.setProperty("--x1", `${(i - 4.5) * 10}px`);
    card.style.setProperty("--y1", `${((i % 2) - 0.5) * 24}px`);
    card.style.setProperty("--r1", `${(i - 5) * 5}deg`);
    card.style.setProperty("--x2", `${(4.5 - i) * 18}px`);
    card.style.setProperty("--y2", `${(0.5 - (i % 2)) * 42}px`);
    card.style.setProperty("--r2", `${(5 - i) * 8}deg`);
    card.style.setProperty("--x3", `${(i - 4.5) * 7}px`);
    card.style.setProperty("--y3", `${((i % 3) - 1) * 18}px`);
    card.style.setProperty("--r3", `${(i - 5) * 3}deg`);
    card.style.backgroundImage = state?.cardBack ? `url("${state.cardBack}")` : "";
    burst.append(card);
  }
  tableCore?.append(burst);
  deck.classList.remove("shuffling");
  void deck.offsetWidth;
  deck.classList.add("shuffling");
  setTimeout(() => {
    deck.classList.remove("shuffling");
    burst.remove();
  }, 1800);
}

function playDeckSwapAnimation() {
  const tableCore = document.querySelector(".table-core");
  const wrap = document.createElement("div");
  wrap.className = "swap-burst";
  for (let i = 0; i < 2; i += 1) {
    const card = document.createElement("span");
    card.className = `swap-card swap-card-${i}`;
    card.style.backgroundImage = state?.cardBack ? `url("${state.cardBack}")` : "";
    wrap.append(card);
  }
  tableCore?.append(wrap);
  setTimeout(() => wrap.remove(), 1200);
}

$("joinForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  const name = $("nameInput").value;
  const roomCode = $("roomInput").value;
  const res = await api("join", { name, roomCode, expansions: selectedExpansions() });
  if (res?.ok) $("roomCode").textContent = res.code;
});

$("startBtn").addEventListener("click", async () => {
  await api("startGame");
});
$("drawBtn").addEventListener("click", () => api("draw"));
$("retireBtn").addEventListener("click", () => {
  if (!confirm("¿Seguro que quieres retirarte y descartar toda tu mano?")) return;
  api("retire");
});
$("deckButton").addEventListener("click", () => api("draw"));
$("nopeBtn").addEventListener("click", () => {
  if (state?.pendingNope?.nopeCount === 0 && state.pendingNope.actorId === state.you) {
    return showToast("No puedes cancelar tu propia jugada.");
  }
  if (state?.pendingNope?.nopeCount > 0 && state.pendingNope.lastNopePlayerId === state.you) {
    return showToast("No puedes cancelar tu propio Va a ser que NO.");
  }
  if (!state?.canNope) return showToast("Puedes jugar Va a ser que NO cuando haya una accion pendiente.");
  api("playNope");
});
$("shuffleHandBtn").addEventListener("click", () => api("shuffleHand"));
$("comboThreeBtn").addEventListener("click", chooseThreeCombo);
$("comboFiveBtn").addEventListener("click", chooseFiveCombo);
document.querySelectorAll("[data-view]").forEach((btn) => {
  btn.addEventListener("click", () => {
    handView = btn.dataset.view;
    localStorage.setItem("gatitos.handView", handView);
    renderHand();
    renderHandActions(state?.currentPlayerId === state?.you && state?.status === "active");
  });
});

document.addEventListener("pointermove", (event) => {
  const surface = document.querySelector(".game-surface");
  if (!surface) return;
  const rect = surface.getBoundingClientRect();
  if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) return;
  surface.style.setProperty("--mx", `${((event.clientX - rect.left) / rect.width) * 100}%`);
  surface.style.setProperty("--my", `${((event.clientY - rect.top) / rect.height) * 100}%`);
});

renderJoinExpansionPanel();

$("chatForm").addEventListener("submit", (event) => {
  event.preventDefault();
  const text = $("chatInput").value;
  socket.emit("chat", { text });
  $("chatInput").value = "";
});

socket.on("state", (nextState) => {
  showTurnAlert(nextState);
  state = nextState;
  render();
});

socket.on("drawAnimation", playDrawAnimation);
socket.on("receiveCardAnimation", playReceiveCardAnimation);
socket.on("deckShuffleAnimation", playDeckShuffleAnimation);
socket.on("deckSwapAnimation", playDeckSwapAnimation);

socket.on("peek", ({ title, cards }) => {
  const body = document.createElement("div");
  body.className = "choice-list";
  cards.forEach((card, index) => {
    const p = document.createElement("p");
    p.textContent = `${index + 1}. ${cardName(card)}`;
    body.append(p);
  });
  ask(title, body, [button("Cerrar", closeModal)]);
});
