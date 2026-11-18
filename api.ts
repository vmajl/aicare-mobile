
// Endereço da API do AICare (backend/). No celular, use o IP da máquina
// que executa o servidor (uvicorn ... --host 0.0.0.0).
//
// As chamadas à API ficam em src/services/apiClient.ts e nos contextos
// de cada funcionalidade (auth, pacientes, medicamentos, diário).
export const API_URL = 'http://192.168.15.2:8000';
