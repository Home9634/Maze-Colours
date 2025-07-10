import { Renderer } from './game/Renderer.js';
import { getGridCoordinates } from './utils/helpers.js';

const CELL_SIZE = 50;

class LevelEditor {
    constructor() {
        // DOM Elements
        this.canvas = document.getElementById('editor-canvas');
        this.renderer = new Renderer(this.canvas, CELL_SIZE);
        this.dom = {
            gridWidth: document.getElementById('grid-width'),
            gridHeight: document.getElementById('grid-height'),
            inventorySize: document.getElementById('inventory-size'),
            colorSelect: document.getElementById('color-select'),
            jsonOutput: document.getElementById('json-output'),
        };

        // Editor State
        this.state = {}; // This will hold our level data
        this.activeTool = 'start';
        this.init();
    }

    init() {
        this.createGrid();
        this.addEventListeners();
    }

    createGrid() {
        const width = parseInt(this.dom.gridWidth.value, 10);
        const height = parseInt(this.dom.gridHeight.value, 10);

        this.canvas.width = width * CELL_SIZE;
        this.canvas.height = height * CELL_SIZE;

        // Reset state when creating a new grid
        this.state = {
            gridSize: { width, height },
            inventorySize: parseInt(this.dom.inventorySize.value, 10),
            start: null,
            end: null,
            walls: [],
            objectives: [],
        };
        this.draw();
    }

    draw() {
        this.renderer.clear();
        this.renderer.drawGrid(this.state.gridSize);
        if (this.state.walls) this.renderer.drawWalls(this.state.walls);
        if (this.state.objectives) this.renderer.drawObjectives(this.state.objectives);
        if (this.state.start && this.state.end) this.renderer.drawSpecialCells(this.state.start, this.state.end);
    }

    // --- Event Handlers ---
    addEventListeners() {
        document.getElementById('create-grid-btn').addEventListener('click', () => this.createGrid());
        this.canvas.addEventListener('mousedown', (e) => this.handleCanvasClick(e));
        document.querySelectorAll('input[name="tool"]').forEach(radio => {
            radio.addEventListener('change', (e) => this.activeTool = e.target.value);
        });
        document.getElementById('generate-btn').addEventListener('click', () => this.generateJSON());
        document.getElementById('load-btn').addEventListener('click', () => this.loadFromJSON());
        document.getElementById('download-btn').addEventListener('click', () => this.downloadJSON());
    }

    handleCanvasClick(event) {
        const cell = getGridCoordinates(event, this.canvas, CELL_SIZE);
        if (!cell) return;

        switch (this.activeTool) {
            case 'start_cell':
                this.state.start = { x: cell.x, y: cell.y };
                break;
            case 'end_cell':
                this.state.end = { x: cell.x, y: cell.y };
                break;
            case 'start_edge':
            case 'end_edge':
                this.placeEdgeMarker(cell, event, this.activeTool);
                break;
            case 'wall':
                this.toggleWall(cell, event);
                break;
            case 'box':
            case 'dropoff':
                this.placeObjective(cell, this.activeTool);
                break;
            case 'eraser':
                this.eraseCell(cell);
                break;
        }
        this.draw();
    }

    placeEdgeMarker(cell, event, tool) {
        // Reuse the precise edge detection logic from the wall tool
        const rect = this.canvas.getBoundingClientRect();
        const xInCell = (event.clientX - rect.left) % CELL_SIZE;
        const yInCell = (event.clientY - rect.top) % CELL_SIZE;
        const threshold = 10;

        let side = null;
        if (yInCell < threshold) side = 'top';
        else if (yInCell > CELL_SIZE - threshold) side = 'bottom';
        else if (xInCell < threshold) side = 'left';
        else if (xInCell > CELL_SIZE - threshold) side = 'right';
        if (!side) return; // Click was in the middle of the cell

        const marker = { cell: { x: cell.x, y: cell.y }, side: side };

        if (tool === 'start_edge') {
            this.state.start = marker;
        } else if (tool === 'end_edge') {
            this.state.end = marker;
        }
    }

    toggleWall(cell, event) {
        // More precise wall placement based on click position within the cell
        const rect = this.canvas.getBoundingClientRect();
        const xInCell = (event.clientX - rect.left) % CELL_SIZE;
        const yInCell = (event.clientY - rect.top) % CELL_SIZE;
        const threshold = 10; // 10px from edge

        let side = null;
        if (yInCell < threshold) side = 'top';
        else if (yInCell > CELL_SIZE - threshold) side = 'bottom';
        else if (xInCell < threshold) side = 'left';
        else if (xInCell > CELL_SIZE - threshold) side = 'right';
        if (!side) return; // Click was in the middle

        let wall = this.state.walls.find(w => w.x === cell.x && w.y === cell.y);
        if (!wall) {
            wall = { x: cell.x, y: cell.y, sides: [] };
            this.state.walls.push(wall);
        }

        const sideIndex = wall.sides.indexOf(side);
        if (sideIndex > -1) {
            wall.sides.splice(sideIndex, 1); // Remove wall if it exists
        } else {
            wall.sides.push(side); // Add wall if it doesn't
        }
    }

    placeObjective(cell, type) {
        this.eraseCell(cell); // Clear the cell first
        const color = this.dom.colorSelect.value;
        this.state.objectives.push({
            color,
            type,
            status: 'available', // <-- THE FIX: Add the missing status property
            position: { x: cell.x, y: cell.y }
        });
    }

    eraseCell(cell) {
        // Erase old format
        if (this.state.start && !this.state.start.side && this.state.start.x === cell.x && this.state.start.y === cell.y) this.state.start = null;
        if (this.state.end && !this.state.end.side && this.state.end.x === cell.x && this.state.end.y === cell.y) this.state.end = null;
        // Erase new format
        if (this.state.start && this.state.start.side && this.state.start.cell.x === cell.x && this.state.start.cell.y === cell.y) this.state.start = null;
        if (this.state.end && this.state.end.side && this.state.end.cell.x === cell.x && this.state.end.cell.y === cell.y) this.state.end = null;

        this.state.objectives = this.state.objectives.filter(o => o.position.x !== cell.x || o.position.y !== cell.y);
    }

    // --- JSON Functionality ---
    generateJSON() {
        // Update state from inputs one last time
        this.state.gridSize = { width: parseInt(this.dom.gridWidth.value), height: parseInt(this.dom.gridHeight.value) };
        this.state.inventorySize = parseInt(this.dom.inventorySize.value);
        // Filter out walls with no sides
        this.state.walls = this.state.walls.filter(w => w.sides.length > 0);

        this.dom.jsonOutput.value = JSON.stringify(this.state, null, 2);
    }

    loadFromJSON() {
        try {
            const data = JSON.parse(this.dom.jsonOutput.value);
            this.state = data;
            this.dom.gridWidth.value = data.gridSize.width;
            this.dom.gridHeight.value = data.gridSize.height;
            this.dom.inventorySize.value = data.inventorySize;
            this.canvas.width = data.gridSize.width * CELL_SIZE;
            this.canvas.height = data.gridSize.height * CELL_SIZE;
            this.draw();
        } catch (e) {
            alert("Invalid JSON! Please check the format.");
            console.error(e);
        }
    }

    downloadJSON() {
        this.generateJSON();
        const content = this.dom.jsonOutput.value;
        const blob = new Blob([content], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `level-new.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }
}

new LevelEditor();