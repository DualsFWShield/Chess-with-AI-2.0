// --- START OF FILE scriptss.js ---

const chessboard = document.getElementById('chessboard');
const pieces = {
    'r': '♜', 'n': '♞', 'b': '♝', 'q': '♛', 'k': '♚', 'p': '♟',
    'R': '♖', 'N': '♘', 'B': '♗', 'Q': '♕', 'K': '♔', 'P': '♙'
};

// --- State Variables ---
let initialBoard = []; // Will be populated by resetBoard
let selectedPiece = null;
let promotionCallback = null; // Callback for promotion choice
const capturedWhite = []; // Black pieces captured by White
const capturedBlack = []; // White pieces captured by Black
const pieceValues = { 'p': 1, 'n': 3, 'b': 3, 'r': 5, 'q': 9, 'k': 0 }; // Simplified values
let currentPlayer = 'white';
let whiteTime = 600;
let blackTime = 600;
let timerInterval;
let enPassantTarget = null; // Stores [row, col] of the square vulnerable to en passant, or null

// Castling rights state
let whiteCanCastleKingside = true;
let whiteCanCastleQueenside = true;
let blackCanCastleKingside = true;
let blackCanCastleQueenside = true;

// Game statistics
let gamesPlayed = 0, wins = 0, losses = 0, draws = 0;
let playerRating = 1200;
let aiRating = 1200;
const K_FACTOR = 32;

// --- Game mode & AI difficulty ---
let gameMode = ''; // "human", "ai", "ai-vs-ai"
let aiDifficulty = ''; // For player vs AI
let aiDifficultyWhite = ''; // For AI vs AI (White)
let aiDifficultyBlack = ''; // For AI vs AI (Black)
let aiMoveHistory = { white: [], black: [] }; // For simple repetition avoidance in AI vs AI

// --- Stockfish Worker ---
let stockfish;
let isStockfishReady = false;
let isStockfishThinking = false; // Flag to prevent concurrent commands
let stockfishResponseCallback = null; // Store the callback for the current Stockfish request


// --- Initialization ---
document.addEventListener('DOMContentLoaded', () => {
    initStockfish();
    setupMainMenu();
    setupDifficultySelection();
    setupAivsAiDifficultySelection();
    setupModals();
    setupControls();
    loadSavedSettings();
    updateStatistics(); // Initial display
    // Don't start game immediately, wait for user selection
});

function resetBoardState() {
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
    selectedPiece = null;
    promotionCallback = null;
    capturedWhite.length = 0;
    capturedBlack.length = 0;
    currentPlayer = 'white';
    enPassantTarget = null;
    whiteCanCastleKingside = true;
    whiteCanCastleQueenside = true;
    blackCanCastleKingside = true;
    blackCanCastleQueenside = true;
    aiMoveHistory = { white: [], black: [] }; // Reset history for AI vs AI
    isStockfishThinking = false; // Ensure ready for new game
    stockfishResponseCallback = null;
    updateGameStatus("Nouvelle partie ! Les blancs jouent.");
}

function setupMainMenu() {
    document.getElementById('mode-ai').addEventListener('click', () => {
        gameMode = 'ai';
        document.getElementById('main-menu').style.display = 'none';
        document.getElementById('difficulty-selection').style.display = 'block';
    });
    document.getElementById('mode-human').addEventListener('click', () => {
        gameMode = 'human';
        document.getElementById('main-menu').style.display = 'none';
        startGame();
    });
     document.getElementById('mode-ai-ai').addEventListener('click', () => {
        gameMode = 'ai-vs-ai';
        document.getElementById('main-menu').style.display = 'none';
        document.getElementById('ai-vs-ai-difficulty-selection').style.display = 'block';
    });
}

function setupDifficultySelection() {
     document.querySelectorAll('#difficulty-selection button').forEach(button => {
        button.addEventListener('click', () => {
            aiDifficulty = button.dataset.difficulty;
            document.getElementById('difficulty-selection').style.display = 'none';
            startGame();
        });
    });
}

function setupAivsAiDifficultySelection() {
    document.querySelectorAll('#ai-vs-ai-difficulty-selection .difficulty-button').forEach(button => {
        button.addEventListener('click', () => {
            const color = button.dataset.color;
            const difficulty = button.dataset.difficulty;

            if (color === 'white') {
                aiDifficultyWhite = difficulty;
                document.querySelectorAll('#ai-vs-ai-difficulty-selection button[data-color="white"]').forEach(b => b.classList.remove('selected'));
                button.classList.add('selected');
            } else if (color === 'black') {
                aiDifficultyBlack = difficulty;
                document.querySelectorAll('#ai-vs-ai-difficulty-selection button[data-color="black"]').forEach(b => b.classList.remove('selected'));
                button.classList.add('selected');
            }

            // Check if both difficulties are selected to start the game
            if (aiDifficultyWhite && aiDifficultyBlack) {
                document.getElementById('ai-vs-ai-difficulty-selection').style.display = 'none';
                startGame(); // Start game setup (board, etc.)
            }
        });
    });
}


function setupModals() {
    // Promotion Modal setup (if needed, e.g., close button)
    // Game End Modal setup
    document.getElementById('play-again').onclick = () => {
        // Don't reload, just reset the state and show main menu
         document.getElementById('game-end-modal').style.display = 'none';
         document.getElementById('main-menu').style.display = 'block'; // Show main menu again
         chessboard.innerHTML = ''; // Clear board visually
         resetTimer();
         updateTimerDisplay(); // Display initial times
         // Reset stats display if needed, though they persist
         updateGameStatus("Choisissez un mode de jeu.");
    };
}

function setupControls() {
    document.getElementById('theme-toggle').addEventListener('click', toggleTheme);
    document.getElementById('sound-toggle').addEventListener('click', toggleSound);
}

