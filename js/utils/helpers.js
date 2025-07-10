/**
 * Converts mouse event coordinates to grid cell coordinates.
 * @param {MouseEvent} event The mouse event.
 * @param {HTMLCanvasElement} canvas The canvas element.
 *  @param {number} cellSize The size of each grid cell in pixels.
 * @returns {{x: number, y: number}|null} The grid coordinates or null if outside.
 */
export function getGridCoordinates(event, canvas, cellSize) {
    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    if (x < 0 || x > canvas.width || y < 0 || y > canvas.height) {
        return null; // Mouse is outside the canvas
    }

    const gridX = Math.floor(x / cellSize);
    const gridY = Math.floor(y / cellSize);

    return { x: gridX, y: gridY };
}