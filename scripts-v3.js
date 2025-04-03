// --- START OF FILE scriptss.js ---

// --- Constants ---
const chessboard = document.getElementById('chessboard');
const pieces = {
    'r': '♜', 'n': '♞', 'b': '♝', 'q': '♛', 'k': '♚', 'p': '♟',
    'R': '♖', 'N': '♘', 'B': '♗', 'Q': '♕', 'K': '♔', 'P': '♙'
};
const pieceValues = { 'p': 1, 'n': 3, 'b': 3, 'r': 5, 'q': 9, 'k': Infinity }; // King value for material check
const files = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
const K_FACTOR = 32;

// --- Game State Variables ---
let initialBoard = []; // 8x8 array representing the board
let currentPlayer = 'white';
let whiteTime = 600;
let blackTime = 600;
let timerInterval;
let enPassantTarget = null; // [row, col] or null
let whiteCanCastleKingside = true;
let whiteCanCastleQueenside = true;
let blackCanCastleKingside = true;
let blackCanCastleQueenside = true;
let halfMoveClock = 0; // For 50-move rule
let fullMoveNumber = 1; // Increments after Black moves
let moveHistory = []; // Array of move objects { from, to, piece, captured, promotion, flags, fenBefore, epBefore, castleBefore, halfMoveClockBefore, fullMoveNumberBefore }
let selectedPiece = null; // { element, row, col }
let lastMove = null; // { from: [r, c], to: [r, c] } for highlighting
let isGameOver = false;
let gameMode = ''; // "human", "ai", "ai-vs-ai"
let aiDifficulty = '';
let aiDifficultyWhite = '';
let aiDifficultyBlack = '';
let capturedWhite = [];
let capturedBlack = [];

// --- Statistics & Ratings ---
let gamesPlayed = 0, wins = 0, losses = 0, draws = 0;
let playerRating = 1200;
let aiRating = 1200;

// --- Stockfish Worker ---
let stockfish;
let isStockfishReady = false;
let isStockfishThinking = false;
let stockfishResponseCallback = null;

// --- UI Elements (Cache them) ---
const whiteTimeEl = document.getElementById('white-time');
const blackTimeEl = document.getElementById('black-time');
const gameStatusEl = document.getElementById('game-status');
const capturedWhiteEl = document.getElementById('captured-white');
const capturedBlackEl = document.getElementById('captured-black');
const whiteProgressEl = document.getElementById('white-progress');
const blackProgressEl = document.getElementById('black-progress');
const scoreAdvantageEl = document.getElementById('score-advantage');
const player1RatingEl = document.querySelector('.player-1-rating');
const player2RatingEl = document.querySelector('.player-2-rating');
const player1NameEl = document.querySelector('.player-1-name');
const player2NameEl = document.querySelector('.player-2-name');
const moveListEl = document.getElementById('move-list');
const undoButton = document.getElementById('undo-button');
const resignButton = document.getElementById('resign-button');
const playerInfoWhiteEl = document.querySelector('.player-info-white');
const playerInfoBlackEl = document.querySelector('.player-info-black');
const promotionModal = document.getElementById('promotion-modal');
const promotionOptionsContainer = promotionModal ? promotionModal.querySelector('.promotion-options') : null;
const gameEndModal = document.getElementById('game-end-modal');
const gameEndMessageEl = document.getElementById('game-end-message');
const playAgainButton = document.getElementById('play-again');
const themeToggleButton = document.getElementById('theme-toggle');
const soundToggleButton = document.getElementById('sound-toggle');
const modeAiButton = document.getElementById('mode-ai');
const modeHumanButton = document.getElementById('mode-human');
const modeAiAiButton = document.getElementById('mode-ai-ai');
const mainMenuEl = document.getElementById('main-menu');
const difficultySelectionEl = document.getElementById('difficulty-selection');
const aiVsAiDifficultySelectionEl = document.getElementById('ai-vs-ai-difficulty-selection');

// --- Initialization ---
document.addEventListener('DOMContentLoaded', () => {
    initStockfish();
    setupMenusAndButtons();
    loadSavedSettings();
    updateStatistics();
    updateRatingDisplay();
    if (gameStatusEl) gameStatusEl.textContent = "Choisissez un mode de jeu.";
    else console.error("Element with ID 'game-status' not found.");

    // Add null checks for potentially missing elements before adding listeners
     if (!mainMenuEl || !difficultySelectionEl || !aiVsAiDifficultySelectionEl || !gameEndModal || !promotionModal || !promotionOptionsContainer) {
         console.error("One or more essential menu/modal elements are missing from the HTML.");
         // Optionally disable game modes or show an error message to the user
     }
     if (!chessboard) console.error("Element with ID 'chessboard' not found.");
     if (!playerInfoWhiteEl || !playerInfoBlackEl) console.error("Player info elements (.player-info-white / .player-info-black) not found.");
});


// --- Setup Functions ---
function setupMenusAndButtons() {
    // Main Menu
    if (modeAiButton) modeAiButton.addEventListener('click', () => setupGameMode('ai'));
    else console.warn("Button 'mode-ai' not found.");
    if (modeHumanButton) modeHumanButton.addEventListener('click', () => setupGameMode('human'));
    else console.warn("Button 'mode-human' not found.");
    if (modeAiAiButton) modeAiAiButton.addEventListener('click', () => setupGameMode('ai-vs-ai'));
    else console.warn("Button 'mode-ai-ai' not found.");

    // Difficulty Selections
    if (difficultySelectionEl) {
        difficultySelectionEl.querySelectorAll('button').forEach(button => {
            button.addEventListener('click', () => {
                aiDifficulty = button.dataset.difficulty;
                difficultySelectionEl.style.display = 'none';
                startGame();
            });
        });
    }
    if (aiVsAiDifficultySelectionEl) {
        aiVsAiDifficultySelectionEl.querySelectorAll('.difficulty-button').forEach(button => {
            button.addEventListener('click', () => handleAiVsAiDifficultySelection(button));
        });
    }

    // Modals & Controls
    if (playAgainButton) playAgainButton.onclick = returnToMainMenu;
    else console.warn("Button 'play-again' not found.");
    if (themeToggleButton) themeToggleButton.addEventListener('click', toggleTheme);
    else console.warn("Button 'theme-toggle' not found.");
    if (soundToggleButton) soundToggleButton.addEventListener('click', toggleSound);
    else console.warn("Button 'sound-toggle' not found.");
    if (undoButton) undoButton.addEventListener('click', undoMove);
    else console.warn("Button 'undo-button' not found.");
    if (resignButton) resignButton.addEventListener('click', resignGame);
    else console.warn("Button 'resign-button' not found.");
}

function setupGameMode(mode) {
    gameMode = mode;
    if (mainMenuEl) mainMenuEl.style.display = 'none';
    if (mode === 'ai' && difficultySelectionEl) {
        difficultySelectionEl.style.display = 'block';
    } else if (mode === 'human') {
        startGame();
    } else if (mode === 'ai-vs-ai' && aiVsAiDifficultySelectionEl) {
        aiVsAiDifficultySelectionEl.style.display = 'block';
        aiDifficultyWhite = '';
        aiDifficultyBlack = '';
        aiVsAiDifficultySelectionEl.querySelectorAll('button.selected').forEach(b => b.classList.remove('selected'));
    }
}

function handleAiVsAiDifficultySelection(button) {
     if (!aiVsAiDifficultySelectionEl) return;
     const color = button.dataset.color;
     const difficulty = button.dataset.difficulty;
     const columnButtons = aiVsAiDifficultySelectionEl.querySelectorAll(`button[data-color="${color}"]`);

     columnButtons.forEach(b => b.classList.remove('selected'));
     button.classList.add('selected');

     if (color === 'white') aiDifficultyWhite = difficulty;
     else if (color === 'black') aiDifficultyBlack = difficulty;

     if (aiDifficultyWhite && aiDifficultyBlack) {
         aiVsAiDifficultySelectionEl.style.display = 'none';
         startGame();
     }
}

function returnToMainMenu() {
     if (gameEndModal) gameEndModal.style.display = 'none';
     if (mainMenuEl) mainMenuEl.style.display = 'block';
     if (difficultySelectionEl) difficultySelectionEl.style.display = 'none';
     if (aiVsAiDifficultySelectionEl) aiVsAiDifficultySelectionEl.style.display = 'none';
     if (chessboard) chessboard.innerHTML = '';
     if (moveListEl) moveListEl.innerHTML = '';
     resetTimer();
     updateTimerDisplay();
     isGameOver = true;
     clearInterval(timerInterval);
     if (gameStatusEl) gameStatusEl.textContent = "Choisissez un mode de jeu.";
     updateRatingDisplay();
     resetBoardState(); // Full reset including captures etc.
}

function resetBoardState() {
    // ... (previous implementation was good) ...
     initialBoard = [
         ['r', 'n', 'b', 'q', 'k', 'b', 'n', 'r'],
         ['p', 'p', 'p', 'p', 'p', 'p', 'p', 'p'],
         ['', '', '', '', '', '', '', ''],
         ['', '', '', '', '', '', '', ''],
         ['', '', '', '', '', '', '', ''],
         ['', '', '', '', '', '', '', ''],
         ['P', 'P', 'P', 'P', 'P', 'P', 'P', 'P'],
         ['R', 'N', 'B', 'Q', 'K', 'B', 'N', 'R']
     ];
     currentPlayer = 'white';
     enPassantTarget = null;
     whiteCanCastleKingside = true;
     whiteCanCastleQueenside = true;
     blackCanCastleKingside = true;
     blackCanCastleQueenside = true;
     halfMoveClock = 0;
     fullMoveNumber = 1;
     moveHistory = [];
     selectedPiece = null;
     lastMove = null;
     isGameOver = false;
     capturedWhite.length = 0;
     capturedBlack.length = 0;
     isStockfishThinking = false;
     stockfishResponseCallback = null;
     if (moveListEl) moveListEl.innerHTML = '';
     updateGameStatus("Nouvelle partie ! Les blancs jouent.");
     updateControlsState();
     updateAllUI(); // Update display like captured pieces
     updatePlayerTurnIndicator();
}

