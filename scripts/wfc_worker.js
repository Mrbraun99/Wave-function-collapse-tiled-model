importScripts("https://cdn.jsdelivr.net/gh/Mrbraun99/Utils/FnLib/dist/main.js");

const Direction = Object.freeze({
    LEFT: "LEFT",
    RIGHT: "RIGHT",
    UP: "UP",
    DOWN: "DOWN",
});

const opposite_dir = { "LEFT": "RIGHT", "RIGHT": "LEFT", "UP": "DOWN", "DOWN": "UP" };

const DirectionVector = Object.freeze({
    UP: { x: 0, y: -1 },
    DOWN: { x: 0, y: 1 },
    LEFT: { x: -1, y: 0 },
    RIGHT: { x: 1, y: 0 },
});

self.onmessage = function (event) {
    try {
        solve(event.data.grid, event.data.connections);
    } catch (e) {
        if (e?.type === "SolutionFound") {
            self.postMessage({ "pos": event.data.pos, "grid": e.grid });
            return;
        }

        throw e;
    }

    self.postMessage({ "pos": event.data.pos, "grid": null });
};

function solve(grid, connections) {
    const sizeX = FnLib.Array2D.getSizeX(grid);
    const sizeY = FnLib.Array2D.getSizeY(grid);

    for (let y = 0; y < sizeY; y++) {
        for (let x = 0; x < sizeX; x++) {
            if (grid[y][x] == null) {
                const cell = { x: x, y: y };
                let options = (1n << BigInt(connections.length)) - 1n;

                for (const dir of Object.values(Direction)) {
                    const offset = DirectionVector[dir];

                    if (cell.x + offset.x >= 0 && cell.x + offset.x < sizeX && cell.y + offset.y >= 0 && cell.y + offset.y < sizeY) {
                        if (FnLib.isArray(grid[cell.y + offset.y][cell.x + offset.x])) {
                            options &= connections[grid[cell.y + offset.y][cell.x + offset.x][0]][opposite_dir[dir]];
                        }
                    }
                }

                if (options == 0n) return;

                grid[y][x] = FnLib.Bit.hasOnlyOneBitSet(options) ? [FnLib.Bit.indexes(options)[0]] : options;
            }
        }
    }

    if (FnLib.Array2D.every(grid, e => FnLib.isArray(e))) {
        throw { "type": "SolutionFound", "grid": grid };
    }

    const collapse_pos = FnLib.Array1D.randomChoice(FnLib.Array2D.min(grid, e => {
        return FnLib.isArray(e) ? Infinity : FnLib.Bit.count(e);
    }, true).indexes);

    for (const option of FnLib.Array1D.shuffle(FnLib.Bit.indexes(grid[collapse_pos.y][collapse_pos.x]))) {
        const copy = FnLib.Array2D.create({ x: sizeX, y: sizeY }, (x, y) => FnLib.isArray(grid[y][x]) ? [grid[y][x][0]] : null);

        copy[collapse_pos.y][collapse_pos.x] = [option];
        solve(copy, connections);
    }
}