function loadSavedSettings() {
    // Theme
    const savedTheme = localStorage.getItem('chess-theme');
    const body = document.body;
    const themeIcon = document.querySelector('#theme-toggle i');
    if (savedTheme === 'light') {
        body.classList.add('light-theme');
        if (themeIcon) {
             themeIcon.classList.remove('fa-moon');
             themeIcon.classList.add('fa-sun');
        }
    } else {
        body.classList.remove('light-theme');
         if (themeIcon) {
            themeIcon.classList.remove('fa-sun');
            themeIcon.classList.add('fa-moon');
         }
    }

    // Sound
    const soundSetting = localStorage.getItem('chess-sound');
    const soundIcon = document.querySelector('#sound-toggle i');
    if (soundSetting === 'off') {
        soundEnabled = false;
        if (soundIcon) {
             soundIcon.classList.remove('fa-volume-up');
             soundIcon.classList.add('fa-volume-mute');
        }
    } else {
        soundEnabled = true;
         if (soundIcon) {
            soundIcon.classList.remove('fa-volume-mute');
            soundIcon.classList.add('fa-volume-up');
         }
    }
}


// --- Stockfish Functions ---
function initStockfish() {
    try {
        stockfish = new Worker('stockfish.js');
        stockfish.postMessage('uci'); // Initialize UCI mode

        stockfish.onmessage = function(event) {
            const message = event.data;
            // console.log("Stockfish:", message); // Debugging

            if (message === 'uciok') {
                stockfish.postMessage('isready');
            } else if (message === 'readyok') {
                isStockfishReady = true;
                console.log("Stockfish ready.");
                // If an AI vs AI game was waiting for Stockfish, start it
                 if (gameMode === 'ai-vs-ai' && currentPlayer === 'white' && aiDifficultyWhite && aiDifficultyBlack) {
                     console.log("Stockfish ready, starting AI vs AI move.");
                     requestAiMove(); // Use the unified function
                 }
            } else if (message.startsWith('bestmove')) {
                 isStockfishThinking = false; // Stockfish finished
                const bestmove = message.split(' ')[1];
                if (stockfishResponseCallback) {
                    stockfishResponseCallback(bestmove); // Execute the stored callback
                    stockfishResponseCallback = null; // Clear callback
                } else {
                    console.error("Stockfish response received, but no callback was set!");
                }
            }
            // Optional: Handle other messages like 'info depth...'
        };

        stockfish.onerror = function(error) {
            console.error("Stockfish Worker Error:", error);
            updateGameStatus("Erreur: Impossible de charger l'IA.");
            isStockfishReady = false;
        };

    } catch (e) {
         console.error("Failed to initialize Stockfish Worker:", e);
         updateGameStatus("Erreur: Worker IA non supporté ou introuvable.");
         // Disable AI modes if worker fails
         document.getElementById('mode-ai').disabled = true;
         document.getElementById('mode-ai-ai').disabled = true;
    }
}

// Unified function to request a move from Stockfish
function requestStockfishMove(fen, depth, callback) {
    if (!isStockfishReady) {
        console.error("Stockfish not ready.");
        updateGameStatus("IA non prête...");
        // Maybe try to re-init or wait? For now, just return.
        // In AIvAI, this would stall the game. Could add a retry mechanism.
        return;
    }
     if (isStockfishThinking) {
         console.warn("Stockfish is already thinking. Move request ignored.");
         // This should ideally not happen with serialized calls, but good to have a check.
         return;
     }

    isStockfishThinking = true;
    stockfishResponseCallback = callback; // Store the callback for this specific request
    stockfish.postMessage(`position fen ${fen}`);
    stockfish.postMessage(`go depth ${depth}`);
}


function boardToFEN(board) {
    let fen = '';
    // 1. Piece Placement
    for (let r = 0; r < 8; r++) {
        let emptyCount = 0;
        let rowFen = '';
        for (let c = 0; c < 8; c++) {
            const piece = board[r][c];
            if (!piece || piece === '') {
                emptyCount++;
            } else {
                if (emptyCount > 0) {
                    rowFen += emptyCount;
                    emptyCount = 0;
                }
                rowFen += piece;
            }
        }
        if (emptyCount > 0) rowFen += emptyCount;
        fen += rowFen + (r === 7 ? '' : '/');
    }

    // 2. Active Color
    fen += ` ${currentPlayer === 'white' ? 'w' : 'b'}`;

    // 3. Castling Availability - USE THE STATE VARIABLES!
    let castlingFen = '';
    if (whiteCanCastleKingside) castlingFen += 'K';
    if (whiteCanCastleQueenside) castlingFen += 'Q';
    if (blackCanCastleKingside) castlingFen += 'k';
    if (blackCanCastleQueenside) castlingFen += 'q';
    fen += ` ${castlingFen || '-'}`; // Use '-' if no rights left

    // 4. En passant Target Square
    if (enPassantTarget) {
        const files = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
        // enPassantTarget is [row, col] of the *vulnerable square*
        fen += ` ${files[enPassantTarget[1]]}${8 - enPassantTarget[0]}`;
    } else {
        fen += ' -';
    }

    // 5. Halfmove Clock (Implement later if needed - for 50 move rule)
    fen += ' 0'; // Placeholder
    // 6. Fullmove Number (Implement later if needed)
    fen += ' 1'; // Placeholder

    return fen;
}

// --- Game Flow Functions ---
function startGame() {
    resetBoardState();
    resetTimer();
    createBoard();
    updateCapturedPieces();
    updateProgressBar();
    startTimer();
    updateRatingDisplay(); // Update based on mode
    playSound('start');

    // If AI vs AI mode, trigger the first AI move after a short delay
    if (gameMode === 'ai-vs-ai') {
        if (!aiDifficultyWhite || !aiDifficultyBlack) {
            console.error("AI vs AI mode selected but difficulties not set.");
            updateGameStatus("Erreur: Difficultés IA non définies.");
            return;
        }
         console.log("Starting AI vs AI game. White's turn.");
         // Delay slightly to allow UI to render and Stockfish to potentially finish init
         setTimeout(() => {
            if (isStockfishReady) {
                requestAiMove();
            } else {
                 console.log("AI vs AI start delayed, waiting for Stockfish ready signal.");
                 // initStockfish's readyok handler will call requestAiMove if needed
            }
         }, 500); // 500ms delay
    } else {
         updateGameStatus("Les blancs commencent.");
    }
}

