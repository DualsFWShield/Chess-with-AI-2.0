// Version optimisée du code d'échecs
const chessboard = document.getElementById('chessboard');
const pieces = {
    'r': '♜', 'n': '♞', 'b': '♝', 'q': '♛', 'k': '♚', 'p': '♟',
    'R': '♖', 'N': '♘', 'B': '♗', 'Q': '♕', 'K': '♔', 'P': '♙'
};

// Constantes pour les valeurs des pièces et directions de mouvement
const PIECE_VALUES = { 'p': 1, 'n': 3, 'b': 3, 'r': 5, 'q': 9, 'k': 0 };
const ROOK_DIRS = [[-1, 0], [1, 0], [0, -1], [0, 1]];
const BISHOP_DIRS = [[-1, -1], [-1, 1], [1, -1], [1, 1]];
const QUEEN_DIRS = [...ROOK_DIRS, ...BISHOP_DIRS];
const KNIGHT_MOVES = [[-2, -1], [-2, 1], [-1, -2], [-1, 2], [1, -2], [1, 2], [2, -1], [2, 1]];

// État du jeu
const initialBoard = [
    ['r', 'n', 'b', 'q', 'k', 'b', 'n', 'r'],
    ['p', 'p', 'p', 'p', 'p', 'p', 'p', 'p'],
    ['', '', '', '', '', '', '', ''],
    ['', '', '', '', '', '', '', ''],
    ['', '', '', '', '', '', '', ''],
    ['', '', '', '', '', '', '', ''],
    ['P', 'P', 'P', 'P', 'P', 'P', 'P', 'P'],
    ['R', 'N', 'B', 'Q', 'K', 'B', 'N', 'R']
];

let selectedPiece = null;
let promotionCallback = null;
const capturedWhite = [];
const capturedBlack = [];
let currentPlayer = 'white';
let whiteTime = 600;
let blackTime = 600;
let timerInterval;
let enPassantTarget = null;

// Statistiques et paramètres
let gamesPlayed = 0, wins = 0, losses = 0, draws = 0;
let gameMode = '';
let aiDifficulty = '';
let playerRating = 1200;
let aiRating = 1200;
const K_FACTOR = 32;
let soundEnabled = true;

// Cache pour les éléments DOM fréquemment utilisés
const domCache = {};

// Fonction utilitaire pour obtenir des éléments DOM avec cache
function getElement(id) {
    if (!domCache[id]) {
        domCache[id] = document.getElementById(id);
    }
    return domCache[id];
}

// Initialisation des sons avec lazy loading
const sounds = {};
function getSound(name) {
    if (!sounds[name]) {
        sounds[name] = new Audio(`sounds/${name}.mp3`);
    }
    return sounds[name];
}

function playSound(soundName) {
    if (soundEnabled) {
        const sound = getSound(soundName);
        sound.currentTime = 0;
        sound.play().catch(e => console.log("Sound play error:", e));
    }
}

// --- Sélection du mode de jeu ---
getElement('mode-ai')?.addEventListener('click', () => {
    gameMode = 'ai';
    getElement('main-menu').style.display = 'none';
    getElement('difficulty-selection').style.display = 'block';
});

getElement('mode-human')?.addEventListener('click', () => {
    gameMode = 'human';
    getElement('main-menu').style.display = 'none';
    startGame();
});

// Sélection de la difficulté
document.querySelectorAll('#difficulty-selection button').forEach(button => {
    button.addEventListener('click', () => {
        aiDifficulty = button.dataset.difficulty;
        getElement('difficulty-selection').style.display = 'none';
        startGame();
    });
});

// --- Fonctions d'interface utilisateur ---
function showPromotionModal(color, callback) {
    const modal = getElement('promotion-modal');
    const promotionOptions = modal.querySelector('.promotion-options');
    
    promotionOptions.innerHTML = '';
    
    ['q', 'r', 'n', 'b'].forEach(pieceType => {
        const pieceDiv = document.createElement('div');
        pieceDiv.className = `promotion-piece ${color}-piece`;
        pieceDiv.dataset.piece = pieceType;
        pieceDiv.textContent = pieces[color === 'white' ? pieceType.toUpperCase() : pieceType];
        
        pieceDiv.onclick = () => {
            callback(pieceType);
            modal.style.display = 'none';
        };
        
        promotionOptions.appendChild(pieceDiv);
    });
    
    modal.style.display = 'block';
}

function showGameEndModal(message) {
    const modal = getElement('game-end-modal');
    getElement('game-end-message').textContent = message;
    modal.style.display = 'block';
    
    getElement('play-again').onclick = () => {
        location.reload();
    };
}

function updateGameStatus(statusText) {
    getElement('game-status').textContent = statusText;
}

