/**
 * MÁS ALLÁ DE LO SALVAJE - Base de Datos del Juego
 * Sistema de Gestión de Asentamientos v2.0
 * Con sistema de herencia de biomas y niveles de abundancia
 */

// =====================================================
// NIVELES DE ABUNDANCIA DE RECURSOS
// =====================================================
const NIVELES_ABUNDANCIA = {
    "Inexistente": { valor: -99, modificador: null, descripcion: "No se puede recolectar" },
    "Escaso": { valor: 2, modificador: -2, descripcion: "Producción penalizada" },
    "Normal": { valor: 3, modificador: 0, descripcion: "Producción estándar" },
    "Abundante": { valor: 4, modificador: 1, descripcion: "Bonificación por terreno favorable" },
    "Exuberante": { valor: 5, modificador: 2, descripcion: "Máximo rendimiento" }
};

// =====================================================
// SISTEMA DE UNIDADES (Medidas y Cuotas)
// =====================================================
const CONVERSION = {
    CUOTA_POBLACION: 20,  // 1 Cuota = 20 colonos (medidas)
    CUOTA_RECURSOS: 10,   // 1 Cuota = 10 medidas de recurso
    CUOTA_DOBLONES: 10    // 1 Cuota = 10 medidas de oro
};

// Multiplicadores de abundancia para extracción
const MULTIPLICADORES_ABUNDANCIA = {
    "Inexistente": 0,
    "Escaso": 0.5,
    "Normal": 1.0,
    "Abundante": 1.5,
    "Exuberante": 2.0
};

// =====================================================
// NATURALEZAS DE POBLACIÓN
// =====================================================
const NATURALEZAS_POBLACION = {
    "Neutral": {
        icono: "⚪",
        ejemplos: "Humanos, Elfos, Medianos",
        modCalidad: 0,
        bonoInmigracion: 0,
        compatibilidad: "Universal",
        descripcion: "Adaptabilidad estándar",
        consumeAlimento: true,
        puedeReproducir: true,
        puedeSerAcademico: true,
        puedeDevocion: true
    },
    "Positiva": {
        icono: "🌟",
        ejemplos: "Aasimares, Seres Celestiales",
        modCalidad: 2,
        bonoInmigracion: 0,
        compatibilidad: "Solo Positivas/Neutras",
        descripcion: "Aumentan la paz social",
        consumeAlimento: true,
        puedeReproducir: true,
        puedeSerAcademico: true,
        puedeDevocion: true
    },
    "Negativa": {
        icono: "🌑",
        ejemplos: "Orcos, Drows, Tieflings",
        modCalidad: -2,
        bonoInmigracion: 0,
        compatibilidad: "Solo Negativas/Neutras",
        descripcion: "Alta resistencia física",
        consumeAlimento: true,
        puedeReproducir: true,
        puedeSerAcademico: true,
        puedeDevocion: true
    },
    "Monstruo": {
        icono: "👹",
        ejemplos: "Kobolds, Goblins, Minotauros",
        modCalidad: -1,
        bonoInmigracion: 5,
        compatibilidad: "Específicas de especie",
        descripcion: "Mayor tasa de reproducción",
        consumeAlimento: true,
        puedeReproducir: true,
        puedeSerAcademico: true,
        puedeDevocion: true
    },
    "Artificial": {
        icono: "🤖",
        ejemplos: "Autómatas, No-Muertos, Constructos, Demonios invocados",
        modCalidad: 0,
        bonoInmigracion: 0,
        compatibilidad: "No aplica",
        descripcion: "Seres no natos. No comen, no crecen, cuestan Doblones.",
        consumeAlimento: false,      // No consumen alimentos
        puedeReproducir: false,      // No tienen crecimiento poblacional
        puedeSerAcademico: false,    // No pueden ser Académicos
        puedeDevocion: false,        // No siguen Devociones
        mantenimientoDoblones: 1,    // Consume 1 Doblón por cuota
        tieneSubtipo: true           // Puede tener subtipo (Neutral, Positiva, Negativa, Monstruo)
    }
};

// =====================================================
// ROLES DE POBLACIÓN
// =====================================================
const ROLES_POBLACION = {
    "Plebeyo": {
        icono: "👨‍🌾",
        funcion: "Crecimiento y labor general",
        beneficio: "+1 colono/turno por cuota",
        requisito: null,
        color: "#8B4513"
    },
    "Académico": {
        icono: "📚",
        funcion: "Investigación y Magia",
        beneficio: "+3 Ideas/turno",
        requisito: "Escuela o Academia",
        color: "#4169E1"
    },
    "Artesano": {
        icono: "🔨",
        funcion: "Producción y Comercio",
        beneficio: "+1 Doblón en mercados",
        requisito: "Taller o Manufactura",
        color: "#DAA520"
    },
    "Soldado": {
        icono: "⚔️",
        funcion: "Defensa y Orden",
        beneficio: "Mantiene guarnición",
        requisito: "Cuartel",
        color: "#DC143C"
    },
    "Devoto": {
        icono: "🙏",
        funcion: "Generación de Fe",
        beneficio: "+1 Devoción/turno del tipo de la cuota",
        requisito: "Plaza de Adoración o Sitio Sagrado",
        color: "#9932CC"
    }
};

// =====================================================
// ESTADÍSTICAS CON COLOR INVERTIDO
// =====================================================
const STATS_INVERTIDAS = [
    "Mantenimiento",
    "Coste de Movilidad",
    "Coste de construcción",
    "Coste de Construcción",
    "Consumo de Suministros Militares"
];

function esStatInvertida(statName) {
    return STATS_INVERTIDAS.some(inv =>
        statName.toLowerCase().includes(inv.toLowerCase()) ||
        statName.toLowerCase().includes("coste")
    );
}

// =====================================================
// BIOMAS BASE (Sub-Biomas para herencia)
// =====================================================
const BIOMAS_BASE = {
    "Bosque Llano": {
        id: 1,
        icono: "🌲",
        dado: "d10",
        // Lista 1: Recursos indexados 1-10
        recursos: [
            "Madera Útil",        // 1
            "Frutos y Tubérculos", // 2
            "Pieles",             // 3
            "Carnes",             // 4
            "Fibras Útiles",      // 5
            "Tintes",             // 6
            "Pesca",              // 7
            "Roca",               // 8
            "Sal",                // 9
            "Caucho"              // 10
        ],
        // Exóticos d4: Bosque/Humedal comparten tabla
        exoticos: ["Pieles Exóticas", "Guano", "Textiles Mágicos", "Especias Exóticas"],
        dadoExotico: "d4",
        propiedadesBase: ["Tierra Fértil", "Paraíso Animal", "Agua abundante", "Caminos Claros"],
        influenciaMagica: "Baja",
        descripcion: "Bosques templados con abundante vegetación"
    },
    "Humedal": {
        id: 2,
        icono: "🐊",
        dado: "d8",
        // Lista 2: Recursos indexados 1-8
        recursos: [
            "Madera Útil",   // 1
            "Pieles",        // 2
            "Fibras Útiles", // 3
            "Tintes",        // 4
            "Pesca",         // 5
            "Roca",          // 6
            "Guano",         // 7
            "Caucho"         // 8
        ],
        // Exóticos d4: Bosque/Humedal comparten tabla
        exoticos: ["Pieles Exóticas", "Guano", "Textiles Mágicos", "Especias Exóticas"],
        dadoExotico: "d4",
        propiedadesBase: ["Tierra Fértil", "Paraíso Animal", "Agua abundante", "Terrazas Obstruidas"],
        influenciaMagica: "Baja",
        descripcion: "Pantanos y marismas"
    },
    "Árido": {
        id: 3,
        icono: "🌵",
        dado: "d8",
        // Lista 3: Recursos indexados 1-8
        recursos: [
            "Pieles",            // 1
            "Carnes",            // 2
            "Marfiles",          // 3
            "Especias Exóticas", // 4
            "Textiles",          // 5
            "Tintes",            // 6
            "Pesca",             // 7
            "Roca"               // 8
        ],
        // Exóticos d4: Árido
        exoticos: ["Metales", "Cristales Mágicos", "Textiles Mágicos", "Reliquias"],
        dadoExotico: "d4",
        propiedadesBase: ["Paraíso Animal", "Sofocante", "Hierba Alta", "Caminos Claros"],
        influenciaMagica: "Baja",
        descripcion: "Tierras secas con escasa vegetación"
    },
    "Desértico": {
        id: 4,
        icono: "🏜️",
        dado: "d6",
        // Lista 4: Recursos indexados 1-6
        recursos: [
            "Marfiles",          // 1
            "Especias Exóticas", // 2
            "Textiles",          // 3
            "Tintes",            // 4
            "Metales",           // 5
            "Guano"              // 6
        ],
        // Exóticos d6: Desértico tiene 6 opciones
        exoticos: ["Joyas", "Cristales Mágicos", "Metales Preciosos", "Reliquias", "Textiles Mágicos"],
        dadoExotico: "d6",
        propiedadesBase: ["Sofocante", "Desolado", "Terrazas Obstruidas", "Caminos Claros"],
        influenciaMagica: "Baja",
        descripcion: "Desiertos inhóspitos"
    },
    "Tundra": {
        id: 5,
        icono: "🦌",
        dado: "d10",
        // Lista 5: Recursos indexados 1-10
        recursos: [
            "Madera Útil",        // 1
            "Frutos y Tubérculos", // 2
            "Pieles",             // 3
            "Carnes",             // 4
            "Fibras Útiles",      // 5
            "Carbón",             // 6
            "Pesca",              // 7
            "Roca",               // 8
            "Sal",                // 9
            "Caucho"              // 10
        ],
        // Exóticos d4: Tundra
        exoticos: ["Guano", "Hielo Eterno", "Maderas Preciosas", "Metales"],
        dadoExotico: "d4",
        propiedadesBase: ["Helado", "Tierra Fértil", "Terrazas Obstruidas", "Agua abundante", "Paraíso Animal"],
        influenciaMagica: "Baja",
        descripcion: "Llanuras frías con permafrost"
    },
    "Parajes Helados": {
        id: 6,
        icono: "❄️",
        dado: "d8",
        // Lista 6: Recursos indexados 1-8
        recursos: [
            "Marfiles",        // 1
            "Pieles",          // 2
            "Carnes",          // 3
            "Pieles Exóticas", // 4
            "Mantecas",        // 5
            "Pesca",           // 6
            "Sal",             // 7
            "Hielo Eterno"     // 8
        ],
        // Exóticos d4: Parajes Helados
        exoticos: ["Guano", "Metales Preciosos", "Pesca Exótica", "Reliquias"],
        dadoExotico: "d4",
        propiedadesBase: ["Helado", "Infértil", "Desolado", "Terrazas Obstruidas", "Caminos Claros"],
        influenciaMagica: "Baja",
        descripcion: "Territorios congelados"
    }
};

// =====================================================
// BIOMAS ESPECIALES (Capas de superposición)
// =====================================================
const BIOMAS_ESPECIALES = {
    "Montañoso": {
        idRango: [7], // d12 = 7
        icono: "⛰️",
        propiedadesCapa: ["Intransitable"],
        recursosGarantizados: ["Metales", "Joyas", "Roca", "Carbón"],
        exoticosGarantizados: ["Fuente de Energía Natural"],
        peculiaridadFija: "Terreno Inestable",
        dadoPeculiaridades: "2d6",
        influenciaMagica: "Media",
        descripcion: "Cordilleras y picos elevados"
    },
    "Yermo": {
        idRango: [8], // d12 = 8
        icono: "💨",
        propiedadesCapa: ["Infértil", "Desolado", "Caminos Claros"],
        recursosGarantizados: [], // Hereda del sub-bioma
        exoticosGarantizados: [], // Lanza 2d6 en sub-bioma
        peculiaridadFija: null,
        dadoPeculiaridades: "2d6",
        influenciaMagica: "Baja",
        descripcion: "Tierras yermas y despobladas"
    },
    "Tierras Malditas": {
        idRango: [9], // d12 = 9
        icono: "💀",
        propiedadesCapa: ["Desolado", "Maldito"],
        recursosGarantizados: ["Reliquias"],
        exoticosGarantizados: ["Fuente de Energía Negativa"],
        peculiaridadFija: null,
        dadoPeculiaridades: "2d6",
        influenciaMagica: "Media",
        descripcion: "Territorios corrompidos por energía oscura"
    },
    "Tierras Caóticas": {
        idRango: [10], // d12 = 10
        icono: "🌀",
        propiedadesCapa: ["Terrazas Obstruidas", "Influencia Energética"],
        recursosGarantizados: ["Cristales Mágicos"],
        exoticosGarantizados: ["Fuente de Energía Salvaje"],
        peculiaridadFija: null,
        dadoPeculiaridades: "2d6",
        influenciaMagica: "Media",
        descripcion: "Zonas de inestabilidad mágica"
    },
    "Tierras Consagradas": {
        idRango: [11], // d12 = 11
        icono: "✝️",
        propiedadesCapa: ["Caminos Claros", "Bendito"],
        recursosGarantizados: ["Reliquias"],
        exoticosGarantizados: ["Fuente de Energía Positiva"],
        peculiaridadFija: null,
        dadoPeculiaridades: "2d6",
        influenciaMagica: "Media",
        descripcion: "Lugares sagrados y bendecidos"
    }
};

