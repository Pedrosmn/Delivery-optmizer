import React, { useEffect, useMemo, useState } from 'react';
import { MapContainer, TileLayer, Polyline, Marker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';



import { Card, CardContent } from './components/ui/card';
import { Button } from './components/ui/button';
import { Vertice } from './Vertice.js';
import { ZonaEntrega } from './ZonaEntrega.js';
import { Deposito } from './Deposito.js';
import { Hub } from './Hub.js';
import { Rota } from './Rota.js';
import { Grafo } from './Grafo.js';
const API_BASE_URL = "http://127.0.0.1:8000";

L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
});



const loadDataFromCSV = (csvText) => {
  const lines = csvText.split('\n').filter(line => line.trim());
  const newVertices = [];
  const newRotas = [];
  for (let i = 1; i < lines.length; i++) { 
    const [id, tipo, nome, origem, destino, capacidade] = lines[i].split(',');
    if (tipo) newVertices.push({ id, tipo, nome });
    if (origem && destino && capacidade) newRotas.push({ origem, destino, capacidade: parseInt(capacidade) });
  }
  return { vertices: newVertices, rotas: newRotas };
};


class Graph {
  constructor(n) {
    this.n = n;
    this.capacity = Array.from({ length: n }, () => Array(n).fill(0));
    this.adj = Array.from({ length: n }, () => []);
  }

  addEdge(u, v, cap) {
    this.capacity[u][v] += cap;
    this.adj[u].push(v);
    this.adj[v].push(u);
  }

  bfs(s, t, parent) {
    const visited = new Array(this.n).fill(false);
    const queue = [s];
    visited[s] = true;
    parent[s] = -1;

    while (queue.length > 0) {
      const u = queue.shift();

      for (const v of this.adj[u]) {
        if (!visited[v] && this.capacity[u][v] > 0) {
          visited[v] = true;
          parent[v] = u;
          if (v === t) return true;
          queue.push(v);
        }
      }
    }

    return false;
  }

  edmondsKarp(s, t) {
    const parent = new Array(this.n);
    let maxFlow = 0;

    while (this.bfs(s, t, parent)) {
      let pathFlow = Infinity;

      for (let v = t; v !== s; v = parent[v]) {
        const u = parent[v];
        pathFlow = Math.min(pathFlow, this.capacity[u][v]);
      }

      for (let v = t; v !== s; v = parent[v]) {
        const u = parent[v];
        this.capacity[u][v] -= pathFlow;
        this.capacity[v][u] += pathFlow;
      }

      maxFlow += pathFlow;
    }

    return maxFlow;
  }

  getFlowPaths(s, t) {
    const paths = [];
    const parent = new Array(this.n);
    while (this.bfs(s, t, parent)) {
      const path = [];
      let v = t;
      while (v !== s) {
        const u = parent[v];
        path.unshift([u, v]);
        v = u;
      }
      paths.push(path);
      let pathFlow = Infinity;
      for (let [u, v] of path) pathFlow = Math.min(pathFlow, this.capacity[u][v]);
      for (let [u, v] of path) {
        this.capacity[u][v] -= pathFlow;
        this.capacity[v][u] += pathFlow;
      }
    }
    return paths;
  }
}

function maxFlowMultipleSourcesSinks(numNodes, edges, sources, sinks) {
  const superSource = numNodes;
  const superSink = numNodes + 1;
  const g = new Graph(numNodes + 2);

  for (const [u, v, cap] of edges) {
    g.addEdge(u, v, cap);
  }

  for (const s of sources) {
    g.addEdge(superSource, s, Infinity);
  }

  for (const t of sinks) {
    g.addEdge(t, superSink, Infinity);
  }

  return g.edmondsKarp(superSource, superSink);
}

function displayFlowPaths(numNodes, edges, sources, sinks) {
  const superSource = numNodes;
  const superSink = numNodes + 1;
  const g = new Graph(numNodes + 2);

  for (const [u, v, cap] of edges) {
    g.addEdge(u, v, cap);
  }

  for (const s of sources) {
    g.addEdge(superSource, s, Infinity);
  }

  for (const t of sinks) {
    g.addEdge(t, superSink, Infinity);
  }

  const maxFlow = g.edmondsKarp(superSource, superSink);
  const paths = g.getFlowPaths(superSource, superSink);

  return { maxFlow, paths };
}

