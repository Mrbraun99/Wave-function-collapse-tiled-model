class ConnectionEditor {
    static display() {
        document.getElementById('available-tile-container').innerHTML = "";
        document.getElementById("connection-editor-container").style.display = "block";

        for (let i = 0; i < tiles.length; i++) {
            const available_tile = document.getElementById("available-tile-template").content.cloneNode(true).querySelector(".available-tile");
            available_tile.querySelector("img").src = tiles[i].img.canvas.toDataURL();
            available_tile.setAttribute('data-tile_index', i);

            document.getElementById('available-tile-container').appendChild(available_tile);

            available_tile.addEventListener('click', () => {
                const max_neighbour_count = FnLib.Array1D.max(connections, connection => FnLib.Array1D.max(
                    Object.values(Direction).map(dir => connection.neighbours[dir].length)
                ));

                document.documentElement.style.setProperty('--grid-size', Math.min(8, Math.ceil(Math.sqrt(max_neighbour_count + 1))));

                document.getElementById("connection-editor").style.display = "block";

                const editor_grid_center = document.getElementById('editor-grid-center');
                editor_grid_center.querySelector("img").src = tiles[i].img.canvas.toDataURL();
                editor_grid_center.setAttribute('data-tile_index', i);

                const delete_overlay = editor_grid_center.querySelector(".delete-overlay");
                delete_overlay.classList.toggle("active", connections[i].disabled);

                for (const dir of Object.values(Direction)) {
                    const neighbour_grid = document.getElementById('grid-' + dir.toLowerCase());
                    neighbour_grid.innerHTML = '';

                    for (const neighbour of connections[i].neighbours[dir]) {
                        const neighbour_tile = document.getElementById("neighbour-tile-template").content.cloneNode(true).querySelector(".neighbour-tile");
                        neighbour_tile.querySelector("img").src = tiles[neighbour.tile_index].img.canvas.toDataURL();
                        neighbour_tile.setAttribute('data-tile_index', neighbour.tile_index);

                        if (connections[neighbour.tile_index].disabled) {
                            neighbour_tile.style.display = "none";
                        }

                        neighbour_grid.appendChild(neighbour_tile);

                        neighbour_tile.querySelector(".delete-overlay").classList.toggle('active', neighbour.disabled);

                        neighbour_tile.addEventListener('click', (event) => {
                            if (event.ctrlKey) {
                                connections[i].neighbours[dir] = connections[i].neighbours[dir].filter(n => n.tile_index != neighbour.tile_index);
                                connections[neighbour.tile_index].neighbours[opposite_dir[dir]] = connections[neighbour.tile_index].neighbours[opposite_dir[dir]].filter(n => n.tile_index != i);

                                available_tile.click();
                                return;
                            }

                            neighbour.disabled = !neighbour.disabled;
                            neighbour_tile.querySelector(".delete-overlay").classList.toggle('active', neighbour.disabled);

                            connections[neighbour.tile_index].neighbours[opposite_dir[dir]].find(n => n.tile_index == i).disabled = neighbour.disabled;
                        });
                    }

                    const plus_tile = document.getElementById("plus-tile-template").content.cloneNode(true).querySelector(".plus-tile");
                    neighbour_grid.appendChild(plus_tile);

                    plus_tile.addEventListener('click', () => {
                        document.getElementById("modal-add-button").setAttribute("data-direction", dir);

                        const tile_indexes = (new Set(FnLib.Array1D.create(tiles.length, i => i).filter(index => !connections[index].disabled))).difference(new Set(connections[i].neighbours[dir].map(neighbour => neighbour.tile_index)));
                        const modal_tile_container = document.getElementById("modal-tile-container");
                        modal_tile_container.innerHTML = "";

                        for (const tile_index of tile_indexes) {
                            const modal_tile = document.getElementById("modal-tile-template").content.cloneNode(true).querySelector(".modal-tile");
                            modal_tile.querySelector("img").src = tiles[tile_index].img.canvas.toDataURL();
                            modal_tile.setAttribute("data-tile_index", tile_index);

                            modal_tile_container.appendChild(modal_tile);

                            modal_tile.addEventListener('click', () => {
                                modal_tile.classList.toggle('selected');
                                modal_tile.querySelector(".confirm-overlay").classList.toggle('active', modal_tile.classList.contains("selected"));
                            });
                        }

                        document.getElementById("modal-add-button").onclick = () => {
                            document.getElementById("modal-overlay").style.display = "none";

                            for (const element of document.querySelectorAll(".modal-tile.selected")) {
                                const tile_index = Number(element.getAttribute("data-tile_index"));

                                connections[i].neighbours[dir].push({ "tile_index": tile_index, "disabled": false });
                                connections[tile_index].neighbours[opposite_dir[dir]].push({ "tile_index": i, "disabled": false });
                            }

                            available_tile.click();
                        };

                        document.getElementById("modal-overlay").style.display = "flex";
                    });

                    plus_tile.style.display = connections[i].neighbours[dir].length < tiles.length ? "flex" : "none";
                }
            });
        }

        const editor_grid_center = document.getElementById('editor-grid-center');
        editor_grid_center.onclick = () => {
            const index = editor_grid_center.getAttribute('data-tile_index');

            connections[index].disabled = !connections[index].disabled;

            editor_grid_center.querySelector(".delete-overlay").classList.toggle("active", connections[index].disabled);

            const available_tile = document.querySelector(`.available-tile[data-tile_index="${index}"]`);
            available_tile.querySelector(".delete-overlay").classList.toggle('active', connections[index].disabled);

            for (const element of document.querySelectorAll(`.neighbour-tile[data-tile_index="${index}"]`)) {
                element.style.display = connections[index].disabled ? "none" : "block";
            }
        };
    }

    static export() {
        const offset_table = [];
        let offset = 0;
        for (let i = 0; i < connections.length; i++) {
            offset_table[i] = connections[i].disabled ? null : i - offset;
            if (offset_table[i] == null) {
                offset++;
            }
        }
        const json = tiles.map((tile, index) => {
            if (connections[index].disabled) {
                return null;
            }

            const neighbours = {};
            for (const dir of Object.values(Direction)) {
                neighbours[dir] = connections[index].neighbours[dir].map(connection => {
                    return offset_table[connection.tile_index] == null ? null : { "tile_index": offset_table[connection.tile_index], "disabled": connection.disabled }
                }).filter(v => v != null);
            }

            return { "img": tile.img.canvas.toDataURL(), "neighbours": neighbours };
        }).filter(v => v != null);

        saveJSON(json, "tiles.json");
    }
}