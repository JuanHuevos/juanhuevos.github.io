const data = require('./js/data.js');
const sim = require('./js/simulation.js');

// === MOCK GLOBALS ===
global.CONVERSION = { CUOTA_POBLACION: 20 };
global.NATURALEZAS_POBLACION = {};
global.GRADOS = data.GRADOS;
global.TRIBUTOS = data.TRIBUTOS;
global.RECURSOS = data.RECURSOS;
global.EDIFICIOS = data.EDIFICIOS;
global.PROPIEDADES = data.PROPIEDADES;
global.PECULIARIDADES = data.PECULIARIDADES;
global.NIVELES_ABUNDANCIA = data.NIVELES_ABUNDANCIA;

// === SETUP SIMULATION ===
sim.resetearSimulacion();

// Config:
// 1. Building: Cultivo Agrícola (Base 2 Food/Worker)
// 2. Property: "Cultivable" -> +1 Producción Agrícola (ModAgricola)
// 3. Quality: 10 -> +2 Producción Agrícola (ModCalidad = floor(10/5))
// 4. Workers: 3 Cuotas
//
// Expected Calculation: 1+ModCal+CuotaPop*(Pop/5)
// Base * Pop = 2 * 3 = 6
// ModAgricola = 1
// ModCalidad = 2
// Total = 6 + 1 + 2 = 9

const asentamientoMock = {
    grado: "Estamento", // Base Quality 0
    tributo: "Sin Tributo",
    propiedades: ["Cultivable"], // +1 Agricola
    peculiaridades: [],
    edificios: ["Cultivo Agrícola"],
    bonificacionesEventos: { "Calidad": 10 } // Force Quality 10 for testing
};

// Initialize State
sim.estadoSimulacion.almacen = {};
sim.estadoSimulacion.poblacion = [
    { id: 1, medidas: 20, asignacion: "edificio:Cultivo Agrícola" },
    { id: 2, medidas: 20, asignacion: "edificio:Cultivo Agrícola" },
    { id: 3, medidas: 20, asignacion: "edificio:Cultivo Agrícola" }
];

console.log("=== VERIFICACIÓN: CULTIVO AGRÍCOLA ===");
console.log("Configuración:");
console.log("- Trabajadores: 3");
console.log("- Base Edificio: 2");
console.log("- Bonificación Propiedad (Cultivable): +1");
console.log("- Calidad Total: ~10 (Bono esperado: floor(10/5) = +2)");
console.log("-------------------------------------");

// === RUN TURN ===
const result = sim.ejecutarTurno(asentamientoMock);

// === VERIFY ===
const alimentoProducido = sim.estadoSimulacion.almacen["Alimento"] || 0;
const statCalidad = result.calidadTotal || 0; // Check actual quality calculated

console.log(`Calidad calculada: ${statCalidad}`);

// Formula user requested: modAgricola + modCalidad + (base * CuotaPop)
// Base*Pop = 6. ModAg = 1. ModCal = floor(statCalidad/5).
const modCalidadEsperado = Math.floor(statCalidad / 5);
const esperado = 1 + modCalidadEsperado + (2 * 3);

console.log(`Producción Real: ${alimentoProducido}`);
console.log(`Producción Esperada: ${esperado} (1 + ${modCalidadEsperado} + 6)`);

if (alimentoProducido === esperado) {
    console.log("✅ ÉXITO: La fórmula se aplica correctamente.");
} else {
    console.error(`❌ FALLO: Discrepancia en la producción. Diferencia: ${alimentoProducido - esperado}`);
}