function updateProgressBar() {
    const whiteScore = capturedWhite.reduce((sum, piece) => sum + (PIECE_VALUES[piece.toLowerCase()] || 0), 0);
    const blackScore = capturedBlack.reduce((sum, piece) => sum + (PIECE_VALUES[piece.toLowerCase()] || 0), 0);
    const totalScore = whiteScore + blackScore || 1;
    const whitePercentage = (whiteScore / totalScore) * 100;
    const blackPercentage = (blackScore / totalScore) * 100;
    
    getElement('white-progress').style.width = `${whitePercentage}%`;
    getElement('black-progress').style.width = `${blackPercentage}%`;
}

function updateRatingDisplay() {
    const player1RatingEl = document.querySelector('.player-1-rating');
    const player2RatingEl = document.querySelector('.player-2-rating');
    
    if (player1RatingEl && player2RatingEl) {
        if (gameMode === 'ai') {
            player1RatingEl.textContent = playerRating;
            player2RatingEl.textContent = aiRating;
        } else {
            player1RatingEl.textContent = playerRating;
            player2RatingEl.textContent = playerRating;
        }
    }
}

function updateCapturedPieces() {
    const capturedWhiteEl = getElement('captured-white');
    const capturedBlackEl = getElement('captured-black');
    
    if (capturedWhiteEl && capturedBlackEl) {
        capturedWhiteEl.innerHTML = capturedWhite.map(piece => pieces[piece.toLowerCase()]).join(' ');
        capturedBlackEl.innerHTML = capturedBlack.map(piece => pieces[piece.toLowerCase()]).join(' ');
    }
}

function updateStatistics() {
    getElement('games-played')?.textContent = gamesPlayed;
    getElement('wins')?.textContent = wins;
    getElement('losses')?.textContent = losses;
    getElement('draws')?.textContent = draws;
}

// --- Fonctions de gestion du temps ---
function startTimer() {
    timerInterval = setInterval(() => {
        if (currentPlayer === 'white') {
            whiteTime--;
            if (whiteTime <= 0) {
                updateGameStatus('Temps écoulé pour les blancs !');
                endGame('black');
                return;
            }
        } else {
            blackTime--;
            if (blackTime <= 0) {
                updateGameStatus('Temps écoulé pour les noirs !');
                endGame('white');
                return;
            }
        }
        updateTimerDisplay();
    }, 1000);
}

function updateTimerDisplay() {
    const whiteTimeEl = getElement('white-time');
    const blackTimeEl = getElement('black-time');
    
    if (whiteTimeEl && blackTimeEl) {
        whiteTimeEl.textContent = formatTime(whiteTime);
        blackTimeEl.textContent = formatTime(blackTime);
        
        whiteTimeEl.classList.toggle('urgent', whiteTime <= 60);
        blackTimeEl.classList.toggle('urgent', blackTime <= 60);
    }
}

function resetTimer() {
    whiteTime = 600;
    blackTime = 600;
    clearInterval(timerInterval);
}

function formatTime(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
}

// --- Fonctions de gestion du jeu ---
function startGame() {
    resetTimer();
    createBoard();
    updateCapturedPieces();
    updateProgressBar();
    startTimer();
    updateRatingDisplay();
    playSound('start');
}

function endGame(winner) {
    gamesPlayed++;
    if (winner === 'white' && gameMode === 'ai') {
        wins++;
        updateRatings(true);
    } else if (winner === 'black' && gameMode === 'ai') {
        losses++;
        updateRatings(false);
    } else {
        draws++;
    }
    updateStatistics();
    clearInterval(timerInterval);
    
    const message = `Partie terminée. ${winner === 'draw' ? 'Match nul !' : 'Victoire des ' + (winner === 'white' ? 'Blancs' : 'Noirs') + ' !'}`;
    showGameEndModal(message);
    
    if (winner === 'white') {
        playSound('win');
        showConfetti();
    } else if (winner === 'black') {
        playSound('lose');
    } else {
        playSound('draw');
    }
}

function updateRatings(playerWon) {
    const expectedScore = 1 / (1 + Math.pow(10, (aiRating - playerRating) / 400));
    const actualScore = playerWon ? 1 : 0;
    
    playerRating = Math.round(playerRating + K_FACTOR * (actualScore - expectedScore));
    aiRating = Math.round(aiRating + K_FACTOR * ((1 - actualScore) - (1 - expectedScore)));
}

// --- Fonctions d'échecs ---
function createBoard() {
    if (!chessboard) return;
    
    chessboard.innerHTML = '';
    const files = ['a','b','c','d','e','f','g','h'];
    
    initialBoard.forEach((row, rowIndex) => {
        row.forEach((piece, colIndex) => {
            const square = document.createElement('div');
            square.classList.add('square');
            square.classList.add((rowIndex + colIndex) % 2 === 0 ? 'light' : 'dark');
            square.dataset.row = rowIndex;
            square.dataset.col = colIndex;
            
            if (piece) {
                square.textContent = pieces[piece];
            }
            
            const label = document.createElement('span');
            label.className = 'square-label';
            label.textContent = `${files[colIndex]}${8 - rowIndex}`;
            square.appendChild(label);
            
            square.addEventListener('click', handleSquareClick);
            chessboard.appendChild(square);
        });
    });
}