function switchPlayer() {
    currentPlayer = (currentPlayer === 'white' ? 'black' : 'white');
    // Update UI indicator for current player if you have one
}

function endGame(winner) { // winner is 'white', 'black', or 'draw'
    clearInterval(timerInterval); // Stop the timer

    gamesPlayed++;
    let message = '';
    let sound = 'end'; // Default end sound

    if (winner === 'draw') {
        draws++;
        message = 'Partie terminée. Match nul !';
        sound = 'draw';
    } else {
        const winnerColorText = winner === 'white' ? 'Blancs' : 'Noirs';
        message = `Partie terminée. Victoire des ${winnerColorText} !`;

        if (gameMode === 'ai') { // Player vs AI
            if (winner === 'white') { // Player won
                wins++;
                updateRatings(true); // Player won = true
                sound = 'win';
                showConfetti();
            } else { // AI won
                losses++;
                updateRatings(false); // Player won = false
                sound = 'lose';
            }
        } else if (gameMode === 'human') {
             // Decide how to track wins/losses or just announce winner
             sound = (winner === 'white') ? 'win' : 'lose'; // Simple win/lose sound
             if (winner === 'white') showConfetti(); // Confetti for white win
        } else { // AI vs AI - Just announce
            sound = 'end'; // Or specific sounds if desired
        }
    }

    updateStatistics();
    updateRatingDisplay(); // Show final ratings if applicable
    showGameEndModal(message);
    playSound(sound);
}

function checkGameEndConditions(colorToCheck) { // Checks if the player *whose turn it is* is mated or stalemated
    const legalMoves = getAllLegalMoves(colorToCheck);

    if (legalMoves.length === 0) {
        if (isKingInCheck(colorToCheck)) {
            // Checkmate
            const winner = (colorToCheck === 'white' ? 'black' : 'white');
            updateGameStatus(`Échec et mat ! Victoire des ${winner === 'white' ? 'Blancs' : 'Noirs'} !`);
            endGame(winner);
            return true; // Game ended
        } else {
            // Stalemate
            updateGameStatus('Pat ! Match nul !');
            endGame('draw');
            return true; // Game ended
        }
    }
    // Add checks for insufficient material, 50-move rule, threefold repetition here later
    return false; // Game continues
}


// --- AI Logic ---

function getAiSearchDepth(difficulty, color) {
    // Use playerRating and aiRating only if gameMode is 'ai' and difficulty is 'adaptative'
    // For AI vs AI, use fixed depths based on selection
    const diffLower = difficulty.toLowerCase();
    let searchDepth = 2; // Default

    switch (diffLower) {
        case 'noob': searchDepth = 1; break;
        case 'easy': searchDepth = 2; break;
        case 'regular': searchDepth = 3; break;
        case 'hard': searchDepth = 4; break;
        case 'very hard': searchDepth = 6; break;
        case 'super hard': searchDepth = 8; break;
        case 'magnus carlsen': searchDepth = 12; break;
        case 'unbeatable': searchDepth = 15; break;
        case 'adaptative':
             // Adaptative only really makes sense in Player vs AI
             if (gameMode === 'ai') {
                const ratingDiff = aiRating - playerRating;
                if (ratingDiff < -300) searchDepth = 1;
                else if (ratingDiff < -100) searchDepth = 2;
                else if (ratingDiff < 100) searchDepth = 3;
                else if (ratingDiff < 300) searchDepth = 4;
                else searchDepth = 5;
             } else {
                 searchDepth = 3; // Default for adaptive in AI vs AI? Or use 'regular'?
             }
            break;
        default: searchDepth = 2;
    }
    return searchDepth;
}

// Main function to trigger AI move (handles both Player vs AI and AI vs AI)
function requestAiMove() {
    if (gameMode === 'ai' && currentPlayer === 'black') {
        const fen = boardToFEN(initialBoard);
        const depth = getAiSearchDepth(aiDifficulty, 'black');
        updateGameStatus("L'IA réfléchit...");
        requestStockfishMove(fen, depth, handleAiMoveResponse);
    } else if (gameMode === 'ai-vs-ai') {
        const currentDifficulty = (currentPlayer === 'white') ? aiDifficultyWhite : aiDifficultyBlack;
        const fen = boardToFEN(initialBoard);
        const depth = getAiSearchDepth(currentDifficulty, currentPlayer);
        updateGameStatus(`IA (${currentPlayer}) réfléchit (${currentDifficulty} - Prof ${depth})...`);
        requestStockfishMove(fen, depth, handleAiMoveResponse);
    }
}

