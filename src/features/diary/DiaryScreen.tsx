import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Image,
  TextInput,
  ScrollView,
  ActivityIndicator,
  Modal,
  Dimensions,
  StatusBar,
  Platform,
} from 'react-native';
import { Alert } from '../../utils/platformAlert';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImagePicker from 'expo-image-picker';
import { Directory, File, Paths } from 'expo-file-system';
import {
  Camera,
  ChevronLeft,
  ChevronRight,
  Image as ImageIcon,
  Trash2,
  CalendarDays,
  Check,
  Pencil,
  X,
  Send,
} from 'lucide-react-native';
import { usePatient } from '../patients/PatientContext';

const BLUE = '#50A9C3';
const DARK = '#102F40';
const MUTED = '#6D8794';
const BORDER = '#D8E3E8';
const STORAGE_KEY = '@aicare:diary-records';
const PENDING_HOME_PHOTO_KEY = '@aicare:pending-home-photo';
const PHOTO_DATES_KEY = '@aicare:diary-photo-dates';

function getPhotoDirectory(): Directory | null {
  if (Platform.OS === 'web') return null;
  return new Directory(Paths.document, 'diary-photos');
}

function isPermanentPhoto(uri: string | null) {
  if (!uri || Platform.OS === 'web') return false;

  const directory = getPhotoDirectory();
  return Boolean(directory && uri.startsWith(directory.uri));
}

type DiaryRecord = {
  date: string;
  imageUri: string | null;
  observation: string;
  createdAt: string;
  updatedAt?: string;
};

const MONTHS = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril',
  'Maio', 'Junho', 'Julho', 'Agosto',
  'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

const WEEKDAYS = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];

const SCREEN_WIDTH = Dimensions.get('window').width;

function dateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

function formatDate(date: Date) {
  return date.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
}

