
export const API_URL = 'http://192.168.0.100:8000';

export async function buscarMedicamentos() {
  const response = await fetch(`${API_URL}/medications`);

  if (!response.ok) {
    throw new Error(`Erro ao buscar medicamentos: ${response.status}`);
  }

  return response.json();
}

export async function criarMedicamento(medicamento: {
  patient_id: number;
  name: string;
  dosage: string;
  instructions: string | null;
  first_dose_at: string | null;
  interval_hours: number;
  continuous: boolean;
  start_date: string;
  end_date: string | null;
  stock_quantity: number | null;
  stock_unit: string;
  units_per_dose: number;
}) {
  const response = await fetch(`${API_URL}/medications`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(medicamento),
  });

  if (!response.ok) {
    const erro = await response.text();
    throw new Error(`Erro ao cadastrar medicamento: ${response.status} - ${erro}`);
  }

  return response.json();
}

export async function atualizarMedicamento(
  id: string,
  medicamento: {
    name: string;
    dosage: string;
    instructions: string | null;
    first_dose_at: string;
    interval_hours: number | null;
    continuous: boolean;
    start_date: string | null;
    end_date: string | null;
    stock_quantity: number | null;
    stock_unit: string | null;
    units_per_dose: number | null;
    active: boolean;
  }
) {
  const response = await fetch(
    `${API_URL}/medications/${id}`,
    {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(medicamento),
    }
  );

  if (!response.ok) {
    const erro = await response.text();
    throw new Error(
      `Erro ao atualizar medicamento: ${response.status} - ${erro}`
    );
  }

  return response.json();
}
