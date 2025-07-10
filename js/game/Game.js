import { Renderer } from './Renderer.js';
import { getGridCoordinates } from '../utils/helpers.js';

const CELL_SIZE = 50; // pixels

export class Game {
    constructor(canvas) {
        this.canvas = canvas;
        this.renderer = new Renderer(canvas, CELL_SIZE);

        this.cellSize = CELL_SIZE

        this.currentLevel = 0;
        this.levelData = null;
        this.wallSet = new Set();

        // THE NEW DATA STRUCTURE:
        // An array of objects, where each object is a "segment" of the path
        // [{ cellKey: "x,y", pixels: [{x,y}, {x,y}, ...] }, ...]
        this.pathHistory = [];

        this.inventory = [];
        this.objectiveStates = [];

        this.objectiveColors = {
            orange: "#ff9800",
            yellow: "#ffeb3b",
            blue: "#2196f3",
            purple: "#9c27b0",
            green: "#4CAF50",
            red: "#F44336"
        };

        this.isDrawing = false;
        this.initEventListeners();
    }

    async loadLevel(levelNumber) {
        // ... loadLevel logic is mostly the same ...
        this.currentLevel = levelNumber;
        try {
            const response = await fetch(`../levels/level-${levelNumber}.json`);
            if (!response.ok) throw new Error(`Level ${levelNumber} not found`);
            this.levelData = await response.json();

            this.canvas.width = this.levelData.gridSize.width * CELL_SIZE;
            this.canvas.height = this.levelData.gridSize.height * CELL_SIZE;

            this.wallSet.clear();
            this.levelData.walls.forEach(wall => {
                wall.sides.forEach(side => {
                    const key = `${wall.x},${wall.y}-${side}`;
                    this.wallSet.add(key);
                    if (side === 'top' && wall.y > 0) this.wallSet.add(`${wall.x},${wall.y - 1}-bottom`);
                    if (side === 'bottom') this.wallSet.add(`${wall.x},${wall.y + 1}-top`);
                    if (side === 'left' && wall.x > 0) this.wallSet.add(`${wall.x - 1},${wall.y}-right`);
                    if (side === 'right') this.wallSet.add(`${wall.x + 1},${wall.y}-left`);
                });
            });

            this.objectiveStates = this.levelData.objectives.map(obj => ({
                ...obj,
                status: 'available' // Add a dynamic status field
            }));

            this.resetLevel();
        } catch (error) {
            console.error("Failed to load level:", error);
            alert("Could not load the next level!");
        }
    }

    resetLevel() {
        this.isDrawing = false;
        this.pathHistory = []; // Reset the new data structure

        this.inventory = [];
        this.objectiveStates = this.levelData.objectives.map(obj => ({ ...obj, status: 'available' }));
        this.updateInventoryDisplay();
        this.drawFullScene();
    }

    // NEW: The Undo function. It's now very simple!
    undoLastStep() {
        if (this.isDrawing || this.pathHistory.length <= 1) return;

        this.pathHistory.pop(); // Remove the last path segment
        this.rebuildStateFromHistory(); // Recalculate everything based on the new path

        this.updateInventoryDisplay(); // <-- Update UI after undo
        this.drawFullScene();
    }

    updateInventoryDisplay() {
        const display = document.getElementById('inventory-display');
        display.innerHTML = ''; // Clear previous slots

        for (let i = 0; i < this.levelData.inventorySize; i++) {
            const slot = document.createElement('div');
            slot.className = 'inventory-slot';

            if (this.inventory[i]) {
                // This slot is filled
                const color = this.inventory[i];
                slot.style.backgroundColor = this.objectiveColors[color] || '#ffffff';
                slot.style.borderStyle = 'solid'; // Make the border solid for filled slots
            }
            display.appendChild(slot);
        }
    }

    drawFullScene() {
        const allPixels = this.pathHistory.flatMap(segment => segment.pixels);
        const allCells = this.pathHistory.map(segment => segment.cellKey);

        this.renderer.clear();
        this.renderer.drawGrid(this.levelData.gridSize);
        this.renderer.drawObjectives(this.objectiveStates); // <-- NEW
        this.renderer.drawWalls(this.levelData.walls);
        this.renderer.drawUsedCells(allCells);
        this.renderer.drawSpecialCells(this.levelData.start, this.levelData.end);
        this.renderer.drawPath(allPixels);
    }

