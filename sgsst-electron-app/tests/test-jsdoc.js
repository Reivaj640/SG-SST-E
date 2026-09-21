/**
 * @fileoverview Ejemplo de archivo con JSDoc para pruebas
 */

/**
 * Suma dos números
 * @param {number} a - El primer número
 * @param {number} b - El segundo número
 * @returns {number} La suma de los dos números
 */
function sum(a, b) {
  return a + b;
}

/**
 * Representa una clase de ejemplo para pruebas de JSDoc
 */
class Calculator {
  /**
   * Crea una calculadora
   * @param {string} name - El nombre de la calculadora
   */
  constructor(name) {
    this.name = name;
  }

  /**
   * Multiplica dos números
   * @param {number} a - El primer número
   * @param {number} b - El segundo número
   * @returns {number} El producto de los dos números
   */
  multiply(a, b) {
    return a * b;
  }
}