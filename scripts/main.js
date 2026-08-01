const Direction = Object.freeze({
    LEFT: "LEFT",
    RIGHT: "RIGHT",
    UP: "UP",
    DOWN: "DOWN",
});

const DirectionVector = Object.freeze({
    UP: { x: 0, y: -1 },
    DOWN: { x: 0, y: 1 },
    LEFT: { x: -1, y: 0 },
    RIGHT: { x: 1, y: 0 },
});

const opposite_dir = { [Direction.LEFT]: Direction.RIGHT, [Direction.RIGHT]: Direction.LEFT, [Direction.UP]: Direction.DOWN, [Direction.DOWN]: Direction.UP };

const GRID_SIZE = { x: 36, y: 20 };
const TILE_SIZE = 40;
const CHUNK_SIZE = 16;
const CHUNK_BORDER = 4;
const GENERATION_ATTEMPTS = 5;

var tiles;
var connections;
var chunks = {};
var drawing = false;
var worker;
var is_worker_busy = false;

var generateChunk;

function setup() {
    noCanvas();
    pixelDensity(1);
    noSmooth();
    textFont("monospace");

    worker = new Worker("scripts/wfc_worker.js");
    worker.onmessage = function (event) {
        if (chunks[event.data.pos] == null) {
            chunks[event.data.pos] = { "attempts": 1, "grid": null };
        }

        if (event.data.grid == null) {
            chunks[event.data.pos].attempts++;

            for (const offset of Object.values(DirectionVector)) {
                const [x, y] = event.data.pos.split(";").map(Number);
                delete (chunks[(x + offset.x) + ";" + (y + offset.y)]);
            }

            is_worker_busy = false;
            return;
        }

        chunks[event.data.pos].grid = new Uint8Array(FnLib.Array2D.create({ x: CHUNK_SIZE, y: CHUNK_SIZE }, (x, y) => event.data.grid[y + CHUNK_BORDER][x + CHUNK_BORDER]).flat());
        is_worker_busy = false;
    }

    document.getElementById("load-demo-button").addEventListener("click", async function () {
        tiles = [];
        connections = [];
        drawing = false;

        loadJSON("assets/demo.json", async (data) => {
            for (const tile_data of data) {
                const img = await new Promise((resolve) => { loadImage(tile_data.img, img => resolve(img)); });

                tiles.push(new Tile(img));
                connections.push({ "neighbours": tile_data.neighbours, "disabled": false });
            }

            ConnectionEditor.display();
        });
    });

    document.getElementById("json-file-input").addEventListener("change", async function () {
        tiles = [];
        connections = [];
        drawing = false;

        const file = this.files[0];

        if (file.type != "application/json") {
            alert("Please upload an exported JSON file.");
            return;
        }

        const text = await file.text();

        for (const tile_data of JSON.parse(text)) {
            const img = await new Promise((resolve) => { loadImage(tile_data.img, img => resolve(img)); });

            tiles.push(new Tile(img));
            connections.push({ "neighbours": tile_data.neighbours, "disabled": false });
        }

        ConnectionEditor.display();
    });

    document.getElementById("img-file-input").addEventListener("change", async function () {
        tiles = [];
        connections = [];
        drawing = false;

        const files = [...this.files].filter(file => file.type == "image/png");

        const images = await Promise.all(files.map(file =>
            new Promise((resolve) => {
                const url = URL.createObjectURL(file);

                loadImage(url, img => {
                    URL.revokeObjectURL(url);
                    resolve(img);
                });
            })
        ));

        if (images.length == 0) {
            alert("Please upload at least one PNG image.");
            return;
        }

        if (!images.every(img => img.width == img.height)) {
            alert("All images must be square.");
            return;
        }

        if (!(FnLib.Array1D.same(images, img => img.width) && FnLib.Array1D.same(images, img => img.height))) {
            alert("All images must have the same size.");
            return;
        }

        for (const img of images) {
            const variants = [];

            for (const angle of [0, radians(90), radians(180), radians(270)]) {
                const buffer = createGraphics(img.width, img.height);
                buffer.pixelDensity(1);
                buffer.noSmooth();
                buffer.push();
                buffer.translate(img.width / 2, img.height / 2);
                buffer.rotate(angle);
                buffer.imageMode(CENTER);
                buffer.image(img, 0, 0);
                buffer.pop();

                variants.push(new Tile(buffer.get()));
                buffer.remove();
            }

            const unique = [];
            for (const variant of variants) {
                if (!unique.some(u => u.compare(variant))) {
                    unique.push(variant);
                }
            }

            tiles.push(...unique);
        }

        for (const tile of tiles) {
            const neighbours = { [Direction.LEFT]: [], [Direction.RIGHT]: [], [Direction.UP]: [], [Direction.DOWN]: [] };

            for (let i = 0; i < tiles.length; i++) {
                for (const direction of [Direction.LEFT, Direction.RIGHT, Direction.UP, Direction.DOWN]) {
                    if (tile.match(tiles[i], direction)) {
                        neighbours[direction].push({ "tile_index": i, "disabled": false });
                    }
                }
            }

            connections.push({ "neighbours": neighbours, "disabled": false });
        }

        ConnectionEditor.display();
    });

    document.getElementById('generate-btn').addEventListener('click', () => {
        chunks = {};
        document.getElementById("connection-editor").style.display = "none";

        const canvas = createCanvas(TILE_SIZE * GRID_SIZE.x, TILE_SIZE * GRID_SIZE.y).parent("#canvas-parent");
        canvas.elt.style.visibility = "visible";
        Viewport.setScreenCenterGlobalPos(0, 0);

        const wfc_connections = FnLib.Array1D.create(tiles.length, i => { return {} });
        for (let i = 0; i < tiles.length; i++) {
            for (const direction of Object.values(Direction)) {
                wfc_connections[i][direction] = connections[i].neighbours[direction].filter(neighbour => neighbour.disabled == false).map(neighbour => neighbour.tile_index);
                wfc_connections[i][direction] = wfc_connections[i][direction].reduce((acc, v) => acc | (1n << BigInt(v)), 0n);
            }
        }

        generateChunk = (x, y, extended_chunk) => {
            worker.postMessage({ "pos": x + ";" + y, "grid": extended_chunk, "connections": wfc_connections });
        }

        drawing = true;
    });
}