function loadSavedSettings() {
    // Theme
    const savedTheme = localStorage.getItem('chess-theme');
    const body = document.body;
    const themeIcon = themeToggleButton ? themeToggleButton.querySelector('i') : null;
    body.classList.toggle('light-theme', savedTheme === 'light');
    if (themeIcon) {
        themeIcon.className = savedTheme === 'light' ? 'fas fa-sun' : 'fas fa-moon';
    }

    // Sound
    const soundSetting = localStorage.getItem('chess-sound');
    const soundIcon = soundToggleButton ? soundToggleButton.querySelector('i') : null;
    soundEnabled = (soundSetting !== 'off');
    if (soundIcon) {
        soundIcon.className = soundEnabled ? 'fas fa-volume-up' : 'fas fa-volume-mute';
    }
}

// --- Game Flow & Control ---
function startGame() {
    console.log("Starting game in mode:", gameMode);
    resetBoardState(); // Ensure clean state
    resetTimer();
    createBoard(); // Draw the board
    updateAllUI(); // Update captured, progress, timers, ratings
    startTimer();
    playSound('start');

    if (gameMode === 'ai-vs-ai') {
        if (!aiDifficultyWhite || !aiDifficultyBlack) {
            console.error("AI vs AI mode but difficulties not set.");
            updateGameStatus("Erreur: Difficultés IA non définies.");
            return;
        }
        setTimeout(() => {
            if (isStockfishReady) requestAiMove();
            else console.log("AI vs AI start delayed, waiting for Stockfish.");
        }, 500);
    } else {
        updateGameStatus("Les blancs commencent.");
    }
    updateControlsState();
    updatePlayerTurnIndicator();
}

function switchPlayer() {
    currentPlayer = (currentPlayer === 'white' ? 'black' : 'white');
    updatePlayerTurnIndicator();
}

function updatePlayerTurnIndicator() {
     if (!playerInfoWhiteEl || !playerInfoBlackEl) return;
     playerInfoWhiteEl.classList.toggle('active-player', currentPlayer === 'white');
     playerInfoBlackEl.classList.toggle('active-player', currentPlayer === 'black');
}

function endGame(winner, reason) {
    if (isGameOver) return;
    isGameOver = true;
    clearInterval(timerInterval);
    isStockfishThinking = false;

    gamesPlayed++;
    let message = '';
    let sound = 'end';
    let playerWon = null;

    if (winner === 'draw') {
        draws++;
        message = `Partie terminée. Match nul (${reason}).`;
        sound = 'draw';
    } else {
        const winnerColorText = winner === 'white' ? 'Blancs' : 'Noirs';
        message = `Partie terminée. Victoire des ${winnerColorText} (${reason}).`;
        if (gameMode === 'ai') {
            playerWon = (winner === 'white');
            if (playerWon) { wins++; sound = 'win'; showConfetti(); }
            else { losses++; sound = 'lose'; }
            updateRatings(playerWon);
        } else if (gameMode === 'human') {
            sound = (winner === 'white') ? 'win' : 'lose';
            if (winner === 'white') showConfetti();
        } else { sound = 'end'; }
    }

    updateStatistics();
    updateRatingDisplay();
    showGameEndModal(message);
    playSound(sound);
    updateControlsState();
    // Clear active player highlight on game end
    if (playerInfoWhiteEl) playerInfoWhiteEl.classList.remove('active-player');
    if (playerInfoBlackEl) playerInfoBlackEl.classList.remove('active-player');
}

function resignGame() {
    if (isGameOver || gameMode === 'ai-vs-ai') return;
    const loser = currentPlayer;
    const winner = (loser === 'white' ? 'black' : 'white');
    updateGameStatus(`Les ${loser === 'white' ? 'Blancs' : 'Noirs'} abandonnent.`);
    endGame(winner, 'abandon');
}

function updateControlsState() {
     const canUndo = moveHistory.length > 0 && !isGameOver && !isStockfishThinking && gameMode !== 'ai-vs-ai';
     const canResign = !isGameOver && gameMode !== 'ai-vs-ai';
     if (undoButton) undoButton.disabled = !canUndo;
     if (resignButton) resignButton.disabled = !canResign;
}

// --- Move History & Notation ---
function recordMove(fromRow, fromCol, toRow, toCol, piece, capturedPiece, promotionPiece, flags) {
     const historyEntry = {
         from: [fromRow, fromCol], to: [toRow, toCol], piece: piece,
         captured: capturedPiece, promotion: promotionPiece, flags: flags,
         fenBefore: boardToFEN(initialBoard),
         epBefore: enPassantTarget ? [...enPassantTarget] : null,
         castleBefore: { wK: whiteCanCastleKingside, wQ: whiteCanCastleQueenside, bK: blackCanCastleKingside, bQ: blackCanCastleQueenside },
         halfMoveClockBefore: halfMoveClock,
         fullMoveNumberBefore: fullMoveNumber
     };
     moveHistory.push(historyEntry);
     updateMoveListUI(historyEntry);
}

function getAlgebraicNotation(moveData) {
    const pieceType = moveData.piece.toLowerCase();
    const pieceNotation = (pieceType === 'p' ? '' : moveData.piece.toUpperCase());
    const fromAlg = files[moveData.from[1]] + (8 - moveData.from[0]);
    const toAlg = files[moveData.to[1]] + (8 - moveData.to[0]);
    const captureNotation = moveData.captured ? 'x' : '';
    const promotionNotation = moveData.promotion ? `=${moveData.promotion.toUpperCase()}` : '';

    if (moveData.flags.isCastleKingside) return 'O-O';
    if (moveData.flags.isCastleQueenside) return 'O-O-O';

    let notation = pieceNotation;
    if (pieceType === 'p' && captureNotation) {
        notation += fromAlg[0];
    }
    notation += captureNotation + toAlg + promotionNotation;
    // Check/Mate symbols require lookahead - omitted for now
    return notation;
}


function updateMoveListUI(moveData) {
     if (!moveListEl) return;
     const notation = getAlgebraicNotation(moveData);
     const moveNumber = moveData.fullMoveNumberBefore;
     const moveIndex = moveHistory.length - 1; // Index in the history array

     if (moveData.piece.toUpperCase() === moveData.piece) { // White moved
         const listItem = document.createElement('li');
         listItem.dataset.moveIndex = moveIndex;
         listItem.innerHTML = `<span class="move-number">${moveNumber}.</span> <span class="move-white">${notation}</span>`;
         moveListEl.appendChild(listItem);
     } else { // Black moved
         let lastItem = moveListEl.lastElementChild;
         if (lastItem && lastItem.querySelectorAll('.move-black').length === 0) {
             const blackMoveSpan = document.createElement('span');
             blackMoveSpan.className = 'move-black';
             blackMoveSpan.textContent = notation;
             lastItem.appendChild(document.createTextNode(' '));
             lastItem.appendChild(blackMoveSpan);
             // Update dataset index if needed, though usually tied to li
             // lastItem.dataset.moveIndexBlack = moveIndex; // Example
         } else {
             // Fallback if no corresponding white move li exists (shouldn't happen)
             const listItem = document.createElement('li');
             listItem.dataset.moveIndex = moveIndex;
             listItem.innerHTML = `<span class="move-number">${moveNumber}...</span> <span class="move-black">${notation}</span>`;
             moveListEl.appendChild(listItem);
         }
     }
     moveListEl.scrollTop = moveListEl.scrollHeight;
}

// --- Undo Logic ---
function undoMove() {
     if (moveHistory.length === 0 || isGameOver || isStockfishThinking || gameMode === 'ai-vs-ai') {
         playSound('illegal');
         return;
     }

     let movesToUndo = 1;
     if (gameMode === 'ai' && currentPlayer === 'black' && moveHistory.length >= 2) {
         movesToUndo = 2;
     }

     for (let i = 0; i < movesToUndo; i++) {
         if (moveHistory.length === 0) break;

         const lastMoveData = moveHistory.pop();

         // Restore board and primary state from FEN
         const success = parseFEN(lastMoveData.fenBefore);
         if (!success) {
             console.error("Failed to parse FEN during undo. State corrupted.");
             moveHistory.push(lastMoveData); // Put back
             return;
         }
         // Note: parseFEN updates initialBoard, currentPlayer, castling rights, EP, clocks.

         // Restore captured pieces list
         if (lastMoveData.captured) {
             const capturedActual = lastMoveData.captured; // The piece char that was on the square
             const capturedColor = (capturedActual.toUpperCase() === capturedActual) ? 'white' : 'black';
             // The piece to remove from the *opponent's* capture list
             const pieceToRemoveFromList = (capturedColor === 'white') ? capturedActual.toLowerCase() : capturedActual.toUpperCase();
             // The list it was added to
             const targetArray = (capturedColor === 'white') ? capturedBlack : capturedWhite;

             const index = targetArray.indexOf(pieceToRemoveFromList);
             if (index > -1) {
                 targetArray.splice(index, 1);
             } else {
                 // This might happen with en-passant if not handled carefully
                 console.warn(`Undo: Could not find captured piece '${pieceToRemoveFromList}' in capture list.`);
             }
         }
         // Restore lastMove highlight state
          lastMove = (moveHistory.length > 0) ? { from: moveHistory[moveHistory.length - 1].from, to: moveHistory[moveHistory.length - 1].to } : null;
     }

     // --- Update UI After Undo ---
     createBoard(); // Redraw based on restored initialBoard
     updateAllUI(); // Update captured, progress, timers, ratings, turn indicator
     updateGameStatus(`Tour précédent annulé. Au tour des ${currentPlayer === 'white' ? 'Blancs' : 'Noirs'}.`);
     updateControlsState();

     // Remove the last move(s) from the UI list
     if (moveListEl) {
         for (let i = 0; i < movesToUndo; i++) {
             let lastItem = moveListEl.lastElementChild;
             if (lastItem) {
                let blackMoveSpan = lastItem.querySelector('.move-black');
                if (blackMoveSpan && lastItem.querySelectorAll('.move-white').length > 0) {
                     // If black move exists and white move also exists in the same LI, remove only black
                     blackMoveSpan.previousSibling.remove(); // Remove space
                     blackMoveSpan.remove();
                 } else {
                     // Otherwise, remove the whole list item (either only black was there, or it was white's turn)
                     lastItem.remove();
                 }
             }
         }
         if (moveListEl) moveListEl.scrollTop = moveListEl.scrollHeight;
     }

     playSound('click');
}


