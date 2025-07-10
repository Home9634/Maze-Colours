import { Game } from './game/Game.js';

// The total number of level files you have.
const TOTAL_LEVELS = 20;

class AppManager {
    constructor() {
        this.game = new Game(document.getElementById('game-canvas'));
        
        // DOM Elements
        this.levelSelectView = document.getElementById('level-select-view');
        this.gameView = document.getElementById('game-view');
        this.levelListContainer = document.getElementById('level-list');
        
        this.init();
    }

    init() {
        this.populateLevelSelect();
        this.showView('level-select');
        
        // Event Listeners for view switching
        document.getElementById('back-to-menu-button').addEventListener('click', () => {
            this.showView('level-select');
        });
        
        // Listen for the 'level-complete' event from the game
        this.game.canvas.addEventListener('level-complete', (e) => {
            this.handleLevelComplete(e.detail.nextLevel);
        });
    }

    populateLevelSelect() {
        for (let i = 1; i <= TOTAL_LEVELS; i++) {
            const button = document.createElement('button');
            button.className = 'level-button';
            button.textContent = i;
            button.addEventListener('click', () => {
                this.startGame(i);
            });
            this.levelListContainer.appendChild(button);
        }
    }

    showView(viewName) {
        this.levelSelectView.classList.add('hidden');
        this.gameView.classList.add('hidden');

        if (viewName === 'level-select') {
            this.levelSelectView.classList.remove('hidden');
        } else if (viewName === 'game') {
            this.gameView.classList.remove('hidden');
        }
    }

    startGame(levelNumber) {
        this.game.loadLevel(levelNumber)
            .then(() => {
                document.getElementById('level-display').textContent = levelNumber;
                this.showView('game');
            })
            .catch(error => {
                console.error("Could not start game:", error);
                alert(`Failed to load Level ${levelNumber}. Please check if the file exists.`);
                this.showView('level-select');
            });
    }

    handleLevelComplete(nextLevel) {
        if (nextLevel > TOTAL_LEVELS) {
            alert("Congratulations! You've beaten all the levels!");
            this.showView('level-select');
        } else {
            alert("Level Complete! Loading next level...");
            this.startGame(nextLevel);
        }
    }
}

// Initialize the application
new AppManager();