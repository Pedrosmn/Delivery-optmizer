from enum import IntEnum, Enum
from typing import List, Optional
from fastapi import FastAPI, Path, HTTPException, Query, Response, Request
from pydantic import BaseModel, Field
from collections import deque, defaultdict
from datetime import datetime
from fastapi.middleware.cors import CORSMiddleware
from fastapi import Body
import logging
from typing import List, Optional

logger = logging.getLogger(__name__)

# Inicialização do FastAPI
api = FastAPI()


# Configuração do CORS
origins = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://localhost",
    "http://127.0.0.1",
    "http://0.0.0.0:3000",
]

api.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"]
)

#Funções de fluxo máximo

def build_graph(arestas):
    graph = defaultdict(dict)
    for aresta in arestas:
        graph[aresta.origem_id][aresta.destino_id] = aresta.capacidade
    return graph

def bfs(graph, source, sink, parent):
    visited = set()
    queue = deque([source])
    visited.add(source)
    while queue:
        u = queue.popleft()
        for v, capacity in graph[u].items():
            if v not in visited and capacity > 0:
                parent[v] = u
                if v == sink:
                    return True
                visited.add(v)
                queue.append(v)
    return False

def edmonds_karp(graph, source, sink):
    parent = {}
    max_flow = 0
    while bfs(graph, source, sink, parent):
        path_flow = float('inf')
        s = sink
        while s != source:
            path_flow = min(path_flow, graph[parent[s]][s])
            s = parent[s]
        max_flow += path_flow
        v = sink
        while v != source:
            u = parent[v]
            graph[u][v] -= path_flow
            graph[v].setdefault(u, 0)
            graph[v][u] += path_flow
            v = parent[v]
    return max_flow


# Modelagem das Arestas e Vertices

class Priority(IntEnum):
    LOW = 3
    MEDIUM = 2
    HIGH = 1

class VerticeBase(BaseModel):
    name: str = Field(..., description="Nome do vertice")
    type: str = Field(..., description="Tipo do vertice (hub, storage, delivery_zone)")

class VerticeCreate(VerticeBase):
    pass

class Vertice(VerticeBase):
    vertice_id: int = Field(..., description="ID do vertice")

class VerticeUpdate(VerticeBase):
    name: Optional[str] = Field(None, description="Nome do vertice")
    type: Optional[str] = Field(None, description="Tipo do vertice (hub, storage, delivery_zone)")

class ArestaBase(BaseModel):
    origem_id: int = Field(..., description="ID do vertice de origem")
    destino_id: int = Field(..., description="ID do vertice de destino")
    capacidade: int = Field(..., description="Capacidade da aresta")
    uso: Optional[int] = Field(default=0, description="Uso atual da aresta")
    priority: Priority = Field(default=Priority.LOW, description="Prioridade da aresta")

class ArestaCreate(ArestaBase):
    pass

class Aresta(ArestaBase):
    aresta_id: int = Field(..., description="ID da aresta")

class ArestaUpdate(ArestaBase):
    capacidade: Optional[int] = Field(None, description="Capacidade da aresta")
    uso: Optional[int] = Field(None, description="Uso atual da aresta")
    priority: Optional[Priority] = Field(None, description="Prioridade da aresta")



class NetworkAnalysisRequest(BaseModel):
    vertices: List[dict]
    rotas: List[dict]
    blocked_routes: List[str] = []

class NetworkAnalysisResponse(BaseModel):
    bottlenecks: List[dict]
    idle_capacity: List[dict]
    max_flow: int
    flow_paths: List[List[tuple]]
    timestamp: str

class RouteOperationRequest(BaseModel):
    origem_id: int
    destino_id: int
    capacidade: int
    uso: int = 0


class CurrentStateResponse(BaseModel):
    vertices: List[Vertice]
    arestas: List[Aresta]
    grafo: dict