// --- FEN Parsing & Generation ---
function boardToFEN(board) {
    let fen = '';
    for (let r = 0; r < 8; r++) {
        let emptyCount = 0;
        let rowFen = '';
        for (let c = 0; c < 8; c++) {
            const piece = board[r][c];
            if (!piece) emptyCount++;
            else {
                if (emptyCount > 0) rowFen += emptyCount;
                emptyCount = 0;
                rowFen += piece;
            }
        }
        if (emptyCount > 0) rowFen += emptyCount;
        fen += rowFen + (r === 7 ? '' : '/');
    }
    fen += ` ${currentPlayer === 'white' ? 'w' : 'b'}`;
    let castlingFen = '';
    if (whiteCanCastleKingside) castlingFen += 'K';
    if (whiteCanCastleQueenside) castlingFen += 'Q';
    if (blackCanCastleKingside) castlingFen += 'k';
    if (blackCanCastleQueenside) castlingFen += 'q';
    fen += ` ${castlingFen || '-'}`;
    if (enPassantTarget) {
        fen += ` ${files[enPassantTarget[1]]}${8 - enPassantTarget[0]}`;
    } else {
        fen += ' -';
    }
    fen += ` ${halfMoveClock}`;
    fen += ` ${fullMoveNumber}`;
    return fen;
}

function parseFEN(fen) {
     // console.log("Parsing FEN:", fen);
     try {
         const parts = fen.split(' ');
         if (parts.length < 6) throw new Error("Invalid FEN: Less than 6 parts.");

         // 1. Piece Placement
         const newBoard = Array(8).fill(null).map(() => Array(8).fill(''));
         const rows = parts[0].split('/');
         if (rows.length !== 8) throw new Error("Invalid FEN: Not 8 rows.");
         for (let r = 0; r < 8; r++) {
             let c = 0;
             for (const char of rows[r]) {
                 if (c >= 8) throw new Error(`Invalid FEN: Row ${r+1} too long.`);
                 if (/\d/.test(char)) {
                     c += parseInt(char);
                 } else {
                     if (!pieces[char]) throw new Error(`Invalid FEN: Invalid piece '${char}'.`);
                     newBoard[r][c] = char;
                     c++;
                 }
             }
             if (c !== 8) throw new Error(`Invalid FEN: Row ${r+1} incorrect length.`);
         }
         initialBoard = newBoard;

         // 2. Active Color
         if (parts[1] !== 'w' && parts[1] !== 'b') throw new Error("Invalid FEN: Invalid active color.");
         currentPlayer = (parts[1] === 'w' ? 'white' : 'black');

         // 3. Castling Rights
         const castling = parts[2];
         if (!/^(?:-|[KQkq]{1,4})$/.test(castling) || /(.).*\1/.test(castling)) throw new Error("Invalid FEN: Invalid castling rights.");
         whiteCanCastleKingside = castling.includes('K');
         whiteCanCastleQueenside = castling.includes('Q');
         blackCanCastleKingside = castling.includes('k');
         blackCanCastleQueenside = castling.includes('q');

         // 4. En Passant Target
         const epSquare = parts[3];
         if (epSquare === '-') {
             enPassantTarget = null;
         } else {
             if (!/^[a-h][36]$/.test(epSquare)) throw new Error("Invalid FEN: Invalid en passant square.");
             const epCol = files.indexOf(epSquare[0]);
             const epRow = 8 - parseInt(epSquare[1]);
              // Basic check: EP square must be on rank 3 if black to move, rank 6 if white to move
              if ((currentPlayer === 'white' && epRow !== 2) || (currentPlayer === 'black' && epRow !== 5)) {
                 console.warn(`FEN Warning: EP square ${epSquare} inconsistent with player turn ${currentPlayer}. Parsing anyway.`);
                 // More robust validation could check the pawn positions
              }
             enPassantTarget = [epRow, epCol];
         }

         // 5. Halfmove Clock
         halfMoveClock = parseInt(parts[4]);
         if (isNaN(halfMoveClock) || halfMoveClock < 0) throw new Error("Invalid FEN: Invalid halfmove clock.");

         // 6. Fullmove Number
         fullMoveNumber = parseInt(parts[5]);
         if (isNaN(fullMoveNumber) || fullMoveNumber < 1) throw new Error("Invalid FEN: Invalid fullmove number.");

         return true; // Success
     } catch (e) {
         console.error("FEN Parsing Error:", e.message, "FEN:", fen);
         return false; // Failure
     }
}


// --- Game End Condition Checks ---
function checkGameEndConditions(colorToCheck) {
    if (isGameOver) return true;

    const legalMoves = getAllLegalMoves(colorToCheck);
    if (legalMoves.length === 0) {
        if (isKingInCheck(colorToCheck)) endGame(colorToCheck === 'white' ? 'black' : 'white', 'échec et mat');
        else endGame('draw', 'pat');
        return true;
    }
    if (halfMoveClock >= 100) { endGame('draw', 'règle des 50 coups'); return true; }
    if (checkThreefoldRepetition()) { endGame('draw', 'répétition'); return true; }
    if (checkInsufficientMaterial()) { endGame('draw', 'matériel insuffisant'); return true; }

    return false;
}

function checkThreefoldRepetition() {
     if (moveHistory.length < 8) return false;
     // Compare piece placement, turn, castling, EP state. Clocks don't matter for repetition.
     const currentFENKey = boardToFEN(initialBoard).split(' ').slice(0, 4).join(' ');
     let count = 0;
     // Check current position against history
     for (const historyEntry of moveHistory) {
         const pastFENKey = historyEntry.fenBefore.split(' ').slice(0, 4).join(' ');
         if (pastFENKey === currentFENKey) {
             count++;
         }
     }
     // The current position counts once implicitly. Check if it occurred >= 2 times *before*.
     return count >= 2; // Position occurred 3 or more times in total
}

function checkInsufficientMaterial() {
     const piecesOnBoard = [];
     let whiteBishops = [], blackBishops = [];
     let whiteKnights = 0, blackKnights = 0;
     let whitePawns = 0, blackPawns = 0;
     let whiteRooks = 0, blackRooks = 0;
     let whiteQueens = 0, blackQueens = 0;

     for (let r = 0; r < 8; r++) {
         for (let c = 0; c < 8; c++) {
             const piece = initialBoard[r][c];
             if (piece) {
                 piecesOnBoard.push(piece);
                 const type = piece.toLowerCase();
                 const color = (piece === piece.toUpperCase()) ? 'white' : 'black';
                 if (type === 'p') { if (color === 'white') whitePawns++; else blackPawns++; }
                 else if (type === 'r') { if (color === 'white') whiteRooks++; else blackRooks++; }
                 else if (type === 'q') { if (color === 'white') whiteQueens++; else blackQueens++; }
                 else if (type === 'n') { if (color === 'white') whiteKnights++; else blackKnights++; }
                 else if (type === 'b') {
                     const squareColor = (r + c) % 2; // 0=light, 1=dark
                     if (color === 'white') whiteBishops.push(squareColor);
                     else blackBishops.push(squareColor);
                 }
             }
         }
     }

     // If any pawns, rooks, or queens exist, it's NOT insufficient material
     if (whitePawns > 0 || blackPawns > 0 || whiteRooks > 0 || blackRooks > 0 || whiteQueens > 0 || blackQueens > 0) {
         return false;
     }

     const whiteMinorPieces = whiteKnights + whiteBishops.length;
     const blackMinorPieces = blackKnights + blackBishops.length;

     // K vs K
     if (whiteMinorPieces === 0 && blackMinorPieces === 0) return true;
     // K vs K + N or K vs K + B
     if ((whiteMinorPieces === 1 && blackMinorPieces === 0) || (whiteMinorPieces === 0 && blackMinorPieces === 1)) return true;
     // K + B vs K + B (Bishops on same color squares)
     if (whiteKnights === 0 && blackKnights === 0 && whiteBishops.length === 1 && blackBishops.length === 1) {
         if (whiteBishops[0] === blackBishops[0]) return true; // Same color bishop draw
     }
      // K+N+N vs K is generally NOT a draw (can force mate), so we don't check for it here.
      // Other complex cases like KBN vs K are winning.

     return false; // Assume sufficient material otherwise
}

// --- AI Logic (Stockfish Interaction) ---
function initStockfish() {
    try {
        stockfish = new Worker('stockfish.js');
        stockfish.postMessage('uci');
        stockfish.onmessage = handleStockfishMessage;
        stockfish.onerror = (e) => { console.error("Stockfish Error:", e); updateGameStatus("Erreur IA."); isStockfishReady = false; };
    } catch (e) {
        console.error("Failed to init Stockfish Worker:", e);
        updateGameStatus("Erreur: Worker IA non supporté.");
        isStockfishReady = false; // Ensure it's false
         if (modeAiButton) modeAiButton.disabled = true;
         if (modeAiAiButton) modeAiAiButton.disabled = true;
    }
}

function handleStockfishMessage(event) {
    const message = event.data;
    // console.log("Stockfish:", message);
    if (message === 'uciok') stockfish.postMessage('isready');
    else if (message === 'readyok') {
        isStockfishReady = true;
        console.log("Stockfish ready.");
         if (gameMode === 'ai-vs-ai' && currentPlayer === 'white' && aiDifficultyWhite && aiDifficultyBlack && !isGameOver && !isStockfishThinking) {
             requestAiMove();
         }
    } else if (message.startsWith('bestmove')) {
        isStockfishThinking = false;
        updateControlsState();
        const bestmove = message.split(' ')[1];
        if (stockfishResponseCallback) {
            stockfishResponseCallback(bestmove);
            stockfishResponseCallback = null;
        } else {
            console.error("Stockfish response received, but no callback was set!"); // Could happen if game ended while thinking
        }
    }
}


function requestStockfishMove(fen, depth, callback) {
    if (!isStockfishReady) { console.error("Stockfish not ready."); updateGameStatus("IA non prête..."); return; }
    if (isStockfishThinking) { console.warn("Stockfish already thinking."); return; }
    if (isGameOver) return;

    isStockfishThinking = true;
    stockfishResponseCallback = callback;
    updateControlsState();
    stockfish.postMessage(`position fen ${fen}`);
    stockfish.postMessage(`go depth ${depth}`);
}

