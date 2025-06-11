export class Grafo {
  constructor() {
    this.vertices = new Map();  // Garante que vertices é sempre um Map
    this.adjacencia = new Map(); // Garante que adjacencia é sempre um Map
  }

  adicionarVertice(vertice) {
    if (!this.vertices) {
      this.vertices = new Map(); // Defesa adicional
    }
    this.vertices.set(vertice.id, vertice);
    
    if (!this.adjacencia) {
      this.adjacencia = new Map(); // Defesa adicional
    }
    if (!this.adjacencia.has(vertice.id)) {
      this.adjacencia.set(vertice.id, []);
    }
  }

  adicionarRota(rota) {
    if (!this.adjacencia) {
      this.adjacencia = new Map(); // Defesa adicional
    }
    
    const origemId = rota.origem.id;
    if (!this.adjacencia.has(origemId)) {
      this.adjacencia.set(origemId, []);
    }
    this.adjacencia.get(origemId).push(rota);
  }

  obterRotasDe(id) {
    return this.adjacencia.get(id) || [];
  }

  mostrarGrafo() {
    for (const [origemId, rotas] of this.adjacencia.entries()) {
      for (const rota of rotas) {
        console.log(`${rota.origem.nome} -> ${rota.destino.nome} (Capacidade: ${rota.capacidade})`);
      }
    }
  }
}