    initEventListeners() {
        this.canvas.addEventListener('mousedown', this.handleMouseDown.bind(this));
        this.canvas.addEventListener('mousemove', this.handleMouseMove.bind(this));
        this.canvas.addEventListener('mouseup', this.handleMouseUp.bind(this));
        this.canvas.addEventListener('mouseleave', this.handleMouseLeave.bind(this));

        // Listen for keyboard events on the whole window
        window.addEventListener('keydown', this.handleKeyDown.bind(this));

        // Listen for clicks on the new button
        document.getElementById('undo-button').addEventListener('click', this.undoLastStep.bind(this));
        document.getElementById('reset-button').addEventListener('click', this.resetLevel.bind(this));
    }

    handleKeyDown(event) {
        if (event.key.toLowerCase() === 'z') {
            this.undoLastStep();
        }
        if (event.key.toLowerCase() === 'r') {
            this.resetLevel();
        }
    }

    getMousePos(event) {
        const rect = this.canvas.getBoundingClientRect();
        return { x: event.clientX - rect.left, y: event.clientY - rect.top };
    }

    getEdgeMarkerCenter(marker) {
        if (!marker || !marker.side) return null;
        const cell = marker.cell;
        const x = cell.x * this.cellSize;
        const y = cell.y * this.cellSize;

        switch (marker.side) {
            case 'top': return { x: x + CELL_SIZE / 2, y: y };
            case 'right': return { x: x + CELL_SIZE, y: y + CELL_SIZE / 2 };
            case 'bottom': return { x: x + CELL_SIZE / 2, y: y + CELL_SIZE };
            case 'left': return { x: x, y: y + CELL_SIZE / 2 };
        }
        return null;
    }

    handleMouseDown(event) {
        if (this.isDrawing) return;

        const mousePos = this.getMousePos(event);

        if (this.pathHistory.length === 0) {
            const start = this.levelData.start;

            if (start.side) {
                const startCenter = this.getEdgeMarkerCenter(start);
                if (startCenter && Math.sqrt(Math.pow(mousePos.x - startCenter.x, 2) + Math.pow(mousePos.y - startCenter.y, 2)) < 20) {
                    this.isDrawing = true;
                    const startCellKey = `${start.cell.x},${start.cell.y}`;
                    this.pathHistory.push({ cellKey: startCellKey, pixels: [mousePos] });

                    // THE FIX: Check for objectives in the starting cell.
                    this.handleObjectiveInteraction(start.cell);

                    this.drawFullScene();
                    return;
                }
            }
            else {
                const cell = getGridCoordinates(event, this.canvas, this.cellSize);
                if (cell && cell.x === start.x && cell.y === start.y) {
                    this.isDrawing = true;
                    const startCellKey = `${start.x},${start.y}`;
                    this.pathHistory.push({ cellKey: startCellKey, pixels: [mousePos] });

                    // THE FIX: Check for objectives in the starting cell.
                    this.handleObjectiveInteraction(start);

                    this.drawFullScene();
                    return;
                }
            }
        }
        else {
            const lastSegment = this.pathHistory[this.pathHistory.length - 1];
            const head = lastSegment.pixels[lastSegment.pixels.length - 1];
            if (Math.sqrt(Math.pow(mousePos.x - head.x, 2) + Math.pow(mousePos.y - head.y, 2)) < 15) {
                this.isDrawing = true;
            }
        }
    }