function requestAiMove() {
    if (isGameOver || !isStockfishReady || isStockfishThinking) return;

    let difficulty, color;
    if (gameMode === 'ai' && currentPlayer === 'black') {
        difficulty = aiDifficulty;
        color = 'black';
    } else if (gameMode === 'ai-vs-ai') {
        difficulty = (currentPlayer === 'white') ? aiDifficultyWhite : aiDifficultyBlack;
        color = currentPlayer;
    } else {
        return;
    }

    const fen = boardToFEN(initialBoard);
    const depth = getAiSearchDepth(difficulty, color);
    updateGameStatus(`IA (${color} - ${difficulty}) réfléchit (Prof ${depth})...`);
    requestStockfishMove(fen, depth, handleAiMoveResponse);
}

// Détermine la profondeur de recherche en fonction de la difficulté et de la couleur
function getAiSearchDepth(difficulty, color) {
    const diffLower = difficulty.toLowerCase();
    let searchDepth;
    if (diffLower === 'noob') searchDepth = 1;
    else if (diffLower === 'easy') searchDepth = 2;
    else if (diffLower === 'regular') searchDepth = 3;
    else if (diffLower === 'hard') searchDepth = 4;
    else if (diffLower === 'very hard') searchDepth = 6;
    else if (diffLower === 'super hard') searchDepth = 8;
    else if (diffLower === 'magnus carlsen') searchDepth = 12;
    else if (diffLower === 'unbeatable') searchDepth = 15;
    else if (diffLower === 'adaptative') {
         const ratingDiff = aiRating - playerRating;
         if (ratingDiff < -300) searchDepth = 1;
         else if (ratingDiff < -100) searchDepth = 2;
         else if (ratingDiff < 100) searchDepth = 3;
         else if (ratingDiff < 300) searchDepth = 4;
         else searchDepth = 5;
    } else {
         searchDepth = 2;
    }
    return searchDepth;
}

function handleAiMoveResponse(bestmove) {
    if (isGameOver) {
        isStockfishThinking = false; // Ensure flag is reset even if callback wasn't cleared
        updateControlsState();
        return;
    }
   console.log(`Stockfish (${currentPlayer}) bestmove: ${bestmove}`);
   if (!bestmove || bestmove === '(none)') {
       console.error("Stockfish returned no valid move.");
       updateGameStatus(`Erreur IA (${currentPlayer}) : aucun coup valide.`);
       if (gameMode === 'ai-vs-ai') endGame('draw', 'erreur IA');
       isStockfishThinking = false; // Reset flag
       updateControlsState();
       return;
   }

    // --- Début: Cheat Anti-Répétition (Mode IA vs IA uniquement) ---
    let originalBestmove = bestmove; // Garder une trace
    let moveChosen = bestmove; // Le coup qui sera effectivement joué

    if (gameMode === 'ai-vs-ai' && moveHistory.length > 4) { // Vérifier seulement après quelques coups
       const fileToColRep = { a: 0, b: 1, c: 2, d: 3, e: 4, f: 5, g: 6, h: 7 };
       const fromColRep = fileToColRep[bestmove[0]];
       const fromRowRep = 8 - parseInt(bestmove[1]);
       const toColRep = fileToColRep[bestmove[2]];
       const toRowRep = 8 - parseInt(bestmove[3]);
       const promotionRep = bestmove.length === 5 ? bestmove[4] : null;

       const resultingFenKey = getResultanteFenKeyAfterMove(fromRowRep, fromColRep, toRowRep, toColRep, promotionRep);

       if (resultingFenKey) {
           let repetitionCount = 0;
           for (const historyEntry of moveHistory) {
               // Comparer uniquement les parties pertinentes de la FEN pour la règle des 3 coups
               const pastFenKey = historyEntry.fenBefore.split(' ').slice(0, 4).join(' ');
               if (pastFenKey === resultingFenKey) {
                   repetitionCount++;
               }
           }

           if (repetitionCount >= 2) { // Si ce coup mène à la 3ème répétition
                if (typeof window.console.warn === 'function') {
                    window.console.warn(`CHEAT: ${currentPlayer} allait répéter la position (${resultingFenKey}) avec ${bestmove}. Recherche d'alternative...`);
                } else {
                    console.log(`CHEAT: ${currentPlayer} allait répéter la position (${resultingFenKey}) avec ${bestmove}. Recherche d'alternative...`);
                }
               const allMoves = getAllLegalMoves(currentPlayer);
               const alternativeMoves = allMoves.filter(move => {
                   const uci = moveToUCI(move);
                   // Exclure le coup original ET les promotions différentes du même déplacement de pion (simplification)
                   return uci.substring(0, 4) !== bestmove.substring(0, 4);
               });

               if (alternativeMoves.length > 0) {
                   // Choisir une alternative (presque) aléatoirement
                   const randomIndex = Math.floor(Math.random() * alternativeMoves.length);
                   const alternative = alternativeMoves[randomIndex];
                   moveChosen = moveToUCI(alternative); // Oublie la promotion pour l'alternative simple
                   console.log(`CHEAT: Alternative choisie: ${moveChosen}`);
                   updateGameStatus(`IA (${currentPlayer}) évite la répétition avec ${moveChosen}`);
                    // Vider l'historique simple pour éviter les boucles immédiates (brut mais simple)
                    // aiMoveHistory = { white: [], black: [] };
               } else {
                   console.log(`CHEAT: Répétition inévitable avec ${bestmove}, aucune alternative trouvée.`);
                   moveChosen = bestmove; // Jouer le coup répétitif car forcé
               }
           }
       } else {
            console.error("Erreur lors de la simulation du coup pour la vérification de répétition.");
            moveChosen = bestmove; // Jouer le coup original en cas d'erreur de simulation
       }
    }
   // --- Fin: Cheat Anti-Répétition ---


   // Parse le coup choisi (peut être l'original ou l'alternatif)
   const fileToCol = { a: 0, b: 1, c: 2, d: 3, e: 4, f: 5, g: 6, h: 7 };
   const fromCol = fileToCol[moveChosen[0]];
   const fromRow = 8 - parseInt(moveChosen[1]);
   const toCol = fileToCol[moveChosen[2]];
   const toRow = 8 - parseInt(moveChosen[3]);
   // Utiliser la promotion du *coup original* si le coup choisi est le même, sinon null
   const promotion = (moveChosen === originalBestmove && moveChosen.length === 5) ? moveChosen[4] : null;


   // Exécuter le coup choisi
   const moveSuccess = makeMove(fromRow, fromCol, toRow, toCol, promotion);

   // Ralentissement pour IA vs IA
   if (moveSuccess && !isGameOver && gameMode === 'ai-vs-ai') {
        const delay = 1500; // Délai en millisecondes (1.5 secondes) - Ajustez si besoin
        console.log(`IA vs IA: Attente de ${delay}ms avant le prochain coup.`);
        setTimeout(requestAiMove, delay);
   } else if (moveSuccess && gameMode === 'ai' && currentPlayer === 'black') {
        // Le déclenchement normal pour Joueur vs IA reste rapide (géré dans makeMove/handleSquareClick)
   }
    // makeMove gère déjà la fin de partie et les mises à jour d'état
}

