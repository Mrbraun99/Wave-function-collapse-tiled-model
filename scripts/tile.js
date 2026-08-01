class Tile {
    constructor(img) {
        this.img = img;
        this.img.loadPixels();
        this.pixels = new Uint8ClampedArray(img.pixels);

        this.sides = {
            [Direction.LEFT]: [],
            [Direction.RIGHT]: [],
            [Direction.UP]: [],
            [Direction.DOWN]: [],
        };

        const getPixel = (x, y) => {
            const index = (x + y * this.img.width) * 4;

            return [this.pixels[index], this.pixels[index + 1], this.pixels[index + 2], this.pixels[index + 3]];
        };

        for (let y = 0; y < this.img.height; y++) {
            this.sides[Direction.LEFT].push(...getPixel(0, y));
            this.sides[Direction.RIGHT].push(...getPixel(this.img.width - 1, y));
        }

        for (let x = 0; x < this.img.width; x++) {
            this.sides[Direction.UP].push(...getPixel(x, 0));
            this.sides[Direction.DOWN].push(...getPixel(x, this.img.height - 1));
        }
    }

    compare(tile, threshold = 4) {
        const error = FnLib.Array1D.sum(FnLib.Array1D.zipWith((a, b) => Math.abs(a - b), this.pixels, tile.pixels));
        return error <= threshold * (this.pixels.length / 4);
    }

    match(tile, direction, threshold = 4) {
        const error = FnLib.Array1D.sum(FnLib.Array1D.zipWith((x, y) => Math.abs(x - y), this.sides[direction], tile.sides[opposite_dir[direction]]));
        return error <= threshold * (this.sides[direction].length / 4);
    }
}