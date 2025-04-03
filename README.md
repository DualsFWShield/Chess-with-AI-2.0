# JavaScript Chess Game with Stockfish AI ♟️

![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)

A browser-based chess application built with pure HTML, CSS, and JavaScript, featuring multiple game modes including local play against another human, challenging an AI powered by Stockfish.js, and watching two AIs battle it out.

**(Note: This README describes the version *without* online multiplayer via Firebase.)**

## Aperçu

![Menu principal](assets/Mode-selection.png)
*Menu principal du jeu DFWS Chess*

![Échiquier](assets/board.png)
*Échiquier avec interface moderne et animations fluides*


## ✨ Features

**Gameplay & Rules:**
*   Standard chess rules implemented.
*   Piece movement validation (including special moves).
*   **Castling:** Kingside and Queenside castling supported.
*   **En Passant:** Pawn captures en passant implemented.
*   **Pawn Promotion:** Modal dialog to choose Queen, Rook, Bishop, or Knight upon promotion.
*   **Check Detection:** Highlights the king when in check.
*   **Checkmate & Stalemate Detection:** Ends the game correctly with appropriate messages.
*   **Time Controls:** Timers for both White and Black players; game ends on timeout.
*   **Game End Conditions:** Supports win by checkmate/timeout, draw by stalemate, 50-move rule, threefold repetition (basic check), and insufficient material (basic cases).
*   **Resignation:** Option to resign the game (in human-involved modes).
*   **Undo Move:** Ability to undo the last move (or last pair of moves in Player vs AI mode).

**Game Modes:**
*   👤 **Human vs. Human:** Play locally against another person on the same browser.
*   🤖 **Human vs. AI:** Play against the Stockfish engine with selectable difficulty levels.
    *   ELO Rating System: Tracks player and AI ELO, adjusting after each game.
*   👾 **AI vs. AI:** Watch two Stockfish engines play against each other with independently selectable difficulties.
    *   Includes basic anti-repetition logic to encourage decisive outcomes (optional cheat/feature).
    *   Adjustable delay between AI moves for better observation.

**AI (Stockfish.js):**
*   Integrated via a Web Worker for non-blocking analysis.
*   **Multiple Difficulty Levels:** From "Jean Noob" (ELO ~800) to "Invinci Bill" (ELO ~3000) and "Magnus Carlsen" (ELO ~2850).
*   **Adaptive Difficulty:** AI level adjusts based on the player's ELO rating.
*   Configurable search depth based on selected difficulty.

**User Interface & Experience:**
*   Responsive chessboard layout.
*   Clear piece representation using Unicode characters.
*   Visual highlighting for:
    *   Selected piece.
    *   Possible moves (dots for empty squares).
    *   Possible captures (outlines around target squares/pieces).
    *   Last move made (origin and destination squares).
    *   King in check (background highlight).
*   Display of captured pieces for both players.
*   Material advantage progress bar.
*   Player information display (Name, Rating where applicable, Timer).
*   Clear game status messages (whose turn, check, checkmate, stalemate, etc.).
*   Game end modal with results and "Play Again" option.
*   🎨 **Theme Toggle:** Switch between Light and Dark themes (preference saved in `localStorage`).
*   🔊 **Sound Toggle:** Enable/disable sound effects (preference saved in `localStorage`).
    *   Includes sounds for move, capture, castle, check, promote, game start/end, win/lose/draw, illegal move, clicks, low time.
*   🎉 **Confetti Effect:** Celebratory animation upon player victory.
*   **Toast Notifications:** Subtle pop-up messages for events like check or opponent disconnection (less relevant pre-online).
*   **Move History:** Displays a list of moves played in algebraic notation (basic).
*   **Game Statistics:** Tracks total games played, wins, losses, and draws locally (persisted via variables, reset on reload in this version).

## ⚙️ Installation & Setup