// --- Core Move Execution Logic ---
function makeMove(fromRow, fromCol, toRow, toCol, promotionChoice = null) {
    if (isGameOver) return false;

    const movingPiece = initialBoard[fromRow][fromCol];
    if (!movingPiece) { console.error(`makeMove Error: No piece at [${fromRow}, ${fromCol}]`); return false; }

    const color = movingPiece === movingPiece.toUpperCase() ? 'white' : 'black';
    // Allow move only if it's the correct player's turn.
    // This prevents issues if handleSquareClick logic somehow allows clicking opponent piece
    // or if AI response arrives after player manually made a move.
    if (color !== currentPlayer) {
        console.warn(`makeMove Warning: Attempted to move piece of wrong color (${color} on ${currentPlayer}'s turn).`);
        return false;
    }

    // Validate move legality using game logic (essential check)
    const possibleMoves = getPossibleMoves(movingPiece, fromRow, fromCol);
    const isValid = possibleMoves.some(([r, c]) => r === toRow && c === toCol);
    if (!isValid) {
        console.error(`makeMove Error: Invalid move attempted by ${currentPlayer}: ${movingPiece} from [${fromRow},${fromCol}] to [${toRow},${toCol}]`);
        // In a production environment, you might want to handle this more gracefully,
        // perhaps by deselecting or showing an error, but fundamentally it indicates a bug
        // in either move generation (getPossibleMoves) or the caller (handleSquareClick/handleAiMoveResponse).
        // Forcing a deselect if human:
        if (selectedPiece) {
            selectedPiece.element.classList.remove('selected');
            selectedPiece = null;
            highlightMoves([]);
        }
        return false; // Reject the invalid move
    }

    // --- Prepare Move Data ---
    const capturedPiece = initialBoard[toRow][toCol];
    let actualPromotion = null;
    let flags = { isCastleKingside: false, isCastleQueenside: false, isEnPassant: false };
    let soundToPlay = 'move'; // Default sound

    // Determine Promotion Piece
    const isPromotion = (movingPiece.toLowerCase() === 'p' && (toRow === 0 || toRow === 7));
    if (isPromotion) {
        if (!promotionChoice || !['q', 'r', 'n', 'b'].includes(promotionChoice.toLowerCase())) {
            console.error("makeMove Error: Invalid or missing promotion choice for promotion move.");
             // If called programmatically (AI) without valid choice, default to Queen?
             if (gameMode === 'ai' || gameMode === 'ai-vs-ai') {
                 promotionChoice = 'q';
                 console.warn("Defaulting AI promotion to Queen.");
             } else {
                 return false; // Human move requires explicit valid choice via modal
             }
        }
        actualPromotion = (color === 'white' ? promotionChoice.toUpperCase() : promotionChoice.toLowerCase());
        soundToPlay = 'promote';
    }

    // --- Record State BEFORE Applying Move ---
    // Note: Pass capturedPiece here, but it might be updated below for En Passant
    recordMove(fromRow, fromCol, toRow, toCol, movingPiece, capturedPiece, actualPromotion, flags);


    // --- Apply Move Logic ---
    let effectiveCapturedPiece = capturedPiece; // Use this for state updates

    // 1. Handle En Passant Capture
    if (movingPiece.toLowerCase() === 'p' && enPassantTarget && toRow === enPassantTarget[0] && toCol === enPassantTarget[1] && !capturedPiece) {
        const capturedPawnRow = fromRow; // Pawn captured is on the same rank as the moving pawn *started*
        const capturedPawnCol = toCol;   // and same file as the moving pawn *ended*
        effectiveCapturedPiece = initialBoard[capturedPawnRow][capturedPawnCol]; // Get the actual pawn
        if (!effectiveCapturedPiece || effectiveCapturedPiece.toLowerCase() !== 'p') {
             console.error("makeMove Error: En passant capture failed - expected pawn not found at", [capturedPawnRow, capturedPawnCol]);
             // Attempt to recover? Revert history entry? Very tricky.
             moveHistory.pop(); // Remove potentially incorrect history entry
             return false;
        }
        initialBoard[capturedPawnRow][capturedPawnCol] = ''; // Remove the captured pawn
        flags.isEnPassant = true;
        moveHistory[moveHistory.length - 1].captured = effectiveCapturedPiece; // Update history with actual captured piece
        moveHistory[moveHistory.length - 1].flags = flags; // Update flags
        soundToPlay = 'capture';
    }
    // 2. Handle Castling Rook Move
    else if (movingPiece.toLowerCase() === 'k' && Math.abs(toCol - fromCol) === 2) {
        const isKingside = (toCol > fromCol);
        const rookFromCol = isKingside ? 7 : 0;
        const rookToCol = isKingside ? 5 : 3;
        const rookPiece = initialBoard[toRow][rookFromCol]; // Should be 'R' or 'r'
        if (!rookPiece || rookPiece.toLowerCase() !== 'r') {
            console.error("makeMove Error: Castling failed - rook not found at", [toRow, rookFromCol]);
             moveHistory.pop();
             return false;
        }
        initialBoard[toRow][rookToCol] = rookPiece;
        initialBoard[toRow][rookFromCol] = '';
        if (isKingside) flags.isCastleKingside = true;
        else flags.isCastleQueenside = true;
        moveHistory[moveHistory.length - 1].flags = flags;
        soundToPlay = 'castle';
    }
    // 3. Handle Regular Capture Sound
    else if (capturedPiece) {
         if (capturedPiece.toLowerCase() === 'k') { // Should be prevented by validation
             console.error("Illegal King capture detected!");
             moveHistory.pop();
             return false;
         }
         soundToPlay = 'capture';
    }

    // --- Update Captured Pieces List ---
     if (effectiveCapturedPiece) { // Use effectiveCapturedPiece which includes EP captures
         if (effectiveCapturedPiece.toUpperCase() === effectiveCapturedPiece) capturedBlack.push(effectiveCapturedPiece.toLowerCase()); // White piece captured
         else capturedWhite.push(effectiveCapturedPiece.toUpperCase()); // Black piece captured
     }

    // --- Move the Main Piece on Board ---
    initialBoard[toRow][toCol] = actualPromotion ? actualPromotion : movingPiece;
    initialBoard[fromRow][fromCol] = '';

    // --- Update Game State Variables ---
    updateCastlingRights(movingPiece, fromRow, fromCol); // Check if King/Rook moved FROM start
    if (effectiveCapturedPiece) { // Check if a Rook was captured ON its start square
        updateCastlingRightsIfRookCaptured(effectiveCapturedPiece, toRow, toCol);
    }

    // Update 50 move clock
    if (movingPiece.toLowerCase() === 'p' || effectiveCapturedPiece) {
        halfMoveClock = 0;
    } else {
        halfMoveClock++;
    }

    // Update full move number (after black moves)
    if (currentPlayer === 'black') {
        fullMoveNumber++;
    }

    // Update En Passant possibility for *next* turn
    if (movingPiece.toLowerCase() === 'p' && Math.abs(toRow - fromRow) === 2) {
        enPassantTarget = [ (fromRow + toRow) / 2, fromCol ]; // Square *behind* the moved pawn
    } else {
        enPassantTarget = null; // Clear EP target if move wasn't pawn double step
    }

    // Update last move highlight info
    lastMove = { from: [fromRow, fromCol], to: [toRow, toCol] };

    // --- Play Sound ---
    playSound(soundToPlay);

    // --- Post-Move Tasks ---
    switchPlayer(); // CRITICAL: Switch player BEFORE updating UI and checking end conditions
    createBoard(); // Redraw board with new state AFTER state changes
    updateAllUI(); // Update timers, captured pieces, progress bar, ratings, turn indicator
    checkAndUpdateKingStatus(); // Highlight king if needed FOR THE NEW PLAYER

    // Check if the game ended due to this move (for the player whose turn it is NOW)
    if (!checkGameEndConditions(currentPlayer)) {
        // Game continues, update status text based on check status of the NEW player
         if (isKingInCheck(currentPlayer)) {
             updateGameStatus(`Échec au roi ${currentPlayer === 'white' ? 'blanc' : 'noir'} !`);
             // Check sound already played by checkAndUpdateKingStatus maybe? No, play here based on state *after* move.
             // Reconsider: playSound('check') should probably be here, not in checkAndUpdateKingStatus.
             // Let's move it here.
              playSound('check');
         } else {
             updateGameStatus(`Au tour des ${currentPlayer === 'white' ? 'Blancs' : 'Noirs'}.`);
         }
    } else {
         // Game ended, endGame function handles status messages and sounds
    }

    updateControlsState(); // Update button states (e.g., undo)

    return true; // Move was successful
}


// --- User Interaction (Click Handler) ---
function handleSquareClick(event) {
    if (isGameOver || (gameMode === 'ai' && currentPlayer === 'black') || gameMode === 'ai-vs-ai' || isStockfishThinking) {
        return; // Ignore clicks when not human's turn or game over/thinking
    }

    const square = event.currentTarget;
    const row = parseInt(square.dataset.row);
    const col = parseInt(square.dataset.col);
    const pieceOnSquare = initialBoard[row][col];

    if (selectedPiece) {
        const fromRow = selectedPiece.row;
        const fromCol = selectedPiece.col;
        const movingPiece = initialBoard[fromRow][fromCol]; // Piece being moved

        // --- Case 1: Clicked the same square again ---
        if (row === fromRow && col === fromCol) {
            selectedPiece.element.classList.remove('selected');
            selectedPiece = null;
            highlightMoves([]);
            playSound('click');
            return;
        }

        // --- Case 2: Clicked a potential destination square ---
        const possibleMoves = getPossibleMoves(movingPiece, fromRow, fromCol);
        const isValidMove = possibleMoves.some(([r, c]) => r === row && c === col);

        if (isValidMove) {
            const isPromotion = (movingPiece.toLowerCase() === 'p' && (row === 0 || row === 7));
            const currentSelectedElement = selectedPiece.element; // Keep ref for visuals

            // Clear selection visuals immediately
            currentSelectedElement.classList.remove('selected');
            selectedPiece = null; // Clear logical selection
            highlightMoves([]); // Clear highlights

            if (isPromotion) {
                showPromotionModal(currentPlayer, (promoChoice) => {
                    if (!promoChoice) { // Modal closed without choice
                        // Re-select the piece visually and logically
                        currentSelectedElement.classList.add('selected');
                        selectedPiece = { element: currentSelectedElement, row: fromRow, col: fromCol };
                        highlightMoves(possibleMoves); // Re-show highlights
                        console.log("Promotion cancelled.");
                        return;
                    }
                    // Promotion chosen, execute the move
                    const success = makeMove(fromRow, fromCol, row, col, promoChoice);
                    if (success && gameMode === 'ai' && currentPlayer === 'black') {
                        requestAiMove();
                    }
                });
                // Execution continues in the callback
            } else {
                // Not promotion, execute move directly
                const success = makeMove(fromRow, fromCol, row, col);
                if (success && gameMode === 'ai' && currentPlayer === 'black') {
                    requestAiMove();
                }
            }

        } else {
            // --- Case 3: Clicked an invalid square for the selected piece ---
             if (pieceOnSquare && (pieceOnSquare.toUpperCase() === pieceOnSquare ? 'white' : 'black') === currentPlayer) {
                 // Clicked another of own pieces - switch selection
                 selectedPiece.element.classList.remove('selected'); // Deselect old
                 selectedPiece = { element: square, row: row, col: col }; // Select new
                 square.classList.add('selected');
                 const newMoves = getPossibleMoves(pieceOnSquare, row, col);
                 highlightMoves(newMoves);
                 playSound('click');
             } else {
                 // Clicked empty or opponent piece - deselect
                 playSound('illegal');
                 selectedPiece.element.classList.remove('selected');
                 selectedPiece = null;
                 highlightMoves([]);
             }
        }

    } else if (pieceOnSquare && (pieceOnSquare.toUpperCase() === pieceOnSquare ? 'white' : 'black') === currentPlayer) {
        // --- Case 4: No piece selected, clicked on own piece ---
        playSound('click');
        selectedPiece = { element: square, row: row, col: col };
        square.classList.add('selected');
        const moves = getPossibleMoves(pieceOnSquare, row, col);
        highlightMoves(moves);
    }
    // --- Case 5: Clicked empty square or opponent piece without selection --- Does nothing.
}