// =====================================================
// PROPIEDADES DEL TERRENO (19 tipos)
// =====================================================
const PROPIEDADES = {
    "Tierra Fértil": {
        efectos: {
            "Producción Agrícola": 1,
            "Frutos y Tubérculos": 1,
            "Madera Útil": 1,
            "Cualquier Textil": 1,
            "Fibras Útiles": 1,
            "Caucho": 1,
            "Cualquier Tinte": 1
        },
        icono: "🌱",
        descripcion: "Suelos ricos y fértiles ideales para la agricultura"
    },
    "Paraíso Animal": {
        efectos: {
            "Carne": 1,
            "Cualquier piel": 1,
            "Cualquier pesca": 1,
            "Consumo de Suministros Militares": -1
        },
        icono: "🦌",
        descripcion: "Abundancia de fauna silvestre"
    },
    "Agua abundante": {
        efectos: {
            "Coste de Movilidad": -1,
            "Producción Agrícola": 1,
            "Mantenimiento": 1,
            "Consumo de Suministros Militares": -1
        },
        icono: "💧",
        descripcion: "Ríos, lagos o manantiales abundantes"
    },
    "Caminos Claros": {
        efectos: {
            "Coste de Movilidad": -1,
            "Calidad": 1
        },
        icono: "🛤️",
        descripcion: "Rutas bien definidas y transitables"
    },
    "Terrazas Obstruidas": {
        efectos: {
            "Coste de Movilidad": 1,
            "Coste de construcción (Todos los recursos)": 1,
            "Consumo de Suministros Militares": 1,
            "Defensa en trincheras y asedios": 1,
            "Sigilo": 1
        },
        icono: "🏔️",
        descripcion: "Terreno difícil pero defensivo"
    },
    "Sofocante": {
        efectos: {
            "Producción Agrícola": -1,
            "Consumo de Suministros Militares": 1,
            "Calidad": -1,
            "Mantenimiento": 1,
            "Defensa (Todos)": -1
        },
        icono: "🥵",
        descripcion: "Clima extremadamente caluroso"
    },
    "Hierba Alta": {
        efectos: {
            "Producción Agrícola": 1,
            "Frutos y Tubérculos": 1,
            "Fibras Útiles": 1,
            "Cualquier Textil": 1,
            "Defensa (Campo abierto)": -1,
            "Sigilo": 1
        },
        icono: "🌾",
        descripcion: "Praderas y pastizales extensos"
    },
    "Desolado": {
        efectos: {
            "Coste de Movilidad": -1,
            "Coste de construcción (Todos los recursos)": -1,
            "Consumo de Suministros Militares": 1,
            "Detección": 1,
            "Inmigración": -5
        },
        icono: "🏜️",
        descripcion: "Tierra yerma y despoblada"
    },
    "Helado": {
        efectos: {
            "Producción Agrícola": -1,
            "Coste de Movilidad": 1,
            "Consumo de Suministros Militares": 1,
            "Calidad": -1,
            "Mantenimiento": -1,
            "Ataque (Todos)": -1
        },
        icono: "❄️",
        descripcion: "Clima gélido y nevado"
    },
    "Intransitable": {
        efectos: {
            "Producción Agrícola": -1,
            "Coste de Movilidad": 4,
            "Coste de construcción (Todos los recursos)": 1,
            "Consumo de Suministros Militares": 1,
            "Mantenimiento": 1,
            "Ataque (A trincheras y asedio)": -1,
            "Detección": -1,
            "Inmigración": -5
        },
        icono: "🚫",
        descripcion: "Terreno prácticamente imposible de atravesar"
    },
    "Infértil": {
        efectos: {
            "Producción Agrícola": -1,
            "Frutos y Tubérculos": -1,
            "Madera Útil": -1,
            "Cualquier Textil": -1,
            "Cualquier Tinte": -1,
            "Calidad": -1
        },
        icono: "💀",
        descripcion: "Suelos pobres y estériles"
    },
    "Maldito": {
        efectos: {
            "Mantenimiento": 1,
            "Ataque (Monstruos)": 1,
            "Calidad (Especies Neutrales)": -1,
            "Calidad (Especies Positivas)": -2,
            "Calidad (Especies Negativas)": -1,
            "Capacidad Mágica": 2,
            "Producción de Artilugios Mágicos": 1
        },
        icono: "👻",
        descripcion: "Tierra corrompida por energías oscuras"
    },
    "Influencia Energética": {
        efectos: {
            "Mantenimiento": 1,
            "Calidad": -1,
            "Producción de Artilugios Mágicos": 1,
            "Capacidad Mágica": 2
        },
        icono: "⚡",
        descripcion: "Flujos de energía mágica inestables"
    },
    "Bendito": {
        efectos: {
            "Mantenimiento": -1,
            "Defensa (Contra Monstruos)": 1,
            "Calidad (Especies Positivas)": 2,
            "Calidad (Especies Negativas)": -2,
            "Producción de Artilugios Mágicos": 1
        },
        icono: "✨",
        descripcion: "Tierra sagrada y protegida"
    }
};

// =====================================================
// PECULIARIDADES (15 tipos)
// =====================================================
const PECULIARIDADES = {
    "Monstruos Comunes": {
        efectos: {
            "Mantenimiento": 1,
            "Coste de Movilidad": 1,
            "Producción de Artilugios Mágicos": 1,
            "Cualquier piel": 1,
            "Carne": 1,
            "Inmigración (Monstruos)": 5
        },
        icono: "👹",
        descripcion: "Criaturas hostiles merodean la zona"
    },
    "Presencia Feérica": {
        efectos: {
            "Mantenimiento": 1,
            "Calidad": 1,
            "Coste de Movilidad": 1,
            "Textiles Mágicos": 1,
            "Maderas Útiles": 1,
            "Capacidad Mágica": 1
        },
        icono: "🧚",
        descripcion: "Seres del mundo feérico habitan cerca"
    },
    "Círculo Druídico": {
        efectos: {
            "Coste de Construcción (Madera, Roca, Textiles)": 1,
            "Calidad": 1,
            "Maderas Útiles": -1,
            "Carne": -1,
            "Cualquier piel": -1,
            "Cualquier Textil": -1,
            "Producción Agrícola": 1,
            "Defensa (tus Regimientos)": 1
        },
        icono: "🌿",
        descripcion: "Guardianes druídicos protegen la naturaleza"
    },
    "Animales Inquietos": {
        efectos: {
            "Mantenimiento": 1,
            "Calidad": -1,
            "Coste de Movilidad (otros Regimientos)": 1,
            "Detección": 1
        },
        icono: "🐺",
        descripcion: "Fauna agitada y territorial"
    },
    "Terreno Inestable": {
        efectos: {
            "Coste de Construcción (Maderas, Marfiles, Pieles)": 2,
            "Coste de Movilidad": 1
        },
        icono: "🌋",
        descripcion: "Suelo propenso a movimientos y grietas"
    },
    "Bandidos Activos": {
        efectos: {
            "Calidad": -2,
            "Defensa (tus Regimientos)": 1,
            "Defensa (En Asedios)": 1
        },
        icono: "🗡️",
        descripcion: "Grupos de forajidos operan en la zona"
    },
    "Agudeza Mágica": {
        efectos: {
            "Detección": -1
        },
        icono: "🔮",
        descripcion: "La magia fluye con mayor intensidad"
    },
    "Culto Yuan-Ti": {
        efectos: {
            "Inmigración (Especies Neutrales)": -5,
            "Inmigración (Monstruos)": 5,
            "Inmigración (Especies Negativas)": 5,
            "Consumo de Suministros Militares": 1
        },
        icono: "🐍",
        descripcion: "Adoradores serpentinos realizan rituales"
    },
    "Terreno Ponzoñoso": {
        efectos: {
            "Coste de Movilidad": 2,
            "Consumo de Suministros Militares": 1,
            "Consumo de Suministros Militares (otros Regimientos)": 1
        },
        icono: "☠️",
        descripcion: "Toxinas naturales impregnan el ambiente"
    },
    "Elementales Manifiestos": {
        efectos: {
            "Mantenimiento": 1,
            "Producción de Artilugios Mágicos": 1
        },
        icono: "🌪️",
        descripcion: "Espíritus elementales habitan la zona"
    },
    "Salpicado": {
        efectos: {
            "Calidad": 1,
            "Coste de construcción (Todos los recursos)": 1,
            "Mantenimiento": -1,
            "Inmigración": 5
        },
        icono: "🏝️",
        descripcion: "Terreno fragmentado con muchas islas o zonas"
    },
    "Presencia Naga": {
        efectos: {
            "Coste de construcción (Todos los recursos)": 1,
            "Cualquier Pesca": 1,
            "Producción de Artilugios Mágicos": 1,
            "Capacidad Mágica": -1,
            "Inmigración": -5
        },
        icono: "🐉",
        descripcion: "Nagas ancestrales dominan estas aguas"
    }
};

// =====================================================
// LISTA COMPLETA DE RECURSOS CON CATEGORÍAS
// =====================================================
const RECURSOS = {
    // Materias Primas - Maderas
    "Madera Útil": { categoria: "Materia Prima", tags: ["Madera"], icono: "🪵" },
    "Maderas Preciosas": { categoria: "Materia Prima Exótica", tags: ["Madera", "Exotico"], icono: "🌳" },

    // Alimentos
    "Alimento": { categoria: "Alimento", tags: ["Alimento"], icono: "🥩" },
    "Frutos y Tubérculos": { categoria: "Alimento", tags: ["Alimento", "Vegetal"], icono: "🥗" },
    "Carne": { categoria: "Alimento", tags: ["Alimento"], icono: "🥩" },
    "Pesca": { categoria: "Alimento", tags: ["Alimento"], icono: "🐟" },
    "Pesca Exótica": { categoria: "Alimento Exótico", tags: ["Alimento", "Exotico"], icono: "🦑" },
    "Mantecas": { categoria: "Alimento", tags: ["Alimento"], icono: "🧈" },

    // Pieles
    "Pieles": { categoria: "Materia Prima", tags: ["Piel"], icono: "🦊" },
    "Pieles Exóticas": { categoria: "Materia Prima Exótica", tags: ["Piel", "Exotico"], icono: "🐆" },

    // Textiles y Fibras
    "Fibras Útiles": { categoria: "Materia Prima", tags: ["Fibra", "Textil"], icono: "🧶" },
    "Textiles": { categoria: "Materia Prima", tags: ["Textil"], icono: "🧵" },
    "Textiles Mágicos": { categoria: "Recurso Mágico", tags: ["Textil", "Fibra", "Exotico", "Magico"], icono: "✨" },

    // Minerales y Rocas
    "Roca": { categoria: "Materia Prima", tags: ["Roca"], icono: "🪨" },
    "Sal": { categoria: "Materia Prima", tags: ["Sal"], icono: "🧂" },
    "Carbón": { categoria: "Materia Prima", tags: ["Carbon"], icono: "⚫" },
    "Metales": { categoria: "Materia Prima", tags: ["Metal"], icono: "⛏️" },
    "Metales Preciosos": { categoria: "Materia Prima Exótica", tags: ["Metal", "Exotico"], icono: "🥇" },
    "Joyas": { categoria: "Materia Prima Exótica", tags: ["Joya", "Exotico"], icono: "💎" },
    "Cristales Mágicos": { categoria: "Recurso Mágico", tags: ["Cristal", "Magico", "Exotico"], icono: "🔮" },

    // Otros
    "Tintes": { categoria: "Materia Prima", tags: ["Tinte"], icono: "🎨" },
    "Caucho": { categoria: "Materia Prima", tags: ["Caucho"], icono: "⚫" },
    "Marfiles": { categoria: "Materia Prima Exótica", tags: ["Marfil", "Exotico"], icono: "🦴" },
    "Guano": { categoria: "Materia Prima", tags: ["Guano"], icono: "💩" },
    "Reliquias": { categoria: "Recurso Mágico", tags: ["Reliquia", "Magico"], icono: "📿" },
    "Especias Exóticas": { categoria: "Recurso Exótico", tags: ["Especia", "Exotico"], icono: "🌶️" },

    // Energía
    "Fuente de Energía Natural": { categoria: "Recurso Energético", tags: ["Energia"], icono: "🌿" },
    "Fuente de Energía Positiva": { categoria: "Recurso Energético", tags: ["Energia"], icono: "☀️" },
    "Fuente de Energía Negativa": { categoria: "Recurso Energético", tags: ["Energia"], icono: "🌑" },
    "Fuente de Energía Salvaje": { categoria: "Recurso Energético", tags: ["Energia"], icono: "🌀" },

    // Recursos Procesados / Manufacturas
    "Muebles": { categoria: "Procesado", tags: ["Mueble"], icono: "🪑" },
    "Herramientas": { categoria: "Procesado", tags: ["Herramienta"], icono: "🔧" },
    "Papiro": { categoria: "Procesado", tags: ["Papiro"], icono: "📜" },
    "Acero": { categoria: "Procesado", tags: ["Acero", "Metal"], icono: "🔩" },
    "Cristaleria": { categoria: "Procesado", tags: ["Cristal"], icono: "🥂" },
    "Explosivos": { categoria: "Procesado", tags: ["Explosivo"], icono: "🧨" },
    "Maquinaria": { categoria: "Procesado", tags: ["Maquinaria"], icono: "⚙️" },
    "Piel Procesada": { categoria: "Procesado", tags: ["Piel", "Procesado"], icono: "🧥" }, // Assuming refined leather
    "Suministros": { categoria: "Procesado", tags: ["Suministro"], icono: "📦" },
    "Combustible": { categoria: "Procesado", tags: ["Combustible"], icono: "⛽" },
    "Fertilizante": { categoria: "Procesado", tags: ["Fertilizante"], icono: "🧪" }
};

