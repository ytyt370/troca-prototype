import React, { useState, useEffect } from 'react';
 
// ============ 게임 상수 ============
const GEM_TYPES = ['R', 'E', 'S', 'T'];
const GEM_NAMES = { R: '루비', E: '에메랄드', S: '사파이어', T: '황수정', J: '조커' };
const GEM_COLORS = {
  R: { bg: '#dc2626', text: '#fff', border: '#991b1b' },
  E: { bg: '#16a34a', text: '#fff', border: '#15803d' },
  S: { bg: '#2563eb', text: '#fff', border: '#1e40af' },
  T: { bg: '#eab308', text: '#000', border: '#a16207' },
  J: { bg: '#7c3aed', text: '#fff', border: '#5b21b6' },
};
 
const CARD_COMPOSITION = [
  { count: 1, copies: 5 },
  { count: 2, copies: 4 },
  { count: 3, copies: 3 },
  { count: 4, copies: 2 },
  { count: 6, copies: 1 },
];
 
const VICTORY_CONDITIONS = [
  { id: 'monopoly', name: '독점', type: '자율', desc: '한 종류 17개 이상 보유', score: { 4: 15, 3: 13, 2: 11 } },
  { id: 'jester', name: '광대', type: '자율', desc: '조커 2장 모두 보유', score: { 4: 5, 3: 5, 2: 5 } },
  { id: 'balance', name: '균형', type: '종속', desc: '환율 1:1:1:1', score: { 4: 12, 3: 10, 2: 8 } },
  { id: 'inequality', name: '불평등', type: '종속', desc: '모든 보석 가치가 다름', score: { 4: 6, 3: 5, 2: 4 } },
  { id: 'tax', name: '세금', type: '종속', desc: '모든 필드의 6 1장당', score: { 4: 3, 3: 2, 2: 2 } },
  { id: 'rich', name: '부자', type: '종속', desc: '총가치 45/40/35 이상', score: { 4: 8, 3: 6, 2: 5 } },
  { id: 'poor', name: '거지', type: '종속', desc: '총가치 10/8/6 이하', score: { 4: 11, 3: 9, 2: 7 } },
  { id: 'selfish', name: '이기주의', type: '종속', desc: '핸드 8/9/13장 이상', score: { 4: 8, 3: 7, 2: 10 } },
];
 
// 플레이어 위치 매핑 (남쪽이 현재 턴 플레이어)
// 4인: South, West, North, East 순으로 회전 (시계 반대 방향, P1이 남에서 시작)
// 3인: South, ?, ? - 시계방향 진행에 맞춰 다음이 남으로 오게 회전
// 2인: South, North
function getPlayerPositions(numPlayers, currentPlayerIdx) {
  // 각 플레이어 id에 대해 어느 방향(N/S/E/W)에 배치할지 결정
  // 현재 턴 플레이어는 항상 'S'
  const positions = {};
  if (numPlayers === 4) {
    // P1, P2, P3, P4의 기본 배치: P1=S, P2=W, P3=N, P4=E (시계 반대 방향 회전)
    // 다음 턴이면 P2=S, P3=W, P4=N, P1=E
    const dirs = ['S', 'W', 'N', 'E'];
    for (let i = 0; i < 4; i++) {
      const playerIdx = (currentPlayerIdx + i) % 4;
      positions[playerIdx] = dirs[i];
    }
  } else if (numPlayers === 3) {
    // P1=S, P2=W, P3=E (북쪽은 비움)
    // 진행: P1 턴 → P2 턴 → P3 턴 → P1 턴
    // P2 턴 시: P2=S, P3=W, P1=E (각자 시계방향 한 칸씩)
    // P3 턴 시: P3=S, P1=W, P2=E
    const dirs = ['S', 'W', 'E'];
    for (let i = 0; i < 3; i++) {
      const playerIdx = (currentPlayerIdx + i) % 3;
      positions[playerIdx] = dirs[i];
    }
  } else if (numPlayers === 2) {
    // P1=S, P2=N. 다음 턴이면 P2=S, P1=N
    positions[currentPlayerIdx] = 'S';
    positions[(currentPlayerIdx + 1) % 2] = 'N';
  }
  return positions;
}
 
// ============ 유틸 함수 ============
let cardIdCounter = 0;
const newCardId = () => `c${++cardIdCounter}`;
 
function buildDeck() {
  const cards = [];
  for (const gem of GEM_TYPES) {
    for (const { count, copies } of CARD_COMPOSITION) {
      for (let i = 0; i < copies; i++) {
        cards.push({ id: newCardId(), gem, count });
      }
    }
  }
  return cards;
}
 
function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
 
function calculateRates(exchangeBoard) {
  const rates = {};
  for (const gem of GEM_TYPES) {
    const card = exchangeBoard[gem];
    rates[gem] = card ? card.count : 1;
  }
  return rates;
}
 
function calculateTotalValue(cards, rates) {
  const maxRate = Math.max(...Object.values(rates));
  let total = 0;
  for (const card of cards) {
    if (card.gem === 'J') {
      total += card.count * maxRate;
    } else {
      total += (card.count * maxRate) / rates[card.gem];
    }
  }
  return total;
}
 
function cardValue(card, rates) {
  const maxRate = Math.max(...Object.values(rates));
  if (card.gem === 'J') return card.count * maxRate;
  return (card.count * maxRate) / rates[card.gem];
}
 
function cardsValue(cards, rates) {
  return cards.reduce((sum, c) => sum + cardValue(c, rates), 0);
}
 