function formatTime(value: string) {
  return new Date(value).toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function DiaryScreen() {
  const today = new Date();

  const [records, setRecords] = useState<DiaryRecord[]>([]);
  const [todayKey, setTodayKey] = useState(dateKey(today));
  const [photoDates, setPhotoDates] = useState<string[]>([]);
  const [selectedDate, setSelectedDate] = useState(dateKey(today));
  const [visibleMonth, setVisibleMonth] = useState(
    new Date(today.getFullYear(), today.getMonth(), 1)
  );
  const { patient, loading: patientLoading } = usePatient();

const patientInitial = patient?.name?.trim().charAt(0).toUpperCase() || '?';
  const [observation, setObservation] = useState('');
  const [draftImageUri, setDraftImageUri] = useState<string | null>(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [expandedPhoto, setExpandedPhoto] = useState(false);

  // Foto recebida da tela inicial, aguardando ser carregada no compositor.
  const pendingHomePhotoRef = useRef<{
    uri: string;
    date: string;
  } | null>(null);

  useEffect(() => {
    loadRecords();
  }, []);

  useEffect(() => {
    const refreshToday = () => {
      const nextTodayKey = dateKey(new Date());

      if (nextTodayKey !== todayKey) {
        setTodayKey(nextTodayKey);
        setSelectedDate(nextTodayKey);
        const [year, month] = nextTodayKey.split('-').map(Number);
        setVisibleMonth(new Date(year, month - 1, 1));
      }
    };

    const interval = setInterval(refreshToday, 30_000);
    return () => clearInterval(interval);
  }, [todayKey]);

  useEffect(() => {
    const selectedRecord = records.find(
      record => record.date === selectedDate
    );

    const pendingHomePhoto = pendingHomePhotoRef.current;

    if (pendingHomePhoto) {
      // Garante que a foto enviada pela Home seja associada ao dia atual.
      if (selectedDate !== pendingHomePhoto.date) {
        const [year, month, day] = pendingHomePhoto.date
          .split('-')
          .map(Number);

        setSelectedDate(pendingHomePhoto.date);
        setVisibleMonth(new Date(year, month - 1, 1));
        return;
      }

      pendingHomePhotoRef.current = null;
      setObservation(selectedRecord?.observation ?? '');
      setDraftImageUri(pendingHomePhoto.uri);
      setIsEditing(true);
      setExpandedPhoto(false);
      return;
    }

    setObservation(selectedRecord?.observation ?? '');
    setDraftImageUri(selectedRecord?.imageUri ?? null);
    setIsEditing(false);
    setExpandedPhoto(false);
  }, [records, selectedDate]);

  const selectedRecord = records.find(
    record => record.date === selectedDate
  );

  const selectedDateIsToday = selectedDate === todayKey;
  const selectedDateHasPhoto =
    photoDates.includes(selectedDate) || Boolean(selectedRecord?.imageUri);
  const canAddPhoto = selectedDateIsToday && !selectedDateHasPhoto;

  async function loadRecords() {
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEY);
      let normalizedRecords: DiaryRecord[] = [];

      if (stored) {
        const parsed = JSON.parse(stored);

        // Mantém compatibilidade com os registros da versão anterior.
        normalizedRecords = parsed.map(
          (record: any) => ({
            date: record.date,
            imageUri: record.imageUri || null,
            observation: record.observation ?? '',
            createdAt: record.createdAt || new Date().toISOString(),
            updatedAt: record.updatedAt,
          })
        );
      }

      // A lista de datas com foto é reconstruída a partir das publicações
      // existentes. Assim, uma data deixa de ficar bloqueada quando a
      // publicação correspondente é excluída.
      const datesWithExistingPhotos = normalizedRecords
        .filter(record => Boolean(record.imageUri))
        .map(record => record.date);
      const currentPhotoDates = Array.from(new Set(datesWithExistingPhotos));
      setPhotoDates(currentPhotoDates);
      await AsyncStorage.setItem(
        PHOTO_DATES_KEY,
        JSON.stringify(currentPhotoDates)
      );

      // Verifica se a Home encaminhou uma foto para o Diário.
      const pendingPhoto = await AsyncStorage.getItem(
        PENDING_HOME_PHOTO_KEY
      );

      if (pendingPhoto) {
        pendingHomePhotoRef.current = {
          uri: pendingPhoto,
          date: dateKey(new Date()),
        };

        // Remove a transferência temporária para não reutilizar a foto
        // em uma próxima abertura do Diário.
        await AsyncStorage.removeItem(PENDING_HOME_PHOTO_KEY);
      }

      // Atualiza mesmo quando ainda não existem publicações salvas.
      setRecords(normalizedRecords);
    } catch {
      Alert.alert('Erro', 'Não foi possível carregar o Diário.');
    } finally {
      setLoading(false);
    }
  }

  async function persistRecords(updatedRecords: DiaryRecord[]) {
    await AsyncStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(updatedRecords)
    );

    setRecords(updatedRecords);
  }

  async function ensurePhotoDirectory() {
    if (Platform.OS === 'web') return null;

    const directory = getPhotoDirectory();
    if (!directory) return null;

    directory.create({
      idempotent: true,
      intermediates: true,
    });

    return directory;
  }

  async function savePhotoPermanently(
    temporaryUri: string,
    recordDate: string,
  ) {
    // Na Web, mantém a imagem em formato persistente no armazenamento local.
    if (Platform.OS === 'web') {
      return temporaryUri;
    }

    const directory = await ensurePhotoDirectory();
    if (!directory) return temporaryUri;

    const fileName = `diary-${recordDate}-${Date.now()}.jpg`;
    const destination = new File(directory, fileName);
    const source = new File(temporaryUri);

    await source.copy(destination);

    return destination.uri;
  }

  async function removeStoredPhoto(uri: string | null) {
    if (!uri || Platform.OS === 'web') return;

    try {
      const directory = getPhotoDirectory();
      if (!directory || !uri.startsWith(directory.uri)) return;

      const file = new File(uri);
      if (file.exists) {
        file.delete();
      }
    } catch {
      // Uma falha na exclusão do arquivo não interrompe o Diário.
    }
  }

  const calendarDays = useMemo(() => {
    const year = visibleMonth.getFullYear();
    const month = visibleMonth.getMonth();

    const firstDay = new Date(year, month, 1);
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const offset = (firstDay.getDay() + 6) % 7;

    return [
      ...Array(offset).fill(null),
      ...Array.from({ length: daysInMonth }, (_, index) => index + 1),
    ];
  }, [visibleMonth]);

  function changeMonth(direction: number) {
    setVisibleMonth(current =>
      new Date(
        current.getFullYear(),
        current.getMonth() + direction,
        1
      )
    );
  }

  function selectDay(day: number) {
    const date = new Date(
      visibleMonth.getFullYear(),
      visibleMonth.getMonth(),
      day
    );

    setSelectedDate(dateKey(date));
    setExpandedPhoto(false);
  }

  function startEditing() {
    setObservation(selectedRecord?.observation ?? '');
    setDraftImageUri(selectedRecord?.imageUri ?? null);
    setIsEditing(true);
  }

  function cancelEditing() {
    setObservation(selectedRecord?.observation ?? '');
    setDraftImageUri(selectedRecord?.imageUri ?? null);
    setIsEditing(false);
  }

  async function choosePhoto() {
    if (!selectedDateIsToday) {
      Alert.alert(
        'Data indisponível',
        'Fotos só podem ser adicionadas à publicação da data atual.'
      );
      return;
    }

    if (selectedDateHasPhoto) {
      Alert.alert(
        'Foto já registrada hoje',
        'Você já publicou a foto desta data. Uma nova foto só poderá ser publicada a partir de 00h do próximo dia.'
      );
      return;
    }

    Alert.alert(
      'Adicionar foto',
      'Como deseja adicionar uma foto à publicação?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Tirar foto',
          onPress: openCamera,
        },
        {
          text: 'Escolher da galeria',
          onPress: openGallery,
        },
      ]
    );
  }

  async function openCamera() {
    if (!canAddPhoto) {
      Alert.alert(
        'Não é possível adicionar outra foto',
        selectedDateIsToday
          ? 'Você já publicou a foto de hoje. Uma nova foto estará disponível a partir de 00h de amanhã.'
          : 'Só é possível adicionar fotos à data atual.'
      );
      return;
    }

    try {
      if (Platform.OS !== 'web') {
        const permission =
          await ImagePicker.requestCameraPermissionsAsync();

        if (!permission.granted) {
          Alert.alert(
            'Permissão necessária',
            'Autorize o acesso à câmera nas configurações do celular.',
          );
          return;
        }
      }

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
        base64: Platform.OS === 'web',
      });

      if (!result.canceled && result.assets?.length) {
        const asset = result.assets[0];
        const photoUri =
          Platform.OS === 'web' && asset.base64
            ? `data:${asset.mimeType ?? 'image/jpeg'};base64,${asset.base64}`
            : asset.uri;
        setDraftImageUri(photoUri);
      }
    } catch {
      Alert.alert('Erro', 'Não foi possível abrir a câmera.');
    }
  }

  async function openGallery() {
    if (!canAddPhoto) {
      Alert.alert(
        'Não é possível adicionar outra foto',
        selectedDateIsToday
          ? 'Você já publicou a foto de hoje. Uma nova foto estará disponível a partir de 00h de amanhã.'
          : 'Só é possível adicionar fotos à data atual.'
      );
      return;
    }

    try {
      if (Platform.OS !== 'web') {
        const permission =
          await ImagePicker.requestMediaLibraryPermissionsAsync();

        if (!permission.granted) {
          Alert.alert(
            'Permissão necessária',
            'Autorize o acesso às fotos nas configurações do celular.',
          );
          return;
        }
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
        base64: Platform.OS === 'web',
      });

      if (!result.canceled && result.assets?.length) {
        const asset = result.assets[0];
        const photoUri =
          Platform.OS === 'web' && asset.base64
            ? `data:${asset.mimeType ?? 'image/jpeg'};base64,${asset.base64}`
            : asset.uri;
        setDraftImageUri(photoUri);
      }
    } catch {
      Alert.alert('Erro', 'Não foi possível abrir a galeria.');
    }
  }

  function removeDraftPhoto() {
    setDraftImageUri(null);
  }

  async function publishPost() {
    const trimmedObservation = observation.trim();

    if (!trimmedObservation && !draftImageUri) {
      Alert.alert(
        'Publicação vazia',
        'Adicione um comentário ou uma foto antes de publicar.'
      );
      return;
    }

    const previousRecord = records.find(
      record => record.date === selectedDate
    );
    const isAddingNewPhoto = Boolean(
      draftImageUri && draftImageUri !== previousRecord?.imageUri
    );

    if (isAddingNewPhoto && !selectedDateIsToday) {
      Alert.alert(
        'Data indisponível',
        'Fotos só podem ser publicadas na data atual.'
      );
      return;
    }

    if (isAddingNewPhoto && (photoDates.includes(selectedDate) || Boolean(previousRecord?.imageUri))) {
      Alert.alert(
        'Limite diário atingido',
        'Você só pode publicar uma foto por dia. Uma nova foto estará disponível a partir de 00h do próximo dia.'
      );
      return;
    }

    if (!previousRecord && !selectedDateIsToday) {
      Alert.alert(
        'Data indisponível',
        'Novas publicações só podem ser criadas para a data atual.'
      );
      return;
    }

    try {
      setSaving(true);

      let permanentUri: string | null = draftImageUri;

      // Se a foto selecionada for temporária, copia para a pasta permanente.
      if (
        draftImageUri &&
        !isPermanentPhoto(draftImageUri)
      ) {
        permanentUri = await savePhotoPermanently(
          draftImageUri,
          selectedDate
        );
      }

      const now = new Date().toISOString();

      const updatedRecord: DiaryRecord = {
        date: selectedDate,
        imageUri: permanentUri,
        observation: trimmedObservation,
        createdAt: previousRecord?.createdAt ?? now,
        updatedAt: previousRecord ? now : undefined,
      };

      const updatedRecords = [
        ...records.filter(record => record.date !== selectedDate),
        updatedRecord,
      ].sort((a, b) => a.date.localeCompare(b.date));

      try {
        await persistRecords(updatedRecords);
      } catch (error) {
        // Se a gravação falhar, remove somente a nova cópia criada.
        if (
          permanentUri &&
          permanentUri !== previousRecord?.imageUri &&
          isPermanentPhoto(permanentUri)
        ) {
          await removeStoredPhoto(permanentUri);
        }

        throw error;
      }

      if (isAddingNewPhoto) {
        const updatedPhotoDates = Array.from(
          new Set([...photoDates, selectedDate])
        );
        setPhotoDates(updatedPhotoDates);

        // O próprio registro também funciona como proteção caso esta gravação falhe.
        try {
          await AsyncStorage.setItem(
            PHOTO_DATES_KEY,
            JSON.stringify(updatedPhotoDates)
          );
        } catch {
          // Na próxima abertura, as datas com fotos serão reconstruídas pelos registros.
        }
      }

      // Só remove a foto anterior depois que a publicação foi salva.
      if (
        previousRecord?.imageUri &&
        previousRecord.imageUri !== permanentUri
      ) {
        await removeStoredPhoto(previousRecord.imageUri);
      }

      setIsEditing(false);

      Alert.alert(
        previousRecord ? 'Publicação atualizada' : 'Publicado!',
        previousRecord
          ? 'As alterações foram salvas no Diário.'
          : 'Sua publicação foi adicionada ao Diário.'
      );
    } catch {
      Alert.alert(
        'Erro',
        'Não foi possível salvar a publicação. Tente novamente.'
      );
    } finally {
      setSaving(false);
    }
  }

  function deletePost() {
    if (!selectedRecord) return;

    Alert.alert(
      'Excluir publicação',
      'Tem certeza de que deseja excluir esta publicação e sua foto? Essa ação não poderá ser desfeita.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Excluir publicação',
          style: 'destructive',
          onPress: async () => {
            try {
              const recordToDelete = selectedRecord;

              const updatedRecords = records.filter(
                record => record.date !== selectedDate
              );

              await persistRecords(updatedRecords);

              if (recordToDelete.imageUri) {
                await removeStoredPhoto(recordToDelete.imageUri);
              }

              // Excluir a publicação também libera a cota de foto do dia.
              // Isso permite registrar outra foto na mesma data, se ainda for hoje.
              const updatedPhotoDates = updatedRecords
                .filter(record => Boolean(record.imageUri))
                .map(record => record.date);
              const uniquePhotoDates = Array.from(new Set(updatedPhotoDates));
              setPhotoDates(uniquePhotoDates);
              await AsyncStorage.setItem(
                PHOTO_DATES_KEY,
                JSON.stringify(uniquePhotoDates)
              );

              setIsEditing(false);
              setExpandedPhoto(false);

              Alert.alert(
                'Publicação excluída',
                'O registro foi removido do Diário.'
              );
            } catch {
              Alert.alert(
                'Erro',
                'Não foi possível excluir a publicação.'
              );
            }
          },
        },
      ]
    );
  }

  const selectedDateObject = new Date(
    Number(selectedDate.slice(0, 4)),
    Number(selectedDate.slice(5, 7)) - 1,
    Number(selectedDate.slice(8, 10))
  );

  const monthRecordCount = records.filter(record => {
    const [year, month] = record.date.split('-');

    return (
      Number(year) === visibleMonth.getFullYear() &&
      Number(month) === visibleMonth.getMonth() + 1
    );
  }).length;

  if (loading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color={BLUE} />
        <Text style={styles.description}>Carregando Diário...</Text>
      </View>
    );
  }

  return (
    <>
      <StatusBar barStyle="dark-content" />

      <ScrollView
        style={styles.screen}
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.pageHeading}>
          <Text style={styles.pageKicker}>Acompanhamento AICare</Text>
          <Text style={styles.pageTitle}>
  {patientLoading
    ? 'Carregando Diário...'
    : patient
      ? `Diário · ${patient.name}`
      : 'Diário'}
