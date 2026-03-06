/**
 * Utilidades para calcular promedios finales según las 
 * reglas definidas en el SIE (Sistema Institucional de Evaluación).
 */

/**
 * Calcula el promedio final de una materia basándose en los periodos cursados y su peso porcentual.
 * @param {Array} notasPeriodos - Array de objetos { nota: numero, peso_porcentual: numero }
 * @returns {number} Promedio ponderado final
 */
function calcularPromedioPonderado(notasPeriodos) {
    if (!notasPeriodos || notasPeriodos.length === 0) return 0;

    let sumaPonderada = 0;
    let pesoAcumulado = 0;

    notasPeriodos.forEach(p => {
        // Si la nota existe (no es nula)
        if (p.nota !== null && p.nota !== undefined) {
            sumaPonderada += p.nota * (p.peso_porcentual / 100);
            pesoAcumulado += (p.peso_porcentual / 100);
        }
    });

    // Ajustar si no se han completado todos los periodos (ej. vamos a mitad de año)
    if (pesoAcumulado === 0) return 0;

    const promedioAcumulado = sumaPonderada / pesoAcumulado;
    return parseFloat(promedioAcumulado.toFixed(2));
}

/**
 * Determina la escala valorativa (ej. Bajo, Básico, Alto, Superior)
 * basándose en la nota obtenida.
 * @param {number} nota - Nota obtenida
 * @param {Array} escalas - Array de configuración de escalas { nombre, rango_min, rango_max }
 * @returns {string} Nombre de la escala correspondiente
 */
function obtenerEscalaValorativa(nota, escalas) {
    if (!escalas || escalas.length === 0) return 'Sin Definir';

    const escalaEncontrada = escalas.find(e => nota >= e.rango_min && nota <= e.rango_max);
    return escalaEncontrada ? escalaEncontrada.nombre : 'Fuera de Rango';
}

module.exports = {
    calcularPromedioPonderado,
    obtenerEscalaValorativa
};