// =====================================================
// EDIFICIOS
// =====================================================
const EDIFICIOS_INICIALES = [
    "Cultivo Agrícola",
    "Zona Residencial",
    "Cuartel",
    "Almacén",
    "Manufactura",
    "Archivo",
    "Mercado",
    "Ala Festiva"
];

// =====================================================
// RECURSOS ESPECIALES (No ocupan almacenamiento)
// =====================================================
const RECURSOS_ESPECIALES = {
    "Ideas": { icono: "💡", descripcion: "Puntos de investigación", ocupaAlmacen: false },
    "Influencia": { icono: "🏛️", descripcion: "Poder político", ocupaAlmacen: false }
};

// EDIFICIOS v5 - Sistema de Costes con Opciones
// Cada edificio tiene costesG1 (array de opciones) y costesMejora (para subir grado)
// El jugador elige UNA opción de coste para construir
// =====================================================
const EDIFICIOS = {
    // === ADMINISTRACIÓN ===
    "Oficina Coordinación": {
        tipo: "Admin", icono: "📋", maxGrado: 3,
        costesG1: [
            { "Cualquier Madera": 8, "Papiro": 2 },
            { "Metal": 3, "Papiro": 2 },
            { "Roca": 4, "Papiro": 2 },
            { "Doblones": 25 }
        ],
        costesMejora: [
            { "Cualquier Madera": 3, "Papiro": 1 },
            { "Metal": 2, "Papiro": 1 },
            { "Roca": 3, "Papiro": 1 },
            { "Doblones": 12 }
        ],
        capacidad: { base: 1, porGrado: 1, rol: "Académico" }, // 1 Académico (+1 por Grado)
        produccionTrabajo: { tipo: "Regional", cantidad: 1 },
        descripcion: "Coordina la región. +1 Producción del Recurso Regional elegido."
    },
    "Alcaldía": {
        tipo: "Admin", icono: "🏛️", maxGrado: 1,
        costesG1: [
            { "Cualquier Madera": 6 },
            { "Marfil": 2, "Piel": 3 },
            { "Roca": 5 },
            { "Metal": 4 },
            { "Doblones": 12 }
        ],
        descripcion: "Mejora a Poblado. Calidad +2.",
        efectos: { "Calidad": 2 },
        effect: "Habilita Grado Poblado"
    },
    "Palacio": {
        tipo: "Admin", icono: "🏰", maxGrado: 1,
        costesG1: [
            { "Cualquier Madera": 12 },
            { "Marfil": 4, "Piel": 6 },
            { "Roca": 10 },
            { "Metal": 8 },
            { "Doblones": 24 }
        ],
        descripcion: "Mejora a Urbe.",
        effect: "Habilita Grado Urbe"
    },
    "Ala Concejal": {
        tipo: "Admin", icono: "⚖️", maxGrado: 1,
        costesG1: [
            { "Cualquier Madera": 28 },
            { "Marfil": 9, "Piel": 14 },
            { "Roca": 23 },
            { "Metal": 19 },
            { "Doblones": 60 }
        ],
        descripcion: "Mejora a Megalópolis.",
        effect: "Habilita Grado Megalópolis"
    },
    "Jurisprudencia ICS": {
        tipo: "Admin", icono: "📜", maxGrado: 1,
        costesG1: [
            { "Doblones": 2, "Fibra Útil": 2 },
            { "Doblones": 5 }
        ],
        descripcion: "Produce +1 Influencia (Pasivo).",
        produccionPasiva: { "Influencia": 1 }
    },

    // === PRODUCCIÓN ===
    "Cultivo Agrícola": {
        tipo: "Prod.", icono: "🌾", maxGrado: 1,
        costesG1: [
            { "Cualquier Madera": 2 },
            { "Marfil": 1 },
            { "Doblones": 4 }
        ],
        capacidad: { base: 3, rol: "Cualquiera" },
        produccionTrabajo: { recurso: "Alimento", cantidad: 2 },
        descripcion: "+2 Alimentos por Cuota asignada."
    },
    "Manufactura": {
        tipo: "Prod.", icono: "🏭", maxGrado: 4,
        costesG1: [
            { "Cualquier Madera": 5 },
            { "Metal": 3 },
            { "Roca": 4 },
            { "Doblones": 11 }
        ],
        costesMejora: [
            { "Cualquier Madera": 2 },
            { "Metal": 1 },
            { "Roca": 2 },
            { "Doblones": 5 }
        ],
        capacidad: { base: 4, porGrado: 4, rol: "Cualquiera" }, // 4 Cuotas Pob. (Por Grado) -> Base 4 at G1? Or 4 per grade implies 4*Grade. Assuming Base 4, +4 per Upgrade (G2=8).
        produccionTrabajo: { tipo: "Procesado", cantidad: 1 },
        permiteManufactura: true,
        mantenimiento: { Doblones: 0 },
        descripcion: "+1 Recurso Procesado (del tipo elegido) por Cuota."
    },
    "Molinar": {
        tipo: "Prod.", icono: "🌬️", maxGrado: 1,
        costesG1: [
            { "Cualquier Madera": 7, "Fibra": 1 },
            { "Roca": 6, "Fibra": 1 },
            { "Doblones": 17 }
        ],
        descripcion: "Aumenta producción Agrícola +1 (Pasivo).",
        efectos: { "Bono_Agricola": 1 }
    },
    "Mina": {
        tipo: "Prod.", icono: "⛏️", maxGrado: 1,
        costesG1: [
            { "Explosivos": 1 },
            { "Doblones": 8 }
        ],
        descripcion: "Aumenta prod. Metales (Pasivo Regional).",
        efectos: { "Bono_Metales": 1 }
    },
    "Forja": {
        tipo: "Prod.", icono: "🔥", maxGrado: 3,
        costesG1: [
            { "Metal": 12, "Herramienta": 2 },
            { "Roca": 15, "Herramienta": 2 },
            { "Doblones": 44 }
        ],
        costesMejora: [
            { "Metal": 1, "Herramienta": 1 },
            { "Roca": 2, "Herramienta": 1 },
            { "Doblones": 6 }
        ],
        capacidad: { base: 2, rol: "Artesano" },
        produccionTrabajo: { recurso: "Acero", cantidad: 2 }, // G1: +2 Aceros. Upgrades change this to "Aceros Preciosos". Logic will handle this.
        permiteManufactura: true,
        descripcion: "G1: +2 Aceros. +Grado: +2 Aceros Preciosos."
    },
    "Taller": {
        tipo: "Prod.", icono: "🔧", maxGrado: 1,
        costesG1: [
            { "Cualquier Madera": 4 },
            { "Roca": 3 },
            { "Metal": 2 },
            { "Doblones": 9 }
        ],
        descripcion: "Efecto Pasivo: Tus Artesanos producen +1 Arma o Herramienta.",
        efectos: { "Bono_Artesanos_Tools": 1 }
    },
    "Taller Ingeniería": {
        tipo: "Prod.", icono: "🚜", maxGrado: 1,
        costesG1: [
            { "Acero": 20, "Maquinaria": 2 },
            { "Roca": 160, "Maquinaria": 2 },
            { "Cualquier Madera": 190, "Maquinaria": 2 },
            { "Doblones": 400 }
        ],
        descripcion: "Efecto Pasivo: Tus Artesanos producen +1 a todo Recurso Procesado.",
        efectos: { "Bono_Artesanos_All": 1 }
    },

    // === ECONOMÍA ===
    "Mercado": {
        tipo: "Econ.", icono: "🏪", maxGrado: 1,
        costesG1: [
            { "Cualquier Madera": 3 },
            { "Marfil": 1, "Piel": 2 },
            { "Roca": 3 },
            { "Doblones": 7 }
        ],
        capacidad: { base: 3, rol: "Artesano" },
        produccionTrabajo: { recurso: "Doblones", cantidad: 1, condicion: "per_5_pop" }, // +1 Medida de Doblón por cada 5 Cuotas de Población totales.
        descripcion: "+1 Medida de Doblón por cada 5 Cuotas de Población totales."
    },
    "Caraversai": {
        tipo: "Econ.", icono: "🐪", maxGrado: 1,
        costesG1: [
            { "Alimento": 30 },
            { "Doblones": 45 }
        ],
        capacidad: { base: 1, rol: "Artesano" },
        descripcion: "+1 Medida Doblón por cada otro Poblado en Contacto."
    },
    "Casa Moneda": {
        tipo: "Econ.", icono: "💰", maxGrado: 1,
        costesG1: [
            { "Acero": 20, "Papiro": 10 },
            { "Roca": 160, "Papiro": 10 },
            { "Doblones": 350 }
        ],
        capacidad: { base: 1, rol: "Académico" },
        descripcion: "+1 Cuota Doblón por cada 10 Cuotas de Población."
    },

    // === MILITAR ===
    "Cuartel": {
        tipo: "Militar", icono: "⚔️", maxGrado: 1,
        costesG1: [
            { "Cualquier Madera": 3 },
            { "Marfil": 1, "Piel": 2 },
            { "Roca": 3 },
            { "Metal": 2 },
            { "Doblones": 7 }
        ],
        capacidad: { base: 3, rol: "Plebeyo" },
        produccionTrabajo: { tipo: "Transformacion", output: "Soldados", cantidad: 20 },
        descripcion: "Transformación: Convierte la Cuota en 20 Medidas de Soldados."
    },
    "Barracas": {
        tipo: "Militar", icono: "🛌", maxGrado: 3,
        costesG1: [
            { "Cualquier Madera": 8 },
            { "Marfil": 3, "Piel": 4 },
            { "Metal": 5 },
            { "Roca": 7 },
            { "Doblones": 17 }
        ],
        costesMejora: [
            { "Cualquier Madera": 2 },
            { "Marfil": 1, "Piel": 1 },
            { "Metal": 1 },
            { "Roca": 2 },
            { "Doblones": 5 }
        ],
        efectos: { "Guarnicion": 5, "Estructura": 20 },
        descripcion: "Guarnición +5. Estructura +20."
    },
    "Centro Adiestramiento": {
        tipo: "Militar", icono: "🎯", maxGrado: 1,
        costesG1: [
            { "Acero": 20, "Maquinaria": 2 },
            { "Roca": 160, "Maquinaria": 2 },
            { "Doblones": 396 }
        ],
        efectos: { "Guarnicion": 10 },
        descripcion: "Guarnición +10. Descuento tropas."
    },
    "Bastión": {
        tipo: "Militar", icono: "🏯", maxGrado: 1,
        costesG1: [
            { "Roca": 20 },
            { "Metal": 16 },
            { "Doblones": 52 }
        ],
        efectos: { "Asedio": 2 },
        descripcion: "Ataque/Defensa Asedios +2."
    },
    "Baluarte": {
        tipo: "Militar", icono: "🏰", maxGrado: 1,
        costesG1: [
            { "Acero": 41 },
            { "Roca": 250 },
            { "Doblones": 650 }
        ],
        efectos: { "Asedio": 2, "Estructura": 30 },
        descripcion: "Ataque/Defensa Asedios +2. Estructura +30."
    },
    "Alambrados": {
        tipo: "Militar", icono: "🚧", maxGrado: 1,
        costesG1: [
            { "Acero": 15 },
            { "Doblones": 233 }
        ],
        efectos: { "Calidad": 4 },
        descripcion: "Calidad +4. Mejora producción pasiva."
    },
    "Muros": {
        tipo: "Defensa", icono: "🧱", maxGrado: 5,
        costesG1: [
            { "Cualquier Madera": 14 },
            { "Metal": 4, "Roca": 9 },
            { "Metal": 10 },
            { "Roca": 11 },
            { "Doblones": 30 }
        ],
        costesMejora: [
            { "Cualquier Madera": 2 },
            { "Piel": 1 },
            { "Metal": 1 },
            { "Roca": 2 },
            { "Doblones": 4 }
        ],
        efectos: { "Defensa": 1, "Estructura": 20 },
        descripcion: "Defensa +1. Estructura +20."
    },
    "Vigía": {
        tipo: "Defensa", icono: "🔭", maxGrado: 4,
        costesG1: [
            { "Cualquier Madera": 3 },
            { "Metal": 2 },
            { "Roca": 3 },
            { "Doblones": 7 }
        ],
        costesMejora: [
            { "Cualquier Madera": 2 },
            { "Metal": 1 },
            { "Roca": 2 },
            { "Doblones": 4 }
        ],
        efectos: { "Deteccion": 2 },
        descripcion: "Detección +2 (+2/Grado)."
    },

    // === CONOCIMIENTO ===
    "Academia": {
        tipo: "Conoc.", icono: "🎓", maxGrado: 1,
        costesG1: [
            { "Cualquier Madera": 7 },
            { "Marfil": 2, "Piel": 4 },
            { "Roca": 6 },
            { "Metal": 5 },
            { "Doblones": 15 }
        ],
        capacidad: { base: 3, rol: "Cualquiera" },
        produccionTrabajo: { tipo: "Transformacion", options: ["Soldados", "Arcanistas", "Clero"] },
        descripcion: "Transformación: Convierte la Cuota en Soldados, Arcanistas o Clero."
    },
    "Escuela": {
        tipo: "Conoc.", icono: "🏫", maxGrado: 2,
        costesG1: [
            { "Cualquier Madera": 11, "Mueble": 1 },
            { "Marfil": 4, "Piel": 6, "Mueble": 1 },
            { "Roca": 9, "Mueble": 1 },
            { "Doblones": 38 }
        ],
        costesMejora: [
            { "Cualquier Madera": 2, "Mueble": 1 },
            { "Marfil": 1, "Mueble": 1 },
            { "Roca": 2, "Mueble": 1 },
            { "Doblones": 13 }
        ],
        capacidad: { base: 2, porGrado: 2, rol: "Plebeyo" },
        produccionTrabajo: { tipo: "Transformacion", output: "Artesanos" },
        descripcion: "Transformación: Convierte Plebeyos en Artesanos."
    },
    "Gremio Intelectuales": {
        tipo: "Conoc.", icono: "🧠", maxGrado: 1,
        costesG1: [
            { "Papiro": 2, "Influencia": 1 },
            { "Doblones": 12 }
        ],
        costesMejora: [
            { "Metal": 1, "Herramienta": 1 },
            { "Roca": 2, "Herramienta": 1 },
            { "Doblones": 6 }
        ],
        capacidad: { base: 3, rol: "Académico" },
        produccionTrabajo: { recurso: "Ideas", cantidad: 1 },
        descripcion: "+1 Ideas. (Pasivo: Produce Aceros por Grado)."
    },
    "Universidad": {
        tipo: "Conoc.", icono: "🏛️", maxGrado: 3,
        costesG1: [
            { "Cualquier Madera": 250, "Mueble": 5 },
            { "Roca": 208, "Mueble": 5 },
            { "Doblones": 565 }
        ],
        costesMejora: [
            { "Cualquier Madera": 20, "Mueble": 2 },
            { "Roca": 17, "Mueble": 2 },
            { "Doblones": 53 }
        ],
        capacidad: { base: 6, rol: "Mix_Acad_Pob" },
        descripcion: "Académicos: +3 Ideas. Población: Se convierte en Académicos."
    },
    "Archivo": {
        tipo: "Conoc.", icono: "📚", maxGrado: 1,
        costesG1: [
            { "Cualquier Madera": 3, "Fibra": 1 },
            { "Roca": 3, "Fibra": 1 },
            { "Doblones": 9 }
        ],
        efectos: { "CapacidadAdmin": 20 },
        descripcion: "Capacidad Administrativa +20."
    },

    // === VIVIENDA ===
    "Zona Residencial": {
        tipo: "Vivienda", icono: "🏠", maxGrado: 3,
        costesG1: [
            { "Cualquier Madera": 3 },
            { "Marfil": 1, "Piel": 2 },
            { "Roca": 3 },
            { "Doblones": 7 }
        ],
        costesMejora: [
            { "Cualquier Madera": 3 },
            { "Marfil": 1, "Piel": 2 },
            { "Roca": 3 },
            { "Doblones": 7 }
        ],
        descripcion: "Calidad +2 (+1/Grado).",
        efectos: { "Calidad": 2, "CalidadPorGrado": 1 },
        mantenimiento: { Doblones: 1 }
    },

    // === LOGÍSTICA ===
    "Almacén": {
        tipo: "Logística", icono: "📦", maxGrado: 4,
        costesG1: [
            { "Cualquier Madera": 4 },
            { "Marfil": 1, "Piel": 3 },
            { "Doblones": 9 }
        ],
        costesMejora: [
            { "Cualquier Madera": 2 },
            { "Marfil": 1, "Piel": 1 },
            { "Doblones": 5 }
        ],
        descripcion: "Capacidad Almacenamiento +10 Cuotas/Grado."
    },
    "Caminos": {
        tipo: "Infra", icono: "🛣️", maxGrado: 3,
        costesG1: [
            { "Doblones": 1 }
        ],
        costesMejora: [
            { "Roca": 1 },
            { "Doblones": 2 }
        ],
        descripcion: "Movilidad +1 (+1/Grado)."
    },

    // === NAVAL ===
    "Bahía": {
        tipo: "Naval", icono: "⚓", maxGrado: 1,
        costesG1: [
            { "Cualquier Madera": 3 },
            { "Doblones": 7 }
        ],
        descripcion: "Habilita Navíos. +1 Pesca."
    },
    "Puerto": {
        tipo: "Naval", icono: "🚢", maxGrado: 1,
        costesG1: [
            { "Roca": 10, "Metal": 4 },
            { "Cualquier Madera": 12, "Metal": 4 },
            { "Doblones": 39 }
        ],
        descripcion: "Contacto costero. +1 Pesca."
    },

    // === MAGIA ===
    "Salón Hechicería": {
        tipo: "Magia", icono: "🔮", maxGrado: 1,
        costesG1: [
            { "Doblones": 2, "Fibra": 2 },
            { "Doblones": 5 }
        ],
        descripcion: "Habilita Hechicería."
    },
    "Torre Hechicería": {
        tipo: "Magia", icono: "🧙‍♂️", maxGrado: 1,
        costesG1: [
            { "Roca": 10, "Cristal": 2 },
            { "Cualquier Madera": 12, "Cristal": 2 },
            { "Doblones": 35 }
        ],
        capacidad: { base: 2, rol: "Mix_Arc_Pob" },
        descripcion: "Arcanista: +1 Cap. Mágica. Pob: Convierte en Arcanista."
    },
    "Terraza Archimagos": {
        tipo: "Magia", icono: "✨", maxGrado: 1,
        costesG1: [
            { "Roca": 75, "Cristal Mágico": 10 },
            { "Doblones": 403 }
        ],
        capacidad: { base: 5, rol: "Mix_Arc_Art" },
        descripcion: "Ambos: +3 Artilugios Mágicos."
    },

    // === RELIGIÓN ===
    "Plaza Adoración": {
        tipo: "Religión", icono: "🛐", maxGrado: 1,
        costesG1: [
            { "Doblones": 5 }
        ],
        descripcion: "Habilita Devoción."
    },
    "Sitio Sagrado": {
        tipo: "Religión", icono: "⛩️", maxGrado: 1,
        costesG1: [
            { "Cualquier Madera": 6 },
            { "Marfil": 2, "Piel": 3 },
            { "Roca": 5 },
            { "Doblones": 13 }
        ],
        capacidad: { base: 3, rol: "Mix_Clero_Pob" },
        descripcion: "Clero: +1 Devoción. Pob: Se convierte en Clero."
    },
    "Insigne": {
        tipo: "Religión", icono: "⛪", maxGrado: 1,
        costesG1: [
            { "Roca": 160, "Textil Mágico": 10 },
            { "Doblones": 380 }
        ],
        capacidad: { base: 4, rol: "Mix_Teo_Acad" },
        descripcion: "Teólogo: +1 Ideas y Devoción. Académico: Se convierte en Teólogo."
    },

    // === ESPECIAL ===
    "Generador": {
        tipo: "Especial", icono: "⚡", maxGrado: 1,
        costesG1: [
            { "Roca": 10, "Metal": 4 },
            { "Cualquier Madera": 12, "Metal": 4 },
            { "Doblones": 39 }
        ],
        capacidad: { base: 2, rol: "Mix_Carb_Ener" },
        descripcion: "Consumo Carbón/Energía para potenciar producción."
    },
    "Antena Telúrica": {
        tipo: "Especial", icono: "📡", maxGrado: 1,
        costesG1: [
            { "Cristal Mágico": 8 },
            { "Doblones": 34 }
        ],
        descripcion: "Aumenta Grado Influencia Mágica."
    },
    "Ala Festiva": {
        tipo: "Social", icono: "🎉", maxGrado: 5,
        costesG1: [
            { "Cualquier Madera": 6 },
            { "Marfil": 2, "Piel": 3 },
            { "Metal": 4 },
            { "Roca": 5 },
            { "Doblones": 13 }
        ],
        costesMejora: [
            { "Cualquier Madera": 2 },
            { "Piel": 1 },
            { "Metal": 1 },
            { "Roca": 2 },
            { "Doblones": 4 }
        ],
        descripcion: "Calidad +3 (+3/Grado).",
        efectos: { "Calidad": 3, "CalidadPorGrado": 3 },
        mantenimiento: { Doblones: 2 }
    }
};