// Callback function for when Stockfish returns a move
function handleAiMoveResponse(bestmove) {
     console.log(`Stockfish (${currentPlayer}) bestmove: ${bestmove}`); // Log the move
     if (!bestmove || bestmove === '(none)') {
        console.error("Stockfish returned no valid move.");
        updateGameStatus(`Erreur IA (${currentPlayer}) : aucun coup valide.`);
        // This could happen in mate/stalemate, but checkGameEndConditions should catch it first.
        // If it happens unexpectedly, it might indicate a FEN issue or Stockfish error.
        // For AI vs AI, this would stall the game. Maybe declare a draw?
        if (gameMode === 'ai-vs-ai') {
            endGame('draw'); // Or handle appropriately
        }
        return;
    }

    // --- Anti-Repetition for AI vs AI ---
    let moveUCI = bestmove.substring(0, 4); // Ignore promotion part for history check
    if (gameMode === 'ai-vs-ai') {
        const history = aiMoveHistory[currentPlayer];
        history.push(moveUCI);
        if (history.length > 6) history.shift(); // Keep last 6 moves (3 pairs)

        const repeatCount = history.filter(m => m === moveUCI).length;
        if (repeatCount >= 3) {
            if (window.console && typeof window.console.warn === 'function') {
                window.console.warn(`AI (${currentPlayer}) move ${moveUCI} repeated ${repeatCount} times. Looking for alternative.`);
            } else {
                console.log(`AI (${currentPlayer}) move ${moveUCI} repeated ${repeatCount} times. Looking for alternative.`);
            }
            updateGameStatus(`IA (${currentPlayer}) répète un coup. (${moveUCI})`);
            // Ici, vous pouvez tenter de chercher un coup alternatif.
        }
    }

    // Parse the move: e.g., "e2e4" or "a7a8q" (promotion)
    const fileToCol = { a: 0, b: 1, c: 2, d: 3, e: 4, f: 5, g: 6, h: 7 };
    const fromCol = fileToCol[bestmove[0]];
    const fromRow = 8 - parseInt(bestmove[1]);
    const toCol = fileToCol[bestmove[2]];
    const toRow = 8 - parseInt(bestmove[3]);
    const promotionPiece = bestmove.length === 5 ? bestmove[4] : null; // e.g., 'q'

    const movingPiece = initialBoard[fromRow][fromCol];
    if (!movingPiece) {
         console.error(`AI Error: No piece found at source square ${bestmove.substring(0,2)} for move ${bestmove}`);
         updateGameStatus(`Erreur interne IA (${currentPlayer}).`);
         // This indicates a major desync between board state and AI thinking.
         return;
    }

    // --- Apply the move ---
    // Capture
    const capturedPiece = initialBoard[toRow][toCol];
    if (capturedPiece) {
        if (capturedPiece.toLowerCase() === 'k') {
            console.error("AI attempted to capture the king! FEN or logic error.");
             updateGameStatus(`Erreur critique IA (${currentPlayer}) !`);
            endGame(currentPlayer); // The player making the illegal move loses (or draw?)
            return;
        }
        if (capturedPiece.toUpperCase() === capturedPiece) { // White piece captured
            capturedBlack.push(capturedPiece.toLowerCase());
        } else { // Black piece captured
            capturedWhite.push(capturedPiece.toUpperCase());
        }
        playSound('capture');
    } else {
         playSound('move2'); // AI move sound
    }

    // Move piece
    initialBoard[toRow][toCol] = movingPiece;
    initialBoard[fromRow][fromCol] = '';

    // En Passant capture (AI perspective)
    // If the move was a pawn diagonal to the enPassantTarget square
    if (movingPiece.toLowerCase() === 'p' && enPassantTarget && toRow === enPassantTarget[0] && toCol === enPassantTarget[1]) {
        const capturedPawnRow = fromRow; // Pawn was on the same rank
        const capturedPawnCol = toCol;
        const capturedPawn = initialBoard[capturedPawnRow][capturedPawnCol]; // Should be opponent's pawn
        if (capturedPawn) {
            if (capturedPawn.toUpperCase() === capturedPawn) { // White pawn captured
                capturedBlack.push('p');
            } else { // Black pawn captured
                capturedWhite.push('P');
            }
            initialBoard[capturedPawnRow][capturedPawnCol] = ''; // Remove captured pawn
            playSound('capture'); // Override move sound
        } else {
            console.error("En passant error: Expected pawn not found for capture.");
        }
    }

     // Castling (AI perspective) - move the rook
    if (movingPiece.toLowerCase() === 'k' && Math.abs(toCol - fromCol) === 2) {
        const rookFromCol = (toCol > fromCol) ? 7 : 0; // Kingside or Queenside
        const rookToCol = (toCol > fromCol) ? 5 : 3; // Rook destination col
        initialBoard[toRow][rookToCol] = initialBoard[toRow][rookFromCol];
        initialBoard[toRow][rookFromCol] = '';
        playSound('castle');
    }


    // Promotion (AI perspective)
    if (promotionPiece) {
         const promoted = (currentPlayer === 'white') ? promotionPiece.toUpperCase() : promotionPiece.toLowerCase();
        initialBoard[toRow][toCol] = promoted;
        playSound('promote');
    }


    // --- Update State After Move ---
    updateCastlingRights(movingPiece, fromRow, fromCol); // Update based on piece moved FROM
     if (capturedPiece) { // If a rook was captured, update opponent's rights
         updateCastlingRightsIfRookCaptured(capturedPiece, toRow, toCol);
     }

    // Set new enPassantTarget *only* if a pawn moved two squares
    if (movingPiece.toLowerCase() === 'p' && Math.abs(toRow - fromRow) === 2) {
        enPassantTarget = [ (fromRow + toRow) / 2, fromCol ]; // The square *behind* the pawn
    } else {
        enPassantTarget = null; // Clear en passant target otherwise
    }


    // --- Post-Move Updates ---
    createBoard(); // Redraw board
    updateCapturedPieces();
    updateProgressBar();
    checkAndUpdateKingStatus(); // Check for checks resulting from the AI move


    // --- Check Game End / Switch Player ---
    switchPlayer(); // Switch player *before* checking their status
    const opponentColor = currentPlayer; // Now refers to the player whose turn it is

    if (!checkGameEndConditions(opponentColor)) {
        // If game continues, check if the opponent is now in check
        if (isKingInCheck(opponentColor)) {
            updateGameStatus(`Échec au roi ${opponentColor === 'white' ? 'blanc' : 'noir'} !`);
            playSound('check');
        } else {
            updateGameStatus(`Au tour des ${opponentColor === 'white' ? 'Blancs' : 'Noirs'}.`);
        }

        // If AI vs AI, trigger the next AI move
        if (gameMode === 'ai-vs-ai') {
             setTimeout(requestAiMove, 100); // Short delay between AI moves
        }
    }
    // If checkGameEndConditions returned true, the game ended, nothing more to do here.
}