const initialData = {
  vertices: [
    { id: 'D1', tipo: 'Deposito', nome: 'Centro A' },
    { id: 'H1', tipo: 'Hub', nome: 'Hub Central' },
    { id: 'Z1', tipo: 'ZonaEntrega', nome: 'Zona Norte' },
  ],
  rotas: [
    { origem: 'D1', destino: 'H1', capacidade: 10 },
    { origem: 'H1', destino: 'Z1', capacidade: 7 },
  ],
};

const COORDS = {
  0: { lat: -9.6691, lng: -35.7153 }, // Depósito Principal
  1: { lat: -9.6550, lng: -35.7250 }, // Hub Central
  2: { lat: -9.6450, lng: -35.7050 }, // Zona de Entrega 1
};

export default function App() {
  const [grafo, setGrafo] = useState(new Grafo());
  const [blocked, setBlocked] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [report, setReport] = useState(null);
  const [newRoute, setNewRoute] = useState({ from: '', to: '', capacity: 0, uso: 0 });
  const [editRota, setEditRota] = useState({});
  const [selectedEditRota, setSelectedEditRota] = useState('');

  const toggleBlock = async (from, to) => {
    if (loading) return;
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/network/toggle-block?origem=${from}&destino=${to}`, {
        method: 'POST'
      });
      const data = await response.json();
      if (data.success) {
        setBlocked(prev => 
          prev.includes(data.blocked) ? prev.filter(k => k !== data.blocked) : [...prev, data.blocked]
        );
      }
    } catch (err) {
      setError('Erro ao atualizar a rota. Tente novamente.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleEditRota = (aresta_id, field, value) => {
  setEditRota((prev) => ({
    ...prev,
    [aresta_id]: {
      ...prev[aresta_id],
      [field]: value,
    },
  }));
};

  const saveEditRota = async (aresta) => {
    if (!aresta.aresta_id) {
      setError('Só é possível editar rotas já persistidas no backend.');
      return;
    }
    setLoading(true);
    try {
      const edit = editRota[aresta.aresta_id] || {};
      const payload = {
        origem_id: aresta.origem.id,
        destino_id: aresta.destino.id,
        capacidade: aresta.capacidade,
        uso: edit.uso !== undefined ? Number(edit.uso) : aresta.uso,
        priority: edit.priority !== undefined ? Number(edit.priority) : aresta.priority,
      };
      await fetch(`${API_BASE_URL}/arestas/${aresta.aresta_id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      setEditRota((prev) => {
        const copy = { ...prev };
        delete copy[aresta.aresta_id];
        return copy;
      });
      await fetchCurrentState();
    } catch (err) {
      setError('Erro ao editar rota. Tente novamente.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const increaseDemand = async (nodeId) => {
    if (loading) return;
    setLoading(true);
    try {
      // Encode o nodeId para URL
      const encodedNodeId = encodeURIComponent(nodeId);
      const response = await fetch(
        `${API_BASE_URL}/network/increase-demand?node_id=${encodedNodeId}`, 
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          }
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Erro ao aumentar demanda');
      }

      const data = await response.json();
      
      if (data.success) {
        // Atualizar o estado local
        const newGrafo = new Grafo();
        newGrafo.vertices = new Map(grafo.vertices);
        newGrafo.adjacencia = new Map();

        // Copiar a estrutura existente
        grafo.adjacencia.forEach((rotas, origemId) => {
          newGrafo.adjacencia.set(origemId, [...rotas]);
        });

        // Atualizar capacidades conforme a API
        data.updated_edges.forEach(edge => {
          newGrafo.adjacencia.forEach(rotas => {
            rotas.forEach(rota => {
              if (rota.destino.id === nodeId) {
                rota.capacidade += 5;
              }
            });
          });
        });

        setGrafo(newGrafo);
      }
    } catch (err) {
      setError(err.message || 'Erro ao aumentar demanda. Tente novamente.');
      console.error('Erro detalhado:', err);
    } finally {
      setLoading(false);
    }
  };

  const generateReport = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/relatorio-automatico`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ blocked }),
      });
      const reportData = await response.json();
      setReport({
        bottlenecks: reportData.bottlenecks,
        idleCapacity: reportData.idle_capacity,
        timestamp: new Date(reportData.timestamp).toLocaleString(),
        maxFlow: reportData.max_flow,
        flowPaths: reportData.flow_paths,
      });
    } catch (err) {
      setError('Erro ao gerar relatório automático.');
      setReport(null);
    } finally {
      setLoading(false);
    }
  };

const fetchCurrentState = async () => {
  try {
    const response = await fetch(`${API_BASE_URL}/network/current-state`);
    const data = await response.json();
    const g = new Grafo();
    const verticesMap = new Map();

    // Adiciona vértices
    (data.grafo.vertices || []).forEach(v => {
      let vertice;
      switch (v.tipo) {
        case 'storage': vertice = new Deposito(v.id, v.nome); break;
        case 'hub': vertice = new Hub(v.id, v.nome); break;
        case 'delivery_zone': vertice = new ZonaEntrega(v.id, v.nome); break;
        default: vertice = new Vertice(v.id, v.nome);
      }
      verticesMap.set(v.id, vertice);
      g.adicionarVertice(vertice);
    });

    (data.grafo.rotas || []).forEach(r => {
      const origem = verticesMap.get(r.origem);
      const destino = verticesMap.get(r.destino);
      if (origem && destino) {
        g.adicionarRota(
          new Rota(
            origem,
            destino,
            r.capacidade,
            r.uso !== undefined ? r.uso : 0,
            r.aresta_id !== undefined ? r.aresta_id : undefined,
            r.priority !== undefined ? r.priority : 1
          )
        );
      }
    });

    setGrafo(g);
  } catch (err) {
    setError('Erro ao atualizar estado da rede.');
  }
};

  const addNewRoute = async () => {
    if (
      loading ||
      newRoute.from === '' ||
      newRoute.to === '' ||
      isNaN(newRoute.from) ||
      isNaN(newRoute.to) ||
      newRoute.capacity <= 0
    ) {
      console.log('Botão não faz nada: campos obrigatórios não preenchidos');
      return;
    }
    setLoading(true);
    try {
      console.log('Enviando rota:', newRoute);
      const response = await fetch(`${API_BASE_URL}/network/add-route`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          origem_id: parseInt(newRoute.from, 10),
          destino_id: parseInt(newRoute.to, 10),
          capacidade: newRoute.capacity,
          uso: newRoute.uso || 0,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Erro ao adicionar rota');
      }

      const data = await response.json();
      if (data.success) {
        await fetchCurrentState(); // Atualize o grafo após adicionar rota
        setNewRoute({ from: '', to: '', capacity: 0 });
      }
    } catch (err) {
      setError('Erro ao adicionar nova rota.');
    } finally {
      setLoading(false);
    }
  };

  const polylineData = useMemo(() => {
    const data = [];
    grafo.adjacencia.forEach((rotas) => {
      rotas.forEach((rota) => {
        const fromNode = COORDS[rota.origem.id];
        const toNode = COORDS[rota.destino.id];
        if (fromNode && toNode) {
          const key = `${rota.origem.id}-${rota.destino.id}`;
          const isBlocked = blocked.includes(key);
          const color = isBlocked ? 'red' : rota.capacidade > 10 ? 'orange' : 'green';
          const weight = Math.min(rota.capacidade * 2, 15);
          data.push({
            positions: [
              [fromNode.lat, fromNode.lng],
              [toNode.lat, toNode.lng]
            ],
            pathOptions: { color, weight }
          });
        }
      });
    });
    return data;
  }, [grafo, blocked]);

  useEffect(() => {
    const interval = setInterval(() => {
      if (!loading) {
        try {
          const rotas = Array.from(grafo.adjacencia.values()).flat();
          if (rotas.length > 0) {
            const randomRota = rotas[Math.floor(Math.random() * rotas.length)];
            if (randomRota && randomRota.origem && randomRota.destino) {
              toggleBlock(randomRota.origem.id, randomRota.destino.id);
              generateReport();
            } else {
              console.warn('Rota inválida detectada na atualização automática.');
            }
          } else {
            console.warn('Nenhuma rota disponível para atualização automática.');
          }
        } catch (err) {
          setError(`Erro na atualização automática da rede: ${err.message}`);
          console.error(err);
        }
      }
    }, 5000);
    return () => clearInterval(interval);
  }, [grafo, toggleBlock, loading]);

  const resetNetwork = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/network/reset`, {
        method: 'POST'
      });
      const data = await response.json();
      
      if (data.success) {
        await fetchCurrentState()
        // Resetar todos os estados
        setBlocked([]);
        setReport(null);
        setNewRoute({ from: '', to: '', capacity: 0 });
        setError(null);
      }
    } catch (err) {
      setError('Erro ao resetar a rede. Tente novamente.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const validarIntegridade = () => {
    const conectados = new Set();
    grafo.adjacencia.forEach((rotas) => {
      rotas.forEach((rota) => {
        conectados.add(rota.origem.id);
        conectados.add(rota.destino.id);
        if (rota.capacidade <= 0) {
          console.warn(`Capacidade inválida entre ${rota.origem.nome} e ${rota.destino.nome}`);
        }
      });
    });
    grafo.vertices.forEach((vertice, id) => {
      if (!conectados.has(id)) {
        console.warn(`Vértice isolado: ${vertice.nome} (${id})`);
      }
    });
    console.log('Validação concluída.');
  };

  useEffect(() => {
    const loadInitialData = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/network/current-state`);
        const data = await response.json();
        const g = new Grafo();
        const verticesMap = new Map();
        (data.grafo.vertices || []).forEach(v => {
          let vertice;
          switch (v.tipo) {
            case 'storage': vertice = new Deposito(v.id, v.nome); break;
            case 'hub': vertice = new Hub(v.id, v.nome); break;
            case 'delivery_zone': vertice = new ZonaEntrega(v.id, v.nome); break;
            default: vertice = new Vertice(v.id, v.nome);
          }
          verticesMap.set(v.id, vertice);
          g.adicionarVertice(vertice);
        });
        (data.grafo.rotas || []).forEach(r => {
          const origem = verticesMap.get(r.origem);
          const destino = verticesMap.get(r.destino);
          if (origem && destino) {
            g.adicionarRota(
              new Rota(
                origem,
                destino,
                r.capacidade,
                r.uso !== undefined ? r.uso : 0,
                r.aresta_id !== undefined ? r.aresta_id : undefined,
                r.priority !== undefined ? r.priority : 1
              )
            );
          }
        });
        setGrafo(g);
      } catch (err) {
        console.error("Erro ao carregar dados:", err);
        setError("Falha ao carregar dados iniciais");
      }
    };
    loadInitialData();
  }, []);

  // Função para teste de stress
  const runStressTest = () => {
    setLoading(true);
    try {
      const bigN = 100;
      const bigE = 200;
      const bigEdges = Array.from({ length: bigE }, () => {
        const u = Math.floor(Math.random() * bigN);
        const v = Math.floor(Math.random() * bigN);
        return [u, v, Math.floor(Math.random() * 20) + 1];
      });
      const bigSources = [0, 1];
      const bigSinks = [bigN - 1, bigN - 2];
      const startTime = performance.now();
      const flow = maxFlowMultipleSourcesSinks(bigN, bigEdges, bigSources, bigSinks);
      const endTime = performance.now();
      console.log(`Stress Test - Max Flow: ${flow}, Tempo: ${(endTime - startTime) / 1000} segundos`);
    } catch (err) {
      setError('Erro no teste de stress.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="grid grid-cols-1 gap-4 p-4">
      {error && (
        <div className="text-red-500 mb-4">
          {error}
          <button onClick={() => setError(null)} className="ml-2 underline">
            Fechar
          </button>
        </div>
      )}
      <Card>
        <CardContent>
          <h2 className="text-xl font-bold mb-2">Rede de Entregas</h2>
          <MapContainer
            center={[-9.6567, -35.7150]} // Centro aproximado dos pontos
            zoom={14}
            scrollWheelZoom={false}
            style={{ height: '500px', width: '100%' }}
          >
            <TileLayer
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              attribution="© OpenStreetMap contributors"
            />
            {Array.from(grafo.vertices.values()).map((node) => (
              <Marker key={node.id} position={[COORDS[node.id].lat, COORDS[node.id].lng]}>
                <Popup>
                  <strong>{node.nome}</strong>
                </Popup>
              </Marker>
            ))}
            {polylineData.map((data, idx) => (
  <Polyline key={idx} positions={data.positions} pathOptions={data.pathOptions} />
))}
          </MapContainer>
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold">Simulador de Cenários</h3>
            <Button variant="outline" onClick={resetNetwork} disabled={loading}>
              Reiniciar Rede
            </Button>
          </div>
          <div className="mb-4">
            <h4 className="text-md font-semibold mb-2">Aumentar Demanda</h4>
            {Array.from(grafo.vertices.values()).map((node) => (
              <Button
                key={node.id}
                onClick={() => increaseDemand(node.id)}
                disabled={loading}
                className="mr-2 mb-2"
              >
                Aumentar Demanda em {node.nome}
              </Button>
            ))}
          </div>
          <div className="mb-4">
            <h4 className="text-md font-semibold mb-2">Adicionar Nova Rota</h4>
            <select
              value={newRoute.from}
              onChange={(e) => setNewRoute({ ...newRoute, from: parseInt(e.target.value, 10) })}
              disabled={loading}
              className="mr-2 p-1 border"
            >
              <option value="">Selecione Origem</option>
              {Array.from(grafo.vertices.values()).map((node) => (
                <option key={node.id} value={node.id}>
                  {node.nome}
                </option>
              ))}
            </select>
            <select
              value={newRoute.to}
              onChange={(e) => setNewRoute({ ...newRoute, to: parseInt(e.target.value, 10) })}
              disabled={loading}
              className="mr-2 p-1 border"
            >
              <option value="">Selecione Destino</option>
              {Array.from(grafo.vertices.values()).map((node) => (
                <option key={node.id} value={node.id}>
                  {node.nome}
                </option>
              ))}
            </select>
            <span className="mr-1">Capacidade:</span>
            <input
              type="number"
              value={newRoute.capacity}
              onChange={(e) => setNewRoute({ ...newRoute, capacity: parseInt(e.target.value, 10) || 0 })}
              placeholder="Capacidade"
              disabled={loading}
              className="mr-2 p-1 border"
            />

            <span>Uso:</span>
            <input
              type="number"
              value={newRoute.uso || 0}
              onChange={(e) => setNewRoute({ ...newRoute, uso: parseInt(e.target.value) || 0 })}
              placeholder="Uso"
              disabled={loading}
              className="p-1 border w-24"
            />
            <Button onClick={addNewRoute} disabled={loading} className="ml-2">
              Adicionar Rota
            </Button>
          </div>
          
          <div className="mb-4">
            <h4 className="text-md font-semibold mb-2">Editar Rota Existente</h4>
              <select
                value={selectedEditRota}
                onChange={e => setSelectedEditRota(e.target.value)}
                className="mr-2 p-1 border"
                disabled={loading}
              >
                <option value="">Selecione a Rota</option>
                {Array.from(grafo.adjacencia.values()).flat().map((rota, idx) => (
                  <option
                    key={rota.aresta_id !== undefined ? rota.aresta_id : `${rota.origem.id}-${rota.destino.id}-${idx}`}
                    value={rota.aresta_id !== undefined ? rota.aresta_id : `${rota.origem.id}-${rota.destino.id}-${idx}`}
                  >
                    {typeof rota.origem === 'object'
  ? rota.origem.nome
  : grafo.vertices.get(String(rota.origem))?.nome || rota.origem}
→
{typeof rota.destino === 'object'
  ? rota.destino.nome
  : grafo.vertices.get(String(rota.destino))?.nome || rota.destino}
                  </option>
                ))}
              </select>
              {selectedEditRota && (() => {
                const rotasList = Array.from(grafo.adjacencia.values()).flat();
                const rota = rotasList.find((r, idx) => {
                  const key = r.aresta_id !== undefined ? String(r.aresta_id) : `${r.origem.id}-${r.destino.id}-${idx}`;
                  return key === selectedEditRota;
                });
              if (!rota) return null;
              return (
                <div className="flex items-center mt-2 gap-2">
                  <span>
                    {typeof rota.origem === 'object'
  ? rota.origem.nome
  : grafo.vertices.get(String(rota.origem))?.nome || rota.origem}
→
{typeof rota.destino === 'object'
  ? rota.destino.nome
  : grafo.vertices.get(String(rota.destino))?.nome || rota.destino}
                  </span>
                  <span>Uso:</span>
                  <input
                    type="number"
                    value={
                      editRota[selectedEditRota]?.uso !== undefined
                        ? editRota[selectedEditRota].uso
                        : rota.uso || 0
                    }
                    min={0}
                    onChange={(e) => handleEditRota(selectedEditRota, 'uso', e.target.value)}
                    className="p-1 border w-16"
                    disabled={loading}
                  />
                  <span>Prioridade:</span>
                  <input
                    type="number"
                    value={
                      editRota[selectedEditRota]?.priority !== undefined
                        ? editRota[selectedEditRota].priority
                        : rota.priority || 1
                    }
                    min={1}
                    max={5}
                    onChange={(e) => handleEditRota(selectedEditRota, 'priority', e.target.value)}
                    className="p-1 border w-16"
                    disabled={loading}
                  />
                  <Button
                    onClick={() => saveEditRota(rota)}
                    disabled={loading}
                    className="ml-2"
                  >
                    Salvar
                  </Button>
                </div>
              );
            })()}
          </div>


            {Array.from(grafo.adjacencia.entries()).flatMap(([_, rotas], origemIdx) =>
              rotas.map((rota, rotaIdx) => (
                <div key={rota.aresta_id || `${rota.origem.id}-${rota.destino.id}-${rotaIdx}`} className="flex items-center gap-2 mb-1">
                  <span>
                    {typeof rota.origem === 'object'
                      ? rota.origem.nome
                      : grafo.vertices.get(String(rota.origem))?.nome || rota.origem}
                    {' → '}
                    {typeof rota.destino === 'object'
                      ? rota.destino.nome
                      : grafo.vertices.get(String(rota.destino))?.nome || rota.destino}
                    {' | '}
                    <strong>Capacidade:</strong> {rota.capacidade}
                    {' | '}
                    <strong>Uso:</strong> {rota.uso ?? 0}
                  </span>
                  <Button
                    size="xs"
                    variant="outline"
                    onClick={() => toggleBlock(rota.origem.id ?? rota.origem, rota.destino.id ?? rota.destino)}
                    disabled={loading}
                  >
                    {blocked.includes(`${rota.origem.id ?? rota.origem}-${rota.destino.id ?? rota.destino}`) ? 'Desbloquear' : 'Bloquear'}
                  </Button>
                </div>
              ))
            )}
          <div className="mt-4">
            <Button onClick={runStressTest} disabled={loading} className="mr-2 mb-2">
              Teste de Stress
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          <h3 className="text-lg font-semibold mb-2">Relatório Automático</h3>
          {report ? (
            <div>
              <p>
                <strong>Data:</strong> {report.timestamp}
              </p>
              <p>
                <strong>Gargalos (Capacidade > 10):</strong>
              </p>
              <ul>
                {(report.bottlenecks || []).map((rota, idx) => (
                  <li key={idx}>
                    {typeof rota.origem === 'object'
  ? rota.origem.nome
  : grafo.vertices.get(String(rota.origem))?.nome || rota.origem}
→
{typeof rota.destino === 'object'
  ? rota.destino.nome
  : grafo.vertices.get(String(rota.destino))?.nome || rota.destino}
                  </li>
                ))}
                {(report.bottlenecks || []).length === 0 && <li>Nenhum gargalo detectado.</li>}
              </ul>
              <p>
                <strong>Capacidade Ociosa (Capacidade &lt; 7):</strong>
              </p>
              <ul>
                {(report.idleCapacity || []).map((rota, idx) => (
                  <li key={idx}>
                    {typeof rota.origem === 'object'
  ? rota.origem.nome
  : grafo.vertices.get(String(rota.origem))?.nome || rota.origem}
→
{typeof rota.destino === 'object'
  ? rota.destino.nome
  : grafo.vertices.get(String(rota.destino))?.nome || rota.destino}
                  </li>
                ))}
                {(report.idleCapacity || []).length === 0 && <li>Nenhuma capacidade ociosa detectada.</li>}
              </ul>
              <p>
                <strong>Fluxo Máximo Total:</strong> {report.maxFlow}
              </p>
              <p>
                <strong>Caminhos de Fluxo:</strong>
              </p>
              <ul>
                {(report.flowPaths || []).map((path, idx) => (
                  <li key={idx}>
                    Caminho {idx + 1}: {path.map(([u, v]) => {
                      const nodeU = Array.from(grafo.vertices.values())[u];
                      const nodeV = Array.from(grafo.vertices.values())[v];
                      return `${nodeU?.nome || u} -> ${nodeV?.nome || v}`;
                    }).join(' -> ')}
                  </li>
                ))}
                {report.flowPaths.length === 0 && <li>Nenhum caminho de fluxo detectado.</li>}
              </ul>
            </div>
          ) : (
            <p>Relatório será gerado automaticamente...</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          <h3 className="text-lg font-semibold mb-2">Legenda</h3>
          <ul>
            <li><span style={{ color: 'green' }}>●</span> Capacidade normal (≤ 10)</li>
            <li><span style={{ color: 'orange' }}>●</span> Gargalo (> 10)</li>
            <li><span style={{ color: 'red' }}>●</span> Bloqueada</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}