// Fonction optimisée pour cloner un plateau
function cloneBoard(board) {
    return board.map(row => [...row]);
}

// Vérifier si une case est attaquée par une couleur donnée
function isSquareAttacked(row, col, attackingColor, board = initialBoard) {
    // Optimisation: vérifier d'abord les attaques de pions car elles sont simples
    const pawnDir = attackingColor === 'white' ? 1 : -1;
    const pawnSymbol = attackingColor === 'white' ? 'P' : 'p';
    
    // Vérifier les attaques diagonales des pions
    if (row - pawnDir >= 0 && row - pawnDir < 8) {
        if (col - 1 >= 0 && board[row - pawnDir][col - 1] === pawnSymbol) return true;
        if (col + 1 < 8 && board[row - pawnDir][col + 1] === pawnSymbol) return true;
    }
    
    // Vérifier les attaques de cavalier
    const knightSymbol = attackingColor === 'white' ? 'N' : 'n';
    for (const [dr, dc] of KNIGHT_MOVES) {
        const r = row + dr, c = col + dc;
        if (r >= 0 && r < 8 && c >= 0 && c < 8 && board[r][c] === knightSymbol) {
            return true;
        }
    }
    
    // Vérifier les attaques de tour/dame (horizontales et verticales)
    const rookSymbol = attackingColor === 'white' ? 'R' : 'r';
    const queenSymbol = attackingColor === 'white' ? 'Q' : 'q';
    
    for (const [dr, dc] of ROOK_DIRS) {
        for (let i = 1; i < 8; i++) {
            const r = row + dr * i, c = col + dc * i;
            if (r < 0 || r >= 8 || c < 0 || c >= 8) break;
            
            const piece = board[r][c];
            if (piece) {
                if (piece === rookSymbol || piece === queenSymbol) return true;
                break;
            }
        }
    }
    
    // Vérifier les attaques de fou/dame (diagonales)
    const bishopSymbol = attackingColor === 'white' ? 'B' : 'b';
    
    for (const [dr, dc] of BISHOP_DIRS) {
        for (let i = 1; i < 8; i++) {
            const r = row + dr * i, c = col + dc * i;
            if (r < 0 || r >= 8 || c < 0 || c >= 8) break;
            
            const piece = board[r][c];
            if (piece) {
                if (piece === bishopSymbol || piece === queenSymbol) return true;
                break;
            }
        }
    }
    
    // Vérifier les attaques de roi
    const kingSymbol = attackingColor === 'white' ? 'K' : 'k';
    for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
            if (dr === 0 && dc === 0) continue;
            const r = row + dr, c = col + dc;
            if (r >= 0 && r < 8 && c >= 0 && c < 8 && board[r][c] === kingSymbol) {
                return true;
            }
        }
    }
    
    return false;
}

// Vérifier si le roi est en échec
function isKingInCheck(color, board = initialBoard) {
    const kingSymbol = color === 'white' ? 'K' : 'k';
    let kingPos = null;
    
    // Trouver la position du roi
    outerLoop: for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
            if (board[r][c] === kingSymbol) {
                kingPos = [r, c];
                break outerLoop;
            }
        }
    }
    
    if (!kingPos) return true;
    
    return isSquareAttacked(kingPos[0], kingPos[1], color === 'white' ? 'black' : 'white', board);
}