// =====================================================
// RECETAS DE MANUFACTURA
// =====================================================
const RECETAS_MANUFACTURA = {
    "logistica_y_supervivencia": {
        "suministros": { "edificio": "Manufactura", "input": { "Alimento": 20 }, "output": { "Recurso": "Suministros", "Cantidad": 10 }, "desc": "Sustento básico para expediciones." },
        "fertilizante": {
            "edificio": "Manufactura",
            "opcion_a": { "input": { "Guano": 20 }, "output": { "Recurso": "Fertilizante", "Cantidad": 10 } },
            "opcion_b": { "input": { "Carbon": 10, "Cualquier Madera": 10 }, "output": { "Recurso": "Fertilizante", "Cantidad": 10 } }
        },
        "combustibles": {
            "edificio": "Manufactura",
            "opcion_a": { "input": { "Carbon": 30 }, "output": { "Recurso": "Combustible", "Cantidad": 10 } },
            "opcion_b": { "input": { "Energia": 10 }, "output": { "Recurso": "Combustible", "Cantidad": 10 } }
        }
    },
    "construccion_y_hogar": {
        "muebles": { "input": { "Cualquier Madera": 10, "Fibra": 10 }, "output": { "Recurso": "Muebles", "Cantidad": 10 } },
        "muebles_de_lujo": { "input": { "Cualquier Madera": 10, "Textil Magico": 20 }, "output": { "Recurso": "Muebles Lujo", "Cantidad": 10 } },
        "herramientas_rudimentarias": { "input": { "Cualquier Madera": 10 }, "output": { "Recurso": "Herramientas Rudimentarias", "Cantidad": 10 } },
        "herramientas": { "input": { "Roca": 20 }, "output": { "Recurso": "Herramientas", "Cantidad": 10 } },
        "cristaleria": { "input": { "Roca": 10 }, "output": { "Recurso": "Cristaleria", "Cantidad": 10 } }
    },
    "textiles_y_papeleria": {
        "papiro": { "input": { "Fibra": 20 }, "output": { "Recurso": "Papiro", "Cantidad": 10 } },
        "ropa": { "input": { "Textil": 20 }, "output": { "Recurso": "Ropa", "Cantidad": 10 } },
        "ropa_de_lujo": {
            "opcion_a": { "input": { "Textil Magico": 20 }, "output": { "Recurso": "Ropa Lujo", "Cantidad": 10 } },
            "opcion_b": { "input": { "Piel Exotica": 20 }, "output": { "Recurso": "Ropa Lujo", "Cantidad": 10 } }
        },
        "libros": {
            "opcion_a": { "input": { "Papiro": 10, "Fibra": 10 }, "output": { "Recurso": "Libros", "Cantidad": 10 } },
            "opcion_b": { "input": { "Guano": 20 }, "output": { "Recurso": "Libros", "Cantidad": 10 } }
        }
    },
    "metalurgia_avanzada": {
        "acero": { "edificio": "Forja", "input": { "Metal": 20 }, "output": { "Recurso": "Acero", "Cantidad": 10 } },
        "acero_precioso": { "edificio": "Forja", "input": { "Metal Precioso": 20 }, "output": { "Recurso": "Acero Precioso", "Cantidad": 10 } },
        "orfebreria": { "edificio": "Forja", "input": { "Metal Precioso": 10, "Joyas": 10 }, "output": { "Recurso": "Orfebreria", "Cantidad": 10 } }
    },
    "quimica_y_tecnologia": {
        "materiales_alquimicos": { "edificio": "Manufactura", "input": { "Carbon": 10, "Sal": 10, "Frutos": 10 }, "output": { "Recurso": "Materiales Alquimicos", "Cantidad": 10 } },
        "explosivos": { "edificio": "Manufactura", "input": { "Materiales Alquimicos": 20, "Cristaleria": 10 }, "output": { "Recurso": "Explosivos", "Cantidad": 10 } },
        "polvora": {
            "edificio": "Manufactura",
            "opcion_a": { "input": { "Carbon": 10, "Sal": 10 }, "output": { "Recurso": "Polvora", "Cantidad": 10 } },
            "opcion_b": { "input": { "Fertilizante": 20 }, "output": { "Recurso": "Polvora", "Cantidad": 10 } }
        },
        "plasticos": { "edificio": "Manufactura", "input": { "Caucho": 20 }, "output": { "Recurso": "Plasticos", "Cantidad": 10 } },
        "neumaticos": { "edificio": "Manufactura", "input": { "Plastico": 10, "Caucho": 20 }, "output": { "Recurso": "Neumaticos", "Cantidad": 10 } },
        "maquinaria": { "edificio": "Manufactura", "input": { "Acero": 20, "Metal": 20, "Caucho": 10, "Plastico": 20 }, "output": { "Recurso": "Maquinaria", "Cantidad": 10 } }
    },
    "armamento_y_defensa": {
        "armas_rudimentarias": { "edificio": "Forja", "input": { "Cualquier Madera": 10 }, "output": { "Recurso": "Armas Rudimentarias", "Cantidad": 10 } },
        "armas": { "edificio": "Forja", "input": { "Metal": 20 }, "output": { "Recurso": "Armas", "Cantidad": 10 } },
        "armas_excelsas": { "edificio": "Forja", "input": { "Acero": 20 }, "output": { "Recurso": "Armas Excelsas", "Cantidad": 10 } },
        "armas_de_fuego": { "edificio": "Forja", "input": { "Acero": 10, "Polvora": 10 }, "output": { "Recurso": "Armas Fuego", "Cantidad": 10 } },
        "armaduras_excelsas": { "edificio": "Forja", "input": { "Acero": 30 }, "output": { "Recurso": "Armaduras Excelsas", "Cantidad": 10 } },
        "material_balistico": { "edificio": "Forja", "input": { "Explosivos": 30 }, "output": { "Recurso": "Material Balistico", "Cantidad": 10 } },
        "canon_clasico": { "edificio": "Forja", "input": { "Acero": 20, "Polvora": 10 }, "output": { "Recurso": "Canon Clasico", "Cantidad": 10 } },
        "canon_balistico": { "edificio": "Forja", "input": { "Acero": 30, "Material Balistico": 10 }, "output": { "Recurso": "Canon Balistico", "Cantidad": 10 } }
    },
    "vehiculos": {
        "carruajes": { "edificio": "Manufactura", "input": { "Cualquier Madera": 40, "Metal": 10 }, "output": { "Recurso": "Carruajes", "Cantidad": 10 } }
    }
};