</Text>
         <Text style={styles.description}>
  {patient
    ? `Momentos, acontecimentos e registros do dia a dia de ${patient.name}.`
    : 'Momentos, acontecimentos e registros do dia a dia.'}
</Text>
        </View>

        {/* CALENDÁRIO */}
        <View style={styles.calendarCard}>
          <View style={styles.monthHeader}>
            <Pressable
              onPress={() => changeMonth(-1)}
              style={styles.monthArrow}
            >
              <ChevronLeft size={22} color={DARK} />
            </Pressable>

            <View style={styles.monthTitleContainer}>
              <CalendarDays size={18} color={BLUE} />
              <Text style={styles.monthTitle}>
                {MONTHS[visibleMonth.getMonth()]}{' '}
                {visibleMonth.getFullYear()}
              </Text>
            </View>

            <Pressable
              onPress={() => changeMonth(1)}
              style={styles.monthArrow}
            >
              <ChevronRight size={22} color={DARK} />
            </Pressable>
          </View>

          <View style={styles.weekdays}>
            {WEEKDAYS.map(day => (
              <View key={day} style={styles.weekdayCell}>
                <Text style={styles.weekdayText}>{day}</Text>
              </View>
            ))}
          </View>

          <View style={styles.calendarGrid}>
            {calendarDays.map((day, index) => {
              if (!day) {
                return (
                  <View
                    key={`empty-${index}`}
                    style={styles.dayCell}
                  />
                );
              }

              const date = new Date(
                visibleMonth.getFullYear(),
                visibleMonth.getMonth(),
                day
              );

              const key = dateKey(date);
              const hasPost = records.some(
                record => record.date === key
              );
              const isSelected = selectedDate === key;
              const isToday = key === todayKey;
              const isFutureDate = key > todayKey;

              return (
                <Pressable
                  key={key}
                  onPress={() => selectDay(day)}
                  disabled={isFutureDate}
                  style={[
                    styles.dayCell,
                    isSelected && styles.selectedDay,
                    isToday && !isSelected && styles.todayDay,
                    isFutureDate && styles.disabledDay,
                  ]}
                >
                  <Text
                    style={[
                      styles.dayText,
                      isSelected && styles.selectedDayText,
                      isFutureDate && styles.disabledDayText,
                    ]}
                  >
                    {day}
                  </Text>

                  {hasPost && (
                    <View
                      style={[
                        styles.photoIndicator,
                        isSelected && styles.selectedPhotoIndicator,
                      ]}
                    />
                  )}
                </Pressable>
              );
            })}
          </View>

          <View style={styles.calendarLegend}>
            <View style={styles.legendItem}>
              <View style={styles.legendDot} />
              <Text style={styles.legendText}>Publicação</Text>
            </View>

            <View style={styles.legendItem}>
              <View style={styles.todayLegend} />
              <Text style={styles.legendText}>Hoje</Text>
            </View>
          </View>
        </View>

        {/* ÁREA DE PUBLICAÇÃO */}
        <View style={styles.recordCard}>
          <View style={styles.recordHeader}>
            <View style={styles.recordTitleContainer}>
              <Text style={styles.cardTitle}>
                {selectedRecord
                  ? 'Publicação do dia'
                  : 'Nova publicação'}
              </Text>

              <Text style={styles.description}>
                {formatDate(selectedDateObject)}
              </Text>
            </View>

            {selectedRecord && (
              <View style={styles.registeredBadge}>
                <Check size={13} color="#27845A" />
                <Text style={styles.registeredText}>Publicado</Text>
              </View>
            )}
          </View>

          {selectedRecord && !isEditing ? (
            /* POST PUBLICADO */
            <View style={styles.postCard}>
              <View style={styles.postAuthor}>
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>{patientInitial}</Text>
                </View>

                <View style={styles.authorInfo}>
                  <Text style={styles.authorName}>Cuidador</Text>
                  <Text style={styles.postDate}>
                    {formatDate(selectedDateObject)} ·{' '}
                    {formatTime(
                      selectedRecord.updatedAt ??
                      selectedRecord.createdAt
                    )}
                  </Text>
                </View>
              </View>

              {selectedRecord.imageUri && (
                <Pressable
                  onPress={() => setExpandedPhoto(true)}
                  accessibilityRole="button"
                  accessibilityLabel="Ampliar foto da publicação"
                >
                  <Image
                    source={{ uri: selectedRecord.imageUri }}
                    style={styles.postPhoto}
                    resizeMode="cover"
                  />

                  <View style={styles.expandHint}>
                    <Text style={styles.expandHintText}>
                      Toque para ampliar
                    </Text>
                  </View>
                </Pressable>
              )}

              {!!selectedRecord.observation && (
                <Text style={styles.postText}>
                  {selectedRecord.observation}
                </Text>
              )}

              <View style={styles.postActions}>
                <Pressable
                  style={styles.editButton}
                  onPress={startEditing}
                >
                  <Pencil size={15} color={BLUE} />
                  <Text style={styles.editButtonText}>Editar publicação</Text>
                </Pressable>

                <Pressable
                  style={styles.postDeleteButton}
                  onPress={deletePost}
                >
                  <Trash2 size={15} color="#B54A4A" />
                </Pressable>
              </View>
            </View>
          ) : !selectedRecord && !selectedDateIsToday ? (
            <View style={styles.readOnlyNotice}>
              <Text style={styles.description}>
                Não há publicação nesta data. Novas publicações e fotos só podem ser adicionadas no dia atual.
              </Text>
            </View>
          ) : (
            /* COMPOSITOR DE PUBLICAÇÃO */
            <View style={styles.composer}>
              <View style={styles.postAuthor}>
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>{patientInitial}</Text>
                </View>

                <View style={styles.authorInfo}>
                  <Text style={styles.authorName}>Cuidador</Text>
                  <Text style={styles.postDate}>
                    {selectedRecord
                      ? 'Editando publicação'
                      : 'Compartilhe um momento do dia'}
                  </Text>
                </View>
              </View>

              <TextInput
                style={styles.composerInput}
                placeholder="O que aconteceu hoje? Escreva uma observação..."
                placeholderTextColor="#9AABB3"
                multiline
                value={observation}
                editable={!saving}
                onChangeText={setObservation}
              />

              {draftImageUri && (
                <View style={styles.draftPhotoContainer}>
                  <Image
                    source={{ uri: draftImageUri }}
                    style={styles.draftPhoto}
                    resizeMode="cover"
                  />

                  {!(selectedRecord?.imageUri && draftImageUri === selectedRecord.imageUri) && (
                    <Pressable
                      style={styles.removeDraftPhoto}
                      onPress={removeDraftPhoto}
                      disabled={saving}
                      accessibilityRole="button"
                      accessibilityLabel="Remover foto"
                    >
                      <X size={18} color="#FFFFFF" />
                    </Pressable>
                  )}
                </View>
              )}

              <View style={styles.composerDivider} />

              <View style={styles.composerFooter}>
                {canAddPhoto && !(selectedRecord?.imageUri) ? (
                  <Pressable
                    style={styles.addPhotoButton}
                    onPress={choosePhoto}
                    disabled={saving}
                  >
                    <ImageIcon size={19} color={BLUE} />
                    <Text style={styles.addPhotoText}>Adicionar foto</Text>
                  </Pressable>
                ) : (
                  <Text style={styles.optionalText}>
                    {selectedRecord?.imageUri
                      ? 'A foto desta publicação não pode ser substituída.'
                      : selectedDateIsToday && selectedDateHasPhoto
                        ? 'Limite de uma foto por dia atingido.'
                        : 'Fotos disponíveis somente para a data atual.'}
                  </Text>
                )}
              </View>

              <Pressable
                style={[
                  styles.publishButton,
                  saving && styles.disabledButton,
                ]}
                onPress={publishPost}
                disabled={saving}
              >
                {saving ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <>
                    <Send size={16} color="#FFFFFF" />
                    <Text style={styles.publishButtonText}>
                      {selectedRecord
                        ? 'Salvar alterações'
                        : 'Publicar'}
                    </Text>
                  </>
                )}
              </Pressable>

              {selectedRecord && (
                <Pressable
                  style={styles.cancelButton}
                  onPress={cancelEditing}
                  disabled={saving}
                >
                  <Text style={styles.cancelButtonText}>
                    Cancelar edição
                  </Text>
                </Pressable>
              )}
            </View>
          )}

          {!selectedRecord && !isEditing && (
            <Text style={styles.helperText}>
              {selectedDateHasPhoto
                ? 'A foto desta data já foi publicada. Você pode registrar uma observação, mas não adicionar outra foto.'
                : 'Você pode publicar uma foto e uma observação por dia. A foto só pode ser adicionada na data atual.'}
            </Text>
          )}
        </View>

        {/* RESUMO */}
        <View style={styles.summaryCard}>
          <View style={styles.summaryIcon}>
            <ImageIcon size={20} color={BLUE} />
          </View>

          <View style={styles.summaryText}>
            <Text style={styles.summaryTitle}>
              Publicações neste mês
            </Text>
            <Text style={styles.summaryDescription}>
              {monthRecordCount}{' '}
              {monthRecordCount === 1
                ? 'dia com publicação'
                : 'dias com publicação'}
            </Text>
          </View>
        </View>
      </ScrollView>

      {/* FOTO AMPLIADA */}
      <Modal
        visible={expandedPhoto}
        transparent
        animationType="fade"
        onRequestClose={() => setExpandedPhoto(false)}
      >
        <View style={styles.photoModal}>
          <Pressable
            style={styles.closePhotoButton}
            onPress={() => setExpandedPhoto(false)}
            accessibilityRole="button"
            accessibilityLabel="Fechar foto ampliada"
          >
            <X size={25} color="#FFFFFF" />
          </Pressable>

          {selectedRecord?.imageUri && (
            <Image
              source={{ uri: selectedRecord.imageUri }}
              style={styles.expandedPhoto}
              resizeMode="contain"
            />
          )}

          <Text style={styles.expandedPhotoDate}>
            {formatDate(selectedDateObject)}
          </Text>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  container: {
    paddingBottom: 32,
    gap: 20,
  },
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  pageHeading: {
    gap: 5,
  },
  pageKicker: {
    color: DARK,
    fontSize: 12,
  },
  pageTitle: {
    color: '#0A293A',
    fontSize: 27,
    fontWeight: '800',
  },
  description: {
    color: MUTED,
    fontSize: 13,
    lineHeight: 20,
  },
  calendarCard: {
    backgroundColor: '#FFFFFF',
    borderColor: BORDER,
    borderWidth: 1,
    borderRadius: 12,
    padding: 15,
    gap: 16,
  },
  monthHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  monthArrow: {
    width: 38,
    height: 38,
    borderRadius: 9,
    backgroundColor: '#F1F7F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  monthTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  monthTitle: {
    color: DARK,
    fontSize: 17,
    fontWeight: '800',
  },
  weekdays: {
    flexDirection: 'row',
  },
  weekdayCell: {
    flex: 1,
    alignItems: 'center',
  },
  weekdayText: {
    color: MUTED,
    fontSize: 11,
    fontWeight: '700',
  },
  calendarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  dayCell: {
    width: '14.2857%',
    height: 47,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    borderRadius: 9,
    marginBottom: 3,
  },
  dayText: {
    color: DARK,
    fontSize: 13,
    fontWeight: '600',
  },
  selectedDay: {
    backgroundColor: BLUE,
  },
  selectedDayText: {
    color: '#FFFFFF',
  },
  todayDay: {
    borderWidth: 1,
    borderColor: BLUE,
  },
  disabledDay: {
    opacity: 0.35,
  },
  disabledDayText: {
    color: '#AAB8BE',
  },
  photoIndicator: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: BLUE,
  },
  selectedPhotoIndicator: {
    backgroundColor: '#FFFFFF',
  },
  calendarLegend: {
    flexDirection: 'row',
    gap: 20,
    paddingTop: 3,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: BLUE,
  },
  todayLegend: {
    width: 10,
    height: 10,
    borderRadius: 3,
    borderWidth: 1,
    borderColor: BLUE,
  },
  legendText: {
    color: MUTED,
    fontSize: 11,
  },
  readOnlyNotice: {
    backgroundColor: '#F4F8F9',
    borderRadius: 9,
    padding: 14,
  },
  recordCard: {
    backgroundColor: '#FFFFFF',
    borderColor: BORDER,
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    gap: 15,
  },
  recordHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  recordTitleContainer: {
    flex: 1,
    gap: 4,
  },
  cardTitle: {
    color: DARK,
    fontSize: 16,
    fontWeight: '800',
  },
  registeredBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#E5F5EC',
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 20,
  },
  registeredText: {
    color: '#27845A',
    fontSize: 10,
    fontWeight: '700',
  },
  postCard: {
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 12,
    padding: 12,
    gap: 13,
  },
  postAuthor: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#E5F3F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: '#287D94',
    fontSize: 16,
    fontWeight: '800',
  },
  authorInfo: {
    flex: 1,
    gap: 3,
  },
  authorName: {
    color: DARK,
    fontSize: 13,
    fontWeight: '800',
  },
  postDate: {
    color: MUTED,
    fontSize: 10,
  },
  postPhoto: {
    width: '100%',
    height: 230,
    borderRadius: 9,
    backgroundColor: '#F1F5F6',
  },
  expandHint: {
    position: 'absolute',
    bottom: 9,
    right: 9,
    backgroundColor: 'rgba(16, 47, 64, 0.75)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
  },
  expandHintText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '600',
  },
  postText: {
    color: DARK,
    fontSize: 14,
    lineHeight: 22,
  },
  postActions: {
    borderTopWidth: 1,
    borderTopColor: BORDER,
    paddingTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  editButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 5,
    paddingHorizontal: 4,
  },
  editButtonText: {
    color: BLUE,
    fontSize: 12,
    fontWeight: '700',
  },
  postDeleteButton: {
    padding: 7,
  },
  composer: {
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 12,
    padding: 12,
    gap: 13,
  },
  composerInput: {
    minHeight: 105,
    color: DARK,
    fontSize: 14,
    lineHeight: 22,
    textAlignVertical: 'top',
    padding: 2,
  },
  draftPhotoContainer: {
    position: 'relative',
  },
  draftPhoto: {
    width: '100%',
    height: 220,
    borderRadius: 9,
    backgroundColor: '#F1F5F6',
  },
  removeDraftPhoto: {
    position: 'absolute',
    top: 9,
    right: 9,
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(16, 47, 64, 0.8)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  composerDivider: {
    height: 1,
    backgroundColor: BORDER,
  },
  composerFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  addPhotoButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingVertical: 5,
  },
  addPhotoText: {
    color: BLUE,
    fontSize: 12,
    fontWeight: '700',
  },
  optionalText: {
    color: MUTED,
    fontSize: 10,
  },
  publishButton: {
    minHeight: 46,
    borderRadius: 9,
    backgroundColor: BLUE,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  publishButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
  },
  disabledButton: {
    opacity: 0.65,
  },
  cancelButton: {
    alignItems: 'center',
    padding: 7,
  },
  cancelButtonText: {
    color: MUTED,
    fontSize: 12,
    fontWeight: '700',
  },
  helperText: {
    color: MUTED,
    fontSize: 11,
    lineHeight: 17,
    textAlign: 'center',
  },
  summaryCard: {
    backgroundColor: '#F0F8FA',
    borderRadius: 12,
    padding: 15,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  summaryIcon: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  summaryText: {
    flex: 1,
    gap: 3,
  },
  summaryTitle: {
    color: DARK,
    fontSize: 13,
    fontWeight: '800',
  },
  summaryDescription: {
    color: MUTED,
    fontSize: 12,
  },
  photoModal: {
    flex: 1,
    backgroundColor: '#071923',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  closePhotoButton: {
    position: 'absolute',
    top: 55,
    right: 22,
    zIndex: 2,
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  expandedPhoto: {
    width: SCREEN_WIDTH - 24,
    height: '75%',
  },
  expandedPhotoDate: {
    color: '#FFFFFF',
    fontSize: 13,
    marginTop: 18,
  },
});