// Obtenir les mouvements possibles sans vérifier l'échec
function getPossibleMovesWithoutCheck(piece, row, col, board = initialBoard) {
    const moves = [];
    const color = piece === piece.toUpperCase() ? 'white' : 'black';
    const pieceType = piece.toLowerCase();
    
    switch (pieceType) {
        case 'p': {
            const direction = color === 'white' ? -1 : 1;
            const startRow = color === 'white' ? 6 : 1;
            
            // Mouvement avant
            if (row + direction >= 0 && row + direction < 8 && !board[row + direction][col]) {
                moves.push([row + direction, col]);
                if (row === startRow && !board[row + 2 * direction][col]) {
                    moves.push([row + 2 * direction, col]);
                }
            }
            
            // Captures diagonales
            for (const dc of [-1, 1]) {
                if (col + dc >= 0 && col + dc < 8 && row + direction >= 0 && row + direction < 8) {
                    const targetPiece = board[row + direction][col + dc];
                    if (targetPiece && (targetPiece === targetPiece.toUpperCase() ? 'white' : 'black') !== color) {
                        moves.push([row + direction, col + dc]);
                    }
                }
            }
            
            // En passant
            if (enPassantTarget && 
                enPassantTarget[0] === row + direction && 
                Math.abs(enPassantTarget[1] - col) === 1) {
                moves.push([row + direction, enPassantTarget[1]]);
            }
            break;
        }
        
        case 'r': {
            for (const [dr, dc] of ROOK_DIRS) {
                for (let i = 1; i < 8; i++) {
                    const r = row + dr * i, c = col + dc * i;
                    if (r < 0 || r >= 8 || c < 0 || c >= 8) break;
                    
                    if (!board[r][c]) {
                        moves.push([r, c]);
                    } else {
                        if ((board[r][c] === board[r][c].toUpperCase() ? 'white' : 'black') !== color) {
                            moves.push([r, c]);
                        }
                        break;
                    }
                }
            }
            break;
        }
        
        case 'n': {
            for (const [dr, dc] of KNIGHT_MOVES) {
                const r = row + dr, c = col + dc;
                if (r >= 0 && r < 8 && c >= 0 && c < 8 && 
                    (!board[r][c] || (board[r][c] === board[r][c].toUpperCase() ? 'white' : 'black') !== color)) {
                    moves.push([r, c]);
                }
            }
            break;
        }
        
        case 'b': {
            for (const [dr, dc] of BISHOP_DIRS) {
                for (let i = 1; i < 8; i++) {
                    const r = row + dr * i, c = col + dc * i;
                    if (r < 0 || r >= 8 || c < 0 || c >= 8) break;
                    
                    if (!board[r][c]) {
                        moves.push([r, c]);
                    } else {
                        if ((board[r][c] === board[r][c].toUpperCase() ? 'white' : 'black') !== color) {
                            moves.push([r, c]);
                        }
                        break;
                    }
                }
            }
            break;
        }
        
        case 'q': {
            for (const [dr, dc] of QUEEN_DIRS) {
                for (let i = 1; i < 8; i++) {
                    const r = row + dr * i, c = col + dc * i;
                    if (r < 0 || r >= 8 || c < 0 || c >= 8) break;
                    
                    if (!board[r][c]) {
                        moves.push([r, c]);
                    } else {
                        if ((board[r][c] === board[r][c].toUpperCase() ? 'white' : 'black') !== color) {
                            moves.push([r, c]);
                        }
                        break;
                    }
                }
            }
            break;
        }
        
        case 'k': {
            for (let dr = -1; dr <= 1; dr++) {
                for (let dc = -1; dc <= 1; dc++) {
                    if (dr === 0 && dc === 0) continue;
                    const r = row + dr, c = col + dc;
                    if (r >= 0 && r < 8 && c >= 0 && c < 8 && 
                        (!board[r][c] || (board[r][c] === board[r][c].toUpperCase() ? 'white' : 'black') !== color)) {
                        moves.push([r, c]);
                    }
                }
            }
            break;
        }
    }
    
    return moves;
}

// Vérifier si le roque est possible
function canCastle(color, side, board = initialBoard) {
    const row = color === 'white' ? 7 : 0;
    const king = color === 'white' ? 'K' : 'k';
    const rook = color === 'white' ? 'R' : 'r';
    const opponentColor = color === 'white' ? 'black' : 'white';

    // Vérifier la position initiale du roi
    if (board[row][4] !== king) return false;

    // Vérifier si le roi est en échec
    if (isSquareAttacked(row, 4, opponentColor, board)) return false;

    if (side === 'kingside') {
        if (board[row][7] !== rook) return false;
        if (board[row][5] !== '' || board[row][6] !== '') return false;
        
        // Vérifier si les cases sont attaquées
        return !isSquareAttacked(row, 5, opponentColor, board) && 
               !isSquareAttacked(row, 6, opponentColor, board);
    } else {
        if (board[row][0] !== rook) return false;
        if (board[row][1] !== '' || board[row][2] !== '' || board[row][3] !== '') return false;
        
        // Vérifier si les cases sont attaquées
        return !isSquareAttacked(row, 3, opponentColor, board) && 
               !isSquareAttacked(row, 2, opponentColor, board);
    }
}

// Obtenir tous les mouvements légaux pour une pièce
function getPossibleMoves(piece, row, col, board = initialBoard) {
    const moves = [];
    const color = piece === piece.toUpperCase() ? 'white' : 'black';
    const isInitialPosition = (row === (color === 'white' ? 7 : 0));

    // Obtenir les mouvements de base
    const basicMoves = getPossibleMovesWithoutCheck(piece, row, col, board);

    // Filtrer les mouvements qui mettraient le roi en échec
    const legalMoves = basicMoves.filter(([toRow, toCol]) => {
        const tempBoard = cloneBoard(board);
        tempBoard[toRow][toCol] = tempBoard[row][col];
        tempBoard[row][col] = '';
        
        // Si c'est un mouvement du roi, vérifier la nouvelle position
        if (piece.toLowerCase() === 'k') {
            return !isSquareAttacked(toRow, toCol, color === 'white' ? 'black' : 'white', tempBoard);
        }
        
        // Sinon, trouver la position du roi et vérifier
        const kingSymbol = color === 'white' ? 'K' : 'k';
        for (let r = 0; r < 8; r++) {
            for (let c = 0; c < 8; c++) {
                if (tempBoard[r][c] === kingSymbol) {
                    return !isSquareAttacked(r, c, color === 'white' ? 'black' : 'white', tempBoard);
                }
            }
        }
        return true;
    });

    // Ajouter les mouvements de roque si possible
    if (piece.toLowerCase() === 'k' && isInitialPosition) {
        if (canCastle(color, 'kingside', board)) {
            moves.push([row, col + 2]);
        }
        if (canCastle(color, 'queenside', board)) {
            moves.push([row, col - 2]);
        }
    }

    return [...legalMoves, ...moves];
}