// --- Rendering & UI Updates ---
function createBoard() {
    if (!chessboard) return;
    chessboard.innerHTML = '';
    const boardFragment = document.createDocumentFragment();

    for (let rowIndex = 0; rowIndex < 8; rowIndex++) {
        for (let colIndex = 0; colIndex < 8; colIndex++) {
            const square = document.createElement('div');
            square.classList.add('square');
            square.classList.add((rowIndex + colIndex) % 2 === 0 ? 'light' : 'dark');
            square.dataset.row = rowIndex;
            square.dataset.col = colIndex;

            const piece = initialBoard[rowIndex][colIndex];
            if (piece) {
                const pieceElement = document.createElement('span');
                pieceElement.className = 'piece';
                pieceElement.textContent = pieces[piece];
                pieceElement.classList.add(piece === piece.toUpperCase() ? 'white-piece' : 'black-piece');
                square.appendChild(pieceElement);
            }

            // Add label (optional, uncomment if needed)
            // const label = document.createElement('span');
            // label.className = 'square-label';
            // label.textContent = `${files[colIndex]}${8 - rowIndex}`;
            // square.appendChild(label);

             // Add click listener - allow clicking always, but handler checks state
             square.addEventListener('click', handleSquareClick);
             // Optionally change cursor based on state
             square.style.cursor = (isGameOver || (gameMode === 'ai' && currentPlayer === 'black') || gameMode === 'ai-vs-ai' || isStockfishThinking) ? 'default' : 'pointer';


            // Highlight last move
            if (lastMove &&
               ((rowIndex === lastMove.from[0] && colIndex === lastMove.from[1]) ||
                (rowIndex === lastMove.to[0] && colIndex === lastMove.to[1]))) {
                square.classList.add('last-move');
            }

            boardFragment.appendChild(square);
        }
    }
    chessboard.appendChild(boardFragment);

    // Re-apply selection and check highlights after redraw
    if (selectedPiece?.element) { // Check if selectedPiece and its element exist
         // Find the new square element corresponding to the selected piece's coordinates
         const newSelectedSquare = chessboard.querySelector(`.square[data-row="${selectedPiece.row}"][data-col="${selectedPiece.col}"]`);
         if (newSelectedSquare) {
             newSelectedSquare.classList.add('selected');
             selectedPiece.element = newSelectedSquare; // Update the element reference
             // Optionally re-highlight moves if needed, though usually done on select click
             // const rehighlightMoves = getPossibleMoves(initialBoard[selectedPiece.row][selectedPiece.col], selectedPiece.row, selectedPiece.col);
             // highlightMoves(rehighlightMoves);
         } else {
             // Piece might have been captured or moved during an AI turn while selected? Deselect.
             selectedPiece = null;
         }
    }
    checkAndUpdateKingStatus(); // Re-apply check highlight
}

function highlightMoves(moves) {
    if (!chessboard) return;
    // Clear previous move/capture highlights
    chessboard.querySelectorAll('.square.highlight, .square.capture').forEach(sq => {
        sq.classList.remove('highlight', 'capture');
    });

    moves.forEach(([r, c]) => {
        const square = chessboard.querySelector(`.square[data-row="${r}"][data-col="${c}"]`);
        if (square) {
            if (initialBoard[r][c] !== "") { // Target has a piece
                square.classList.add('capture');
            } else { // Target is empty
                square.classList.add('highlight');
            }
             // Highlight en passant differently?
            if (enPassantTarget && r === enPassantTarget[0] && c === enPassantTarget[1]) {
                 // Check if the move is actually a pawn move to the EP square
                 if (selectedPiece && initialBoard[selectedPiece.row][selectedPiece.col]?.toLowerCase() === 'p') {
                     square.classList.add('en-passant-target'); // Add specific class for styling
                     square.classList.remove('highlight'); // Remove generic highlight maybe
                 }
            }
        }
    });
}

function updateAllUI() {
     updateTimerDisplay();
     updateCapturedPieces();
     updateProgressBar();
     updateRatingDisplay();
     updatePlayerTurnIndicator();
     // Move list UI is updated incrementally
}

function updateGameStatus(statusText) {
    if (gameStatusEl) gameStatusEl.textContent = statusText;
}

function updateCapturedPieces() {
     if (capturedWhiteEl) capturedWhiteEl.innerHTML = capturedWhite.sort((a,b) => (pieceValues[b.toLowerCase()] || 0) - (pieceValues[a.toLowerCase()] || 0)).map(p => pieces[p.toUpperCase()]).join('');
     if (capturedBlackEl) capturedBlackEl.innerHTML = capturedBlack.sort((a,b) => (pieceValues[b.toLowerCase()] || 0) - (pieceValues[a.toLowerCase()] || 0)).map(p => pieces[p.toLowerCase()]).join('');
}

function updateProgressBar() {
     if (!whiteProgressEl || !blackProgressEl) return;
     // capturedWhite = black pieces captured BY white
     // capturedBlack = white pieces captured BY black
     const whiteMaterialAdvantage = capturedWhite.reduce((s, p) => s + (pieceValues[p.toLowerCase()] || 0), 0);
     const blackMaterialAdvantage = capturedBlack.reduce((s, p) => s + (pieceValues[p.toLowerCase()] || 0), 0);
     const diff = whiteMaterialAdvantage - blackMaterialAdvantage;

     const maxAdvantage = 10; // Cap visual difference at +/- 10 points for scaling
     const scaledDiff = Math.max(-maxAdvantage, Math.min(maxAdvantage, diff));
     let whitePerc = 50 + (scaledDiff / maxAdvantage) * 50;
     whitePerc = Math.max(0, Math.min(100, whitePerc));

     whiteProgressEl.style.width = `${whitePerc}%`;
     blackProgressEl.style.width = `${100 - whitePerc}%`;

     if (scoreAdvantageEl) {
         if (diff > 0) scoreAdvantageEl.textContent = `+${diff}`;
         else if (diff < 0) scoreAdvantageEl.textContent = `${diff}`; // diff is already negative
         else scoreAdvantageEl.textContent = '';
         scoreAdvantageEl.className = diff > 0 ? 'score-white' : (diff < 0 ? 'score-black' : '');
     }
}

function checkAndUpdateKingStatus() {
     if (isGameOver) { // Clear highlights if game over
         highlightKingInCheck('white', false);
         highlightKingInCheck('black', false);
         return;
     };
     const whiteInCheck = isKingInCheck('white');
     const blackInCheck = isKingInCheck('black');
     highlightKingInCheck('white', whiteInCheck);
     highlightKingInCheck('black', blackInCheck);
     // Check sound is played in makeMove now, based on state *after* the move.
}

function highlightKingInCheck(color, inCheck) {
    const kingSymbol = (color === 'white' ? 'K' : 'k');
    const kingSquare = findPieceSquareElement(kingSymbol); // Use helper
    if (kingSquare) {
        kingSquare.classList.toggle('in-check', inCheck);
    }
}

function findPieceSquareElement(pieceSymbol) {
    if (!chessboard) return null;
    for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
            if (initialBoard[r][c] === pieceSymbol) {
                // Query the currently rendered board
                return chessboard.querySelector(`.square[data-row="${r}"][data-col="${c}"]`);
            }
        }
    }
    return null;
}


function showPromotionModal(color, callback) {
    if (!promotionModal || !promotionOptionsContainer) {
        console.error("Promotion modal elements not found!");
        callback('q'); // Default to queen if modal fails
        return;
    }
    promotionOptionsContainer.innerHTML = ''; // Clear previous

    ['q', 'r', 'n', 'b'].forEach(type => {
        const pieceSymbol = (color === 'white') ? type.toUpperCase() : type.toLowerCase();
        const div = document.createElement('div');
        div.className = 'promotion-piece';
        div.textContent = pieces[pieceSymbol];
        div.onclick = () => {
            promotionModal.style.display = 'none';
            callback(type);
        };
        optionsContainer.appendChild(div);
    });

    // Optional: Add close/cancel button explicitly
    // const cancelBtn = document.createElement('button');
    // ... setup cancel button ...
    // cancelBtn.onclick = () => { promotionModal.style.display = 'none'; callback(null); }
    // promotionOptionsContainer.appendChild(cancelBtn);

    promotionModal.style.display = 'block';
}


function showGameEndModal(message) {
    if (!gameEndModal || !gameEndMessageEl) return;
    gameEndMessageEl.textContent = message;
    gameEndModal.style.display = 'block';
}

// --- Timer, Ratings, Sound, Theme, Effects (implementations from previous response are fine) ---
function startTimer() {
    clearInterval(timerInterval);
    if (isGameOver) return;
    timerInterval = setInterval(() => {
        if (isGameOver) { clearInterval(timerInterval); return; }

        if (currentPlayer === 'white') {
            whiteTime--;
            if (whiteTime <= 0) { whiteTime = 0; updateTimerDisplay(); endGame('black', 'temps écoulé'); }
        } else {
            blackTime--;
            if (blackTime <= 0) { blackTime = 0; updateTimerDisplay(); endGame('white', 'temps écoulé'); }
        }
        if (!isGameOver) updateTimerDisplay(); // Avoid updating after game ended
        if (!isGameOver && ((currentPlayer === 'white' && whiteTime === 10) || (currentPlayer === 'black' && blackTime === 10))) {
            playSound('tenseconds');
        }
    }, 1000);
}
function resetTimer() { clearInterval(timerInterval); whiteTime = 600; blackTime = 600; }
function formatTime(s) { const m = Math.floor(s / 60); const sec = s % 60; return `${m}:${sec < 10 ? '0' : ''}${sec}`; }
function updateTimerDisplay() {
    if (!whiteTimeEl || !blackTimeEl) return;
    whiteTimeEl.textContent = formatTime(whiteTime);
    blackTimeEl.textContent = formatTime(blackTime);
     // Use timeout > 0 check to avoid highlighting 0:00 as urgent
    whiteTimeEl.classList.toggle('urgent', whiteTime <= 30 && whiteTime > 0 && !isGameOver);
    blackTimeEl.classList.toggle('urgent', blackTime <= 30 && blackTime > 0 && !isGameOver);
}

function updateStatistics() {
    const gamesPlayedEl = document.getElementById('games-played');
    const winsEl = document.getElementById('wins');
    const lossesEl = document.getElementById('losses');
    const drawsEl = document.getElementById('draws');
    if(gamesPlayedEl) gamesPlayedEl.textContent = gamesPlayed;
    if(winsEl) winsEl.textContent = wins;
    if(lossesEl) lossesEl.textContent = losses;
    if(drawsEl) drawsEl.textContent = draws;
}
function updateRatings(playerWon) {
    if (gameMode !== 'ai') return;
    const expectedScore = 1 / (1 + Math.pow(10, (aiRating - playerRating) / 400));
    // Use winner info from endGame, null for draw is handled implicitly by actualScore
    const actualScore = playerWon === true ? 1 : (playerWon === false ? 0 : 0.5);
    const ratingChange = Math.round(K_FACTOR * (actualScore - expectedScore));
    playerRating += ratingChange;
    aiRating -= ratingChange; // AI rating changes inversely
    console.log(`Rating change: ${ratingChange}. New Player: ${playerRating}, AI: ${aiRating}`);
    // No need to call updateRatingDisplay here, endGame calls it.
}
function updateRatingDisplay() {
    if (!player1RatingEl || !player2RatingEl || !player1NameEl || !player2NameEl) return;
    if (gameMode === 'ai') {
         player1NameEl.textContent = "Joueur"; player2NameEl.textContent = `IA (${aiDifficulty || '?'})`;
         player1RatingEl.textContent = playerRating; player2RatingEl.textContent = aiRating;
    } else if (gameMode === 'human') {
         player1NameEl.textContent = "Joueur 1"; player2NameEl.textContent = "Joueur 2";
         player1RatingEl.textContent = "----"; player2RatingEl.textContent = "----";
    } else if (gameMode === 'ai-vs-ai') {
         player1NameEl.textContent = `IA Blanc (${aiDifficultyWhite || '?'})`; player2NameEl.textContent = `IA Noir (${aiDifficultyBlack || '?'})`;
         player1RatingEl.textContent = "----"; player2RatingEl.textContent = "----";
    } else { // Default / Main Menu
         player1NameEl.textContent = "Joueur 1"; player2NameEl.textContent = "Joueur 2";
         player1RatingEl.textContent = "----"; player2RatingEl.textContent = "----";
    }
}