# Inicialização dos dados
'''
vertices = [
    Vertice(vertice_id=0, name="Deposito", type= "storage"),
    Vertice(vertice_id=1, name= "Hub",type= "hub"),
    Vertice(vertice_id=2, name= "Zona 1",type= "delivery_zone"),
    Vertice(vertice_id=3, name= "Zona 2",type= "delivery_zone"),
    Vertice(vertice_id=4, name= "Zona 3",type= "delivery_zone"),
    Vertice(vertice_id=5, name= "Hhub 2",type= "hub")
    ]

arestas = [
    Aresta(aresta_id=0, origem_id=0, destino_id=1, capacidade=100, uso=0, priority=Priority.LOW),
    Aresta(aresta_id=0, origem_id=0, destino_id=1, capacidade=50, uso=0, priority=Priority.LOW),
    Aresta(aresta_id=0, origem_id=0, destino_id=5, capacidade=75, uso=0, priority=Priority.LOW),
    Aresta(aresta_id=3, origem_id=1, destino_id=4, capacidade=60, uso=0, priority=Priority.HIGH),
    Aresta(aresta_id=4, origem_id=5, destino_id=3, capacidade=80, uso=0, priority=Priority.MEDIUM),
]
'''


vertices: List[Vertice] = [
    Vertice(vertice_id=0, name="Depósito Principal", type="storage"),
    Vertice(vertice_id=1, name="Hub Central", type="hub"),
    Vertice(vertice_id=2, name="Zona de Entrega 1", type="delivery_zone")
]
arestas: List[Aresta] = []
#CRUD dos Vertices

@api.get("/vertices/{vertice_id}", response_model=Vertice)
def get_vertice(vertice_id: int = Path(..., description="O ID do vertice que deseja buscar")):
    for vertice in vertices:
        if vertice.vertice_id == vertice_id:
            return vertice
        
    raise HTTPException(status_code=404, detail="Vertice não encontrado")

@api.get("/vertices", response_model=List[Vertice])
def get_all_vertices(first_n: int = None):
    if first_n:
        return vertices[:first_n]
    else:
        return vertices
    
@api.post("/vertices", response_model=Vertice)
def create_vertice(vertice: VerticeCreate):
    new_vertice_id = max(v.vertice_id for v in vertices) + 1 if vertices else 0

    new_vertice = Vertice(vertice_id=new_vertice_id, name=vertice.name, type=vertice.type)

    vertices.append(new_vertice)

    return new_vertice

@api.put("/vertices/{vertice_id}", response_model=Vertice)
def update_vertice(vertice_id: int, updated_vertice: VerticeUpdate):
    for v in vertices:
        if v.vertice_id == vertice_id:
            if updated_vertice.name is not None:
                v.name = updated_vertice.name
            if updated_vertice.type is not None:
                v.type = updated_vertice.type
            
            return v
    raise HTTPException(status_code=404, detail="Vertice não encontrado")

@api.delete("/vertices/{vertice_id}", response_model=List[Vertice])
def delete_vertice(vertice_id: int):
    global vertices
    vertices = [v for v in vertices if v.vertice_id != vertice_id]
    return vertices

#CRUD das Arestas

@api.get("/arestas/{aresta_id}", response_model=Aresta)
def get_aresta(aresta_id: int = Path(..., description="O ID da aresta que deseja buscar")):
    for aresta in arestas:
        if aresta.aresta_id == aresta_id:
            return aresta
        
    raise HTTPException(status_code=404, detail="Aresta não encontrada")

@api.get("/arestas", response_model=List[Aresta])
def get_all_arestas(first_n: int = None):
    if first_n:
        return arestas[:first_n]
    else:
        return arestas
    
@api.post("/arestas", response_model=Aresta)
def create_aresta(aresta: ArestaCreate):
    new_aresta_id = max(v.aresta_id for v in arestas) + 1 if arestas else 0

    new_aresta = Aresta(
        aresta_id=new_aresta_id,
        origem_id=aresta.origem_id,
        destino_id=aresta.destino_id,
        capacidade=aresta.capacidade,
        uso=aresta.uso,
        priority=aresta.priority)

    arestas.append(new_aresta)

    return new_aresta

@api.put("/arestas/{aresta_id}", response_model=Aresta)
def update_aresta(aresta_id: int, updated_aresta: ArestaUpdate):
    for a in arestas:
        if a.aresta_id == aresta_id:
            if updated_aresta.capacidade is not None:
                a.capacidade = updated_aresta.capacidade
            if updated_aresta.uso is not None:
                a.uso = updated_aresta.uso
            if updated_aresta.priority is not None:
                a.priority = updated_aresta.priority
            
            return a
    raise HTTPException(status_code=404, detail="Aresta não encontrada")