function draw() {
    background(0);

    if (!drawing) return;

    Viewport.update();

    const corner_pos = Viewport.getGlobalPos(0, 0);

    const chunk_x = { "FIRST": floor(corner_pos.x / (CHUNK_SIZE * TILE_SIZE)), "LAST": floor(Viewport.getGlobalPosX(width) / (CHUNK_SIZE * TILE_SIZE)) };
    const chunk_y = { "FIRST": floor(corner_pos.y / (CHUNK_SIZE * TILE_SIZE)), "LAST": floor(Viewport.getGlobalPosY(height) / (CHUNK_SIZE * TILE_SIZE)) };

    for (let y = chunk_y.FIRST; y <= chunk_y.LAST; y++) {
        for (let x = chunk_x.FIRST; x <= chunk_x.LAST; x++) {
            if ((chunks[x + ";" + y] == null || (chunks[x + ";" + y].grid == null && chunks[x + ";" + y].attempts < GENERATION_ATTEMPTS)) && !is_worker_busy) {
                is_worker_busy = true;

                const extended_chunk = FnLib.Array2D.create({ x: CHUNK_SIZE + 2 * CHUNK_BORDER, y: CHUNK_SIZE + 2 * CHUNK_BORDER }, null);

                for (let chunk_offset_y = -1; chunk_offset_y <= 1; chunk_offset_y++) {
                    for (let chunk_offset_x = -1; chunk_offset_x <= 1; chunk_offset_x++) {
                        if (chunks[(x + chunk_offset_x) + ";" + (y + chunk_offset_y)] == null || chunks[(x + chunk_offset_x) + ";" + (y + chunk_offset_y)].grid == null) {
                            continue;
                        }

                        const src_x = chunk_offset_x <= 0 ? chunk_offset_x * CHUNK_BORDER : CHUNK_SIZE;
                        const dst_x = chunk_offset_x >= 0 ? CHUNK_SIZE + chunk_offset_x * CHUNK_BORDER : 0;

                        const src_y = chunk_offset_y <= 0 ? chunk_offset_y * CHUNK_BORDER : CHUNK_SIZE;
                        const dst_y = chunk_offset_y >= 0 ? CHUNK_SIZE + chunk_offset_y * CHUNK_BORDER : 0;

                        for (let cy = src_y; cy < dst_y; cy++) {
                            for (let cx = src_x; cx < dst_x; cx++) {
                                const index = FnLib.Math.mod(cy, CHUNK_SIZE) * CHUNK_SIZE + FnLib.Math.mod(cx, CHUNK_SIZE);
                                extended_chunk[cy + CHUNK_BORDER][cx + CHUNK_BORDER] = [chunks[(x + chunk_offset_x) + ";" + (y + chunk_offset_y)].grid[index]];
                            }
                        }
                    }
                }

                generateChunk(x, y, extended_chunk);
            }

            if (chunks[x + ";" + y] != null && chunks[x + ";" + y].grid != null) {
                for (let cy = 0; cy < CHUNK_SIZE; cy++) {
                    for (let cx = 0; cx < CHUNK_SIZE; cx++) {
                        image(tiles[chunks[x + ";" + y].grid[cx + cy * CHUNK_SIZE]].img, x * (CHUNK_SIZE * TILE_SIZE) + cx * TILE_SIZE, y * (CHUNK_SIZE * TILE_SIZE) + cy * TILE_SIZE, TILE_SIZE, TILE_SIZE);
                    }
                }
            }

            if (chunks[x + ";" + y] != null && chunks[x + ";" + y].grid == null && chunks[x + ";" + y].attempts >= GENERATION_ATTEMPTS) {
                noStroke();
                fill(70, 0, 0,);
                rect(x * (CHUNK_SIZE * TILE_SIZE), y * (CHUNK_SIZE * TILE_SIZE), CHUNK_SIZE * TILE_SIZE, CHUNK_SIZE * TILE_SIZE);

                fill(255);
                textAlign(CENTER, CENTER);
                textSize(36);
                text("<UNSOLVABLE>", x * (CHUNK_SIZE * TILE_SIZE) + CHUNK_SIZE * TILE_SIZE / 2, y * (CHUNK_SIZE * TILE_SIZE) + CHUNK_SIZE * TILE_SIZE / 2);
            }
        }
    }
}
function mousePressed(event) {
    if (mouseButton == RIGHT) Viewport.startPan();
}

function mouseReleased(event) {
    if (mouseButton == RIGHT) Viewport.stopPan();
}