// =====================================================
// GRADOS DE ASENTAMIENTO
// =====================================================
const GRADOS = {
    "Estamento": {
        nivel: 1,
        calidad: 1,
        admin: 15,
        guarnicion: 5,
        almacenamiento: 20,
        inmigracion: 10,
        icono: "🏕️",
        descripcion: "Campamento básico"
    },
    "Poblado": {
        nivel: 2,
        calidad: 3,
        admin: 25,
        guarnicion: 10,
        almacenamiento: 30,
        inmigracion: 15,
        icono: "🏘️",
        descripcion: "Pequeña comunidad establecida"
    },
    "Urbe": {
        nivel: 3,
        calidad: 5,
        admin: 40,
        guarnicion: 25,
        almacenamiento: 40,
        inmigracion: 10,
        icono: "🏛️",
        descripcion: "Ciudad próspera"
    },
    "Megalópolis": {
        nivel: 4,
        calidad: 15,
        admin: 300,
        guarnicion: 80,
        almacenamiento: 120,
        inmigracion: 20,
        icono: "🏰",
        descripcion: "Gran metrópolis"
    }
};

// =====================================================
// TRIBUTOS
// =====================================================
const TRIBUTOS = {
    "Sin Tributo": { doblones: 0, calidad: 1, icono: "😊" },
    "Tributo Sencillo": { doblones: 1, calidad: -1, icono: "😐" },
    "Tributo Elevado": { doblones: 2, calidad: -3, icono: "😟" },
    "Tributo Exigente": { doblones: 3, calidad: -5, icono: "😰" }
};

// =====================================================
// INFLUENCIA MÁGICA
// =====================================================
const INFLUENCIA_MAGICA = {
    "Baja": { valor: 0, icono: "🔵", descripcion: "Poca actividad mágica" },
    "Media": { valor: 1, icono: "🟣", descripcion: "Actividad mágica moderada" },
    "Alta": { valor: 2, icono: "🔴", descripcion: "Intensa actividad mágica" }
};

// =====================================================
// FUNCIONES DE DADOS
// =====================================================

/**
 * Lanza un dado y retorna el resultado
 * @param {string} tipo - "d4", "d6", "d8", "d10", "d12", "2d6"
 * @returns {number}
 */
function lanzarDado(tipo) {
    if (tipo === "2d6") {
        return Math.floor(Math.random() * 6) + 1 + Math.floor(Math.random() * 6) + 1;
    }
    const max = parseInt(tipo.replace('d', ''), 10);
    return Math.floor(Math.random() * max) + 1;
}

/**
 * Determina el tipo de bioma basado en tirada d12
 * @returns {object} { esBiomaEspecial, biomaEspecial, necesitaSubBioma, tiradaD12 }
 */
function determinarTipoBioma() {
    const tirada = lanzarDado("d12");

    // Biomas normales: 1-6
    if (tirada <= 6) {
        const biomasArray = Object.keys(BIOMAS_BASE);
        return {
            esBiomaEspecial: false,
            biomaBase: biomasArray[tirada - 1],
            biomaEspecial: null,
            necesitaSubBioma: false,
            tiradaD12: tirada
        };
    }

    // Biomas especiales: 7-11
    let biomaEspecial = null;
    for (const [nombre, data] of Object.entries(BIOMAS_ESPECIALES)) {
        if (data.idRango.includes(tirada)) {
            biomaEspecial = nombre;
            break;
        }
    }

    // 12 = repetir tirada
    if (tirada === 12) {
        return determinarTipoBioma(); // Recursivo
    }

    return {
        esBiomaEspecial: true,
        biomaBase: null,
        biomaEspecial: biomaEspecial,
        necesitaSubBioma: true,
        tiradaD12: tirada
    };
}

/**
 * Determina el sub-bioma con d6
 * @returns {object} { subBioma, tiradaD6 }
 */
function determinarSubBioma() {
    const tirada = lanzarDado("d6");
    const biomasArray = Object.keys(BIOMAS_BASE);
    return {
        subBioma: biomasArray[tirada - 1],
        tiradaD6: tirada
    };
}

/**
 * Fusiona un bioma especial con su sub-bioma
 * @param {string} biomaEspecial - Nombre del bioma especial
 * @param {string} subBioma - Nombre del sub-bioma
 * @returns {object} Bioma fusionado
 */
function fusionarBiomas(biomaEspecial, subBioma) {
    const especial = BIOMAS_ESPECIALES[biomaEspecial];
    const base = BIOMAS_BASE[subBioma];

    // Combinar propiedades (especial + base, sin duplicados)
    const propiedadesCombinadas = [...new Set([
        ...especial.propiedadesCapa,
        ...base.propiedadesBase
    ])];

    // Recursos: base + garantizados del especial
    const recursosCombinados = [...new Set([
        ...base.recursos,
        ...especial.recursosGarantizados
    ])];

    // Exóticos: base + garantizados del especial
    const exoticosCombinados = [...new Set([
        ...base.exoticos,
        ...especial.exoticosGarantizados
    ])];

    // Determinar influencia mágica (la más alta)
    const nivelesMagia = { "Baja": 0, "Media": 1, "Alta": 2 };
    const nivelFinal = Math.max(
        nivelesMagia[especial.influenciaMagica],
        nivelesMagia[base.influenciaMagica]
    );
    const influenciaFinal = Object.keys(nivelesMagia).find(k => nivelesMagia[k] === nivelFinal);

    return {
        nombre: `${biomaEspecial} (${subBioma})`,
        icono: especial.icono,
        iconoSecundario: base.icono,
        propiedades: propiedadesCombinadas,
        recursos: recursosCombinados,
        recursosGarantizados: especial.recursosGarantizados,
        exoticos: exoticosCombinados,
        exoticosGarantizados: especial.exoticosGarantizados,
        dado: base.dado,
        dadoExotico: base.dadoExotico,
        peculiaridadFija: especial.peculiaridadFija,
        dadoPeculiaridades: especial.dadoPeculiaridades,
        influenciaMagica: influenciaFinal,
        descripcion: `${especial.descripcion} sobre ${base.descripcion.toLowerCase()}`
    };
}

/**
 * Obtiene un recurso aleatorio de un bioma (REEMPLAZA el anterior)
 * @param {string[]} recursos - Lista de recursos del bioma
 * @param {string} dado - Tipo de dado
 * @returns {object} { recurso, tirada, abundancia }
 */
function tirarRecurso(recursos, dado) {
    const tirada = lanzarDado(dado);
    const maxDado = parseInt(dado.replace('d', ''), 10);
    const indice = Math.min(tirada - 1, recursos.length - 1);
    const recurso = recursos[indice];

    // Determinar abundancia basada en tirada (Invertido: bajos son comunes/abundantes, altos son raros/escasos)
    let abundancia;
    if (tirada <= Math.floor(maxDado * 0.2)) {
        abundancia = "Abundante";
    } else if (tirada >= Math.ceil(maxDado * 0.8)) {
        abundancia = "Escaso";
    } else {
        abundancia = "Normal";
    }

    return {
        recurso,
        tirada,
        dado,
        abundancia
    };
}

/**
 * Calcula los modificadores de recursos basados en propiedades
 * @param {string[]} propiedades - Propiedades seleccionadas
 * @returns {object} Mapa de recurso -> modificador total
 */
function calcularModificadoresRecursos(propiedades) {
    const modificadores = {};

    propiedades.forEach(propNombre => {
        const prop = PROPIEDADES[propNombre];
        if (!prop || !prop.efectos) return;

        Object.entries(prop.efectos).forEach(([stat, valor]) => {
            // Solo aplicar a stats que son recursos
            if (RECURSOS[stat]) {
                modificadores[stat] = (modificadores[stat] || 0) + valor;
            }
            // Manejar "Cualquier X"
            if (stat.startsWith("Cualquier")) {
                const tipo = stat.replace("Cualquier ", "").toLowerCase();
                Object.keys(RECURSOS).forEach(recurso => {
                    if (recurso.toLowerCase().includes(tipo)) {
                        modificadores[recurso] = (modificadores[recurso] || 0) + valor;
                    }
                });
            }
        });
    });

    return modificadores;
}

/**
 * Convierte nivel de abundancia a modificador numérico
 * @param {string} nivel - Nombre del nivel
 * @returns {number}
 */
function obtenerModificadorAbundancia(nivel) {
    return NIVELES_ABUNDANCIA[nivel]?.modificador ?? 0;
}