// --- Board Creation & Rendering ---
function createBoard() {
    chessboard.innerHTML = '';
    const files = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
    // Clear previous highlights
    document.querySelectorAll('.square.highlight, .square.capture, .square.selected, .square.last-move').forEach(sq => {
        sq.classList.remove('highlight', 'capture', 'selected', 'last-move');
    });

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
                 // Add color class for potential styling
                 pieceElement.classList.add(piece === piece.toUpperCase() ? 'white-piece' : 'black-piece');
                 square.appendChild(pieceElement);
            }

            // Optional: Add square labels (a1, h8, etc.)
            const label = document.createElement('span');
            label.className = 'square-label';
            label.textContent = `${files[colIndex]}${8 - rowIndex}`;
            square.appendChild(label);

            // Add click listener only if it's not AI vs AI turn
            if (gameMode !== 'ai-vs-ai') {
                 square.addEventListener('click', handleSquareClick);
            } else {
                // Optionally add a class or style to indicate non-clickable squares during AI vs AI
                 square.style.cursor = 'default';
            }

            chessboard.appendChild(square);
        }
    }

     // Highlight last move after board redraw
     // (Requires storing last move info: lastMove = { from: [r,c], to: [r,c] })
     // if (lastMove) {
     //     highlightSquare(lastMove.from[0], lastMove.from[1], 'last-move');
     //     highlightSquare(lastMove.to[0], lastMove.to[1], 'last-move');
     // }
}

function highlightSquare(row, col, className) {
     const square = document.querySelector(`.square[data-row="${row}"][data-col="${col}"]`);
     if (square) {
         square.classList.add(className);
     }
}

function highlightMoves(moves) {
    // Clear previous highlights first (already done in createBoard generally)
    document.querySelectorAll('.square.highlight, .square.capture').forEach(sq => {
        sq.classList.remove('highlight', 'capture');
    });

    moves.forEach(([r, c]) => {
        const square = document.querySelector(`.square[data-row="${r}"][data-col="${c}"]`);
        if (square) {
            if (initialBoard[r][c] !== "") { // If target square has a piece
                square.classList.add('capture'); // Highlight for capture
            } else {
                square.classList.add('highlight'); // Highlight for move
            }
        }
    });
}

