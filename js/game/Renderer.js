// Renders the visual state of the game to the canvas.
export class Renderer {
    constructor(canvas, cellSize) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.cellSize = cellSize;
        this.objectiveColors = {
            orange: "#ff9800",
            yellow: "#ffeb3b",
            blue: "#2196f3",
            purple: "#9c27b0",
            green: "#4CAF50",
            red: "#F44336"
        };
    }

    clear() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    }

    drawGrid(gridSize) {
        this.ctx.strokeStyle = '#444';
        this.ctx.lineWidth = 1;
        for (let x = 0; x <= gridSize.width; x++) {
            this.ctx.beginPath();
            this.ctx.moveTo(x * this.cellSize, 0);
            this.ctx.lineTo(x * this.cellSize, this.canvas.height);
            this.ctx.stroke();
        }

        for (let y = 0; y <= gridSize.height; y++) {
            this.ctx.beginPath();
            this.ctx.moveTo(0, y * this.cellSize);
            this.ctx.lineTo(this.canvas.width, y * this.cellSize);
            this.ctx.stroke();
        }
    }

    /**
     * NEW FUNCTION: Draws the impassable walls from the level data.
     * @param {Array} walls - The wall data from the level file.
     */
    drawWalls(walls) {
        this.ctx.strokeStyle = '#e91e63'; // A vibrant pink for walls
        this.ctx.lineWidth = 4; // Make walls thick and obvious
        this.ctx.beginPath();

        walls.forEach(wall => {
            const x = wall.x * this.cellSize;
            const y = wall.y * this.cellSize;
            wall.sides.forEach(side => {
                switch (side) {
                    case 'top':
                        this.ctx.moveTo(x, y);
                        this.ctx.lineTo(x + this.cellSize, y);
                        break;
                    case 'right':
                        this.ctx.moveTo(x + this.cellSize, y);
                        this.ctx.lineTo(x + this.cellSize, y + this.cellSize);
                        break;
                    case 'bottom':
                        this.ctx.moveTo(x, y + this.cellSize);
                        this.ctx.lineTo(x + this.cellSize, y + this.cellSize);
                        break;
                    case 'left':
                        this.ctx.moveTo(x, y);
                        this.ctx.lineTo(x, y + this.cellSize);
                        break;
                }
            });
        });
        this.ctx.stroke();
    }

    drawUsedCells(usedCells) {
        this.ctx.fillStyle = 'rgba(80, 80, 80, 0.4)';
        usedCells.forEach(cellKey => {
            const [x, y] = cellKey.split(',').map(Number);
            this.ctx.fillRect(x * this.cellSize, y * this.cellSize, this.cellSize, this.cellSize);
        });
    }

    drawSpecialCells(start, end) { // No longer needs blocked cells
        this.ctx.fillStyle = 'rgba(76, 175, 80, 0.7)';
        this.ctx.fillRect(start.x * this.cellSize, start.y * this.cellSize, this.cellSize, this.cellSize);

        this.ctx.fillStyle = 'rgba(33, 150, 243, 0.7)';
        this.ctx.fillRect(end.x * this.cellSize, end.y * this.cellSize, this.cellSize, this.cellSize);

        this.drawEdgeMarker(start, 'rgba(76, 175, 80, 1)'); // Green for start
        this.drawEdgeMarker(end, 'rgba(33, 150, 243, 1)');   // Blue for end
    }

    drawEdgeMarker(marker, color) {
        if (!marker || !marker.side) return; // Only run for new format

        const cell = marker.cell;
        const x = cell.x * this.cellSize;
        const y = cell.y * this.cellSize;

        let x1, y1, x2, y2;

        switch (marker.side) {
            case 'top': [x1, y1, x2, y2] = [x, y, x + this.cellSize, y]; break;
            case 'right': [x1, y1, x2, y2] = [x + this.cellSize, y, x + this.cellSize, y + this.cellSize]; break;
            case 'bottom': [x1, y1, x2, y2] = [x, y + this.cellSize, x + this.cellSize, y + this.cellSize]; break;
            case 'left': [x1, y1, x2, y2] = [x, y, x, y + this.cellSize]; break;
        }

        this.ctx.strokeStyle = color;
        this.ctx.lineWidth = 8; // Make it thick and obvious
        this.ctx.lineCap = 'butt'; // Use flat ends for a clean look
        this.ctx.beginPath();
        this.ctx.moveTo(x1, y1);
        this.ctx.lineTo(x2, y2);
        this.ctx.stroke();
        this.ctx.lineCap = 'round'; // Reset for the path
    }

    /**
   * NEW: Draws the objectives (boxes and dropoffs) based on their state.
   * @param {Array} objectives - The array of objective states from the game.
   */
    drawObjectives(objectives) {
        objectives.forEach(obj => {
            const x = obj.position.x * this.cellSize;
            const y = obj.position.y * this.cellSize;
            const color = this.objectiveColors[obj.color] || '#ffffff'; // Default to white if color not found

            this.ctx.lineWidth = 3;
            this.ctx.strokeStyle = color;

            if (obj.type === 'box' && obj.status === 'available') {
                // Draw an available box
                this.ctx.fillStyle = color;
                this.ctx.fillRect(x + 5, y + 5, this.cellSize - 10, this.cellSize - 10);
            } else if (obj.type === 'dropoff') {
                if (obj.status === 'available') {
                    // Draw an empty drop-off point (dashed circle)
                    this.ctx.beginPath();
                    this.ctx.setLineDash([5, 5]); // Dashed line effect
                    this.ctx.arc(x + this.cellSize / 2, y + this.cellSize / 2, this.cellSize / 2 - 5, 0, Math.PI * 2);
                    this.ctx.stroke();
                    this.ctx.setLineDash([]); // Reset line dash
                } else if (obj.status === 'complete') {
                    // Draw a completed drop-off (solid box)
                    this.ctx.fillStyle = color;
                    this.ctx.globalAlpha = 0.5; // Make it semi-transparent
                    this.ctx.fillRect(x + 5, y + 5, this.cellSize - 10, this.cellSize - 10);
                    this.ctx.globalAlpha = 1.0; // Reset alpha
                }
            }
        });
    }

    drawPath(path) {
        // ... (rest of path drawing is the same)
        if (path.length < 1) return;
        this.ctx.strokeStyle = '#f0e68c';
        this.ctx.lineWidth = 8;
        this.ctx.lineCap = 'round';
        this.ctx.lineJoin = 'round';
        if (path.length > 1) {
            this.ctx.beginPath();
            this.ctx.moveTo(path[0].x, path[0].y);
            for (let i = 1; i < path.length; i++) {
                this.ctx.lineTo(path[i].x, path[i].y);
            }
            this.ctx.stroke();
        }
        const head = path[path.length - 1];
        this.ctx.fillStyle = '#ffeb3b';
        this.ctx.beginPath();
        this.ctx.arc(head.x, head.y, this.ctx.lineWidth / 2 + 2, 0, Math.PI * 2);
        this.ctx.fill();
    }
}