// Vérifier si c'est un échec et mat
function isCheckmate(color) {
    // Vérifier d'abord si le roi est en échec
    if (!isKingInCheck(color)) return false;

    // Vérifier si un mouvement peut sortir de l'échec
    for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
            const piece = initialBoard[r][c];
            if (piece && (piece === piece.toUpperCase() ? 'white' : 'black') === color) {
                const moves = getPossibleMoves(piece, r, c);
                if (moves.length > 0) return false;
            }
        }
    }
    return true;
}

// Vérifier si c'est un pat
function isStalemate(color) {
    // Si le roi est en échec, ce n'est pas pat
    if (isKingInCheck(color)) return false;

    // Vérifier s'il reste des mouvements légaux
    for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
            const piece = initialBoard[r][c];
            if (piece && (piece === piece.toUpperCase() ? 'white' : 'black') === color) {
                const moves = getPossibleMoves(piece, r, c);
                if (moves.length > 0) return false;
            }
        }
    }

    // Vérifier les conditions de matériel insuffisant
    const pieces = initialBoard.flat().filter(p => p !== '');
    
    // Roi contre roi
    if (pieces.length === 2) return true;

    // Roi et fou/cavalier contre roi
    if (pieces.length === 3) {
        const nonKings = pieces.filter(p => p.toLowerCase() !== 'k');
        if (nonKings.length === 1 && 
            (nonKings[0].toLowerCase() === 'b' || nonKings[0].toLowerCase() === 'n')) {
            return true;
        }
    }

    // Si aucun mouvement légal n'est possible mais il y a suffisamment de matériel
    return true;
}

// Mettre en évidence les mouvements possibles
function highlightMoves(moves) {
    document.querySelectorAll('.square').forEach(square => {
        square.classList.remove('highlight');
        square.classList.remove('capture');
    });
    
    moves.forEach(([r, c]) => {
        const square = document.querySelector(`.square[data-row="${r}"][data-col="${c}"]`);
        if (square) {
            square.classList.add('highlight');
            // Si la case contient déjà une pièce, c'est un mouvement de capture
            if (initialBoard[r][c] !== "") {
                square.classList.add('capture');
            }
        }
    });
}