// =====================================================
// SISTEMA DE DEVOCIÓN
// =====================================================

/**
 * Tipos de Devoción con sus oposiciones
 * Positiva <-> Negativa
 * Neutral <-> Salvaje
 */
const TIPOS_DEVOCION = {
    "Positiva": {
        icono: "☀️",
        opuesto: "Negativa",
        color: "#ffd700",
        descripcion: "Fe en divinidades celestiales y del orden"
    },
    "Negativa": {
        icono: "🌑",
        opuesto: "Positiva",
        color: "#8b0000",
        descripcion: "Culto a entidades oscuras y caóticas"
    },
    "Neutral": {
        icono: "⚖️",
        opuesto: "Salvaje",
        color: "#708090",
        descripcion: "Veneración del equilibrio y la razón"
    },
    "Salvaje": {
        icono: "🌿",
        opuesto: "Neutral",
        color: "#228b22",
        descripcion: "Respeto a los espíritus de la naturaleza"
    }
};

/**
 * Base de datos de Milagros
 * Estructura: { tipo: { nombreMilagro: { grado, coste, efecto, objetivo?, variable? } } }
 */
const MILAGROS = {
    "Positiva": {
        "Templanza al Herido": {
            grado: 1, coste: 40,
            efecto: "Reduce el daño recibido a la Resolución de un Regimiento durante una batalla.",
            objetivo: "regimiento"
        },
        "Poder y Valor": {
            grado: 1, coste: 30, variable: true,
            efecto: "Otorga +X de Ataque y Defensa a un Regimiento. El coste aumenta con X.",
            objetivo: "regimiento"
        },
        "Curar Enfermedad": {
            grado: 1, coste: 35,
            efecto: "Elimina una enfermedad o maldición menor de la población.",
            objetivo: "asentamiento"
        },
        "Bendición de Cosecha": {
            grado: 2, coste: 50,
            efecto: "+2 a la Producción Agrícola durante 3 turnos.",
            objetivo: "asentamiento"
        },
        "Santuario Protector": {
            grado: 2, coste: 60,
            efecto: "Crea una barrera que otorga +2 Defensa contra Monstruos.",
            objetivo: "asentamiento"
        },
        "Gracia a los Dioses": {
            grado: 3, coste: 80,
            efecto: "Terraforma el bioma del asentamiento a Tierras Consagradas.",
            objetivo: "asentamiento"
        },
        "Resurrección": {
            grado: 3, coste: 100,
            efecto: "Restaura 1 Cuota de población perdida en combate recientemente.",
            objetivo: "asentamiento"
        }
    },
    "Negativa": {
        "Corromper": {
            grado: 1, coste: 40,
            efecto: "Genera +10 de Devoción Negativa en un asentamiento enemigo.",
            objetivo: "asentamiento_enemigo"
        },
        "Agriar": {
            grado: 1, coste: 40,
            efecto: "Destruye hasta 20 medidas de Alimento en el objetivo.",
            objetivo: "asentamiento"
        },
        "Maldición Menor": {
            grado: 1, coste: 30,
            efecto: "Reduce la Calidad del asentamiento enemigo en -2 por 3 turnos.",
            objetivo: "asentamiento_enemigo"
        },
        "Invocar Horror": {
            grado: 2, coste: 55,
            efecto: "Invoca una criatura de pesadilla que ataca un asentamiento.",
            objetivo: "asentamiento_enemigo"
        },
        "Plaga": {
            grado: 2, coste: 65,
            efecto: "Propaga enfermedad: -1 Cuota de población y -3 Calidad por 2 turnos.",
            objetivo: "asentamiento_enemigo"
        },
        "Maledicto Terrenal": {
            grado: 3, coste: 60,
            efecto: "Terraforma el bioma del objetivo a Tierras Malditas.",
            objetivo: "casilla"
        },
        "Despertar No-Muerto": {
            grado: 3, coste: 90,
            efecto: "Convierte 2 Cuotas de población en Cuotas Artificiales No-Muertas.",
            objetivo: "asentamiento"
        }
    },
    "Neutral": {
        "Noble Labor": {
            grado: 1, coste: 40,
            efecto: "Completa instantáneamente una construcción en progreso.",
            objetivo: "construccion"
        },
        "Clarividencia": {
            grado: 1, coste: 25,
            efecto: "Revela información sobre una casilla o asentamiento enemigo.",
            objetivo: "casilla"
        },
        "Pacificar": {
            grado: 1, coste: 35,
            efecto: "Evita un combate inminente, forzando negociación.",
            objetivo: "regimiento"
        },
        "Fantasía": {
            grado: 2, coste: 70,
            efecto: "Aumenta la Capacidad Mágica del asentamiento en +2 permanentemente.",
            objetivo: "asentamiento"
        },
        "Equilibrio Cósmico": {
            grado: 2, coste: 55,
            efecto: "Neutraliza efectos de Sacrilegio por 5 turnos.",
            objetivo: "asentamiento"
        },
        "Juicio Divino": {
            grado: 3, coste: 85,
            efecto: "Elimina todas las bonificaciones de devoción de un asentamiento enemigo.",
            objetivo: "asentamiento_enemigo"
        }
    },
    "Salvaje": {
        "Tránsito Libre": {
            grado: 1, coste: 30,
            efecto: "+2 de Movilidad a todos los Regimientos por 3 turnos.",
            objetivo: "asentamiento"
        },
        "Llamada de la Manada": {
            grado: 1, coste: 35,
            efecto: "Atrae animales: +50% producción de Pieles y Carne por 2 turnos.",
            objetivo: "asentamiento"
        },
        "Comunión Natural": {
            grado: 1, coste: 25,
            efecto: "Revela todos los recursos ocultos en una casilla.",
            objetivo: "casilla"
        },
        "Furia Ancestral": {
            grado: 2, coste: 20, variable: true,
            efecto: "+X de daño masivo a un Regimiento. El coste aumenta con X.",
            objetivo: "regimiento"
        },
        "Muralla de Espinas": {
            grado: 2, coste: 50,
            efecto: "Crea defensas naturales: +3 Defensa en asedios por 3 turnos.",
            objetivo: "asentamiento"
        },
        "Avatar del Bosque": {
            grado: 3, coste: 95,
            efecto: "Invoca un elemental guardian que defiende el asentamiento.",
            objetivo: "asentamiento"
        },
        "Renacer Primigenio": {
            grado: 3, coste: 75,
            efecto: "Restaura un bioma dañado a su estado natural original.",
            objetivo: "casilla"
        }
    }
};

/**
 * Calcula el grado de devoción basado en cuotas de devotos
 * @param {number} cuotasDevotos - Número de cuotas de devotos
 * @returns {number} - Grado de devoción (1, 2 o 3)
 */
function calcularGradoDevocion(cuotasDevotos) {
    if (cuotasDevotos >= 300) return 3;
    if (cuotasDevotos >= 60) return 2;
    return 1;
}

/**
 * Verifica si dos tipos de devoción son opuestos (causan Sacrilegio)
 * @param {string} tipo1 
 * @param {string} tipo2 
 * @returns {boolean}
 */
function sonDevocioneOpuestas(tipo1, tipo2) {
    const t1 = TIPOS_DEVOCION[tipo1];
    const t2 = TIPOS_DEVOCION[tipo2];
    if (!t1 || !t2) return false;
    return t1.opuesto === tipo2 || t2.opuesto === tipo1;
}

// =====================================================
// CATEGORÍAS DE ASPIRACIONES
// =====================================================
const CATEGORIAS_ASPIRACIONES = {
    "administrativa": {
        id: "administrativa",
        nombre: "Administrativa",
        icono: "🏛️",
        color: "#DAA520", // Gold
        descripcion: "Mejoras administrativas y de construcción"
    },
    "militar": {
        id: "militar",
        nombre: "Militar",
        icono: "⚔️",
        color: "#DC143C", // Crimson Red
        descripcion: "Mejoras de combate y defensa"
    },
    "arcana": {
        id: "arcana",
        nombre: "Arcana",
        icono: "🔮",
        color: "#00CED1", // Cyan
        descripcion: "Mejoras mágicas y de hechicería"
    },
    "fe": {
        id: "fe",
        nombre: "Fe",
        icono: "🙏",
        color: "#FFD700", // Yellow
        descripcion: "Mejoras de devoción y religión"
    },
    "artificial": {
        id: "artificial",
        nombre: "Artificial",
        icono: "🤖",
        color: "#20B2AA", // Teal
        descripcion: "Mejoras de seres artificiales"
    }
};