// --- User Interaction ---
function handleSquareClick(event) {
    // Ignore clicks if it's AI's turn or AI vs AI game
    if ((gameMode === 'ai' && currentPlayer === 'black') || gameMode === 'ai-vs-ai' || isStockfishThinking) {
        return;
    }

    const square = event.currentTarget; // Use currentTarget for the element listener was attached to
    const row = parseInt(square.dataset.row);
    const col = parseInt(square.dataset.col);
    const pieceOnSquare = initialBoard[row][col];

    if (selectedPiece) {
        // A piece was already selected, try to move
        const fromRow = parseInt(selectedPiece.dataset.row);
        const fromCol = parseInt(selectedPiece.dataset.col);
        const movingPiece = initialBoard[fromRow][fromCol];

        // Check if the clicked square is a valid destination
        const possibleMoves = getPossibleMoves(movingPiece, fromRow, fromCol);
        const isValidMove = possibleMoves.some(([r, c]) => r === row && c === col);

        if (isValidMove) {
            // --- Perform the move ---
            let capturedPiece = initialBoard[row][col]; // Store potential capture
            let isEnPassantCapture = false;
            let isCastle = false;

            // Check for En Passant Capture (human move)
            if (movingPiece.toLowerCase() === 'p' && enPassantTarget && row === enPassantTarget[0] && col === enPassantTarget[1] && !capturedPiece) {
                const capturedPawnRow = fromRow;
                const capturedPawnCol = col;
                capturedPiece = initialBoard[capturedPawnRow][capturedPawnCol]; // The pawn being captured en passant
                 initialBoard[capturedPawnRow][capturedPawnCol] = ''; // Remove it
                 isEnPassantCapture = true;
            }

            // Check for Castling (human move)
            if (movingPiece.toLowerCase() === 'k' && Math.abs(col - fromCol) === 2) {
                 isCastle = true;
                const rookFromCol = (col > fromCol) ? 7 : 0; // Kingside or Queenside
                const rookToCol = (col > fromCol) ? 5 : 3; // Rook destination col
                 initialBoard[row][rookToCol] = initialBoard[row][rookFromCol];
                 initialBoard[row][rookFromCol] = '';
            }


            // Record capture (if not en passant, or if en passant found the piece)
            if (capturedPiece && !isEnPassantCapture) {
                 if (capturedPiece.toLowerCase() === 'k') { // Should not happen if getPossibleMoves is correct
                     console.error("Illegal move allowed: King capture attempt.");
                     return; // Don't allow the move
                 }
                 if (capturedPiece.toUpperCase() === capturedPiece) { // White piece captured
                     capturedBlack.push(capturedPiece.toLowerCase());
                 } else { // Black piece captured
                     capturedWhite.push(capturedPiece.toUpperCase());
                 }
                 playSound('capture');
            } else if (isEnPassantCapture && capturedPiece) {
                 // Already handled adding captured piece above
                 playSound('capture');
            } else if (isCastle) {
                 playSound('castle');
            } else {
                 playSound('move'); // Normal move sound
            }

            // Move the piece
            initialBoard[row][col] = movingPiece;
            initialBoard[fromRow][fromCol] = '';


             // --- Update State After Move ---
             updateCastlingRights(movingPiece, fromRow, fromCol);
             if (capturedPiece && !isEnPassantCapture) { // Update opponent rights if a rook was captured directly
                 updateCastlingRightsIfRookCaptured(capturedPiece, row, col);
             }


            // Set new enPassantTarget *only* if a pawn moved two squares
            let newEnPassantTarget = null; // Local variable for clarity
             if (movingPiece.toLowerCase() === 'p' && Math.abs(row - fromRow) === 2) {
                 newEnPassantTarget = [ (fromRow + row) / 2, col ];
             }
             enPassantTarget = newEnPassantTarget; // Update global state


            // Handle Promotion
            const isPromotion = (movingPiece.toLowerCase() === 'p' && (row === 0 || row === 7));
            if (isPromotion) {
                playSound('promote');
                showPromotionModal(currentPlayer, (promoPieceType) => {
                    // This callback executes AFTER the user chooses
                    initialBoard[row][col] = (currentPlayer === 'white') ? promoPieceType.toUpperCase() : promoPieceType.toLowerCase();
                    createBoard(); // Redraw with promoted piece
                    updateCapturedPieces();
                    updateProgressBar();
                    checkAndUpdateKingStatus(); // Check status after promotion

                     // Now switch player and check game end conditions
                    switchPlayer();
                    const opponentColor = currentPlayer;
                    if (!checkGameEndConditions(opponentColor)) {
                        if (isKingInCheck(opponentColor)) {
                             updateGameStatus(`Échec au roi ${opponentColor === 'white' ? 'blanc' : 'noir'} !`);
                             playSound('check');
                         } else {
                             updateGameStatus(`Au tour des ${opponentColor === 'white' ? 'Blancs' : 'Noirs'}.`);
                         }
                         // If Player vs AI, trigger AI move now
                        if (gameMode === 'ai' && opponentColor === 'black') {
                             requestAiMove();
                        }
                     }
                });
                 // *** Important: Return here because the rest of the turn logic happens in the callback ***
                 selectedPiece.classList.remove('selected');
                 selectedPiece = null;
                 highlightMoves([]); // Clear highlights
                 createBoard(); // Redraw board immediately (will be updated again on promotion choice)
                 return;
            }

            // --- Post-Move Updates (if not promotion) ---
            selectedPiece.classList.remove('selected');
            selectedPiece = null;
            highlightMoves([]);
            createBoard(); // Redraw board
            updateCapturedPieces();
            updateProgressBar();
            checkAndUpdateKingStatus(); // Check status after human move


             // --- Check Game End / Switch Player ---
            switchPlayer();
            const opponentColor = currentPlayer; // Now the next player

            if (!checkGameEndConditions(opponentColor)) {
                 if (isKingInCheck(opponentColor)) {
                     updateGameStatus(`Échec au roi ${opponentColor === 'white' ? 'blanc' : 'noir'} !`);
                     playSound('check');
                 } else {
                     updateGameStatus(`Au tour des ${opponentColor === 'white' ? 'Blancs' : 'Noirs'}.`);
                 }

                 // If Player vs AI, trigger AI move
                 if (gameMode === 'ai' && opponentColor === 'black') {
                     requestAiMove();
                 }
             }
             // If checkGameEndConditions was true, game ended.

        } else {
            // Invalid move clicked
            playSound('illegal');
            selectedPiece.classList.remove('selected');
            selectedPiece = null;
            highlightMoves([]); // Clear highlights
        }

    } else if (pieceOnSquare && (pieceOnSquare.toUpperCase() === pieceOnSquare ? 'white' : 'black') === currentPlayer) {
        // No piece selected yet, and clicked on a valid piece of the current player
        playSound('click');
        selectedPiece = square;
        selectedPiece.classList.add('selected');
        const moves = getPossibleMoves(pieceOnSquare, row, col);
        highlightMoves(moves);
    } else {
         // Clicked on empty square or opponent's piece without selection
         if (selectedPiece) {
             selectedPiece.classList.remove('selected');
             selectedPiece = null;
             highlightMoves([]);
         }
    }
}

// --- Move Generation & Validation ---

// Checks if a square is attacked by the opponent
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

// Generates moves without checking if they leave the king in check (pseudo-legal)
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


// Checks if the king of the specified color is currently in check
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

// Simulates a move and checks if it would leave the king in check
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

// Gets all fully legal moves for a piece (filters out moves that leave king in check)
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

// Get all legal moves for a given color
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


// --- Castling Logic ---

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


// --- UI Updates & Modals ---

function updateGameStatus(statusText) {
    document.getElementById('game-status').textContent = statusText;
}

function updateCapturedPieces() {
    // Display captured White pieces (captured BY Black)
    document.getElementById('captured-white').innerHTML = capturedWhite
        .sort() // Optional: sort for consistency
        .map(piece => pieces[piece.toUpperCase()]) // Use uppercase for white pieces display
        .join(' ');

    // Display captured Black pieces (captured BY White)
    document.getElementById('captured-black').innerHTML = capturedBlack
        .sort() // Optional: sort
        .map(piece => pieces[piece.toLowerCase()]) // Use lowercase for black pieces display
        .join(' ');
}