function initGameState(numPlayers) {
  cardIdCounter = 0;
  const deck = shuffle(buildDeck());
  const handCounts = { 4: 2, 3: 3, 2: 5 };
  const fieldCounts = { 4: 5, 3: 7, 2: 9 };
  const handSize = handCounts[numPlayers];
  const fieldSize = fieldCounts[numPlayers];
  const totalPerPlayer = handSize + fieldSize;
 
  const vcDealCount = numPlayers === 2 ? 2 : 1;
  const vcShuffled = shuffle([...VICTORY_CONDITIONS]);
 
  const players = [];
  let deckIdx = 0;
  for (let i = 0; i < numPlayers; i++) {
    const cards = deck.slice(deckIdx, deckIdx + totalPerPlayer);
    deckIdx += totalPerPlayer;
    const hand = cards.slice(0, handSize);
    const field = cards.slice(handSize);
    const victoryCards = [];
    for (let v = 0; v < vcDealCount; v++) {
      victoryCards.push(vcShuffled[(i * vcDealCount + v) % vcShuffled.length]);
    }
    players.push({
      id: i,
      name: `P${i + 1}`,
      hand,
      field,
      victoryCards,
      score: 0,
    });
  }
 
  const jokers = [
    { id: newCardId(), gem: 'J', count: 1 },
    { id: newCardId(), gem: 'J', count: 1 },
  ];
  const shuffledGems = shuffle(GEM_TYPES);
  const exchangeBoard = { R: null, E: null, S: null, T: null };
  exchangeBoard[shuffledGems[0]] = jokers[0];
  exchangeBoard[shuffledGems[1]] = jokers[1];
 
  const remainingDeck = deck.slice(deckIdx);
 
  return {
    numPlayers,
    players,
    deck: remainingDeck,
    exchangeBoard,
    currentPlayer: 0,
    turn: 1,
    actionsThisTurn: { drew: false, exchanged: false, traded: false },
    log: [`라운드 시작 (${numPlayers}인)`, `초기 환율판: ${shuffledGems[0]}=J1, ${shuffledGems[1]}=J1`],
    gameEnded: false,
    endReason: null,
    finalScores: null,
    pendingAction: null, // {type: 'exchange'|'trade', stage, ...}
  };
}
 