@api.delete("/arestas/{aresta_id}", response_model=List[Aresta])
def delete_aresta(aresta_id: int):
    global arestas
    arestas = [a for a in arestas if a.aresta_id != aresta_id]
    return arestas

@api.get("/network/arestas", response_model=List[Aresta])
async def list_arestas():
    return arestas

@api.get("/fluxo_maximo")
def calcular_fluxo_maximo(
    origem_id: int = Query(..., description="ID do vértice de origem"),
    destino_id: int = Query(..., description="ID do vértice de destino")
):
    # Cria uma cópia do grafo para não alterar o original
    import copy
    graph = build_graph(arestas)
    graph_copy = copy.deepcopy(graph)
    max_flow = edmonds_karp(graph_copy, origem_id, destino_id)
    return {"fluxo_maximo": max_flow}





@api.post("/network/analyze", response_model=NetworkAnalysisResponse)
def analyze_network(request: NetworkAnalysisRequest):
    # Implementação similar à função generateReport do React
    bottlenecks = []
    idle_capacity = []
    
    # Processar gargalos e capacidade ociosa
    for rota in request.rotas:
        key = f"{rota['origem']}-{rota['destino']}"
        if rota['capacidade'] > 10 and key not in request.blocked_routes:
            bottlenecks.append(rota)
        if rota['capacidade'] < 7 and key not in request.blocked_routes:
            idle_capacity.append(rota)
    
    # Converter para formato do Edmonds-Karp
    vertex_ids = {v['id']: idx for idx, v in enumerate(request.vertices)}
    num_nodes = len(request.vertices)
    edges = [
        (vertex_ids[r['origem']], vertex_ids[r['destino']], r['capacidade'])
        for r in request.rotas
    ]
    sources = [
        vertex_ids[v['id']] for v in request.vertices 
        if v['tipo'] == 'Deposito'
    ]
    sinks = [
        vertex_ids[v['id']] for v in request.vertices 
        if v['tipo'] == 'ZonaEntrega'
    ]
    
    # Calcular fluxo máximo (implementação similar à do React)
    max_flow, flow_paths = calculate_max_flow(num_nodes, edges, sources, sinks)
    
    return {
        "bottlenecks": bottlenecks,
        "idle_capacity": idle_capacity,
        "max_flow": max_flow,
        "flow_paths": flow_paths,
        "timestamp": datetime.now().isoformat()
    }

arestas: List[Aresta] = []

@api.post("/network/add-route")
async def add_route(request: RouteOperationRequest, response: Response):
    # Adicione manualmente os cabeçalhos CORS
    response.headers["Access-Control-Allow-Origin"] = "http://localhost:3000"
    response.headers["Access-Control-Allow-Methods"] = "POST, OPTIONS"
    response.headers["Access-Control-Allow-Headers"] = "Content-Type"
    
    try:
        global arestas  # ← Isso permite modificar a variável global
        
        # Se não houver arestas, comece com ID 1
        new_aresta_id = max(a.aresta_id for a in arestas) + 1 if arestas else 1
        
        new_aresta = Aresta(
            aresta_id=new_aresta_id,
            origem_id=request.origem_id,
            destino_id=request.destino_id,
            capacidade=request.capacidade,
            uso=request.uso,
            priority=Priority.LOW
        )
        
        arestas.append(new_aresta)
        
        return {
            "success": True,
            "new_route": {
                "id": new_aresta_id,
                "origem": request.origem_id,
                "destino": request.destino_id,
                "capacidade": request.capacidade
            }
        }
    except Exception as e:
        raise HTTPException(
            status_code=400,
            detail=f"Erro ao adicionar rota: {str(e)}"
        )

@api.post("/network/toggle-block")
def toggle_block_route(origem: str, destino: str):
    # Implementação similar à função toggleBlock do React
    key = f"{origem}-{destino}"
    # Lógica para alternar bloqueio
    return {"success": True, "blocked": key}