// =====================================================
// ÁRBOL DE ASPIRACIONES
// =====================================================
const ASPIRACIONES = {
    // ========== ADMINISTRATIVA ==========
    "fuerza_administrativa": {
        id: "fuerza_administrativa", categoria: "administrativa",
        nombre: "Fuerza Administrativa", costo: 0, icono: "🏛️",
        descripcion: "+10 de Capacidad Administrativa por Asentamiento.",
        cita: "La burocracia es el mal que nos salva de la barbarie.",
        prerrequisitos: [], efectos: { "CapacidadAdmin": 10 },
        nivel: 0, posicion: { x: 0, y: 0 }
    },
    "plantillas_construccion": {
        id: "plantillas_construccion", categoria: "administrativa",
        nombre: "Plantillas de Construcción", costo: 50, icono: "📐",
        descripcion: "Al comprar una Construcción con Doblones, se construye en 1 Turno.",
        prerrequisitos: ["fuerza_administrativa"], efectos: { "ConstruccionInstantaConDoblones": true },
        nivel: 1, posicion: { x: -1, y: 1 }
    },
    "nueva_vision_adm": {
        id: "nueva_vision_adm", categoria: "administrativa",
        nombre: "Nueva Visión", costo: 100, icono: "👁️",
        descripcion: "Puedes iniciar otra rama de Aspiración.",
        prerrequisitos: ["fuerza_administrativa"], efectos: { "RamaAdicional": 1 },
        nivel: 1, posicion: { x: 0, y: 1 }
    },
    "busqueda_oportunidades": {
        id: "busqueda_oportunidades", categoria: "administrativa",
        nombre: "Búsqueda de Oportunidades", costo: 10, icono: "🔍",
        descripcion: "Puedes Explorar dos veces gratuitamente en lugar de una.",
        prerrequisitos: [], efectos: { "ExploracionesGratis": 2 },
        nivel: 0, posicion: { x: 1, y: 0 }
    },
    "administracion_urbana": {
        id: "administracion_urbana", categoria: "administrativa",
        nombre: "Administración Urbana", costo: 100, icono: "🏙️",
        descripcion: "Puedes decidir negar el Crecimiento Poblacional por Asentamiento. Las Zonas Residenciales otorgan +1 de Calidad adicional.",
        prerrequisitos: ["busqueda_oportunidades"], efectos: { "ControlCrecimiento": true, "BonusZonaResidencial": 1 },
        nivel: 1, posicion: { x: 1, y: 1 }
    },
    "planeacion_estructural": {
        id: "planeacion_estructural", categoria: "administrativa",
        nombre: "Planeación Estructural", costo: 100, icono: "🏗️",
        descripcion: "El coste en Doblones de las Construcciones se reduce en -1 Cuota por cada 5.",
        prerrequisitos: ["plantillas_construccion"], efectos: { "DescuentoConstruccionDoblones": 0.2 },
        nivel: 2, posicion: { x: -1, y: 2 }
    },
    "estructuras_simplificadas": {
        id: "estructuras_simplificadas", categoria: "administrativa",
        nombre: "Estructuras Simplificadas", costo: 200, icono: "🔧",
        descripcion: "Cada 5 Medidas de Mantenimiento en Construcciones, reduces la cantidad de Mantenimiento en -1 Medida de Doblones.",
        prerrequisitos: ["planeacion_estructural"], efectos: { "DescuentoMantenimiento": 0.2 },
        nivel: 2, posicion: { x: 0, y: 2 }
    },
    "expansion_capacidad": {
        id: "expansion_capacidad", categoria: "administrativa",
        nombre: "Expansión de Capacidad", costo: 100, icono: "📦",
        descripcion: "Por cada +10 de producción de Alimentos que poseas, ganas otro +1. Los Almacenes aumentan la Capacidad de Almacenamiento en +10 adicional.",
        prerrequisitos: ["administracion_urbana"], efectos: { "BonusProduccionAlimento": 0.1, "BonusAlmacen": 10 },
        nivel: 2, posicion: { x: 1, y: 2 }
    },
    "atraccion_externa": {
        id: "atraccion_externa", categoria: "administrativa",
        nombre: "Atracción Externa", costo: 100, icono: "🌟",
        descripcion: "Liberación de Lujos: Cada Turno puedes pagar 8 Cuotas de Doblones. Ganas +15 de Inmigración.",
        prerrequisitos: ["administracion_urbana"], efectos: { "OpcionLiberacionLujos": true },
        nivel: 2, posicion: { x: 2, y: 2 }
    },
    "proyectos_expansivos": {
        id: "proyectos_expansivos", categoria: "administrativa",
        nombre: "Proyectos Expansivos", costo: 300, icono: "🏰",
        descripcion: "Adquieres los Diseños de las Construcciones de Atalaya, Castillo y Carretera.",
        prerrequisitos: ["planeacion_estructural"], efectos: { "DesbloquearEdificios": ["Atalaya", "Castillo", "Carretera"] },
        nivel: 3, posicion: { x: -1, y: 3 }
    },
    "deseos_expansion": {
        id: "deseos_expansion", categoria: "administrativa",
        nombre: "Deseos de Expansión", costo: 200, icono: "🌍",
        descripcion: "Plantar Asentamientos cuesta -6 Cuotas de Suministros o -12 Cuotas de Doblones.",
        prerrequisitos: ["estructuras_simplificadas"], efectos: { "DescuentoPlantarAsentamiento": 6 },
        nivel: 3, posicion: { x: 0, y: 3 }
    },
    "programa_alimentacion": {
        id: "programa_alimentacion", categoria: "administrativa",
        nombre: "Programa de Alimentación", costo: 200, icono: "🍽️",
        descripcion: "Facilidad Alimentaria: Duplicas el consumo de Alimentos de tus Poblaciones. Duplicas tu Crecimiento Poblacional.",
        prerrequisitos: ["expansion_capacidad"], efectos: { "OpcionFacilidadAlimentaria": true },
        nivel: 3, posicion: { x: 1, y: 3 }
    },
    "control_migratorio": {
        id: "control_migratorio", categoria: "administrativa",
        nombre: "Control Migratorio", costo: 50, icono: "🚢",
        descripcion: "Reduces el coste de trasladar Cuotas de Poblaciones a la mitad.",
        prerrequisitos: ["atraccion_externa"], efectos: { "DescuentoTraslado": 0.5 },
        nivel: 3, posicion: { x: 2, y: 3 }
    },
    "nueva_vision_adm2": {
        id: "nueva_vision_adm2", categoria: "administrativa",
        nombre: "Nueva Visión", costo: 200, icono: "👁️",
        descripcion: "Puedes iniciar otra rama de Aspiración.",
        prerrequisitos: ["deseos_expansion", "programa_alimentacion"], prerrequisitosMin: 1,
        efectos: { "RamaAdicional": 1 }, nivel: 4, posicion: { x: 0, y: 4 }
    },

    // ========== MILITAR ==========
    "dominacion": {
        id: "dominacion", categoria: "militar",
        nombre: "Dominación", costo: 0, icono: "⚔️",
        descripcion: "Todos tus Asentamientos obtienen +3 de Capacidad de Guarnición.",
        cita: "Esta tierra nos pertenece y lo demostraremos.",
        prerrequisitos: [], efectos: { "CapacidadGuarnicion": 3 },
        nivel: 0, posicion: { x: 0, y: 0 }
    },
    "cria_bestias": {
        id: "cria_bestias", categoria: "militar",
        nombre: "Cría de Bestias", costo: 100, icono: "🐉",
        descripcion: "Obtienes los Diseños de Unidad: Bestia de Carga, Bestia de Asedio, Gran Monstruo.",
        prerrequisitos: [], efectos: { "DesbloquearUnidades": ["Bestia de Carga", "Bestia de Asedio", "Gran Monstruo"] },
        nivel: 0, posicion: { x: 1, y: 0 }
    },
    "nueva_vision_mil": {
        id: "nueva_vision_mil", categoria: "militar",
        nombre: "Nueva Visión", costo: 200, icono: "👁️",
        descripcion: "Puedes iniciar otra rama de Aspiración.",
        prerrequisitos: ["dominacion"], efectos: { "RamaAdicional": 1 },
        nivel: 1, posicion: { x: -1, y: 1 }
    },
    "estructura_militar": {
        id: "estructura_militar", categoria: "militar",
        nombre: "Estructura Militar", costo: 100, icono: "🏰",
        descripcion: "Tus Regimientos ganan +2 de Movilidad en Áreas de Influencia que controlas.",
        prerrequisitos: ["dominacion"], efectos: { "MovilidadAreaInfluencia": 2 },
        nivel: 1, posicion: { x: 0, y: 1 }
    },
    "ingenieria_militar": {
        id: "ingenieria_militar", categoria: "militar",
        nombre: "Ingeniería Militar", costo: 50, icono: "🔩",
        descripcion: "Los Regimientos con la Opción de Diseño Ingenieros Militares pueden construir Trincheras, Caminos, Campamentos.",
        prerrequisitos: ["dominacion"], efectos: { "IngenierosConstructores": true },
        nivel: 1, posicion: { x: 1, y: 1 }
    },
    "propiedad_suministros": {
        id: "propiedad_suministros", categoria: "militar",
        nombre: "Propiedad de Suministros", costo: 400, icono: "📦",
        descripcion: "Ganas +1 de Suministros por cada Cuota de Población empleada en su producción.",
        prerrequisitos: ["cria_bestias"], efectos: { "BonusSuministros": 1 },
        nivel: 1, posicion: { x: 2, y: 1 }
    },
    "eficacia_ejecutiva": {
        id: "eficacia_ejecutiva", categoria: "militar",
        nombre: "Eficacia Ejecutiva", costo: 200, icono: "⚡",
        descripcion: "Reduces en 1 cada 5 de Consumo de Suministros que generen tus Regimientos Desplegados.",
        prerrequisitos: ["estructura_militar"], efectos: { "DescuentoSuministros": 0.2 },
        nivel: 2, posicion: { x: -1, y: 2 }
    },
    "instruccion_militar": {
        id: "instruccion_militar", categoria: "militar",
        nombre: "Instrucción Militar", costo: 300, icono: "🎯",
        descripcion: "Tus Regimientos ganan +1 de Ataque y +1 de Defensa.",
        prerrequisitos: ["estructura_militar"], efectos: { "AtaqueRegimientos": 1, "DefensaRegimientos": 1 },
        nivel: 2, posicion: { x: 0, y: 2 }
    },
    "eficacia_productiva": {
        id: "eficacia_productiva", categoria: "militar",
        nombre: "Eficacia Productiva", costo: 200, icono: "🔄",
        descripcion: "Cada que consumas una Cuota de un Recurso al producir un Regimiento, recibes 2 Medidas de ese Recurso.",
        prerrequisitos: ["ingenieria_militar"], efectos: { "RecuperacionRecursos": 2 },
        nivel: 2, posicion: { x: 1, y: 2 }
    },
    "medicina_aplicada": {
        id: "medicina_aplicada", categoria: "militar",
        nombre: "Medicina Aplicada", costo: 200, icono: "💊",
        descripcion: "Los Regimientos con Médicos de Campo pueden consumir 1 Cuota de Suministros y recuperar 5 de Vitalidad de un Regimiento.",
        prerrequisitos: ["eficacia_ejecutiva"], efectos: { "MedicosCampo": true },
        nivel: 3, posicion: { x: -1, y: 3 }
    },
    "poder_asedio": {
        id: "poder_asedio", categoria: "militar",
        nombre: "Poder de Asedio", costo: 300, icono: "💣",
        descripcion: "Ganas la Opción de Diseño: Explosivos Pesados.",
        prerrequisitos: ["instruccion_militar"], efectos: { "DesbloquearDiseño": "Explosivos Pesados" },
        nivel: 3, posicion: { x: 0, y: 3 }
    },
    "tactica_militar": {
        id: "tactica_militar", categoria: "militar",
        nombre: "Táctica Militar", costo: 600, icono: "📋",
        descripcion: "Tus Regimientos ganan +1 de Ataque y +1 de Defensa.",
        prerrequisitos: ["medicina_aplicada", "poder_asedio"], prerrequisitosMin: 1,
        efectos: { "AtaqueRegimientos": 1, "DefensaRegimientos": 1 }, nivel: 4, posicion: { x: -1, y: 4 }
    },
    "fortaleza": {
        id: "fortaleza", categoria: "militar",
        nombre: "Fortaleza", costo: 600, icono: "🛡️",
        descripcion: "Tus Regimientos ganan +10 de Vitalidad y aumentan su Pérdida de Soldados en +1.",
        prerrequisitos: ["poder_asedio"], efectos: { "VitalidadRegimientos": 10, "PerdidaSoldados": 1 },
        nivel: 4, posicion: { x: 0, y: 4 }
    },
    "tenacidad": {
        id: "tenacidad", categoria: "militar",
        nombre: "Tenacidad", costo: 600, icono: "💪",
        descripcion: "Tus Regimientos ganan +10 de Resolución.",
        prerrequisitos: ["poder_asedio"], efectos: { "ResolucionRegimientos": 10 },
        nivel: 4, posicion: { x: 1, y: 4 }
    },

    // ========== ARCANA ==========
    "enfoque_arcano": {
        id: "enfoque_arcano", categoria: "arcana",
        nombre: "Enfoque Arcano", costo: 0, icono: "🔮",
        descripcion: "+1 de Capacidad Mágica de todos tus Asentamientos.",
        cita: "La magia es la fuerza universal más poderosa y complaciente.",
        prerrequisitos: [], efectos: { "CapacidadMagica": 1 },
        nivel: 0, posicion: { x: 0, y: 0 }
    },
    "nueva_vision_arc": {
        id: "nueva_vision_arc", categoria: "arcana",
        nombre: "Nueva Visión", costo: 200, icono: "👁️",
        descripcion: "Puedes iniciar otra rama de Aspiración.",
        prerrequisitos: [], efectos: { "RamaAdicional": 1 },
        nivel: 0, posicion: { x: 1, y: 0 }
    },
    "catalizadores": {
        id: "catalizadores", categoria: "arcana",
        nombre: "Catalizadores", costo: 200, icono: "💎",
        descripcion: "Adquieres el Diseño de la Construcción: Catalizadores.",
        prerrequisitos: ["enfoque_arcano"], efectos: { "DesbloquearEdificios": ["Catalizadores"] },
        nivel: 1, posicion: { x: -1, y: 1 }
    },
    "guerra_magia": {
        id: "guerra_magia", categoria: "arcana",
        nombre: "Guerra y Magia", costo: 100, icono: "⚡",
        descripcion: "Adquieres el Diseño de la Unidad: Magos de Guerra.",
        prerrequisitos: ["enfoque_arcano"], efectos: { "DesbloquearUnidades": ["Magos de Guerra"] },
        nivel: 1, posicion: { x: 0, y: 1 }
    },
    "escuela_especializada_1": {
        id: "escuela_especializada_1", categoria: "arcana",
        nombre: "Escuela Especializada", costo: 100, icono: "📚",
        descripcion: "Escoge una Escuela de Magia. Ganas +1 a la Canalización para Hechicerías de esa Escuela.",
        prerrequisitos: ["enfoque_arcano"], efectos: { "CanalizacionEscuela": 1 },
        nivel: 1, posicion: { x: 1, y: 1 }
    },
    "infinitas_posibilidades_1": {
        id: "infinitas_posibilidades_1", categoria: "arcana",
        nombre: "Infinitas Posibilidades", costo: 200, icono: "✨",
        descripcion: "Aumentas tus Espacios de Hechicería en +1.",
        prerrequisitos: ["enfoque_arcano"], efectos: { "EspaciosHechiceria": 1 },
        nivel: 1, posicion: { x: 2, y: 1 }
    },
    "ameritismo": {
        id: "ameritismo", categoria: "arcana",
        nombre: "Ameritismo", costo: 200, icono: "🗡️",
        descripcion: "Adquieres las Opciones de Diseño para Unidades: Espadas Encantadas, Cantor de Guerra, Conjuración Extendida.",
        prerrequisitos: ["guerra_magia"], efectos: { "DesbloquearDiseños": ["Espadas Encantadas", "Cantor de Guerra", "Conjuración Extendida"] },
        nivel: 2, posicion: { x: 0, y: 2 }
    },
    "escuela_especializada_2": {
        id: "escuela_especializada_2", categoria: "arcana",
        nombre: "Escuela Especializada 2", costo: 200, icono: "📚",
        descripcion: "Escoge una Escuela de Magia. Ganas +1 a la Canalización para Hechicerías de esa Escuela.",
        prerrequisitos: ["escuela_especializada_1"], efectos: { "CanalizacionEscuela": 1 },
        nivel: 2, posicion: { x: 1, y: 2 }
    },
    "magia_construida": {
        id: "magia_construida", categoria: "arcana",
        nombre: "Magia Construida", costo: 400, icono: "🏛️",
        descripcion: "Adquieres el Diseño de la Construcción: Caldera de Archimagos.",
        prerrequisitos: ["catalizadores"], efectos: { "DesbloquearEdificios": ["Caldera de Archimagos"] },
        nivel: 3, posicion: { x: -1, y: 3 }
    },
    "escuela_especializada_3": {
        id: "escuela_especializada_3", categoria: "arcana",
        nombre: "Escuela Especializada 3", costo: 400, icono: "📚",
        descripcion: "Escoge una Escuela de Magia. Ganas +1 a la Canalización para Hechicerías de esa Escuela.",
        prerrequisitos: ["escuela_especializada_2"], efectos: { "CanalizacionEscuela": 1 },
        nivel: 3, posicion: { x: 1, y: 3 }
    },
    "infinitas_posibilidades_2": {
        id: "infinitas_posibilidades_2", categoria: "arcana",
        nombre: "Infinitas Posibilidades 2", costo: 400, icono: "✨",
        descripcion: "Aumentas tus Espacios de Hechicería en +1.",
        prerrequisitos: ["infinitas_posibilidades_1"], efectos: { "EspaciosHechiceria": 1 },
        nivel: 3, posicion: { x: 2, y: 3 }
    },
    "escuela_especializada_4": {
        id: "escuela_especializada_4", categoria: "arcana",
        nombre: "Escuela Especializada 4", costo: 600, icono: "📚",
        descripcion: "Escoge una Escuela de Magia. Ganas +1 a la Canalización para Hechicerías de esa Escuela.",
        prerrequisitos: ["escuela_especializada_3"], efectos: { "CanalizacionEscuela": 1 },
        nivel: 4, posicion: { x: 0, y: 4 }
    },

    // ========== FE ==========
    "entrega_devocion": {
        id: "entrega_devocion", categoria: "fe",
        nombre: "Entrega a la Devoción", costo: 0, icono: "🙏",
        descripcion: "Cuando una Devoción se Promulgue a Colonos, puedes hacer que se Promulgue a +1.",
        cita: "Tenemos el deber de respetar y amar lo que creemos, pues nadie más lo hará.",
        prerrequisitos: [], efectos: { "BonusPromulgacion": 1 },
        nivel: 0, posicion: { x: 0, y: 0 }
    },
    "apertura_1": {
        id: "apertura_1", categoria: "fe",
        nombre: "Apertura", costo: 100, icono: "📖",
        descripcion: "Aumentas tu máximo de Devoción Acumulada en +10.",
        prerrequisitos: ["entrega_devocion"], efectos: { "MaxDevocion": 10 },
        nivel: 1, posicion: { x: -1, y: 1 }
    },
    "apertura_2": {
        id: "apertura_2", categoria: "fe",
        nombre: "Apertura 2", costo: 100, icono: "📖",
        descripcion: "Aumentas tu máximo de Devoción Acumulada en +10.",
        prerrequisitos: ["entrega_devocion"], efectos: { "MaxDevocion": 10 },
        nivel: 1, posicion: { x: 1, y: 1 }
    },
    "apertura_3": {
        id: "apertura_3", categoria: "fe",
        nombre: "Apertura 3", costo: 300, icono: "📖",
        descripcion: "Aumentas tu máximo de Devoción Acumulada en +30.",
        prerrequisitos: ["apertura_1", "apertura_2"], prerrequisitosMin: 1,
        efectos: { "MaxDevocion": 30 }, nivel: 0, posicion: { x: 0, y: -1 }
    },
    "soldados_fe": {
        id: "soldados_fe", categoria: "fe",
        nombre: "Soldados de la Fe", costo: 200, icono: "⚔️",
        descripcion: "Obtienes los Diseños de Unidad: Guerrero Santo y Clérigo.",
        prerrequisitos: ["apertura_1"], efectos: { "DesbloquearUnidades": ["Guerrero Santo", "Clérigo"] },
        nivel: 2, posicion: { x: -1, y: 2 }
    },
    "nuestra_vision": {
        id: "nuestra_vision", categoria: "fe",
        nombre: "Nuestra Visión", costo: 50, icono: "👁️",
        descripcion: "Requisito: Tener al menos una Devoción entre los Asentamientos que controles. Eliges un tipo de Devoción. Los Edificios que producen Devoción de ese tipo producen +1.",
        prerrequisitos: ["entrega_devocion"], efectos: { "BonusDevocionTipo": 1 },
        nivel: 2, posicion: { x: 0, y: 2 }
    },
    "agentes_verdad": {
        id: "agentes_verdad", categoria: "fe",
        nombre: "Agentes de la Verdad", costo: 200, icono: "📜",
        descripcion: "Puedes Llamar Devotos: Enviados, Agitadores, Inquisidores.",
        prerrequisitos: ["apertura_2"], efectos: { "DesbloquearDevotos": ["Enviados", "Agitadores", "Inquisidores"] },
        nivel: 2, posicion: { x: 1, y: 2 }
    },
    "arsenal_superior": {
        id: "arsenal_superior", categoria: "fe",
        nombre: "Arsenal Superior", costo: 200, icono: "🗡️",
        descripcion: "Obtienes las Opciones Diseños: Juramento del Deber, Juramento del Poder y Predestinado.",
        prerrequisitos: ["soldados_fe"], efectos: { "DesbloquearDiseños": ["Juramento del Deber", "Juramento del Poder", "Predestinado"] },
        nivel: 3, posicion: { x: -1, y: 3 }
    },
    "espada_lengua": {
        id: "espada_lengua", categoria: "fe",
        nombre: "Espada y Lengua", costo: 200, icono: "💬",
        descripcion: "Cuando una Devoción sea Dominante en una Región que controlas, puedes decidir que se Promulgue +2 a los Asentamientos.",
        prerrequisitos: ["nuestra_vision"], efectos: { "BonusPromulgacionDominante": 2 },
        nivel: 3, posicion: { x: 0, y: 3 }
    },
    "nueva_vision_fe": {
        id: "nueva_vision_fe", categoria: "fe",
        nombre: "Nueva Visión", costo: 200, icono: "👁️",
        descripcion: "Puedes iniciar otra rama de Aspiración.",
        prerrequisitos: ["arsenal_superior"], efectos: { "RamaAdicional": 1 },
        nivel: 4, posicion: { x: -1, y: 4 }
    },
    "espada_papel": {
        id: "espada_papel", categoria: "fe",
        nombre: "Espada y Papel", costo: 300, icono: "📜",
        descripcion: "Obtienes el Diseño de Construcción: Cúpula de Curios.",
        prerrequisitos: ["espada_lengua"], efectos: { "DesbloquearEdificios": ["Cúpula de Curios"] },
        nivel: 4, posicion: { x: 0, y: 4 }
    },
    "tierra_prometida": {
        id: "tierra_prometida", categoria: "fe",
        nombre: "Tierra Prometida", costo: 400, icono: "🌟",
        descripcion: "Elige un Asentamiento. Elige una Devoción. Se vuelve Tierra Prometida; la Devoción Dominante de su Área de influencia siempre es la Devoción que elegiste, gana +1 a todos los Recursos y +4 de Calidad.",
        prerrequisitos: ["espada_lengua"], efectos: { "TierraPrometida": true },
        nivel: 4, posicion: { x: 1, y: 4 }
    },

    // ========== ARTIFICIAL ==========
    "maestria_animacion": {
        id: "maestria_animacion", categoria: "artificial",
        nombre: "Maestría de Animación", costo: 0, icono: "🤖",
        descripcion: "Cada tercera Cuota de Población Artificial no consume Doblones.",
        cita: "El trabajo genera desigualdad entre las gentes, pero no entre las no-gentes.",
        prerrequisitos: [], efectos: { "DescuentoArtificiales": 3 },
        nivel: 0, posicion: { x: 0, y: 0 }
    },
    "pensamiento_externo": {
        id: "pensamiento_externo", categoria: "artificial",
        nombre: "Pensamiento Externo", costo: 1, icono: "💡",
        descripcion: "Cada 3 Cuotas de Población Artificial inactiva producen +1 Ideas.",
        prerrequisitos: [], efectos: { "IdeasPorArtificiales": 1 },
        nivel: 0, posicion: { x: 1, y: 0 }
    },
    "nueva_vision_art": {
        id: "nueva_vision_art", categoria: "artificial",
        nombre: "Nueva Visión", costo: 200, icono: "👁️",
        descripcion: "Puedes iniciar otra rama de Aspiración.",
        prerrequisitos: ["maestria_animacion"], efectos: { "RamaAdicional": 1 },
        nivel: 1, posicion: { x: -1, y: 1 }
    },
    "fabricacion_general": {
        id: "fabricacion_general", categoria: "artificial",
        nombre: "Fabricación General", costo: 100, icono: "🏭",
        descripcion: "Obtienes el Diseño de la Construcción: Elisium.",
        prerrequisitos: ["maestria_animacion"], efectos: { "DesbloquearEdificios": ["Elisium"] },
        nivel: 1, posicion: { x: 0, y: 1 }
    },
    "extension_particular": {
        id: "extension_particular", categoria: "artificial",
        nombre: "Extensión Particular", costo: 200, icono: "🔗",
        descripcion: "Los Regimientos Artificiales que controlas pueden alejarse hasta 5 Casillas de tu Área de Influencia.",
        prerrequisitos: ["maestria_animacion"], efectos: { "RangoArtificiales": 5 },
        nivel: 1, posicion: { x: 1, y: 1 }
    },
    "ejercito_forjado": {
        id: "ejercito_forjado", categoria: "artificial",
        nombre: "Ejército Forjado", costo: 200, icono: "⚔️",
        descripcion: "Obtienes el Diseño de Unidad: Soldado Insensible.",
        prerrequisitos: ["fabricacion_general"], efectos: { "DesbloquearUnidades": ["Soldado Insensible"] },
        nivel: 2, posicion: { x: -1, y: 2 }
    },
    "construccion_constante": {
        id: "construccion_constante", categoria: "artificial",
        nombre: "Construcción Constante", costo: 200, icono: "🔧",
        descripcion: "Cada Turno puedes crear tu Calidad positiva como Colonos Artificiales adicionales.",
        prerrequisitos: ["fabricacion_general"], efectos: { "CalidadEnArtificiales": true },
        nivel: 2, posicion: { x: 0, y: 2 }
    },
    "excursion": {
        id: "excursion", categoria: "artificial",
        nombre: "Excursión", costo: 300, icono: "🚀",
        descripcion: "Cada Turno, puedes utilizar 1 de Capacidad Mágica como si estuvieras Canalizando y elegir una Región, creas un pasillo de 5 Casillas de amplitud donde pueden viajar tus Regimientos Artificiales hacia esa Región.",
        prerrequisitos: ["extension_particular"], efectos: { "PasilloArtificiales": 5 },
        nivel: 2, posicion: { x: 1, y: 2 }
    },
    "proyecto_despertar": {
        id: "proyecto_despertar", categoria: "artificial",
        nombre: "Proyecto del Despertar", costo: 300, icono: "⚡",
        descripcion: "Obtienes el Diseño de Construcción: Estrado de Enervación.",
        prerrequisitos: ["construccion_constante"], efectos: { "DesbloquearEdificios": ["Estrado de Enervación"] },
        nivel: 3, posicion: { x: 0, y: 3 }
    },
    "nueva_vision_art2": {
        id: "nueva_vision_art2", categoria: "artificial",
        nombre: "Nueva Visión", costo: 100, icono: "👁️",
        descripcion: "Puedes iniciar otra rama de Aspiración.",
        prerrequisitos: ["excursion"], efectos: { "RamaAdicional": 1 },
        nivel: 3, posicion: { x: 1, y: 3 }
    }
};

// Exportar para uso en otros módulos
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        PROPIEDADES, PECULIARIDADES, GRADOS, TRIBUTOS, RECURSOS,
        BIOMAS_BASE, BIOMAS_ESPECIALES, NIVELES_ABUNDANCIA, INFLUENCIA_MAGICA,
        STATS_INVERTIDAS, esStatInvertida, RECETAS_MANUFACTURA, EDIFICIOS,
        ASPIRACIONES, CATEGORIAS_ASPIRACIONES,
        TIPOS_DEVOCION, MILAGROS, calcularGradoDevocion, sonDevocioneOpuestas,
        lanzarDado, determinarTipoBioma, determinarSubBioma, fusionarBiomas,
        tirarRecurso, calcularModificadoresRecursos, obtenerModificadorAbundancia
    };
}