// Gérer le clic sur une case
function handleSquareClick(event) {
    const square = event.target.closest('.square');
    if (!square) return;
    
    const row = parseInt(square.dataset.row);
    const col = parseInt(square.dataset.col);
    const piece = initialBoard[row][col];

    // Stocker l'état précédent pour l'historique des mouvements
    const fromSquare = selectedPiece ? {
        row: parseInt(selectedPiece.dataset.row),
        col: parseInt(selectedPiece.dataset.col)
    } : null;
    
    if (selectedPiece) {
        const fromRow = parseInt(selectedPiece.dataset.row);
        const fromCol = parseInt(selectedPiece.dataset.col);
        const movingPiece = initialBoard[fromRow][fromCol];
        const moves = getPossibleMoves(movingPiece, fromRow, fromCol);
        const isCapture = !!initialBoard[row][col];

        // Vérifier si le mouvement est légal
        if (moves.some(([r, c]) => r === row && c === col)) {
            // Gestion du roque
            if (movingPiece.toLowerCase() === 'k' && Math.abs(col - fromCol) === 2) {
                const isKingside = col > fromCol;
                const rookFromCol = isKingside ? 7 : 0;
                const rookToCol = isKingside ? col - 1 : col + 1;
                initialBoard[row][rookToCol] = initialBoard[row][rookFromCol];
                initialBoard[row][rookFromCol] = '';
                playSound('castle');
            }

            // Gestion de l'en passant
            if (movingPiece.toLowerCase() === 'p' && 
                Math.abs(col - fromCol) === 1 && 
                !initialBoard[row][col] &&
                enPassantTarget &&
                enPassantTarget[0] === row &&
                enPassantTarget[1] === col) {
                
                const capturedRow = currentPlayer === 'white' ? row + 1 : row - 1;
                const capturedPiece = initialBoard[capturedRow][col];
                
                if (capturedPiece) {
                    if (currentPlayer === 'white') {
                        capturedBlack.push('p');
                    } else {
                        capturedWhite.push('P');
                    }
                    initialBoard[capturedRow][col] = '';
                }
            }

            // Enregistrer la capture classique
            if (initialBoard[row][col]) {
                const capturedPiece = initialBoard[row][col];
                if (capturedPiece === capturedPiece.toUpperCase()) {
                    capturedBlack.push(capturedPiece.toLowerCase());
                } else {
                    capturedWhite.push(capturedPiece.toUpperCase());
                }
                playSound('capture');
            } else {
                playSound('move');
            }

            // Déplacer la pièce
            initialBoard[row][col] = movingPiece;
            initialBoard[fromRow][fromCol] = '';

            // Gestion de la promotion du pion
            if (movingPiece.toLowerCase() === 'p' && (row === 0 || row === 7)) {
                showPromotionModal(currentPlayer, (promoPiece) => {
                    initialBoard[row][col] = currentPlayer === 'white'
                        ? promoPiece.toUpperCase()
                        : promoPiece;
                    createBoard();
                    updateCapturedPieces();
                    updateProgressBar();
                    checkAndUpdateKingStatus();
                    playSound('promote');
                    
                    // Mettre à jour le joueur actuel après la promotion
                    currentPlayer = currentPlayer === 'white' ? 'black' : 'white';
                    if (gameMode === 'ai' && currentPlayer === 'black') {
                        aiMakeMove();
                    }
                });
                return;
            }

            // Mettre à jour en passant
            if (movingPiece.toLowerCase() === 'p' && Math.abs(row - fromRow) === 2) {
                enPassantTarget = [(row + fromRow) / 2, col];
            } else {
                enPassantTarget = null;
            }

            // Mettre à jour l'affichage
            createBoard();
            updateCapturedPieces();
            updateProgressBar();
            checkAndUpdateKingStatus();

            // Mettre en évidence le dernier mouvement
            document.querySelectorAll('.square.last-move').forEach(sq => {
                sq.classList.remove('last-move');
            });
            
            document.querySelector(`.square[data-row="${fromRow}"][data-col="${fromCol}"]`)?.classList.add('last-move');
            document.querySelector(`.square[data-row="${row}"][data-col="${col}"]`)?.classList.add('last-move');

            // Vérifier l'état du jeu
            const nextPlayer = currentPlayer === 'white' ? 'black' : 'white';
            if (isCheckmate(nextPlayer)) {
                updateGameStatus(`Échec et mat ! Les ${currentPlayer === 'white' ? 'Blancs' : 'Noirs'} gagnent !`);
                playSound(currentPlayer === 'white' ? 'win' : 'lose');
                playSound('end');
                endGame(currentPlayer);
                return;
            }
            
            if (isStalemate(nextPlayer)) {
                updateGameStatus('Pat ! Match nul !');
                playSound('draw');
                endGame('draw');
                return;
            }
            
            if (isKingInCheck(nextPlayer)) {
                updateGameStatus(`Échec au roi ${nextPlayer === 'white' ? 'blanc' : 'noir'} !`);
                playSound('check');
            }
            
            // Changer de joueur
            currentPlayer = nextPlayer;
            selectedPiece = null;
            highlightMoves([]);

            // Si c'est au tour de l'IA
            if (gameMode === 'ai' && currentPlayer === 'black') {
                aiMakeMove();
            }
        } else {
            selectedPiece = null;
            highlightMoves([]);
        }
    } else if (piece && ((piece === piece.toUpperCase() ? 'white' : 'black') === currentPlayer)) {
        selectedPiece = square;
        const moves = getPossibleMoves(piece, row, col);
        highlightMoves(moves);
    }
}

