// =====================================================================
// ai.js — Asistente IA de MiRuta
// Mantiene el catálogo de rutas/planes en el frontend y lo entrega al
// backend únicamente cuando el usuario consulta al asistente.
// =====================================================================
(function () {
    "use strict";

    async function chat(message, history) {
        var rutas = typeof DB !== "undefined" && DB.getRutas ? DB.getRutas() : [];
        var planes = typeof DB !== "undefined" && DB.getPlanes ? DB.getPlanes() : [];

        var catalogo = {
            rutas: rutas.map(function (r) {
                return {
                    tipo: r.tipo,
                    nombre: r.nombre,
                    numero: r.numero,
                    origen: r.origen,
                    destino: r.destino,
                    horario: r.horario,
                    frecuencia: r.frecuencia,
                    precio_pasaje: Number(r.precio_pasaje)
                };
            }),
            planes: planes.map(function (p) {
                return {
                    id_tipo: p.id_tipo,
                    nombre: p.nombre,
                    precio_mensual: Number(p.precio_mensual),
                    descuento_pct: Number(p.descuento_pct),
                    descripcion: p.descripcion
                };
            })
        };

        var response = await fetch("/api/ai/chat", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                message: String(message || "").trim(),
                history: Array.isArray(history) ? history.slice(-6) : [],
                catalogo: catalogo
            })
        });

        var data = await response.json().catch(function () { return {}; });
        if (!response.ok || !data.ok) {
            throw new Error(data.error || "No se pudo conectar con el asistente IA.");
        }
        return data;
    }

    window.MiRutaAI = { chat: chat };
})();