// ============ 메인 컴포넌트 ============
export default function TrocaPrototype() {
  const [state, setState] = useState(null);
  const [numPlayers, setNumPlayers] = useState(4);
  const [savedExists, setSavedExists] = useState(false);
 
  useEffect(() => {
    (async () => {
      try {
        const r = localStorage.getItem('troca_game');
        if (r) setSavedExists(true);
      } catch (e) {}
    })();
  }, []);
 
  useEffect(() => {
    if (state) {
      localStorage.setItem('troca_game', JSON.stringify(state));
    }
  }, [state]);
 
  function startNewGame() {
    const s = initGameState(numPlayers);
    setState(s);
    cardIdCounter = 1000;
  }
 
  async function loadGame() {
    try {
      const r = localStorage.getItem('troca_game');
      if (r) {
        const s = JSON.parse(r.value);
        setState(s);
        setNumPlayers(s.numPlayers);
      }
    } catch (e) {}
  }
 
  function clearSaved() {
    localStorage.removeItem('troca_game');
    setSavedExists(false);
    setState(null);
  }
 
  function exportLog() {
    if (!state) return;
    const data = {
      timestamp: new Date().toISOString(),
      numPlayers: state.numPlayers,
      turn: state.turn,
      log: state.log,
      finalScores: state.finalScores,
      endReason: state.endReason,
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `troca_log_${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }
 
  if (!state) {
    return (
      <div style={styles.app}>
        <div style={styles.startScreen}>
          <h1 style={styles.title}>TROCA</h1>
          <div style={styles.subtitle}>v1.0.1 prototype</div>
          <div style={{ marginTop: 32 }}>
            <label style={styles.label}>인원 수</label>
            <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
              {[2, 3, 4].map(n => (
                <button
                  key={n}
                  onClick={() => setNumPlayers(n)}
                  style={{ ...styles.btn, ...(numPlayers === n ? styles.btnPrimary : {}), flex: 1 }}
                >
                  {n}인
                </button>
              ))}
            </div>
          </div>
          <button onClick={startNewGame} style={{ ...styles.btn, ...styles.btnPrimary, marginTop: 24, width: '100%' }}>
            새 게임 시작
          </button>
          {savedExists && (
            <button onClick={loadGame} style={{ ...styles.btn, marginTop: 8, width: '100%' }}>
              저장된 게임 불러오기
            </button>
          )}
          {savedExists && (
            <button onClick={clearSaved} style={{ ...styles.btn, ...styles.btnDanger, marginTop: 8, width: '100%' }}>
              저장된 게임 삭제
            </button>
          )}
        </div>
      </div>
    );
  }
 
  return <GameView state={state} setState={setState} onNewGame={() => { clearSaved(); setState(null); }} onExport={exportLog} />;
}
 
// ============ 게임 뷰 ============
function GameView({ state, setState, onNewGame, onExport }) {
  const rates = calculateRates(state.exchangeBoard);
  const currentP = state.players[state.currentPlayer];
  const positions = getPlayerPositions(state.numPlayers, state.currentPlayer);
 
  // ===== 액션 함수들 =====
  function doDraw() {
    if (state.actionsThisTurn.drew || state.actionsThisTurn.exchanged || state.actionsThisTurn.traded) return;
    if (state.deck.length === 0) { alert('덱이 비었습니다'); return; }
    const drawn = state.deck.slice(0, 2);
    const newDeck = state.deck.slice(2);
    const newPlayers = state.players.map(p => p.id === currentP.id ? { ...p, hand: [...p.hand, ...drawn] } : p);
    const newState = {
      ...state, players: newPlayers, deck: newDeck,
      actionsThisTurn: { drew: true, exchanged: false, traded: false },
      log: [...state.log, `T${state.turn} ${currentP.name}: 드로우 ${drawn.length}장 (덱 ${newDeck.length}장 남음)`],
    };
    setState(newState);
    checkAutoEnd(newState);
  }
 
  function doExchange(cardId, targetGem) {
    const card = [...currentP.hand, ...currentP.field].find(c => c.id === cardId);
    if (!card) return;
 
    if (card.gem !== 'J' && card.gem !== targetGem) {
      alert(`${GEM_NAMES[card.gem]} 카드는 ${targetGem}칸에 놓을 수 없습니다 (조커만 가능)`);
      return;
    }
    const existing = state.exchangeBoard[targetGem];
    if (existing) {
      if (card.gem === 'J') {
        if (existing.count === 6) { alert('조커는 6장짜리 카드 위에는 놓을 수 없습니다'); return; }
      } else {
        if (card.count <= existing.count) {
          alert(`X 보석 수(${card.count})가 Y 보석 수(${existing.count})보다 커야 합니다`);
          return;
        }
      }
    }
 
    const fromHand = currentP.hand.some(c => c.id === cardId);
    const newHand = fromHand ? currentP.hand.filter(c => c.id !== cardId) : [...currentP.hand];
    const newField = !fromHand ? currentP.field.filter(c => c.id !== cardId) : [...currentP.field];
 
    let newPlayers, newDeck = state.deck, newBoard = { ...state.exchangeBoard }, logMsg;
    if (existing) {
      newField.push(existing);
      newBoard[targetGem] = card;
      newPlayers = state.players.map(p => p.id === currentP.id ? { ...p, hand: newHand, field: newField } : p);
      logMsg = `환율공시 ${targetGem}칸: ${card.gem}${card.count} 놓고 ${existing.gem}${existing.count} 회수`;
    } else {
      newBoard[targetGem] = card;
      const drawn = state.deck.slice(0, 2);
      newDeck = state.deck.slice(2);
      newPlayers = state.players.map(p => p.id === currentP.id ? { ...p, hand: [...newHand, ...drawn], field: newField } : p);
      logMsg = `환율공시 ${targetGem}칸(빈 칸): ${card.gem}${card.count} 놓고 덱에서 ${drawn.length}장 드로우`;
    }
 
    const newState = {
      ...state, players: newPlayers, deck: newDeck, exchangeBoard: newBoard,
      actionsThisTurn: { ...state.actionsThisTurn, exchanged: true },
      pendingAction: null,
      log: [...state.log, `T${state.turn} ${currentP.name}: ${logMsg}`],
    };
    setState(newState);
    checkAutoEnd(newState);
  }
 
  function submitTradeY(yCardIds, refused) {
    const target = state.players[state.pendingAction.targetId];
    const x = state.pendingAction.x;
 
    if (refused) {
      setState({ ...state, pendingAction: { ...state.pendingAction, stage: 'select_grab' } });
      return;
    }
 
    const yCards = yCardIds.map(id => [...target.hand, ...target.field].find(c => c.id === id)).filter(Boolean);
 
    if (yCards.length === 0) { alert('Y 카드를 선택하세요'); return; }
    if (yCards.some(c => c.gem === x.gem)) {
      alert(`X(${x.gem}) 카드와 같은 종류는 제시할 수 없습니다`);
      return;
    }
    if (yCards.length >= 2) {
      const firstGem = yCards[0].gem;
      if (yCards.some(c => c.gem !== firstGem)) {
        alert('2장 이상 제시 시 1종류만 가능합니다');
        return;
      }
    }
    const yVal = cardsValue(yCards, rates);
    const xVal = cardValue(x, rates);
    if (yVal < xVal - 0.0001) {
      alert(`Y의 총가치(${yVal.toFixed(2)})가 X(${xVal.toFixed(2)}) 이상이어야 합니다`);
      return;
    }
 
    const targetNewHand = target.hand.filter(c => !yCardIds.includes(c.id));
    const targetNewField = [...target.field.filter(c => !yCardIds.includes(c.id)), x];
    const currentNewHand = currentP.hand.filter(c => c.id !== x.id);
    const currentNewField = [...currentP.field.filter(c => c.id !== x.id), ...yCards];
 
    const newPlayers = state.players.map(p => {
      if (p.id === currentP.id) return { ...p, hand: currentNewHand, field: currentNewField };
      if (p.id === target.id) return { ...p, hand: targetNewHand, field: targetNewField };
      return p;
    });
 
    const newState = {
      ...state, players: newPlayers, pendingAction: null,
      actionsThisTurn: { ...state.actionsThisTurn, traded: true },
      log: [...state.log, `T${state.turn} ${currentP.name}: 무역 성립 (${target.name}에게 ${x.gem}${x.count} 주고 ${yCards.map(c => `${c.gem}${c.count}`).join(',')} 받음)`],
    };
    setState(newState);
    checkAutoEnd(newState);
  }
 
  function executeRefusalGrab(grabGem) {
    const target = state.players[state.pendingAction.targetId];
    const x = state.pendingAction.x;
    const grabbed = target.field.filter(c => c.gem === grabGem);
 
    const targetNewField = [...target.field.filter(c => c.gem !== grabGem), x];
    const currentNewHand = currentP.hand.filter(c => c.id !== x.id);
    const currentNewField = [...currentP.field.filter(c => c.id !== x.id), ...grabbed];
 
    const newPlayers = state.players.map(p => {
      if (p.id === currentP.id) return { ...p, hand: currentNewHand, field: currentNewField };
      if (p.id === target.id) return { ...p, field: targetNewField };
      return p;
    });
 
    const newState = {
      ...state, players: newPlayers, pendingAction: null,
      actionsThisTurn: { ...state.actionsThisTurn, traded: true },
      log: [...state.log, `T${state.turn} ${currentP.name}: 무역 거절 (${x.gem}${x.count} 주고 ${target.name}의 ${grabGem} ${grabbed.length}장 강탈)`],
    };
    setState(newState);
    checkAutoEnd(newState);
  }
 
  function endTurn() {
    const next = (state.currentPlayer + 1) % state.numPlayers;
    setState({
      ...state,
      currentPlayer: next,
      turn: state.turn + 1,
      actionsThisTurn: { drew: false, exchanged: false, traded: false },
      pendingAction: null,
      log: [...state.log, `--- ${state.players[next].name} 턴 시작 (T${state.turn + 1}) ---`],
    });
  }
 
  function checkAutoEnd(s) {
    if (s.deck.length === 0) { finalize(s, 'a (덱 소진)'); return; }
    const sixesNeeded = ['R6', 'E6', 'S6', 'T6'];
    const allSixesPlaced = sixesNeeded.every(label => {
      const gem = label[0];
      const count = parseInt(label[1]);
      const onBoard = s.exchangeBoard[gem]?.gem === gem && s.exchangeBoard[gem]?.count === count;
      if (onBoard) return true;
      return s.players.some(p => p.field.some(c => c.gem === gem && c.count === count));
    });
    if (allSixesPlaced) finalize(s, 'b (6짜리 4장 모두 환율판/필드)');
  }
 
  function declareAutonomousEnd() {
    const r = calculateRates(state.exchangeBoard);
    const eligible = currentP.victoryCards.filter(v => v.type === '자율').filter(v => checkVictoryCondition(v, currentP, state, r));
    if (eligible.length === 0) { alert('만족한 자율형 승리 조건이 없습니다'); return; }
    finalize(state, `c (${currentP.name}의 자율 승리 선언: ${eligible.map(e => e.name).join(', ')})`);
  }
 
  function finalize(s, reason) {
    const r = calculateRates(s.exchangeBoard);
    const valueScores = { 4: [10, 7, 4, 1], 3: [10, 5, 1], 2: [10, 3] };
    const playersWithValue = s.players.map(p => ({ ...p, totalValue: calculateTotalValue([...p.hand, ...p.field], r) }));
    const sorted = [...playersWithValue].sort((a, b) => b.totalValue - a.totalValue);
    const scoreList = valueScores[s.numPlayers];
    sorted.forEach((p, i) => { p.scoreFromValue = scoreList[i] || 0; });
 
    const finalPlayers = sorted.map(p => {
      const vcResults = p.victoryCards.map(vc => ({ vc, achieved: checkVictoryCondition(vc, p, s, r) }));
      let vcScore = 0;
      for (const { vc, achieved } of vcResults) {
        if (!achieved) continue;
        if (vc.id === 'tax') {
          const sixCount = s.players.reduce((sum, pl) => sum + pl.field.filter(c => c.count === 6).length, 0);
          vcScore += vc.score[s.numPlayers] * sixCount;
        } else {
          vcScore += vc.score[s.numPlayers];
        }
      }
      return { ...p, vcResults, vcScore, totalScore: p.scoreFromValue + vcScore };
    });
 
    setState({ ...s, gameEnded: true, endReason: reason, finalScores: finalPlayers,
      log: [...s.log, `=== 라운드 종료: ${reason} ===`] });
  }
 
  function checkVictoryCondition(vc, player, s, rates) {
    const all = [...player.hand, ...player.field];
    switch (vc.id) {
      case 'monopoly':
        for (const gem of GEM_TYPES) {
          const count = all.filter(c => c.gem === gem).reduce((sum, c) => sum + c.count, 0);
          if (count >= 17) return true;
        }
        return false;
      case 'jester': return all.filter(c => c.gem === 'J').length >= 2;
      case 'balance': return rates.R === 1 && rates.E === 1 && rates.S === 1 && rates.T === 1;
      case 'inequality': return new Set(Object.values(rates)).size === 4;
      case 'tax': return s.players.some(p => p.field.some(c => c.count === 6));
      case 'rich': return calculateTotalValue(all, rates) >= { 4: 45, 3: 40, 2: 35 }[s.numPlayers];
      case 'poor': return calculateTotalValue(all, rates) <= { 4: 10, 3: 8, 2: 6 }[s.numPlayers];
      case 'selfish': return player.hand.length >= { 4: 8, 3: 9, 2: 13 }[s.numPlayers];
      default: return false;
    }
  }
 
  if (state.gameEnded) {
    return <ResultView state={state} rates={rates} onNewGame={onNewGame} onExport={onExport} />;
  }
 
  return (
    <div style={styles.app}>
      {/* 헤더 */}
      <div style={styles.header}>
        <div style={styles.headerLeft}>
          <span style={styles.gameTitle}>TROCA</span>
          <span style={styles.turnBadge}>T{state.turn} · {currentP.name}</span>
          <span style={styles.deckBadge}>덱 {state.deck.length}장</span>
        </div>
        <div style={styles.headerRight}>
          <button onClick={onExport} style={styles.btnSm}>로그 내보내기</button>
          <button onClick={onNewGame} style={{ ...styles.btnSm, ...styles.btnDanger }}>게임 종료</button>
        </div>
      </div>
 
      {/* 게임판 */}
      <BoardView state={state} positions={positions} rates={rates} />
 
      {/* 행동 박스 */}
      <ActionBox
        state={state}
        setState={setState}
        currentP={currentP}
        rates={rates}
        onDraw={doDraw}
        onExchange={doExchange}
        onSubmitTradeY={submitTradeY}
        onRefusalGrab={executeRefusalGrab}
        onEndTurn={endTurn}
        onAutoEnd={declareAutonomousEnd}
      />
 
      {/* 로그 */}
      <div style={styles.section}>
        <div style={styles.sectionTitle}>게임 로그</div>
        <div style={styles.log}>
          {[...state.log].reverse().slice(0, 10).map((line, i) => (
            <div key={i} style={styles.logLine}>{line}</div>
          ))}
        </div>
      </div>
    </div>
  );
}
 
// ============ 게임판 (회전 보드) ============
function BoardView({ state, positions, rates }) {
  return (
    <div style={styles.boardContainer}>
      <div style={styles.boardGrid}>
        {/* 5x5 grid: 가운데 3x3은 환율판, 외곽은 플레이어 영역 */}
        {/* 북쪽 */}
        <div style={{ ...styles.playerSlot, gridArea: 'north' }}>
          {Object.entries(positions).find(([_, d]) => d === 'N') && (
            <PlayerArea
              player={state.players[parseInt(Object.entries(positions).find(([_, d]) => d === 'N')[0])]}
              direction="N"
              isCurrentTurn={false}
            />
          )}
        </div>
 
        {/* 서쪽 */}
        <div style={{ ...styles.playerSlot, gridArea: 'west' }}>
          {Object.entries(positions).find(([_, d]) => d === 'W') && (
            <PlayerArea
              player={state.players[parseInt(Object.entries(positions).find(([_, d]) => d === 'W')[0])]}
              direction="W"
              isCurrentTurn={false}
            />
          )}
        </div>
 
        {/* 환율판 (중앙) */}
        <div style={{ ...styles.exchangeBoardArea, gridArea: 'center' }}>
          <div style={styles.exchangeBoardTitle}>
            환율판 · {rates.R}:{rates.E}:{rates.S}:{rates.T}
          </div>
          <div style={styles.exchangeBoardGrid}>
            {GEM_TYPES.map(gem => (
              <ExchangeSlotDisplay key={gem} gem={gem} card={state.exchangeBoard[gem]} />
            ))}
          </div>
        </div>
 
        {/* 동쪽 */}
        <div style={{ ...styles.playerSlot, gridArea: 'east' }}>
          {Object.entries(positions).find(([_, d]) => d === 'E') && (
            <PlayerArea
              player={state.players[parseInt(Object.entries(positions).find(([_, d]) => d === 'E')[0])]}
              direction="E"
              isCurrentTurn={false}
            />
          )}
        </div>
 
        {/* 남쪽 (현재 턴 플레이어) */}
        <div style={{ ...styles.playerSlot, gridArea: 'south' }}>
          {Object.entries(positions).find(([_, d]) => d === 'S') && (
            <PlayerArea
              player={state.players[parseInt(Object.entries(positions).find(([_, d]) => d === 'S')[0])]}
              direction="S"
              isCurrentTurn={true}
            />
          )}
        </div>
      </div>
    </div>
  );
}
 
function ExchangeSlotDisplay({ gem, card }) {
  const c = GEM_COLORS[gem];
  return (
    <div style={styles.exchangeSlot}>
      <div style={{ ...styles.exchangeSlotLabel, background: c.bg, color: c.text }}>{gem}</div>
      <div style={styles.exchangeSlotContent}>
        {card ? <Card card={card} /> : <div style={styles.exchangeSlotEmpty}>—</div>}
      </div>
    </div>
  );
}
 
function PlayerArea({ player, direction, isCurrentTurn }) {
  // 방향에 따라 핸드는 환율판에서 먼 쪽, 필드는 가까운 쪽
  // direction이 회전 후의 기준 방향이므로 그대로 사용
  // S(남): 필드 위, 핸드 아래
  // N(북): 필드 아래, 핸드 위
  // W(서): 필드 오른쪽, 핸드 왼쪽
  // E(동): 필드 왼쪽, 핸드 오른쪽
 
  const isVertical = direction === 'N' || direction === 'S';
  const fieldFirst = direction === 'N' || direction === 'W'; // 환율판에 가까운 쪽이 필드
 
  const cardList = (cards, hidden) => (
    <div style={{
      display: 'flex',
      flexDirection: isVertical ? 'row' : 'column',
      gap: 3,
      flexWrap: 'wrap',
      justifyContent: 'center',
      alignItems: 'center',
    }}>
      {cards.length === 0 && <div style={styles.empty}>—</div>}
      {cards.map((c, i) => hidden ? (
        <div key={i} style={styles.cardBack}>?</div>
      ) : (
        <Card key={c.id} card={c} small />
      ))}
    </div>
  );
 
  const handHidden = !isCurrentTurn;
 
  const handBlock = (
    <div style={styles.cardBlock}>
      <div style={styles.cardBlockLabel}>핸드 ({player.hand.length})</div>
      {cardList(player.hand, handHidden)}
    </div>
  );
  const fieldBlock = (
    <div style={styles.cardBlock}>
      <div style={styles.cardBlockLabel}>필드 ({player.field.length})</div>
      {cardList(player.field, false)}
    </div>
  );
 
  return (
    <div style={{
      ...styles.playerArea,
      ...(isCurrentTurn ? styles.playerAreaCurrent : {}),
      flexDirection: isVertical ? 'column' : 'row',
    }}>
      <div style={styles.playerNameTag}>
        {player.name} {isCurrentTurn && '●'}
      </div>
      <div style={{
        display: 'flex',
        flexDirection: isVertical ? 'column' : 'row',
        gap: 6,
        width: '100%',
        height: '100%',
        justifyContent: 'center',
        alignItems: 'center',
      }}>
        {fieldFirst ? <>{fieldBlock}{handBlock}</> : <>{handBlock}{fieldBlock}</>}
      </div>
    </div>
  );
}
 
function Card({ card, small, onClick, selected, disabled }) {
  if (!card) return null;
  const c = GEM_COLORS[card.gem];
  return (
    <div
      onClick={disabled ? undefined : onClick}
      style={{
        background: c.bg, color: c.text,
        border: `2px solid ${selected ? '#fbbf24' : c.border}`,
        boxShadow: selected ? '0 0 0 3px #fbbf24' : 'none',
        borderRadius: 4,
        padding: small ? '3px 5px' : '6px 8px',
        cursor: disabled ? 'not-allowed' : (onClick ? 'pointer' : 'default'),
        opacity: disabled ? 0.4 : 1,
        fontWeight: 700,
        fontSize: small ? 11 : 13,
        minWidth: small ? 28 : 40,
        textAlign: 'center',
        userSelect: 'none',
      }}
    >
      {card.gem}{card.count}
    </div>
  );
}
 
// ============ 통합 행동 박스 ============
function ActionBox({ state, setState, currentP, rates, onDraw, onExchange, onSubmitTradeY, onRefusalGrab, onEndTurn, onAutoEnd }) {
  const a = state.actionsThisTurn;
  const canDraw = !a.drew && !a.exchanged && !a.traded;
  const canExchange = !a.drew && !a.exchanged;
  const canTrade = !a.drew && !a.traded;
  const pending = state.pendingAction;
  const totalValue = calculateTotalValue([...currentP.hand, ...currentP.field], rates);
 
  const cancel = () => setState({ ...state, pendingAction: null });
 
  return (
    <div style={styles.actionBox}>
      {/* 상단: 정보 */}
      <div style={styles.infoBar}>
        <div style={styles.infoItem}>
          <span style={styles.infoLabel}>승리조건</span>
          <span style={styles.infoValue}>
            {currentP.victoryCards.map((vc, i) => (
              <span key={i} style={styles.vcBadge}>
                [{vc.type}] {vc.name} — {vc.desc}
              </span>
            ))}
          </span>
        </div>
        <div style={styles.infoStatsRow}>
          <div style={styles.infoStat}>총가치 <strong>{totalValue.toFixed(2)}</strong></div>
          <div style={styles.infoStat}>핸드 <strong>{currentP.hand.length}</strong></div>
          <div style={styles.infoStat}>필드 <strong>{currentP.field.length}</strong></div>
        </div>
      </div>
 
      {/* 하단: 행동 분기 */}
      {!pending && (
        <div style={styles.actionRow}>
          <ActionButton label="a. 드로우 2장" onClick={onDraw} disabled={!canDraw} color="#16a34a" />
          <ActionButton
            label="b. 환율 공시"
            onClick={() => setState({ ...state, pendingAction: { type: 'exchange', stage: 'select_slot' } })}
            disabled={!canExchange}
            color="#2563eb"
          />
          <ActionButton
            label="c. 무역"
            onClick={() => setState({ ...state, pendingAction: { type: 'trade', stage: 'select_target' } })}
            disabled={!canTrade}
            color="#dc2626"
          />
          <div style={{ flex: 1 }} />
          <ActionButton label="자율 승리 선언" onClick={onAutoEnd} color="#f59e0b" small />
          <ActionButton label="턴 종료 →" onClick={onEndTurn} color="#111" />
        </div>
      )}
 
      {/* 환율 공시 흐름 */}
      {pending?.type === 'exchange' && (
        <ExchangeFlow
          pending={pending}
          state={state}
          setState={setState}
          currentP={currentP}
          onExchange={onExchange}
          onCancel={cancel}
        />
      )}
 
      {/* 무역 흐름 */}
      {pending?.type === 'trade' && (
        <TradeFlow
          pending={pending}
          state={state}
          setState={setState}
          currentP={currentP}
          rates={rates}
          onSubmitTradeY={onSubmitTradeY}
          onRefusalGrab={onRefusalGrab}
          onCancel={cancel}
        />
      )}
    </div>
  );
}
 
function ActionButton({ label, onClick, disabled, color, small }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        padding: small ? '8px 12px' : '12px 18px',
        background: disabled ? '#e5e7eb' : color,
        color: disabled ? '#9ca3af' : '#fff',
        border: 'none',
        borderRadius: 6,
        fontSize: small ? 12 : 14,
        fontWeight: 700,
        cursor: disabled ? 'not-allowed' : 'pointer',
        fontFamily: 'inherit',
        whiteSpace: 'nowrap',
      }}
    >
      {label}
    </button>
  );
}
 
function ExchangeFlow({ pending, state, setState, currentP, onExchange, onCancel }) {
  if (pending.stage === 'select_slot') {
    return (
      <div style={styles.flowBox}>
        <div style={styles.flowTitle}>환율 공시 — 어느 칸에 놓을지 선택</div>
        <div style={styles.flowButtons}>
          {GEM_TYPES.map(gem => {
            const c = GEM_COLORS[gem];
            const existing = state.exchangeBoard[gem];
            return (
              <button
                key={gem}
                onClick={() => setState({ ...state, pendingAction: { ...pending, stage: 'select_card', targetGem: gem } })}
                style={{ ...styles.btn, background: c.bg, color: c.text, border: `2px solid ${c.border}` }}
              >
                {gem}칸 {existing ? `(${existing.gem}${existing.count})` : '(비어있음)'}
              </button>
            );
          })}
          <button onClick={onCancel} style={{ ...styles.btn, ...styles.btnDanger }}>취소</button>
        </div>
      </div>
    );
  }
 
  if (pending.stage === 'select_card') {
    const gem = pending.targetGem;
    // 해당 칸에 놓을 수 있는 카드: 같은 종류 또는 조커
    const filter = (c) => c.gem === gem || c.gem === 'J';
    const handCards = currentP.hand.filter(filter);
    const fieldCards = currentP.field.filter(filter);
 
    return (
      <div style={styles.flowBox}>
        <div style={styles.flowTitle}>환율 공시 — {gem}칸에 놓을 카드 선택</div>
        <div style={styles.cardSection}>
          <div style={styles.cardSectionLabel}>핸드:</div>
          <div style={styles.cardRow}>
            {handCards.length === 0 && <div style={styles.empty}>해당 종류 없음</div>}
            {handCards.map(c => (
              <Card key={c.id} card={c} onClick={() => onExchange(c.id, gem)} />
            ))}
          </div>
        </div>
        <div style={styles.cardSection}>
          <div style={styles.cardSectionLabel}>필드:</div>
          <div style={styles.cardRow}>
            {fieldCards.length === 0 && <div style={styles.empty}>해당 종류 없음</div>}
            {fieldCards.map(c => (
              <Card key={c.id} card={c} onClick={() => onExchange(c.id, gem)} />
            ))}
          </div>
        </div>
        <div style={{ marginTop: 8 }}>
          <button onClick={() => setState({ ...state, pendingAction: { ...pending, stage: 'select_slot', targetGem: null } })} style={styles.btn}>
            ← 칸 다시 선택
          </button>
          <button onClick={onCancel} style={{ ...styles.btn, ...styles.btnDanger, marginLeft: 8 }}>전체 취소</button>
        </div>
      </div>
    );
  }
}
 
function TradeFlow({ pending, state, setState, currentP, rates, onSubmitTradeY, onRefusalGrab, onCancel }) {
  const [yCardIds, setYCardIds] = useState([]);
 
  // 1단계: 대상 선택
  if (pending.stage === 'select_target') {
    const others = state.players.filter(p => p.id !== currentP.id);
    return (
      <div style={styles.flowBox}>
        <div style={styles.flowTitle}>무역 — 대상 플레이어 선택</div>
        <div style={styles.flowButtons}>
          {others.map(p => (
            <button
              key={p.id}
              onClick={() => setState({ ...state, pendingAction: { ...pending, stage: 'select_x', targetId: p.id } })}
              style={{ ...styles.btn, ...styles.btnPrimary }}
            >
              {p.name} (필드 {p.field.length}장, 핸드 {p.hand.length}장)
            </button>
          ))}
          <button onClick={onCancel} style={{ ...styles.btn, ...styles.btnDanger }}>취소</button>
        </div>
      </div>
    );
  }
 
  // 2단계: X 카드 선택 (신청자)
  if (pending.stage === 'select_x') {
    const target = state.players[pending.targetId];
    return (
      <div style={styles.flowBox}>
        <div style={styles.flowTitle}>무역 — {target.name}에게 줄 X 카드 선택</div>
        <div style={styles.cardSection}>
          <div style={styles.cardSectionLabel}>핸드:</div>
          <div style={styles.cardRow}>
            {currentP.hand.length === 0 && <div style={styles.empty}>없음</div>}
            {currentP.hand.map(c => (
              <Card key={c.id} card={c} onClick={() => setState({ ...state, pendingAction: { ...pending, stage: 'select_y', x: c } })} />
            ))}
          </div>
        </div>
        <div style={styles.cardSection}>
          <div style={styles.cardSectionLabel}>필드:</div>
          <div style={styles.cardRow}>
            {currentP.field.length === 0 && <div style={styles.empty}>없음</div>}
            {currentP.field.map(c => (
              <Card key={c.id} card={c} onClick={() => setState({ ...state, pendingAction: { ...pending, stage: 'select_y', x: c } })} />
            ))}
          </div>
        </div>
        <div style={{ marginTop: 8 }}>
          <button onClick={() => setState({ ...state, pendingAction: { ...pending, stage: 'select_target', targetId: null } })} style={styles.btn}>
            ← 대상 다시 선택
          </button>
          <button onClick={onCancel} style={{ ...styles.btn, ...styles.btnDanger, marginLeft: 8 }}>전체 취소</button>
        </div>
      </div>
    );
  }
 
  // 3단계: Y 카드 선택 (수용자)
  if (pending.stage === 'select_y') {
    const target = state.players[pending.targetId];
    const x = pending.x;
    const toggleY = (cardId) => {
      setYCardIds(prev => prev.includes(cardId) ? prev.filter(id => id !== cardId) : [...prev, cardId]);
    };
 
    return (
      <div style={styles.flowBox}>
        <div style={styles.flowTitle}>
          무역 — {target.name}이 응답 (X: {x.gem}{x.count} = 가치 {cardValue(x, rates).toFixed(2)})
        </div>
        <div style={{ fontSize: 11, color: '#666', marginBottom: 6 }}>
          X와 다른 종류로 같거나 큰 가치 제시. 2장 이상이면 1종류만.
        </div>
        <div style={styles.cardSection}>
          <div style={styles.cardSectionLabel}>{target.name} 핸드:</div>
          <div style={styles.cardRow}>
            {target.hand.length === 0 && <div style={styles.empty}>없음</div>}
            {target.hand.map(c => (
              <Card
                key={c.id}
                card={c}
                onClick={() => toggleY(c.id)}
                selected={yCardIds.includes(c.id)}
              />
            ))}
          </div>
        </div>
        <div style={styles.cardSection}>
          <div style={styles.cardSectionLabel}>{target.name} 필드:</div>
          <div style={styles.cardRow}>
            {target.field.length === 0 && <div style={styles.empty}>없음</div>}
            {target.field.map(c => (
              <Card
                key={c.id}
                card={c}
                onClick={() => toggleY(c.id)}
                selected={yCardIds.includes(c.id)}
              />
            ))}
          </div>
        </div>
        <div style={{ marginTop: 8, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button onClick={() => { onSubmitTradeY(yCardIds, false); setYCardIds([]); }} style={{ ...styles.btn, ...styles.btnPrimary }}>
            선택 {yCardIds.length}장으로 응답
          </button>
          <button onClick={() => { onSubmitTradeY([], true); setYCardIds([]); }} style={{ ...styles.btn, ...styles.btnDanger }}>
            거절 (한 종류 강탈)
          </button>
          <button onClick={() => setState({ ...state, pendingAction: { ...pending, stage: 'select_x', x: null } })} style={styles.btn}>
            ← X 다시 선택
          </button>
          <button onClick={() => { onCancel(); setYCardIds([]); }} style={{ ...styles.btn, ...styles.btnDanger }}>전체 취소</button>
        </div>
      </div>
    );
  }
 
  // 4단계: 거절 시 강탈 종류 선택
  if (pending.stage === 'select_grab') {
    const target = state.players[pending.targetId];
    const fieldGems = [...new Set(target.field.map(c => c.gem))];
    return (
      <div style={{ ...styles.flowBox, background: '#fef3c7', borderColor: '#d97706' }}>
        <div style={styles.flowTitle}>거절됨 — {target.name}의 필드에서 한 종류 강탈</div>
        <div style={styles.flowButtons}>
          {fieldGems.length === 0 && <div style={styles.empty}>필드가 비어있음 (X만 잃음)</div>}
          {fieldGems.map(gem => {
            const cnt = target.field.filter(c => c.gem === gem).length;
            return (
              <button key={gem} onClick={() => onRefusalGrab(gem)} style={{ ...styles.btn, ...styles.btnPrimary }}>
                {gem} {cnt}장 가져오기
              </button>
            );
          })}
          {fieldGems.length === 0 && (
            <button onClick={() => onRefusalGrab('R')} style={{ ...styles.btn, ...styles.btnPrimary }}>
              확인 (X만 잃음)
            </button>
          )}
        </div>
      </div>
    );
  }
}
 
// ============ 결과 화면 ============
function ResultView({ state, rates, onNewGame, onExport }) {
  const sorted = [...state.finalScores].sort((a, b) => b.totalScore - a.totalScore);
  return (
    <div style={styles.app}>
      <div style={styles.header}>
        <div style={styles.headerLeft}>
          <span style={styles.gameTitle}>TROCA — 라운드 종료</span>
        </div>
        <div style={styles.headerRight}>
          <button onClick={onExport} style={styles.btnSm}>로그 내보내기</button>
          <button onClick={onNewGame} style={{ ...styles.btnSm, ...styles.btnPrimary }}>새 게임</button>
        </div>
      </div>
 
      <div style={styles.section}>
        <div style={styles.sectionTitle}>종료 사유: {state.endReason}</div>
        <div style={styles.sectionTitle}>최종 환율: R:E:S:T = {rates.R}:{rates.E}:{rates.S}:{rates.T}</div>
      </div>
 
      <div style={styles.section}>
        <div style={styles.sectionTitle}>최종 점수 (총 {state.turn}턴)</div>
        <table style={styles.table}>
          <thead>
            <tr>
              <th style={styles.th}>순위</th>
              <th style={styles.th}>플레이어</th>
              <th style={styles.th}>총가치</th>
              <th style={styles.th}>가치 점수</th>
              <th style={styles.th}>승리조건</th>
              <th style={styles.th}>VC 점수</th>
              <th style={styles.th}>합계</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((p, i) => (
              <tr key={p.id} style={i === 0 ? { background: '#fef3c7' } : {}}>
                <td style={styles.td}>{i + 1}</td>
                <td style={styles.td}>{p.name}</td>
                <td style={styles.td}>{p.totalValue.toFixed(2)}</td>
                <td style={styles.td}>{p.scoreFromValue}</td>
                <td style={styles.td}>
                  {p.vcResults.map((r, i) => (
                    <div key={i} style={{ fontSize: 11 }}>
                      {r.achieved ? '✓' : '✗'} [{r.vc.type}] {r.vc.name}
                    </div>
                  ))}
                </td>
                <td style={styles.td}>{p.vcScore}</td>
                <td style={{ ...styles.td, fontWeight: 700 }}>{p.totalScore}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
 
      <div style={styles.section}>
        <div style={styles.sectionTitle}>전체 로그</div>
        <div style={{ ...styles.log, maxHeight: 400 }}>
          {state.log.map((line, i) => (
            <div key={i} style={styles.logLine}>{line}</div>
          ))}
        </div>
      </div>
    </div>
  );
}
 
// ============ 스타일 ============
const styles = {
  app: {
    fontFamily: '"SF Mono", "Cascadia Code", "Roboto Mono", monospace',
    background: '#f9fafb',
    minHeight: '100vh',
    padding: 12,
    color: '#111',
  },
  startScreen: {
    maxWidth: 400, margin: '60px auto', padding: 32,
    background: '#fff', borderRadius: 8, border: '2px solid #111', boxShadow: '4px 4px 0 #111',
  },
  title: { fontSize: 48, fontWeight: 900, letterSpacing: '-0.05em', margin: 0 },
  subtitle: { fontSize: 12, color: '#666', letterSpacing: '0.1em', textTransform: 'uppercase' },
  label: { fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#666' },
  header: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    padding: '10px 14px', background: '#111', color: '#fff', borderRadius: 8, marginBottom: 8,
  },
  headerLeft: { display: 'flex', alignItems: 'center', gap: 10 },
  headerRight: { display: 'flex', gap: 6 },
  gameTitle: { fontSize: 16, fontWeight: 900, letterSpacing: '0.05em' },
  turnBadge: { background: '#fbbf24', color: '#111', padding: '2px 8px', borderRadius: 4, fontSize: 12, fontWeight: 700 },
  deckBadge: { background: '#374151', color: '#fff', padding: '2px 8px', borderRadius: 4, fontSize: 12 },
 
  // 게임판
  boardContainer: {
    background: '#fff',
    border: '2px solid #111',
    borderRadius: 8,
    padding: 8,
    marginBottom: 8,
  },
  boardGrid: {
    display: 'grid',
    gridTemplateColumns: '180px 1fr 180px',
    gridTemplateRows: '140px 1fr 140px',
    gridTemplateAreas: `
      ".     north  .    "
      "west  center east "
      ".     south  .    "
    `,
    gap: 6,
    minHeight: 480,
  },
  playerSlot: {
    display: 'flex',
    alignItems: 'stretch',
    justifyContent: 'center',
  },
  playerArea: {
    border: '1px solid #d1d5db',
    borderRadius: 6,
    padding: 6,
    background: '#f9fafb',
    display: 'flex',
    width: '100%',
    height: '100%',
    position: 'relative',
  },
  playerAreaCurrent: {
    border: '2px solid #16a34a',
    background: '#f0fdf4',
  },
  playerNameTag: {
    position: 'absolute',
    top: 2,
    left: 4,
    fontSize: 10,
    fontWeight: 700,
    color: '#374151',
    background: '#fff',
    padding: '1px 5px',
    borderRadius: 3,
    border: '1px solid #d1d5db',
    zIndex: 1,
  },
  cardBlock: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    flex: 1,
  },
  cardBlockLabel: {
    fontSize: 9,
    color: '#666',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  },
  exchangeBoardArea: {
    background: '#1f2937',
    border: '3px solid #111',
    borderRadius: 8,
    padding: 12,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#fff',
  },
  exchangeBoardTitle: {
    fontSize: 12,
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.1em',
    marginBottom: 10,
    color: '#fbbf24',
  },
  exchangeBoardGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, 1fr)',
    gridTemplateRows: 'repeat(2, 1fr)',
    gap: 8,
    width: '100%',
  },
  exchangeSlot: {
    border: '2px dashed #6b7280',
    borderRadius: 6,
    padding: 8,
    minHeight: 70,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    background: '#374151',
    gap: 4,
  },
  exchangeSlotLabel: {
    fontSize: 11,
    fontWeight: 700,
    padding: '2px 8px',
    borderRadius: 3,
  },
  exchangeSlotContent: {
    flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 30,
  },
  exchangeSlotEmpty: { color: '#9ca3af', fontSize: 14 },
 
  // 행동 박스
  actionBox: {
    background: '#fff',
    border: '2px solid #111',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
  },
  infoBar: {
    background: '#f9fafb',
    border: '1px solid #d1d5db',
    borderRadius: 6,
    padding: 8,
    marginBottom: 10,
  },
  infoItem: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
    flexWrap: 'wrap',
  },
  infoLabel: {
    fontSize: 10, color: '#666', textTransform: 'uppercase', letterSpacing: '0.05em',
    fontWeight: 700,
  },
  infoValue: { fontSize: 12 },
  infoStatsRow: { display: 'flex', gap: 12, fontSize: 12 },
  infoStat: { color: '#666' },
  vcBadge: {
    background: '#fef3c7',
    border: '1px solid #d97706',
    padding: '2px 6px',
    borderRadius: 3,
    fontSize: 11,
    marginRight: 4,
  },
  actionRow: {
    display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center',
  },
  flowBox: {
    border: '2px solid #2563eb',
    borderRadius: 6,
    padding: 10,
    background: '#eff6ff',
  },
  flowTitle: {
    fontSize: 13,
    fontWeight: 700,
    marginBottom: 8,
    color: '#1e40af',
  },
  flowButtons: { display: 'flex', gap: 6, flexWrap: 'wrap' },
  cardSection: { marginBottom: 6 },
  cardSectionLabel: { fontSize: 11, color: '#666', marginBottom: 3 },
  cardRow: { display: 'flex', gap: 4, flexWrap: 'wrap', minHeight: 30 },
  cardBack: {
    background: '#374151', color: '#fff', border: '2px solid #111',
    borderRadius: 4, padding: '3px 5px', fontSize: 11, fontWeight: 700,
    minWidth: 28, textAlign: 'center',
  },
  empty: { fontSize: 11, color: '#999', fontStyle: 'italic', padding: 2 },
 
  // 일반
  section: {
    background: '#fff', border: '1px solid #d1d5db', borderRadius: 8, padding: 10, marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em',
    color: '#374151', marginBottom: 6,
  },
  log: {
    background: '#f9fafb', border: '1px solid #d1d5db', padding: 6, borderRadius: 4,
    fontSize: 10, fontFamily: 'monospace', maxHeight: 140, overflow: 'auto',
  },
  logLine: { padding: '1px 0', borderBottom: '1px solid #f3f4f6' },
  btn: {
    padding: '6px 12px', border: '1px solid #999', background: '#fff',
    borderRadius: 4, cursor: 'pointer', fontSize: 12, fontFamily: 'inherit', fontWeight: 500,
  },
  btnSm: {
    padding: '4px 10px', border: '1px solid #999', background: '#fff',
    borderRadius: 4, cursor: 'pointer', fontSize: 11, fontFamily: 'inherit',
  },
  btnPrimary: { background: '#111', color: '#fff', border: '1px solid #111' },
  btnDanger: { background: '#dc2626', color: '#fff', border: '1px solid #991b1b' },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: 12 },
  th: {
    background: '#f3f4f6', padding: 6, border: '1px solid #d1d5db',
    textAlign: 'left', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.05em',
  },
  td: { padding: 6, border: '1px solid #e5e7eb' },
};
 