function toggleTheme() {
    const body = document.body;
    const icon = themeToggleButton ? themeToggleButton.querySelector('i') : null;
    body.classList.toggle('light-theme');
    const isLight = body.classList.contains('light-theme');
    if (icon) icon.className = isLight ? 'fas fa-sun' : 'fas fa-moon';
    localStorage.setItem('chess-theme', isLight ? 'light' : 'dark');
}
let soundEnabled = true;
const sounds = {};
function loadSound(name, path) {
    if (!sounds[name]) {
        try { sounds[name] = new Audio(path); }
        catch (e) { console.error(`Failed to load sound ${name}:`, e); sounds[name] = null; }
    }
    return sounds[name];
}
function playSound(soundName) {
    if (!soundEnabled) return;
    const soundPaths = {
        move: 'sounds/move-self.mp3', move2: 'sounds/move-opponent.mp3', capture: 'sounds/capture.mp3',
        castle: 'sounds/castle.mp3', check: 'sounds/move-check.mp3', click: 'sounds/click.mp3',
        promote: 'sounds/promote.mp3', illegal: 'sounds/illegal.mp3', start: 'sounds/game-start.mp3',
        win: 'sounds/game-win.mp3', lose: 'sounds/game-lose.mp3', draw: 'sounds/game-draw.mp3',
        end: 'sounds/game-end.mp3', tenseconds: 'sounds/tenseconds.mp3'
    };
    if (!soundPaths[soundName]) return;
    const audio = loadSound(soundName, soundPaths[soundName]);
    if (audio) {
        audio.currentTime = 0;
        audio.play().catch(e => { /* console.warn("Sound play failed:", e) */ });
    }
}
function toggleSound() {
    soundEnabled = !soundEnabled;
    const icon = soundToggleButton ? soundToggleButton.querySelector('i') : null;
    if (icon) icon.className = soundEnabled ? 'fas fa-volume-up' : 'fas fa-volume-mute';
    localStorage.setItem('chess-sound', soundEnabled ? 'on' : 'off');
    if (soundEnabled) playSound('click');
}

function showToast(message, iconClass = 'fa-info-circle', duration = 3000) {
    // Implementation requires a .toast-container element in HTML
    const container = document.querySelector('.toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.innerHTML = `<i class="fas ${iconClass}"></i><span>${message}</span>`;
    container.appendChild(toast);

    // Force reflow to enable animation
    void toast.offsetWidth;
    toast.classList.add('show');

    setTimeout(() => {
        toast.classList.remove('show');
        toast.addEventListener('transitionend', () => toast.remove());
    }, duration);
}

function showConfetti() {
     // Using a library like confetti-js is easier: https://github.com/catdad/canvas-confetti
     // Basic CSS implementation:
    const container = document.createElement('div');
    container.className = 'confetti-container'; // Needs CSS styling
    document.body.appendChild(container);

    const colors = ['#f44336', '#e91e63', '#9c27b0', '#673ab7', '#3f51b5',
                   '#2196f3', '#03a9f4', '#00bcd4', '#009688', '#4CAF50',
                   '#ffeb3b', '#ffc107', '#ff9800'];

    for (let i = 0; i < 100; i++) { // Create 100 confetti pieces
        const confetti = document.createElement('div');
        confetti.className = 'confetti'; // Needs CSS for shape, animation
        confetti.style.left = `${Math.random() * 100}vw`;
        confetti.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
         // Animation needs to be defined in CSS (e.g., falling with rotation)
         confetti.style.animationDelay = `${Math.random() * 3}s`; // Random start delay
         confetti.style.animationDuration = `${3 + Math.random() * 3}s`; // Random duration
        container.appendChild(confetti);
    }

    // Remove container after animation finishes (e.g., 6 seconds)
    setTimeout(() => {
        container.remove();
    }, 6000);
}

function getPossibleMovesWithoutCheck(piece, row, col, board = initialBoard) {
    const moves = [];
    const color = piece === piece.toUpperCase() ? 'white' : 'black';
    const opponentColor = (color === 'white' ? 'black' : 'white');
    const pieceType = piece.toLowerCase();

    const addMove = (r, c) => {
         if (r >= 0 && r < 8 && c >= 0 && c < 8) {
             const targetPiece = board[r][c];
             if (!targetPiece) { // Empty square
                 moves.push([r, c]);
                 return true; // Can continue sliding
            } else if ((targetPiece.toUpperCase() === targetPiece ? 'white' : 'black') === opponentColor) { // Capture
                 moves.push([r, c]);
                 return false; // Stop sliding after capture
             } else { // Own piece
                 return false; // Stop sliding
             }
         }
         return false; // Off board
    };

    switch (pieceType) {
        case 'p': { // Pawn
            const direction = (color === 'white' ? -1 : 1);
            const startRow = (color === 'white' ? 6 : 1);
            const promotionRow = (color === 'white' ? 0 : 7);

            // 1. Forward move
            const oneStepRow = row + direction;
            if (oneStepRow >= 0 && oneStepRow < 8 && !board[oneStepRow][col]) {
                moves.push([oneStepRow, col]);
                // 2. Double step from start row
                if (row === startRow) {
                    const twoStepRow = row + 2 * direction;
                    if (!board[twoStepRow][col]) {
                        moves.push([twoStepRow, col]);
                    }
                }
            }

            // 3. Diagonal captures
            for (let dc = -1; dc <= 1; dc += 2) {
                const captureCol = col + dc;
                if (captureCol >= 0 && captureCol < 8 && oneStepRow >= 0 && oneStepRow < 8) {
                    const targetPiece = board[oneStepRow][captureCol];
                    if (targetPiece && (targetPiece.toUpperCase() === targetPiece ? 'white' : 'black') === opponentColor) {
                        moves.push([oneStepRow, captureCol]);
                    }
                    // 4. En Passant Capture Check (Pseudo-legal only cares if the target square matches)
                    if (enPassantTarget && oneStepRow === enPassantTarget[0] && captureCol === enPassantTarget[1]) {
                         // Check if there's actually an opponent pawn next to the moving pawn that could have made the double step
                         const adjacentPawnRow = row;
                         const adjacentPawnCol = captureCol;
                         const adjacentPiece = board[adjacentPawnRow][adjacentPawnCol];
                         const opponentPawn = (opponentColor === 'white' ? 'P' : 'p');
                         if (adjacentPiece === opponentPawn) {
                             moves.push([oneStepRow, captureCol]);
                         }
                    }
                }
            }
            break;
        }
        case 'n': { // Knight
             const knightMoves = [[-2, -1], [-2, 1], [-1, -2], [-1, 2], [1, -2], [1, 2], [2, -1], [2, 1]];
             knightMoves.forEach(([dr, dc]) => {
                 addMove(row + dr, col + dc); // addMove handles bounds and capture/own piece check
            });
            break;
        }
        case 'b': // Bishop
        case 'r': // Rook
        case 'q': { // Queen
            const directions = [];
            if (pieceType === 'b' || pieceType === 'q') {
                directions.push([-1, -1], [-1, 1], [1, -1], [1, 1]); // Diagonal
            }
            if (pieceType === 'r' || pieceType === 'q') {
                directions.push([-1, 0], [1, 0], [0, -1], [0, 1]); // Orthogonal
            }

             directions.forEach(([dr, dc]) => {
                 for (let i = 1; i < 8; i++) {
                     if (!addMove(row + i * dr, col + i * dc)) {
                         break; // Stop sliding in this direction
                     }
                 }
             });
            break;
        }
        case 'k': { // King
            for (let dr = -1; dr <= 1; dr++) {
                for (let dc = -1; dc <= 1; dc++) {
                    if (dr === 0 && dc === 0) continue;
                    addMove(row + dr, col + dc);
                }
            }
            // Castling moves are added later in getPossibleMoves after check validation
            break;
        }
    }
    return moves;
}

function isSquareAttacked(targetRow, targetCol, attackerColor, board = initialBoard) {
    for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
            const piece = board[r][c];
            if (piece && (piece === piece.toUpperCase() ? 'white' : 'black') === attackerColor) {
                // Use getPossibleMovesWithoutCheck to avoid infinite recursion if the opponent move generation checks for checks
                 const moves = getPossibleMovesWithoutCheck(piece, r, c, board);
                 if (moves.some(([moveR, moveC]) => moveR === targetRow && moveC === targetCol)) {
                    return true;
                }
            }
        }
    }
    return false;
}

function isKingInCheck(color, board = initialBoard) {
    const kingSymbol = (color === 'white' ? 'K' : 'k');
    let kingPos = null;
    // Find the king
    for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
            if (board[r][c] === kingSymbol) {
                kingPos = [r, c];
                break;
            }
        }
        if (kingPos) break;
    }
    if (!kingPos) return false; // Should not happen in a normal game

    // Check if the king's square is attacked by the opponent
    return isSquareAttacked(kingPos[0], kingPos[1], (color === 'white' ? 'black' : 'white'), board);
}