function updateProgressBar() {
    // capturedWhite holds *black* pieces captured *by white*
    const whiteCaptureValue = capturedWhite.reduce((sum, piece) => sum + (pieceValues[piece.toLowerCase()] || 0), 0);
    // capturedBlack holds *white* pieces captured *by black*
    const blackCaptureValue = capturedBlack.reduce((sum, piece) => sum + (pieceValues[piece.toLowerCase()] || 0), 0);

    // Calculate score difference (positive means white is ahead, negative means black is ahead)
    const scoreDifference = whiteCaptureValue - blackCaptureValue;

    // Simple visualization: progress bar shows material advantage relative to total captured
    // More sophisticated: Could relate to initial total material (~39 points excluding kings)
    // Let's use a simple advantage bar: White advantage pushes right, Black advantage pushes left

    const totalCapturedValue = whiteCaptureValue + blackCaptureValue;
    let whitePercentage = 50; // Start at 50% if no captures or equal captures

    if (totalCapturedValue > 0) {
         // Normalize difference based on total captured, scale from 0 to 100 centered at 50
         // Example: White +3 advantage out of 10 total captured. Diff = 3, Total = 10.
         // Need a way to map this. Let's try simple percentage of total.
         // whitePercentage = (whiteCaptureValue / totalCapturedValue) * 100; // This shows % of captured material

         // Alternative: Show advantage magnitude (e.g., +3)
         // For progress bar, let's scale the advantage. Max possible advantage is ~39.
         // Scale scoreDifference from -39 to +39 -> 0% to 100%
         const maxAdvantage = 10; // Cap the visual advantage shown (e.g., +/- 10 points)
         const scaledDifference = Math.max(-maxAdvantage, Math.min(maxAdvantage, scoreDifference));
         whitePercentage = 50 + (scaledDifference / maxAdvantage) * 50;

    } else if (scoreDifference !== 0) {
         // Handle initial material imbalance if setup changes? Unlikely for standard chess.
         whitePercentage = (scoreDifference > 0) ? 60 : 40; // Slight visual indication if somehow imbalanced at start
    }


    // Ensure percentage stays within bounds
     whitePercentage = Math.max(0, Math.min(100, whitePercentage));
    const blackPercentage = 100 - whitePercentage;

    document.getElementById('white-progress').style.width = `${whitePercentage}%`;
    document.getElementById('black-progress').style.width = `${blackPercentage}%`;

     // Display score difference numerically
     const scoreDisplay = document.getElementById('score-advantage'); // Add this element to your HTML
     if (scoreDisplay) {
         if (scoreDifference > 0) {
             scoreDisplay.textContent = `+${scoreDifference}`;
             scoreDisplay.className = 'score-white';
         } else if (scoreDifference < 0) {
             scoreDisplay.textContent = `${scoreDifference}`; // Already negative
             scoreDisplay.className = 'score-black';
         } else {
             scoreDisplay.textContent = ''; // No advantage
             scoreDisplay.className = '';
         }
     }
}

function checkAndUpdateKingStatus() {
    const whiteInCheck = isKingInCheck('white');
    const blackInCheck = isKingInCheck('black');

     highlightKingInCheck('white', whiteInCheck);
     highlightKingInCheck('black', blackInCheck);

    // Update status text only if game is ongoing and not ending checkmate/stalemate message
    // (The checkGameEndConditions handles end messages)
    // if (/* game is ongoing */) { ... }
    // Status text updates are handled within move functions now primarily.
}

function highlightKingInCheck(color, inCheck) {
    const kingSymbol = (color === 'white' ? 'K' : 'k');
    const kingSquare = findPieceSquare(kingSymbol);
    if (kingSquare) {
        if (inCheck) {
            kingSquare.classList.add('in-check');
        } else {
            kingSquare.classList.remove('in-check');
        }
    }
}

function findPieceSquare(pieceSymbol) {
     for (let r = 0; r < 8; r++) {
         for (let c = 0; c < 8; c++) {
             if (initialBoard[r][c] === pieceSymbol) {
                 return document.querySelector(`.square[data-row="${r}"][data-col="${c}"]`);
             }
         }
     }
     return null;
}


function showPromotionModal(color, callback) {
    promotionCallback = callback; // Store callback
    const modal = document.getElementById('promotion-modal');
    const promotionOptions = modal.querySelector('.promotion-options');
    promotionOptions.innerHTML = ''; // Clear previous options

    const promotionPieceTypes = ['q', 'r', 'b', 'n']; // Standard promotion pieces
    promotionPieceTypes.forEach(pieceType => {
        const pieceDiv = document.createElement('div');
        const pieceSymbol = (color === 'white' ? pieceType.toUpperCase() : pieceType.toLowerCase());
        pieceDiv.className = `promotion-piece ${color}-piece`; // Add color class if needed for styling
        pieceDiv.dataset.piece = pieceType; // Store 'q', 'r', etc.
        pieceDiv.textContent = pieces[pieceSymbol]; // Display Unicode character

        pieceDiv.onclick = () => {
             if (promotionCallback) {
                 promotionCallback(pieceType); // Pass back 'q', 'r', 'b', or 'n'
             }
             modal.style.display = 'none';
             promotionCallback = null; // Clear callback after use
        };
        promotionOptions.appendChild(pieceDiv);
    });

    modal.style.display = 'block';
}

function showGameEndModal(message) {
    const modal = document.getElementById('game-end-modal');
    document.getElementById('game-end-message').textContent = message;
    modal.style.display = 'block';
    // 'Play Again' button logic is in setupModals
}

// --- Timer Functions ---
function startTimer() {
    clearInterval(timerInterval); // Clear any existing interval
    timerInterval = setInterval(() => {
        if (currentPlayer === 'white') {
            whiteTime--;
            if (whiteTime <= 0) {
                whiteTime = 0; // Prevent negative display
                updateTimerDisplay();
                updateGameStatus('Temps écoulé pour les blancs ! Victoire des Noirs.');
                endGame('black');
                return;
            }
        } else {
            blackTime--;
            if (blackTime <= 0) {
                blackTime = 0; // Prevent negative display
                updateTimerDisplay();
                updateGameStatus('Temps écoulé pour les noirs ! Victoire des Blancs.');
                endGame('white');
                return;
            }
        }
        updateTimerDisplay();
        // Play sound when time is low
        if ((currentPlayer === 'white' && whiteTime === 10) || (currentPlayer === 'black' && blackTime === 10)) {
             playSound('tenseconds');
        }
    }, 1000);
}

function resetTimer() {
    clearInterval(timerInterval);
    whiteTime = 600; // 10 minutes
    blackTime = 600;
}

function formatTime(totalSeconds) {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
}