@api.post("/network/increase-demand")
async def increase_demand(node_id: str = Query(..., description="ID do nó para aumentar demanda")):
    try:
        logger.info(f"Recebida requisição para aumentar demanda no nó: {node_id}")
        logger.info(f"Tipo do node_id: {type(node_id)}")
        logger.info(f"Todas arestas: {arestas}")
        # Converter para string para garantir compatibilidade
        node_id_str = str(node_id)
        
        # Encontrar todas as arestas que chegam neste nó
        updated_edges = []
        for aresta in arestas:
            if str(aresta.destino_id) == node_id_str:
                aresta.capacidade += 5
                updated_edges.append({
                    "aresta_id": aresta.aresta_id,
                    "nova_capacidade": aresta.capacidade
                })
        
        if not updated_edges:
            raise HTTPException(
                status_code=404,
                detail=f"Nenhuma rota encontrada para o nó {node_id_str}"
            )
        
        return {
            "success": True,
            "node_id": node_id_str,
            "updated_edges": updated_edges,
            "message": f"Demanda aumentada em 5 unidades para o nó {node_id_str}"
        }
    except Exception as e:
        raise HTTPException(
            status_code=400,
            detail=f"Erro ao aumentar demanda: {str(e)}"
        )

@api.post("/network/reset")
def reset_network():
    global vertices, arestas
    
    # Mantém apenas os vértices básicos
    vertices = [
        Vertice(vertice_id=0, name="Depósito Principal", type="storage"),
        Vertice(vertice_id=1, name="Hub Central", type="hub"),
        Vertice(vertice_id=2, name="Zona de Entrega 1", type="delivery_zone")
    ]
    
    # Limpa todas as rotas
    arestas = []
    
    return {
        "success": True,
        "message": "Rede resetada para estado inicial",
        "vertices": vertices,
        "arestas": arestas
    }


@api.post("/relatorio-automatico")
def relatorio_automatico(
    data: dict = Body(default={})
):
    blocked = data.get("blocked", [])
    # Gargalos e capacidade ociosa
    bottlenecks = [a for a in arestas if a.capacidade > 10 and f"{a.origem_id}-{a.destino_id}" not in blocked]
    idle_capacity = [a for a in arestas if a.capacidade < 7 and f"{a.origem_id}-{a.destino_id}" not in blocked]

    # Fluxo máximo (usando Edmonds-Karp entre depósitos e zonas de entrega)
    vertices_storage = [v.vertice_id for v in vertices if v.type in ("storage", "Deposito")]
    vertices_delivery = [v.vertice_id for v in vertices if v.type in ("delivery_zone", "ZonaEntrega")]
    if not vertices_storage or not vertices_delivery:
        max_flow = 0
        flow_paths = []
    else:
        id_to_idx = {v.vertice_id: idx for idx, v in enumerate(vertices)}
        num_nodes = len(vertices)
        edges = [
            (id_to_idx[a.origem_id], id_to_idx[a.destino_id], a.capacidade)
            for a in arestas if f"{a.origem_id}-{a.destino_id}" not in blocked
        ]
        sources = [id_to_idx[i] for i in vertices_storage]
        sinks = [id_to_idx[i] for i in vertices_delivery]

        # Edmonds-Karp adaptado
        from collections import deque
        def ek(n, edges, sources, sinks):
            super_source = n
            super_sink = n + 1
            capacity = [[0] * (n + 2) for _ in range(n + 2)]
            for u, v, cap in edges:
                capacity[u][v] += cap
            for s in sources:
                capacity[super_source][s] = float('inf')
            for t in sinks:
                capacity[t][super_sink] = float('inf')
            parent = [-1] * (n + 2)
            max_flow = 0
            paths = []
            def bfs():
                nonlocal parent
                parent = [-1] * (n + 2)
                queue = deque([super_source])
                parent[super_source] = -2
                flow = [0] * (n + 2)
                flow[super_source] = float('inf')
                while queue:
                    u = queue.popleft()
                    for v in range(n + 2):
                        if parent[v] == -1 and capacity[u][v] > 0:
                            parent[v] = u
                            flow[v] = min(flow[u], capacity[u][v])
                            if v == super_sink:
                                return flow[super_sink]
                            queue.append(v)
                return 0
            path_flow = bfs()
            while path_flow:
                max_flow += path_flow
                # Recupera caminho
                v = super_sink
                path = []
                while v != super_source:
                    u = parent[v]
                    path.append((u, v))
                    v = u
                path.reverse()
                real_path = [p for p in path if p[0] != super_source and p[1] != super_sink]
                if real_path:
                    paths.append(real_path)
                # Atualiza capacidades
                v = super_sink
                while v != super_source:
                    u = parent[v]
                    capacity[u][v] -= path_flow
                    capacity[v][u] += path_flow
                    v = u
                path_flow = bfs()
            return max_flow, paths
        max_flow, flow_paths = ek(num_nodes, edges, sources, sinks)

    return {
        "bottlenecks": [
            {
                **a.dict(),
                "origem": next((v.name for v in vertices if v.vertice_id == a.origem_id), a.origem_id),
                "destino": next((v.name for v in vertices if v.vertice_id == a.destino_id), a.destino_id),
            }
            for a in bottlenecks
        ],
        "idle_capacity": [
            {
                **a.dict(),
                "origem": next((v.name for v in vertices if v.vertice_id == a.origem_id), a.origem_id),
                "destino": next((v.name for v in vertices if v.vertice_id == a.destino_id), a.destino_id),
            }
            for a in idle_capacity
        ],
        "max_flow": int(max_flow),
        "flow_paths": flow_paths or [],
        "timestamp": datetime.now().isoformat()
    }

