class Viewport {
    static ALIGN = Object.freeze({ LINE: "LINE", CELL: "CELL" });

    static GRID_SIZE = 64;
    static MIN_ZOOM = 0.5;
    static MAX_ZOOM = 2.5;

    static zoom = 1;
    static panning = false;
    static offset = { x: 0, y: 0 };
    static zoom_offset = { x: 0, y: 0 };
    static pan_start = { x: 0, y: 0 };
    static pan_origin = { x: 0, y: 0 };

    static startPan() {
        Viewport.pan_start = { x: mouseX, y: mouseY };
        Viewport.pan_origin = { x: Viewport.offset.x, y: Viewport.offset.y };
        Viewport.panning = true;
    }

    static stopPan() {
        Viewport.panning = false;
    }

    static applyZoom(scale) {
        const constrained_zoom = constrain(Viewport.zoom * scale, Viewport.MIN_ZOOM, Viewport.MAX_ZOOM);
        const ratio = constrained_zoom / Viewport.zoom;
        Viewport.zoom = constrained_zoom;

        Viewport.zoom_offset.x = mouseX - ratio * (mouseX - Viewport.zoom_offset.x);
        Viewport.zoom_offset.y = mouseY - ratio * (mouseY - Viewport.zoom_offset.y);
    }

    static update() {
        if (Viewport.panning) {
            Viewport.offset.x = Viewport.pan_origin.x + (mouseX - Viewport.pan_start.x) / Viewport.zoom;
            Viewport.offset.y = Viewport.pan_origin.y + (mouseY - Viewport.pan_start.y) / Viewport.zoom;
        }

        translate(Viewport.zoom_offset.x, Viewport.zoom_offset.y);
        scale(Viewport.zoom);
        translate(Viewport.offset.x, Viewport.offset.y);
    }

    static __align(value, mode) {
        switch (mode) {
            case Viewport.ALIGN.LINE:
                {
                    return Math.round(value / Viewport.GRID_SIZE) * Viewport.GRID_SIZE;
                }
            case Viewport.ALIGN.CELL:
                {
                    return Math.floor(value / Viewport.GRID_SIZE) * Viewport.GRID_SIZE + Viewport.GRID_SIZE / 2;
                }
        }

        return value;
    }

    static getGlobalPos(screen_pos_x, screen_pos_y, align_mode = null) {
        return { x: Viewport.getGlobalPosX(screen_pos_x, align_mode), y: Viewport.getGlobalPosY(screen_pos_y, align_mode) };
    }

    static getGlobalPosX(screen_pos_x, align_mode = null) {
        let x = (screen_pos_x - Viewport.zoom_offset.x) / Viewport.zoom - Viewport.offset.x;
        return Viewport.__align(x, align_mode);
    }

    static getGlobalPosY(screen_pos_y, align_mode = null) {
        let y = (screen_pos_y - Viewport.zoom_offset.y) / Viewport.zoom - Viewport.offset.y;
        return Viewport.__align(y, align_mode);
    }

    static getGlobalMousePos(align_mode = null) {
        return { x: Viewport.getGlobalMousePosX(align_mode), y: Viewport.getGlobalMousePosY(align_mode) };
    }

    static getGlobalMousePosX(align_mode = null) {
        let x = (mouseX - Viewport.zoom_offset.x) / Viewport.zoom - Viewport.offset.x;
        return Viewport.__align(x, align_mode);
    }

    static getGlobalMousePosY(align_mode = null) {
        let y = (mouseY - Viewport.zoom_offset.y) / Viewport.zoom - Viewport.offset.y;
        return Viewport.__align(y, align_mode);
    }

    static setScreenCenterGlobalPos(global_pos_x, global_pos_y) {
        Viewport.setScreenCenterGlobalPosX(global_pos_x);
        Viewport.setScreenCenterGlobalPosY(global_pos_y);
    }

    static setScreenCenterGlobalPosX(global_pos_x) {
        Viewport.offset.x = ((width / 2) - Viewport.zoom_offset.x) / Viewport.zoom - global_pos_x;
    }

    static setScreenCenterGlobalPosY(global_pos_y) {
        Viewport.offset.y = ((height / 2) - Viewport.zoom_offset.y) / Viewport.zoom - global_pos_y;
    }

    static isMouseInsideCanvas() {
        return (mouseX >= 0 && mouseX < width && mouseY >= 0 && mouseY < height);
    }
}