1.  **Clone or Download:** Get the project files (`index.html`, `styles.css`, `scriptss.js`).
2.  **Get Stockfish.js:**
    *   Download the `stockfish.js` WebAssembly build (usually includes `stockfish.js`, `stockfish.wasm`, potentially `stockfish.worker.js`) from the official [Stockfish Download Page](https://stockfishchess.org/download/) (look for the JS version) or its [GitHub releases](https://github.com/official-stockfish/Stockfish/releases).
    *   Place the core `stockfish.js` file (and potentially the `.wasm` file if separate) in the same directory as `index.html`. The script currently expects `new Worker('stockfish.js')`. Adjust the path if needed.
3.  **Get Sound Files:**
    *   Create a folder named `sounds` in the same directory as `index.html`.
    *   Place all the required `.mp3` sound files (e.g., `move-self.mp3`, `capture.mp3`, `game-start.mp3`, etc.) inside the `sounds` folder. The script expects these paths.
4.  **Run Locally:**
    *   **Important:** Due to the use of Web Workers (`stockfish.js`), you usually cannot simply open `index.html` directly from your file system (`file://...`). You need to serve the files using a local web server.
    *   **Easy Method:** If you have Node.js installed, navigate to the project directory in your terminal and run:
        ```bash
        npx serve
        ```
        Then open the provided URL (e.g., `http://localhost:3000`).
    *   Alternatively, use Python's built-in server:
        ```bash
        # Python 3
        python -m http.server
        # Python 2
        python -m SimpleHTTPServer
        ```
        Then open `http://localhost:8000`.
    *   Or use IDE extensions like VS Code's "Live Server".

## ▶️ How to Play

1.  Open the `index.html` file via your local web server in your browser.
2.  You will be presented with the **Main Menu**.
3.  **Select a Game Mode:**
    *   Click "Jouer contre un humain" for local two-player mode.
    *   Click "Jouer contre l'IA" to play against the computer.
    *   Click "IA vs IA" to watch two AI opponents play.
4.  **Select Difficulty (if applicable):**
    *   If you chose "Jouer contre l'IA", select the desired AI difficulty level.
    *   If you chose "IA vs IA", select the difficulty levels for both White and Black AI.
5.  The game board will appear, and the game begins according to the selected mode.
6.  **Making Moves:**
    *   Click on one of your pieces. Valid moves will be highlighted.
    *   Click on a highlighted square (dot or outline) to make the move.
    *   To deselect a piece, click it again or click an invalid square.
7.  **Controls:** Use the theme (<i class="fas fa-moon"></i> / <i class="fas fa-sun"></i>) and sound (<i class="fas fa-volume-up"></i> / <i class="fas fa-volume-mute"></i>) toggle buttons in the top right.
8.  **Game End:** A modal window will pop up indicating checkmate, stalemate, timeout, or draw by rule, with an option to play again (returning to the main menu).

## 🛠️ Technical Details

*   **Frontend:** HTML, CSS, Vanilla JavaScript (ES6+).
*   **AI Engine:** [Stockfish.js](https://github.com/official-stockfish/Stockfish) (WASM) running in a Web Worker.
*   **State Management:** Primarily managed through global JavaScript variables and the `initialBoard` 2D array.
*   **Persistence:** Theme and sound preferences are saved in `localStorage`. Game state and statistics are typically lost on page reload in this version.

### Basic Flow (Mermaid Diagram)

```mermaid
graph TD
    A[Start Game] --> B{Main Menu};
    B --> C[Human vs Human];
    B --> D[Human vs AI];
    B --> E[AI vs AI];

    C --> F[Setup Local Game];
    D --> G{Select AI Difficulty};
    G --> H[Setup AI Game];
    E --> I{Select AI Difficulties (W/B)};
    I --> J[Setup AI vs AI Game];

    F --> K[Game Loop: Human White];
    H --> L[Game Loop: Human White];
    J --> M[Game Loop: AI White];

    K --> N{Make Move (W)};
    L --> N;
    M --> P{AI Calculates Move (W)};
    P --> N;

    N --> Q{Check Game End};
    Q -- No --> R[Switch Player (Black)];
    Q -- Yes --> S[End Game Modal];

    R --> T[Game Loop: Human Black / AI Black];
    T --> U{Make Move (B)};
    U --> V{Check Game End};
    V -- No --> W[Switch Player (White)];
    V -- Yes --> S;

    W --> K;
    W --> L;
    W --> M;

    S --> B;
```

## 📁 Key Files

* `index.html`: Main HTML structure.
* `styles.css` / `styles-v2.css`: CSS for styling.
* `scriptss.js` / `scripts-v4.js`: Contains all JavaScript logic (UI, game rules, AI interaction).
* `stockfish.js`: The Stockfish engine (must be obtained separately).
* `sounds/`: Folder containing all .mp3 sound effect files.

## 🔧 Configuration

* **Timers:** Initial time (`whiteTime`, `blackTime`) can be adjusted in the JavaScript file (default is 600 seconds / 10 minutes).
* **AI Depth:** Search depth for different AI difficulties is set within the `getAiSearchDepth` function.
* **ELO K-Factor:** `ELO_K_FACTOR` controls how much ratings change after a Player vs AI game.

## 📄 License

This project is licensed under the MIT License - see the LICENSE.md file for details (if you create one).

```
MIT License

Copyright (c) [2025] [DFWS]

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```