def calculate_max_flow(num_nodes, edges, sources, sinks):
    # Implementação similar às funções maxFlow... do React
    super_source = num_nodes
    super_sink = num_nodes + 1
    g = Graph(num_nodes + 2)
    
    for u, v, cap in edges:
        g.add_edge(u, v, cap)
    
    for s in sources:
        g.add_edge(super_source, s, float('inf'))
    
    for t in sinks:
        g.add_edge(t, super_sink, float('inf'))
    
    max_flow = g.edmonds_karp(super_source, super_sink)
    paths = g.get_flow_paths(super_source, super_sink)
    
    return max_flow, paths


@api.get("/network/current-state", response_model=CurrentStateResponse)
def get_current_state():
    """Endpoint para fornecer o estado atual da rede"""
    # Use os dados globais atuais
    response = {
        "vertices": vertices,
        "arestas": arestas,
        "grafo": {
            "vertices": [
                {"id": v.vertice_id, "nome": v.name, "tipo": v.type}
                for v in vertices
            ],
            "rotas": [
                {
                    "origem": a.origem_id,
                    "destino": a.destino_id,
                    "capacidade": a.capacidade,
                    "aresta_id": a.aresta_id,      
                    "uso": a.uso,                  
                    "priority": a.priority 
                }
                for a in arestas
            ]
        }
    }
    return response



class Graph:
    # Implementação similar à classe Graph do React
    def __init__(self, n):
        self.n = n
        self.capacity = [[0] * n for _ in range(n)]
        self.adj = [[] for _ in range(n)]
    
    def add_edge(self, u, v, cap):
        self.capacity[u][v] += cap
        self.adj[u].append(v)
        self.adj[v].append(u)
    
    def bfs(self, s, t, parent):
        visited = [False] * self.n
        queue = deque([s])
        visited[s] = True
        parent[s] = -1
        
        while queue:
            u = queue.popleft()
            for v in self.adj[u]:
                if not visited[v] and self.capacity[u][v] > 0:
                    visited[v] = True
                    parent[v] = u
                    if v == t:
                        return True
                    queue.append(v)
        return False
    
    def edmonds_karp(self, s, t):
        parent = [-1] * self.n
        max_flow = 0
        
        while self.bfs(s, t, parent):
            path_flow = float('inf')
            v = t
            while v != s:
                u = parent[v]
                path_flow = min(path_flow, self.capacity[u][v])
                v = u
            
            v = t
            while v != s:
                u = parent[v]
                self.capacity[u][v] -= path_flow
                self.capacity[v][u] += path_flow
                v = u
            
            max_flow += path_flow
        
        return max_flow
    
    def get_flow_paths(self, s, t):
        paths = []
        parent = [-1] * self.n
        while self.bfs(s, t, parent):
            path = []
            v = t
            while v != s:
                u = parent[v]
                path.insert(0, (u, v))
                v = u
            paths.append(path)
            path_flow = float('inf')
            for u, v in path:
                path_flow = min(path_flow, self.capacity[u][v])
            for u, v in path:
                self.capacity[u][v] -= path_flow
                self.capacity[v][u] += path_flow
        return paths