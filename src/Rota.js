import { Vertice } from './Vertice';

export class Rota {
  constructor(origem, destino, capacidade, uso = 0, aresta_id = undefined, priority = 1) {
    this.origem = origem;
    this.destino = destino;
    this.capacidade = capacidade;
    this.uso = uso;
    this.aresta_id = aresta_id;
    this.priority = priority;
  }
}