function wouldKingBeInCheck(fromRow, fromCol, toRow, toCol, color, board = initialBoard) {
    const movingPiece = board[fromRow][fromCol];
    const capturedPiece = board[toRow][toCol]; // Store captured piece

    // Create a temporary board
    const tempBoard = board.map(row => [...row]);

    // Simulate the move
    tempBoard[toRow][toCol] = movingPiece;
    tempBoard[fromRow][fromCol] = '';

     // Handle en passant capture simulation
     if (movingPiece.toLowerCase() === 'p' && enPassantTarget && toRow === enPassantTarget[0] && toCol === enPassantTarget[1] && !capturedPiece) {
         const capturedPawnRow = fromRow;
         const capturedPawnCol = toCol;
         tempBoard[capturedPawnRow][capturedPawnCol] = ''; // Remove pawn captured en passant in sim
     }

    // Find the king on the temporary board
    const kingSymbol = (color === 'white' ? 'K' : 'k');
    let kingPos = null;
    for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
            if (tempBoard[r][c] === kingSymbol) {
                kingPos = [r, c];
                break;
            }
        }
        if (kingPos) break;
    }

    if (!kingPos) return true; // King captured? Illegal state, treat as check.

    // Check if the king is attacked on the temporary board
    return isSquareAttacked(kingPos[0], kingPos[1], (color === 'white' ? 'black' : 'white'), tempBoard);
}

function getPossibleMoves(piece, row, col, board = initialBoard) {
    const color = piece === piece.toUpperCase() ? 'white' : 'black';
    const pseudoLegalMoves = getPossibleMovesWithoutCheck(piece, row, col, board);

    // Filter out moves that leave the king in check
    const legalMoves = pseudoLegalMoves.filter(([toRow, toCol]) =>
        !wouldKingBeInCheck(row, col, toRow, toCol, color, board)
    );

    // Add castling moves if legal
    if (piece.toLowerCase() === 'k') {
        // Kingside
        if (canCastle(color, 'kingside', board)) {
            // Castle move goes 2 squares
            const castleToCol = col + 2;
             legalMoves.push([row, castleToCol]);
        }
        // Queenside
        if (canCastle(color, 'queenside', board)) {
            const castleToCol = col - 2;
             legalMoves.push([row, castleToCol]);
        }
    }

    return legalMoves;
}

function getAllLegalMoves(color, board = initialBoard) {
    const allMoves = [];
    for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
            const piece = board[r][c];
            if (piece && (piece === piece.toUpperCase() ? 'white' : 'black') === color) {
                const moves = getPossibleMoves(piece, r, c, board);
                moves.forEach(move => {
                    allMoves.push({ from: [r, c], to: move, piece: piece });
                });
            }
        }
    }
    return allMoves;
}

function updateCastlingRights(piece, fromRow, fromCol) {
    const pieceType = piece.toLowerCase();
    const color = (piece === piece.toUpperCase()) ? 'white' : 'black';

    if (pieceType === 'k') { // King moved
        if (color === 'white') {
            whiteCanCastleKingside = false;
            whiteCanCastleQueenside = false;
        } else {
            blackCanCastleKingside = false;
            blackCanCastleQueenside = false;
        }
    } else if (pieceType === 'r') { // Rook moved
        if (color === 'white') {
            if (fromRow === 7 && fromCol === 0) whiteCanCastleQueenside = false; // a1 rook
            if (fromRow === 7 && fromCol === 7) whiteCanCastleKingside = false; // h1 rook
        } else {
            if (fromRow === 0 && fromCol === 0) blackCanCastleQueenside = false; // a8 rook
            if (fromRow === 0 && fromCol === 7) blackCanCastleKingside = false; // h8 rook
        }
    }
}

function updateCastlingRightsIfRookCaptured(capturedPiece, capturedRow, capturedCol) {
    // If a rook is captured *on its starting square*, the opponent loses castling rights for that side
    if (capturedPiece === 'R') { // White rook captured
        if (capturedRow === 7 && capturedCol === 0) whiteCanCastleQueenside = false;
        if (capturedRow === 7 && capturedCol === 7) whiteCanCastleKingside = false;
    } else if (capturedPiece === 'r') { // Black rook captured
        if (capturedRow === 0 && capturedCol === 0) blackCanCastleQueenside = false;
        if (capturedRow === 0 && capturedCol === 7) blackCanCastleKingside = false;
    }
}

function canCastle(color, side, board = initialBoard) {
    const row = (color === 'white' ? 7 : 0);
    const kingCol = 4;
    const opponentColor = (color === 'white' ? 'black' : 'white');

    // 1. Check if king or relevant rook has already moved (using state variables)
    if (color === 'white') {
        if (side === 'kingside' && !whiteCanCastleKingside) return false;
        if (side === 'queenside' && !whiteCanCastleQueenside) return false;
    } else {
        if (side === 'kingside' && !blackCanCastleKingside) return false;
        if (side === 'queenside' && !blackCanCastleQueenside) return false;
    }

    // 2. Check if king is currently in check
    if (isKingInCheck(color, board)) return false;

    // 3. Check path clear and safe
    if (side === 'kingside') {
        // Path: f1/f8, g1/g8 must be empty
        if (board[row][kingCol + 1] !== '' || board[row][kingCol + 2] !== '') return false;
        // Squares king moves *through* must not be attacked (e1/e8 checked above, f1/f8, g1/g8)
        if (isSquareAttacked(row, kingCol + 1, opponentColor, board) || isSquareAttacked(row, kingCol + 2, opponentColor, board)) return false;
    } else { // Queenside
        // Path: b1/b8, c1/c8, d1/d8 must be empty
        if (board[row][kingCol - 1] !== '' || board[row][kingCol - 2] !== '' || board[row][kingCol - 3] !== '') return false;
        // Squares king moves *through* must not be attacked (e1/e8 checked above, d1/d8, c1/c8)
        if (isSquareAttacked(row, kingCol - 1, opponentColor, board) || isSquareAttacked(row, kingCol - 2, opponentColor, board)) return false;
        // Note: b1/b8 can be attacked for queenside castling
    }

    return true; // All checks passed
}

// Cheat pour le mode AI vs AI - génère une clé FEN simplifiée pour la détection de répétitions

function getResultanteFenKeyAfterMove(fromRow, fromCol, toRow, toCol, promotion) {
    // *** Attention: Simulation simplifiée - ne gère pas parfaitement les cas complexes de roque/ep/promotion ***
    // Pour une robustesse maximale, il faudrait une copie profonde et appliquer makeMove dessus.
    // Ici, on fait une approximation pour la détection de répétition.

    const tempBoard = initialBoard.map(row => [...row]);
    const movingPiece = tempBoard[fromRow][fromCol];
    if (!movingPiece) return null; // Ne devrait pas arriver

    const targetPiece = tempBoard[toRow][toCol];
    let isEpCapture = false;

    // Simuler le déplacement principal
    tempBoard[toRow][toCol] = promotion
        ? (currentPlayer === 'white' ? promotion.toUpperCase() : promotion.toLowerCase())
        : movingPiece;
    tempBoard[fromRow][fromCol] = '';

    // Simuler capture EP (simplifié)
    if (movingPiece.toLowerCase() === 'p' && enPassantTarget && toRow === enPassantTarget[0] && toCol === enPassantTarget[1] && !targetPiece) {
        tempBoard[fromRow][toCol] = ''; // Enlève le pion capturé EP
        isEpCapture = true;
    }

    // Simuler déplacement tour en cas de roque (simplifié)
    if (movingPiece.toLowerCase() === 'k' && Math.abs(toCol - fromCol) === 2) {
        const isKingside = toCol > fromCol;
        const rookFromCol = isKingside ? 7 : 0;
        const rookToCol = isKingside ? 5 : 3;
        tempBoard[toRow][rookToCol] = tempBoard[toRow][rookFromCol];
        tempBoard[toRow][rookFromCol] = '';
    }

    // Simuler le changement de tour
    const nextPlayer = (currentPlayer === 'white' ? 'black' : 'white');

    // Simuler les droits de roque (approximation - ne capture pas la perte due à la capture d'une tour)
    let tempWk = whiteCanCastleKingside, tempWq = whiteCanCastleQueenside,
        tempBk = blackCanCastleKingside, tempBq = blackCanCastleQueenside;
    const pieceType = movingPiece.toLowerCase();
    if (pieceType === 'k') {
        if (currentPlayer === 'white') { tempWk = false; tempWq = false; }
        else { tempBk = false; tempBq = false; }
    } else if (pieceType === 'r') {
        if (currentPlayer === 'white') {
            if (fromRow === 7 && fromCol === 0) tempWq = false; if (fromRow === 7 && fromCol === 7) tempWk = false;
        } else {
            if (fromRow === 0 && fromCol === 0) tempBq = false; if (fromRow === 0 && fromCol === 7) tempBk = false;
        }
    }
    // Perte de droits si la tour est capturée sur sa case de départ (omise ici pour simplification)


    // Simuler la prochaine cible EP
    let nextEpTarget = null;
    if (movingPiece.toLowerCase() === 'p' && Math.abs(toRow - fromRow) === 2) {
        nextEpTarget = [(fromRow + toRow) / 2, fromCol];
    }

    // Générer la clé FEN (sans les horloges) pour la position simulée
    return boardToSimpleFENKey(tempBoard, nextPlayer, tempWk, tempWq, tempBk, tempBq, nextEpTarget);
}

// Génère la partie pertinente de la FEN pour la répétition
function boardToSimpleFENKey(board, player, wk, wq, bk, bq, epTarget) {
    let fen = '';
    // Placement
    for (let r = 0; r < 8; r++) {
        let empty = 0; let rowFen = '';
        for (let c = 0; c < 8; c++) {
            const p = board[r][c]; if (!p) empty++;
            else { if (empty > 0) rowFen += empty; empty = 0; rowFen += p; }
        } if (empty > 0) rowFen += empty; fen += rowFen + (r === 7 ? '' : '/');
    }
    // Tour
    fen += ` ${player === 'white' ? 'w' : 'b'}`;
    // Roque
    let castleFen = ''; if (wk) castleFen += 'K'; if (wq) castleFen += 'Q'; if (bk) castleFen += 'k'; if (bq) castleFen += 'q'; fen += ` ${castleFen || '-'}`;
    // EP
    if (epTarget) fen += ` ${files[epTarget[1]]}${8 - epTarget[0]}`; else fen += ' -';
    return fen;
}


// Convertit un objet coup de getAllLegalMoves en notation UCI
function moveToUCI(moveData) {
    const fromAlg = files[moveData.from[1]] + (8 - moveData.from[0]);
    const toAlg = files[moveData.to[1]] + (8 - moveData.to[0]);
    // Note: Ne gère pas la promotion ici, car on cherche juste une alternative simple
    return fromAlg + toAlg;
}