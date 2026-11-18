import { Platform } from 'react-native';
import { File } from 'expo-file-system';

import { API_URL } from '../../../api';
import { apiRequest, parseApiDate } from '../../services/apiClient';

export type DiaryRecord = {
  id: number;
  /** AAAA-MM-DD */
  date: string;
  /** URL completa da foto na API, ou null. */
  imageUri: string | null;
  observation: string;
  createdAt: string;
  updatedAt?: string;
};

type ApiDiaryEntry = {
  id: number;
  patient_id: number;
  date: string;
  observation: string;
  photo_url: string | null;
  created_by: number | null;
  created_at: string;
  updated_at: string | null;
};

function toDiaryRecord(data: ApiDiaryEntry): DiaryRecord {
  return {
    id: data.id,
    date: data.date,
    imageUri: data.photo_url ? `${API_URL}${data.photo_url}` : null,
    observation: data.observation ?? '',
    createdAt: parseApiDate(data.created_at).toISOString(),
    updatedAt: data.updated_at
      ? parseApiDate(data.updated_at).toISOString()
      : undefined,
  };
}

export async function listDiaryRecords(
  patientId: string,
  range?: { from?: string; to?: string },
): Promise<DiaryRecord[]> {
  const params: string[] = [];
  if (range?.from) params.push(`date_from=${range.from}`);
  if (range?.to) params.push(`date_to=${range.to}`);

  const query = params.length ? `?${params.join('&')}` : '';
  const data = await apiRequest<ApiDiaryEntry[]>(
    `/patients/${patientId}/diary${query}`,
  );

  return data.map(toDiaryRecord);
}

/**
 * Cria ou atualiza a publicação de uma data.
 * `photoData`: undefined mantém a foto; null remove; string (data URL) substitui.
 */
export async function saveDiaryRecord(
  patientId: string,
  date: string,
  observation: string,
  photoData?: string | null,
): Promise<DiaryRecord> {
  const body: { observation: string; photo_data?: string | null } = {
    observation,
  };

  if (photoData !== undefined) {
    body.photo_data = photoData;
  }

  const data = await apiRequest<ApiDiaryEntry>(
    `/patients/${patientId}/diary/${date}`,
    { method: 'PUT', body },
  );

  return toDiaryRecord(data);
}

export async function deleteDiaryRecord(patientId: string, date: string) {
  await apiRequest<void>(`/patients/${patientId}/diary/${date}`, {
    method: 'DELETE',
  });
}

function guessMimeType(uri: string) {
  const lower = uri.toLowerCase();
  if (lower.endsWith('.png')) return 'image/png';
  if (lower.endsWith('.webp')) return 'image/webp';
  if (lower.endsWith('.heic')) return 'image/heic';
  return 'image/jpeg';
}

async function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

/** Converte a foto escolhida (arquivo local ou data URL) em data URL para envio. */
export async function photoToDataUrl(uri: string): Promise<string> {
  if (uri.startsWith('data:')) {
    return uri;
  }

  if (Platform.OS === 'web') {
    const response = await fetch(uri);
    return blobToDataUrl(await response.blob());
  }

  const base64 = await new File(uri).base64();
  return `data:${guessMimeType(uri)};base64,${base64}`;
}