function updateTimerDisplay() {
    const whiteTimeEl = document.getElementById('white-time');
    const blackTimeEl = document.getElementById('black-time');

    whiteTimeEl.textContent = formatTime(whiteTime);
    blackTimeEl.textContent = formatTime(blackTime);

    // Add/remove urgent class based on time remaining
    if (whiteTime <= 30) whiteTimeEl.classList.add('urgent');
    else whiteTimeEl.classList.remove('urgent');

    if (blackTime <= 30) blackTimeEl.classList.add('urgent');
    else blackTimeEl.classList.remove('urgent');
}

// --- Statistics & Rating ---
function updateStatistics() {
    document.getElementById('games-played').textContent = gamesPlayed;
    document.getElementById('wins').textContent = wins;
    document.getElementById('losses').textContent = losses;
    document.getElementById('draws').textContent = draws;
}

function updateRatings(playerWon) { // Only call this for Player vs AI games
    if (gameMode !== 'ai') return;

    const expectedScore = 1 / (1 + Math.pow(10, (aiRating - playerRating) / 400));
    const actualScore = playerWon ? 1 : (playerWon === false ? 0 : 0.5); // Handle draw? For now, only win/loss

    const ratingChange = Math.round(K_FACTOR * (actualScore - expectedScore));

    playerRating += ratingChange;
    aiRating -= ratingChange; // AI rating changes inversely

    console.log(`Rating change: ${ratingChange}. New Player Rating: ${playerRating}, New AI Rating: ${aiRating}`);
    updateRatingDisplay(); // Update UI after calculation
}


function updateRatingDisplay() {
    const player1RatingEl = document.querySelector('.player-1-rating');
    const player2RatingEl = document.querySelector('.player-2-rating');
    const player1NameEl = document.querySelector('.player-1-name');
    const player2NameEl = document.querySelector('.player-2-name');
    
    // Vérifier que tous les éléments existent
    if (!player1RatingEl || !player2RatingEl || !player1NameEl || !player2NameEl) {
        if (window.console && typeof window.console.warn === 'function') {
            window.console.warn("Les éléments de rating ou de nom ne sont pas trouvés dans le DOM.");
        }
        return;
    }
    
    if (gameMode === 'ai') {
         player1NameEl.textContent = "Joueur";
         player2NameEl.textContent = `IA (${aiDifficulty})`;
         player1RatingEl.textContent = playerRating;
         player2RatingEl.textContent = aiRating;
    } else if (gameMode === 'human') {
         player1NameEl.textContent = "Joueur 1";
         player2NameEl.textContent = "Joueur 2";
         player1RatingEl.textContent = "----";
         player2RatingEl.textContent = "----";
    } else if (gameMode === 'ai-vs-ai') {
         player1NameEl.textContent = `IA Blanc (${aiDifficultyWhite})`;
         player2NameEl.textContent = `IA Noir (${aiDifficultyBlack})`;
         player1RatingEl.textContent = "----";
         player2RatingEl.textContent = "----";
    } else {
         player1NameEl.textContent = "Joueur 1";
         player2NameEl.textContent = "Joueur 2";
         player1RatingEl.textContent = "----";
         player2RatingEl.textContent = "----";
    }
}


// --- Theme & Sound ---
function toggleTheme() {
    const body = document.body;
    const icon = document.querySelector('#theme-toggle i');
    body.classList.toggle('light-theme');

    if (body.classList.contains('light-theme')) {
        icon.classList.remove('fa-moon');
        icon.classList.add('fa-sun');
        localStorage.setItem('chess-theme', 'light');
    } else {
        icon.classList.remove('fa-sun');
        icon.classList.add('fa-moon');
        localStorage.setItem('chess-theme', 'dark');
    }
}

let soundEnabled = true;
const sounds = {}; // Lazy load sounds on first play? Or preload essential ones.

function loadSound(name, path) {
     if (!sounds[name]) {
         try {
             sounds[name] = new Audio(path);
         } catch (e) {
             console.error(`Failed to load sound ${name}:`, e);
             sounds[name] = null; // Prevent further attempts
         }
     }
     return sounds[name];
}

function playSound(soundName) {
    if (!soundEnabled) return;

    // Define sound paths here or in a config object
    const soundPaths = {
        move: 'sounds/move-self.mp3',
        move2: 'sounds/move-opponent.mp3', // AI/Opponent move sound
        capture: 'sounds/capture.mp3',
        castle: 'sounds/castle.mp3',
        check: 'sounds/move-check.mp3',
        click: 'sounds/click.mp3', // Piece selection click
        promote: 'sounds/promote.mp3',
        illegal: 'sounds/illegal.mp3',
        start: 'sounds/game-start.mp3',
        win: 'sounds/game-win.mp3',
        lose: 'sounds/game-lose.mp3',
        draw: 'sounds/game-draw.mp3',
        end: 'sounds/game-end.mp3', // Generic end sound if not win/lose/draw
        tenseconds: 'sounds/tenseconds.mp3'
         // Add others as needed
    };

    const audio = loadSound(soundName, soundPaths[soundName]);

    if (audio) {
        audio.currentTime = 0;
        audio.play().catch(e => {
             // Autoplay policy might block sound initially
             // console.warn("Sound play failed (possibly due to user interaction needed):", e);
        });
    }
}

function toggleSound() {
    soundEnabled = !soundEnabled;
    const icon = document.querySelector('#sound-toggle i');

    if (soundEnabled) {
        icon.classList.remove('fa-volume-mute');
        icon.classList.add('fa-volume-up');
        localStorage.setItem('chess-sound', 'on');
        playSound('click'); // Play a sound to confirm it's on
    } else {
        icon.classList.remove('fa-volume-up');
        icon.classList.add('fa-volume-mute');
        localStorage.setItem('chess-sound', 'off');
         // Stop any currently playing sounds? Maybe not necessary.
    }
}


// --- Effects ---
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