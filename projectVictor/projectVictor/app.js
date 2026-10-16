// =====================================================================
//  app.js — Mapa Leaflet (refactorizado)
//  Conserva el mapa oscuro original, pero ahora las rutas se leen desde
//  DB (db.js) en vez de estar duplicadas aquí. ui.js reutiliza
//  mostrarRuta()/ocultarRutas() a través de window.MapaApp.
// =====================================================================

(function () {
    "use strict";

    var map = null;            // instancia de Leaflet
    var polilineas = [];       // polilíneas dibujadas (1 = seleccionada, 7 = todas)
    var marcadores = [];       // marcadores de paradas

    // Token de "generación" de dibujo: cada vez que se limpia el mapa lo
    // incrementamos. Las respuestas async de OSRM comprueban su token antes
    // de pintar; si el usuario alternó de ruta mientras tanto, la respuesta
    // vieja se descarta y NO se dibuja geometría desfasada encima.
    var generacionActual = 0;

    // Caché en memoria de geometrías ya resueltas por OSRM, indexada por
    // id_ruta. Evita volver a llamar a OSRM cada vez que se muestra la ruta.
    var cacheGeometria = {};

    // Prefijo de la clave de localStorage para persistir la geometría entre
    // recargas (la red vial no cambia, así que es seguro cachearla).
    var CACHE_KEY = "miruta_geom_";

    // Endpoint público de OSRM (perfil driving). Sin API key ni backend.
    var OSRM_BASE = "https://router.project-osrm.org/route/v1/driving/";

    // -----------------------------------------------------------------
    // initMapa(): crea el mapa una sola vez.
    // Se llama desde ui.js cuando la vista del mapa ya está en el DOM
    // (Leaflet necesita que el contenedor #map exista y sea visible).
    // -----------------------------------------------------------------
    function initMapa() {
        var contenedor = document.getElementById("map");
        if (!contenedor) return null;

        // La SPA reemplaza todo #app en cada render, así que el <div id="map">
        // anterior pudo ser destruido. Si la instancia de Leaflet quedó aferrada
        // a un contenedor que ya NO está en el DOM actual, la descartamos para
        // montarla limpia en el contenedor nuevo. (fix bloqueante B1)
        if (map && map.getContainer() !== contenedor) {
            map.remove();
            map = null;
            polilineas = [];
            marcadores = [];
        }

        if (map) {
            // Misma instancia y mismo contenedor: solo recalculamos tamaño.
            map.invalidateSize();
            return map;
        }

        map = L.map("map").setView([10.9878, -74.7889], 13);

        L.tileLayer(
            "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png",
            { attribution: "&copy; OpenStreetMap" }
        ).addTo(map);

        return map;
    }

    // -----------------------------------------------------------------
    // limpiarCapas(): quita del mapa TODAS las polilíneas y marcadores.
    // Es la base de la limpieza para no acumular capas al alternar vistas.
    // -----------------------------------------------------------------
    function limpiarCapas() {
        polilineas.forEach(function (linea) {
            map.removeLayer(linea);
        });
        polilineas = [];

        marcadores.forEach(function (marker) {
            map.removeLayer(marker);
        });
        marcadores = [];

        // Invalida cualquier respuesta async de OSRM en vuelo: lo que se
        // pidió para la vista anterior ya no debe dibujarse en esta.
        generacionActual += 1;
    }

    // -----------------------------------------------------------------
    // CACHÉ de geometría enganchada a calles (memoria + localStorage).
    // La clave es el id_ruta. Se lee primero de memoria; si no está, de
    // localStorage; si tampoco, devuelve null para que toque resolver.
    // -----------------------------------------------------------------
    function leerCacheGeometria(idRuta) {
        if (cacheGeometria[idRuta]) return cacheGeometria[idRuta];
        try {
            var crudo = localStorage.getItem(CACHE_KEY + idRuta);
            if (crudo) {
                var geom = JSON.parse(crudo);
                if (Array.isArray(geom) && geom.length > 0) {
                    cacheGeometria[idRuta] = geom; // re-hidrata memoria
                    return geom;
                }
            }
        } catch (e) {
            // localStorage corrupto o no disponible: simplemente no hay caché.
        }
        return null;
    }

    function guardarCacheGeometria(idRuta, geom) {
        cacheGeometria[idRuta] = geom;
        try {
            localStorage.setItem(CACHE_KEY + idRuta, JSON.stringify(geom));
        } catch (e) {
            // Cuota llena o modo privado: la caché en memoria basta por sesión.
        }
    }

    // -----------------------------------------------------------------
    // obtenerGeometriaCalles(coordenadas): dado un array de waypoints
    // [lat,lng], pide a OSRM la geometría real siguiendo las calles y la
    // devuelve como array de [lat,lng] (orden Leaflet).
    //
    // Fallback robusto: ante CUALQUIER fallo (red, OSRM caído, JSON raro,
    // routes vacío) devuelve las coordenadas originales (líneas rectas).
    // La app nunca se rompe; en el peor caso se ve como antes.
    // -----------------------------------------------------------------
    async function obtenerGeometriaCalles(coordenadas) {
        // Hace falta al menos un par de puntos para trazar una ruta.
        if (!coordenadas || coordenadas.length < 2) return coordenadas || [];

        try {
            // OSRM usa orden lng,lat (GeoJSON), Leaflet usa lat,lng → convertir.
            var waypoints = coordenadas.map(function (c) {
                return c[1] + "," + c[0];
            }).join(";");

            var url = OSRM_BASE + waypoints +
                "?overview=full&geometries=geojson";

            var resp = await fetch(url);
            if (!resp.ok) return coordenadas;

            var data = await resp.json();
            if (!data || !data.routes || data.routes.length === 0) {
                return coordenadas;
            }

            var geo = data.routes[0].geometry;
            if (!geo || !Array.isArray(geo.coordinates) || geo.coordinates.length === 0) {
                return coordenadas;
            }

            // OSRM devuelve [lng,lat]; Leaflet espera [lat,lng] → invertir.
            return geo.coordinates.map(function (par) {
                return [par[1], par[0]];
            });
        } catch (e) {
            // Error de red / fetch / parseo: caemos a las rectas originales.
            return coordenadas;
        }
    }

    // -----------------------------------------------------------------
    // resolverGeometria(ruta): devuelve una Promise con la geometría a
    // dibujar para una ruta, usando caché. Si no hay caché, llama a OSRM,
    // guarda el resultado y lo devuelve. Centraliza caché + fallback.
    // -----------------------------------------------------------------
    function resolverGeometria(ruta) {
        var enCache = leerCacheGeometria(ruta.id_ruta);
        if (enCache) {
            return Promise.resolve(enCache);
        }
        return obtenerGeometriaCalles(ruta.coordenadas).then(function (geom) {
            // Solo cacheamos si OSRM aportó algo mejor que las rectas crudas
            // (más puntos). Así un fallback temporal no envenena la caché.
            if (geom && geom.length > ruta.coordenadas.length) {
                guardarCacheGeometria(ruta.id_ruta, geom);
            }
            return geom;
        });
    }

    // -----------------------------------------------------------------
    // dibujarRuta(ruta, opciones): pinta una polilínea + sus paradas.
    // opciones.weight permite distinguir "protagonista" (8) de "todas" (5).
    // No hace fitBounds: de eso se encarga quien llama (1 ruta vs varias).
    // -----------------------------------------------------------------
    function dibujarRuta(ruta, opciones) {
        opciones = opciones || {};
        var colorRuta = ruta.color;

        // La LÍNEA usa la geometría enganchada a calles si nos la pasan;
        // si no, cae a las coordenadas crudas (rectas). Las PARADAS, en
        // cambio, siempre van en los waypoints originales de la ruta.
        var trazo = opciones.geometria || ruta.coordenadas;

        // --- Dibujar la línea ---
        var linea = L.polyline(trazo, {
            color: colorRuta,
            weight: opciones.weight || 8,
            opacity: opciones.opacity || 1,
            smoothFactor: 2
        }).addTo(map);
        polilineas.push(linea);

        // --- Dibujar las paradas (siempre en los waypoints originales) ---
        ruta.coordenadas.forEach(function (coord, index) {
            var marker = L.circleMarker(coord, {
                radius: opciones.radius || 7,
                fillColor: colorRuta,
                color: "#fff",
                weight: 2,
                fillOpacity: 1
            }).addTo(map);

            marker.bindPopup(
                "<b>Parada " + (index + 1) + "</b><br>" +
                "🚌 " + ruta.nombre + "<br>" +
                "⏰ Próximo bus: " + (Math.floor(Math.random() * 10) + 1) + " min"
            );

            marcadores.push(marker);
        });

        return linea;
    }

    // -----------------------------------------------------------------
    // ocultarRutas(): "deseleccionar". En vez de dejar el mapa vacío,
    // vuelve al estado por defecto = todas las rutas visibles.
    // Mantiene el nombre/firma que usa ui.js.
    // -----------------------------------------------------------------
    function ocultarRutas() {
        mostrarTodasLasRutas();
    }

    // -----------------------------------------------------------------
    // mostrarTodasLasRutas(): estado por defecto. Dibuja las 7 rutas a la
    // vez, cada una con su color, y encaja el mapa a la unión de todas.
    // -----------------------------------------------------------------
    function mostrarTodasLasRutas() {
        initMapa();
        if (!map) return;

        limpiarCapas();

        var rutas = DB.getRutas();
        if (!rutas || rutas.length === 0) return;

        var activas = rutas.filter(function (r) { return r.activo !== false; });
        var opciones = { weight: 5, opacity: 0.85, radius: 5 };

        // Token de esta vista: si el usuario navega a otra cosa mientras OSRM
        // resuelve, este token quedará obsoleto y la respuesta se ignora.
        var miGeneracion = generacionActual;

        // 1) Pintado inmediato con rectas → la UI y fitBounds responden ya.
        activas.forEach(function (ruta) {
            dibujarRuta(ruta, opciones);
        });
        encajarTodas();

        // 2) En paralelo, resolver la geometría enganchada a calles de cada
        //    ruta (con caché + fallback individual). Cuando todas estén,
        //    redibujamos la vista si seguimos en la misma generación.
        Promise.all(activas.map(resolverGeometria)).then(function (geometrias) {
            if (miGeneracion !== generacionActual) return; // vista cambió
            if (!map) return;

            // Redibujar limpio con las geometrías reales. limpiarCapas()
            // incrementa la generación; lo reconciliamos para no auto-anular
            // el siguiente posible redibujo.
            limpiarCapas();
            miGeneracion = generacionActual;

            activas.forEach(function (ruta, i) {
                dibujarRuta(ruta, {
                    weight: opciones.weight,
                    opacity: opciones.opacity,
                    radius: opciones.radius,
                    geometria: geometrias[i]
                });
            });
            encajarTodas();
        });

        return rutas;
    }

    // -----------------------------------------------------------------
    // encajarTodas(): fitBounds a la unión de todas las polilíneas dibujadas.
    // -----------------------------------------------------------------
    function encajarTodas() {
        if (polilineas.length === 0) return;
        var bounds = polilineas[0].getBounds();
        polilineas.forEach(function (linea) {
            bounds.extend(linea.getBounds());
        });
        map.fitBounds(bounds, { padding: [30, 30] });
    }

    // -----------------------------------------------------------------
    // mostrarRuta(tipo): dibuja UNA ruta protagonista por su clave
    // (sobusa, t1, etc.). Lee los datos desde DB.
    // -----------------------------------------------------------------
    function mostrarRuta(tipo) {
        initMapa();
        if (!map) return;

        limpiarCapas();

        var ruta = DB.getRutaPorTipo(tipo);
        if (!ruta) {
            console.warn("Ruta no encontrada:", tipo);
            return;
        }

        var opciones = { weight: 8, opacity: 1, radius: 7 };
        var miGeneracion = generacionActual;

        // 1) Pintado inmediato con rectas + fitBounds, para respuesta instantánea.
        var linea = dibujarRuta(ruta, opciones);
        map.fitBounds(linea.getBounds());

        // 2) Resolver geometría enganchada a calles (caché + fallback) y
        //    reemplazar el trazo si seguimos en la misma vista/generación.
        resolverGeometria(ruta).then(function (geometria) {
            if (miGeneracion !== generacionActual) return; // alternó de ruta
            if (!map) return;

            limpiarCapas();
            miGeneracion = generacionActual;

            var nueva = dibujarRuta(ruta, {
                weight: opciones.weight,
                opacity: opciones.opacity,
                radius: opciones.radius,
                geometria: geometria
            });
            map.fitBounds(nueva.getBounds());
        });

        return ruta;
    }

    // -----------------------------------------------------------------
    // Exponer API para que ui.js controle el mapa.
    // -----------------------------------------------------------------
    window.MapaApp = {
        initMapa: initMapa,
        mostrarRuta: mostrarRuta,
        mostrarTodasLasRutas: mostrarTodasLasRutas,
        ocultarRutas: ocultarRutas
    };
})();