    handleMouseMove(event) {
        if (!this.isDrawing) return;

        const mousePos = this.getMousePos(event);
        const currentCell = getGridCoordinates(event, this.canvas, this.cellSize);
        if (!currentCell) return;

        const lastSegment = this.pathHistory[this.pathHistory.length - 1];
        const lastCellKey = lastSegment.cellKey;
        const [lastX, lastY] = lastCellKey.split(',').map(Number);

        const isSameCell = (currentCell.x === lastX && currentCell.y === lastY);

        // Check adjacency
        const dx = Math.abs(currentCell.x - lastX);
        const dy = Math.abs(currentCell.y - lastY);
        const isAdjacent = (dx + dy === 1);

        // Check for revisiting old cells
        const isRevisiting = !isSameCell && this.pathHistory.some(seg => seg.cellKey === `${currentCell.x},${currentCell.y}`);

        // Check for walls
        let moveDirection = null;
        if (currentCell.x > lastX) moveDirection = 'right';
        else if (currentCell.x < lastX) moveDirection = 'left';
        else if (currentCell.y > lastY) moveDirection = 'bottom';
        else if (currentCell.y < lastY) moveDirection = 'top';
        const wallCheckKey = `${lastX},${lastY}-${moveDirection}`;
        const isHittingWall = this.wallSet.has(wallCheckKey);

        if ((isSameCell || isAdjacent) && !isRevisiting && !isHittingWall) {
            if (isSameCell) {
                lastSegment.pixels.push(mousePos);
            } else {
                this.pathHistory.push({ cellKey: `${currentCell.x},${currentCell.y}`, pixels: [mousePos] });
                // --- NEW: Objective interaction check on entering a new cell ---
                this.handleObjectiveInteraction(currentCell);
            }

            this.drawFullScene();

            const end = this.levelData.end;
            let isAtEnd = false;
            // Check new Edge End
            if (end.side) {
                // First, ensure we are in the correct cell adjacent to the exit.
                if (currentCell.x === end.cell.x && currentCell.y === end.cell.y) {
                    const threshold = 5; // How close the mouse must be to the edge (in pixels)
                    const endCellPixelX = end.cell.x * this.cellSize;
                    const endCellPixelY = end.cell.y * this.cellSize;

                    // Now, check the mouse's actual pixel position against the edge
                    switch (end.side) {
                        case 'right':
                            if (mousePos.x >= endCellPixelX + this.cellSize - threshold) isAtEnd = true;
                            break;
                        case 'left':
                            if (mousePos.x <= endCellPixelX + threshold) isAtEnd = true;
                            break;
                        case 'bottom':
                            if (mousePos.y >= endCellPixelY + this.cellSize - threshold) isAtEnd = true;
                            break;
                        case 'top':
                            if (mousePos.y <= endCellPixelY + threshold) isAtEnd = true;
                            break;
                    }
                }
            }
            // Check old Cell End
            else {
                isAtEnd = (currentCell.x === end.x && currentCell.y === end.y);
            }

            if (isAtEnd) {
                if (this.areAllObjectivesComplete()) {
                    this.isDrawing = false;
                    this.canvas.dispatchEvent(new CustomEvent('level-complete', {
                        detail: { nextLevel: this.currentLevel + 1 }
                    }));
                } else {
                    alert("You've reached the end, but still have objectives to complete!");
                    this.isDrawing = false;
                }
            }
        } else {
            return; // Invalid move, do nothing.
        }
    }

    handleObjectiveInteraction(cell, isReplaying = false) {
        const objective = this.objectiveStates.find(obj => obj.position.x === cell.x && obj.position.y === cell.y);
        if (!objective) return;

        if (objective.type === 'box' && objective.status === 'available') {
            if (this.inventory.length < this.levelData.inventorySize) {
                this.inventory.push(objective.color);
                objective.status = 'carried';
                if (!isReplaying) {
                    console.log(`Picked up ${objective.color} box. Inventory:`, this.inventory);
                    this.updateInventoryDisplay();
                }
            } else { if (!isReplaying) console.log("Inventory is full!"); }
        }
        else if (objective.type === 'dropoff' && objective.status === 'available') {
            const inventoryIndex = this.inventory.indexOf(objective.color);
            if (inventoryIndex > -1) {
                this.inventory.splice(inventoryIndex, 1);
                objective.status = 'complete';

                // THE FIX: Find the box of the same color that is CURRENTLY CARRIED.
                const originalBox = this.objectiveStates.find(o => o.type === 'box' && o.color === objective.color && o.status === 'carried');

                if (originalBox) originalBox.status = 'complete';
                if (!isReplaying) {
                    console.log(`Dropped off ${objective.color} box. Inventory:`, this.inventory);
                    this.updateInventoryDisplay();
                }
            }
        }
    }

    rebuildStateFromHistory() {
        // 1. Reset state to the very beginning
        this.inventory = [];
        this.objectiveStates = this.levelData.objectives.map(obj => ({ ...obj, status: 'available' }));

        // 2. Fast-forward through the current path history
        this.pathHistory.forEach(segment => {
            const [x, y] = segment.cellKey.split(',').map(Number);
            this.handleObjectiveInteraction({ x, y }, true); // Pass a flag to prevent logging
        });
    }

    areAllObjectivesComplete() {
        return this.objectiveStates.every(obj => obj.status === 'complete');
    }


    handleMouseUp(event) { this.isDrawing = false; }
    handleMouseLeave(event) { this.isDrawing = false; }
}