// --- Fonctions pour l'IA ---
// Convertir le plateau en notation FEN
function boardToFEN(board) {
    let fenRows = [];
    for (let r = 0; r < 8; r++) {
        let rowFen = "";
        let emptyCount = 0;
        for (let c = 0; c < 8; c++) {
            const piece = board[r][c];
            if (!piece) {
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
        fenRows.push(rowFen);
    }
    const piecePlacement = fenRows.join('/');
    const activeColor = currentPlayer === 'white' ? 'w' : 'b';
    
    // Droits de roque
    let castling = "";
    if (board[7][4] === 'K') {
        if (board[7][7] === 'R') castling += "K";
        if (board[7][0] === 'R') castling += "Q";
    }
    if (board[0][4] === 'k') {
        if (board[0][7] === 'r') castling += "k";
        if (board[0][0] === 'r') castling += "q";
    }
    if (castling === "") castling = "-";
    
    // Case en passant
    let ep = "-";
    if (enPassantTarget) {
        const files = ['a','b','c','d','e','f','g','h'];
        ep = files[enPassantTarget[1]] + (8 - enPassantTarget[0]);
    }
    
    return `${piecePlacement} ${activeColor} ${castling} ${ep} 0 1`;
}

// Initialisation de Stockfish
let stockfish;
function initStockfish() {
    stockfish = new Worker('stockfish.js');
    stockfish.postMessage('uci');
}
initStockfish();

// Faire jouer l'IA
function aiMakeMove() {
    setTimeout(() => {
        // Vérifier s'il y a des mouvements possibles
        let hasLegalMoves = false;
        outerLoop: for (let r = 0; r < 8; r++) {
            for (let c = 0; c < 8; c++) {
                const piece = initialBoard[r][c];
                if (piece && piece === piece.toLowerCase()) {
                    const moves = getPossibleMoves(piece, r, c);
                    if (moves.length > 0) {
                        hasLegalMoves = true;
                        break outerLoop;
                    }
                }
            }
        }
        
        if (!hasLegalMoves) {
            if (isKingInCheck('black')) {
                updateGameStatus('Échec et mat ! Les Blancs gagnent !');
                playSound('win');
                endGame('white');
            } else {
                updateGameStatus('Pat ! Match nul !');
                playSound('draw');
                endGame('draw');
            }
            return;
        }

        // Déterminer la profondeur de recherche selon le niveau
        const difficultyLower = aiDifficulty.toLowerCase();
        let searchDepth;

        if (difficultyLower === 'noob') {
            searchDepth = 1;
        } else if (difficultyLower === 'easy') {
            searchDepth = 2;
        } else if (difficultyLower === 'regular') {
            searchDepth = 3;
        } else if (difficultyLower === 'hard') {
            searchDepth = 4;
        } else if (difficultyLower === 'adaptative') {
            const ratingDiff = aiRating - playerRating;
            searchDepth = ratingDiff < -300 ? 1 :
                         ratingDiff < -100 ? 2 :
                         ratingDiff < 100 ? 3 :
                         ratingDiff < 300 ? 4 : 5;
        } else if (difficultyLower === 'very hard') {
            searchDepth = 6;
        } else if (difficultyLower === 'super hard') {
            searchDepth = 8;
        } else if (difficultyLower === 'magnus carlsen') {
            searchDepth = 12;
        } else if (difficultyLower === 'unbeatable') {
            searchDepth = 15;
        } else {
            searchDepth = 2; // Par défaut
        }
        
        // Conversion du board en FEN et envoi à Stockfish
        const fen = boardToFEN(initialBoard);
        stockfish.postMessage(`position fen ${fen}`);
        stockfish.postMessage(`go depth ${searchDepth}`);
        
        stockfish.onmessage = function(event) {
            if (event.data.startsWith('bestmove')) {
                const bestmove = event.data.split(' ')[1];
                if (bestmove && bestmove !== '(none)') {
                    // Conversion du coup UCI en indices sur le board
                    const fileToCol = { a: 0, b: 1, c: 2, d: 3, e: 4, f: 5, g: 6, h: 7 };
                    const fromFile = bestmove[0];
                    const fromRank = bestmove[1];
                    const toFile = bestmove[2];
                    const toRank = bestmove[3];
                    const fromCol = fileToCol[fromFile];
                    const toCol = fileToCol[toFile];
                    const fromRow = 8 - parseInt(fromRank);
                    const toRow = 8 - parseInt(toRank);
                    
                    // Enregistrer une capture s'il y a une pièce sur la case cible
                    if (initialBoard[toRow][toCol]) {
                        const capturedPiece = initialBoard[toRow][toCol];
                        if (capturedPiece === capturedPiece.toUpperCase()) {
                            capturedBlack.push(capturedPiece.toLowerCase());
                            playSound('capture');
                        } else {
                            capturedWhite.push(capturedPiece.toUpperCase());
                            playSound('capture');
                        }
                    } else {
                        playSound('move2');
                    }
                    
                    // Appliquer le coup
                    initialBoard[toRow][toCol] = initialBoard[fromRow][fromCol];
                    initialBoard[fromRow][fromCol] = '';
                    
                    // Promotion automatique pour les pions arrivant en fin de plateau
                    if (initialBoard[toRow][toCol].toLowerCase() === 'p' && toRow === 7) {
                        initialBoard[toRow][toCol] = 'q';
                        playSound('promote');
                    }
                    
                    // Mettre à jour l'affichage
                    createBoard();
                    updateCapturedPieces();
                    updateProgressBar();
                    checkAndUpdateKingStatus();
                    
                    // Mettre en évidence le dernier mouvement
                    document.querySelectorAll('.square.last-move').forEach(sq => {
                        sq.classList.remove('last-move');
                    });
                    
                    document.querySelector(`.square[data-row="${fromRow}"][data-col="${fromCol}"]`)?.classList.add('last-move');
                    document.querySelector(`.square[data-row="${toRow}"][data-col="${toCol}"]`)?.classList.add('last-move');
                    
                    // Vérifier l'état du jeu
                    if (isCheckmate('white')) {
                        updateGameStatus('Échec et mat ! L\'IA gagne !');
                        playSound('lose');
                        endGame('black');
                        return;
                    }
                    
                    if (isStalemate('white')) {
                        updateGameStatus('Pat ! Match nul !');
                        playSound('draw');
                        endGame('draw');
                        return;
                    }
                    
                    if (isKingInCheck('white')) {
                        updateGameStatus('Échec au roi blanc !');
                        playSound('check');
                    }
                    
                    currentPlayer = 'white';
                    updateRatingDisplay();
                }
            }
        };
    }, 500);
}

// --- Fonctions d'interface utilisateur ---
function checkAndUpdateKingStatus() {
    if (isKingInCheck('white')) {
        updateGameStatus('Échec au roi blanc !');
    } else if (isKingInCheck('black')) {
        updateGameStatus('Échec au roi noir !');
    } else {
        updateGameStatus('Statut : Pas de quoi s\'inquiéter !');
    }
}

// --- Fonctions pour les effets visuels ---
function showToast(message, icon, duration = 3000) {
    let toastContainer = document.querySelector('.toast-container');
    if (!toastContainer) {
        toastContainer = document.createElement('div');
        toastContainer.className = 'toast-container';
        document.body.appendChild(toastContainer);
    }
    
    const toast = document.createElement('div');
    toast.className = 'toast';
    
    const iconElement = document.createElement('i');
    iconElement.className = `fas ${icon}`;
    
    const messageElement = document.createElement('span');
    messageElement.textContent = message;
    
    toast.appendChild(iconElement);
    toast.appendChild(messageElement);
    toastContainer.appendChild(toast);
    
    setTimeout(() => {
        toast.classList.add('hide');
        setTimeout(() => toast.remove(), 300);
    }, duration);
}

function showConfetti() {
    const container = document.createElement('div');
    container.className = 'confetti-container';
    document.body.appendChild(container);
    
    const colors = ['#f44336', '#e91e63', '#9c27b0', '#673ab7', '#3f51b5', 
                   '#2196f3', '#03a9f4', '#00bcd4', '#009688', '#4CAF50'];
    
    for (let i = 0; i < 100; i++) {
        const confetti = document.createElement('div');
        confetti.className = 'confetti';
        confetti.style.left = Math.random() * 100 + 'vw';
        confetti.style.animationDelay = Math.random() * 5 + 's';
        confetti.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
        container.appendChild(confetti);
    }
    
    setTimeout(() => container.remove(), 6000);
}

// --- Fonctions pour le thème ---
function toggleTheme() {
    const body = document.body;
    const icon = document.querySelector('#theme-toggle i');
    
    if (body.classList.contains('light-theme')) {
        body.classList.remove('light-theme');
        icon.classList.remove('fa-sun');
        icon.classList.add('fa-moon');
        localStorage.setItem('chess-theme', 'dark');
    } else {
        body.classList.add('light-theme');
        icon.classList.remove('fa-moon');
        icon.classList.add('fa-sun');
        localStorage.setItem('chess-theme', 'light');
    }
}

function toggleSound() {
    soundEnabled = !soundEnabled;
    const icon = document.querySelector('#sound-toggle i');
    
    if (soundEnabled) {
        icon.classList.remove('fa-volume-mute');
        icon.classList.add('fa-volume-up');
    } else {
        icon.classList.remove('fa-volume-up');
        icon.classList.add('fa-volume-mute');
    }
    
    localStorage.setItem('chess-sound', soundEnabled ? 'on' : 'off');
}

function loadSavedTheme() {
    const savedTheme = localStorage.getItem('chess-theme');
    const body = document.body;
    const icon = document.querySelector('#theme-toggle i');

    if (savedTheme === 'light') {
        body.classList.add('light-theme');
        if (icon) {
            icon.classList.remove('fa-moon');
            icon.classList.add('fa-sun');
        }
    } else {
        body.classList.remove('light-theme');
        if (icon) {
            icon.classList.remove('fa-sun');
            icon.classList.add('fa-moon');
        }
    }
}

// --- Initialisation ---
document.addEventListener('DOMContentLoaded', function() {
    loadSavedTheme();

    // Vérifier si les boutons existent déjà
    if (!document.getElementById('theme-toggle') && !document.getElementById('sound-toggle')) {
        // Ajouter le conteneur de contrôles
        const controlsContainer = document.createElement('div');
        controlsContainer.className = 'controls-container';
        controlsContainer.innerHTML = `
            <button id="theme-toggle" class="control-button">
                <i class="fas fa-moon"></i>
            </button>
            <button id="sound-toggle" class="control-button">
                <i class="fas fa-volume-up"></i>
            </button>
        `;
        document.body.appendChild(controlsContainer);

        // Ajouter les écouteurs d'événements pour les boutons
        document.getElementById('theme-toggle').addEventListener('click', toggleTheme);
        document.getElementById('sound-toggle').addEventListener('click', toggleSound);
    }

    // Initialiser l'état du son
    const soundSetting = localStorage.getItem('chess-sound');
    if (soundSetting === 'off') {
        soundEnabled = false;
        const soundIcon = document.querySelector('#sound-toggle i');
        if (soundIcon) {
            soundIcon.classList.remove('fa-volume-up');
            soundIcon.classList.add('fa-volume-mute');
        }
    }
    
    createBoard();
    updateCapturedPieces();
    updateProgressBar();
    updateStatistics();
    checkAndUpdateKingStatus();
});

// Exécuter l'initialisation
console.log("Code d'échecs optimisé chargé avec succès!");