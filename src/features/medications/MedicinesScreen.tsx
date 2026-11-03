
import { useMemo, useState } from 'react';
import {
  Alert,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import {
  Pill,
  Plus,
  Pencil,
  Trash2,
  X,
  PackagePlus,
  History,
  ArrowDownLeft,
  ArrowUpRight,
  RotateCcw,
} from 'lucide-react-native';

import { useMedications } from './MedicationContext';
import MedicationForm from './MedicationForm';
import { usePatient } from '../patients/PatientContext';

import type {
  Medicine,
  MedicineDraft,
  InventoryMovement,
} from '../../types/medication';

const COLORS = {
  blue: '#50A9C3',
  dark: '#102F40',
  muted: '#6D8794',
  border: '#D8E3E8',
  background: '#F4FAFC',
};

type ActivePanel =
  | { type: 'replenish'; medicine: Medicine }
  | { type: 'history'; medicine: Medicine }
  | null;

function formatDate(value: string) {
  return new Date(value).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatQuantity(value: number) {
  return Number(value.toFixed(4)).toLocaleString('pt-BR');
}

function movementLabel(type: InventoryMovement['type']) {
  switch (type) {
    case 'entry':
      return 'Reposição';
    case 'administration':
      return 'Administração';
    case 'reversal':
      return 'Estorno';
  }
}

export default function MedicinesScreen() {
  const router = useRouter();

  const {
    medicines,
    loading,
    inventoryMovements,
    addMedicine,
    updateMedicine,
    deleteMedicine,
    toggleMedicine,
    replenishStock,
  } = useMedications();

  const { patient } = usePatient();
  const patientName = patient?.name?.trim() || 'paciente';

  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingMedicine, setEditingMedicine] =
    useState<Medicine | null>(null);

  const [activePanel, setActivePanel] = useState<ActivePanel>(null);
  const [replenishQuantity, setReplenishQuantity] = useState('');
  const [replenishDescription, setReplenishDescription] = useState('');
  const [savingReplenishment, setSavingReplenishment] = useState(false);

  const filteredMedicines = useMemo(
    () =>
      medicines.filter((medicine) =>
        medicine.name
          .toLowerCase()
          .includes(search.toLowerCase().trim()),
      ),
    [medicines, search],
  );

  const activeCount = medicines.filter(
    (medicine) => medicine.active,
  ).length;

  const inactiveCount = medicines.length - activeCount;

  function openNewMedicine() {
    setEditingMedicine(null);
    setShowForm(true);
    setActivePanel(null);
  }

  function openEditMedicine(medicine: Medicine) {
    setEditingMedicine(medicine);
    setShowForm(true);
    setActivePanel(null);
  }

  function closeForm() {
    setShowForm(false);
    setEditingMedicine(null);
  }

  async function handleSave(draft: MedicineDraft) {
    try {
      if (editingMedicine) {
        await updateMedicine(editingMedicine.id, draft);
      } else {
        await addMedicine(draft);
      }

      closeForm();
    } catch {
      Alert.alert(
        'Erro',
        'Não foi possível salvar o medicamento. Tente novamente.',
      );
    }
  }

  async function removeMedicine(medicine: Medicine) {
    try {
      await deleteMedicine(medicine.id);
      setActivePanel(null);
    } catch {
      Alert.alert(
        'Erro',
        'Não foi possível excluir o medicamento. Tente novamente.',
      );
    }
  }

  function confirmDelete(medicine: Medicine) {
    if (Platform.OS === 'web') {
      if (window.confirm(`Deseja excluir ${medicine.name}?`)) {
        void removeMedicine(medicine);
      }
      return;
    }

    Alert.alert(
      'Excluir medicamento',
      `Deseja excluir ${medicine.name}?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Excluir',
          style: 'destructive',
          onPress: () => {
            void removeMedicine(medicine);
          },
        },
      ],
    );
  }

  async function handleToggleMedicine(medicine: Medicine) {
    try {
      await toggleMedicine(medicine.id);
    } catch {
      Alert.alert(
        'Erro',
        'Não foi possível alterar o status do medicamento.',
      );
    }
  }

  function openReplenishment(medicine: Medicine) {
    setReplenishQuantity('');
    setReplenishDescription('');
    setActivePanel({ type: 'replenish', medicine });
  }

  async function handleReplenishment() {
    if (!activePanel || activePanel.type !== 'replenish') return;

    const quantity = Number(
      replenishQuantity.trim().replace(',', '.'),
    );

    if (!Number.isFinite(quantity) || quantity <= 0) {
      Alert.alert(
        'Quantidade inválida',
        'Informe uma quantidade maior que zero.',
      );
      return;
    }

    setSavingReplenishment(true);

    try {
      await replenishStock(
        activePanel.medicine.id,
        quantity,
        replenishDescription,
      );

      setActivePanel(null);
      setReplenishQuantity('');
      setReplenishDescription('');

      Alert.alert(
        'Estoque atualizado',
        'A reposição foi registrada com sucesso.',
      );
    } catch (error) {
      Alert.alert(
        'Erro na reposição',
        error instanceof Error
          ? error.message
          : 'Não foi possível atualizar o estoque.',
      );
    } finally {
      setSavingReplenishment(false);
    }
  }

  const selectedHistory =
    activePanel?.type === 'history'
      ? inventoryMovements
          .filter(
            (movement) =>
              movement.medicineId === activePanel.medicine.id,
          )
          .sort(
            (a, b) =>
              new Date(b.date).getTime() -
              new Date(a.date).getTime(),
          )
      : [];

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.heading}>
          <Text style={styles.kicker}>Acompanhamento AICare</Text>
          <Text style={styles.title}>Medicamentos</Text>
          <Text style={styles.description}>
            {`Cadastre e acompanhe os medicamentos de ${patientName}.`}
          </Text>
        </View>

        {!showForm && (
          <View style={styles.headerActions}>
            <Pressable
              style={styles.assistantButton}
              onPress={() => router.push('/assistente-medicamentos')}
            >
              <Pill size={19} color={COLORS.blue} />
              <Text style={styles.assistantButtonText}>
                Assistente de medicamentos
              </Text>
            </Pressable>

            <Pressable
              style={styles.addButton}
              onPress={openNewMedicine}
            >
              <Plus size={19} color="#FFFFFF" />
              <Text style={styles.addButtonText}>
                Novo medicamento
              </Text>
            </Pressable>
          </View>
        )}
      </View>

      {showForm ? (
        <View style={styles.formContainer}>
          <View style={styles.formHeader}>
            <Text style={styles.sectionTitle}>
              {editingMedicine ? 'Editar cadastro' : 'Novo cadastro'}
            </Text>

            <Pressable
              onPress={closeForm}
              style={styles.closeButton}
            >
              <X size={20} color={COLORS.muted} />
            </Pressable>
          </View>

          <MedicationForm
            initialData={editingMedicine}
            onSave={handleSave}
            onCancel={closeForm}
          />
        </View>
      ) : (
        <>
          <View style={styles.summary}>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryNumber}>
                {medicines.length}
              </Text>
              <Text style={styles.summaryLabel}>Cadastrados</Text>
            </View>

            <View style={styles.summaryItem}>
              <Text style={styles.summaryNumber}>
                {activeCount}
              </Text>
              <Text style={styles.summaryLabel}>Ativos</Text>
            </View>

            <View style={styles.summaryItem}>
              <Text style={styles.summaryNumber}>
                {inactiveCount}
              </Text>
              <Text style={styles.summaryLabel}>Inativos</Text>
            </View>
          </View>

          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Buscar medicamento..."
            placeholderTextColor={COLORS.muted}
            style={styles.search}
          />

          {loading ? (
            <Text style={styles.description}>
              Carregando medicamentos...
            </Text>
          ) : filteredMedicines.length === 0 ? (
            <View style={styles.emptyCard}>
              <Pill size={30} color={COLORS.blue} />

              <Text style={styles.emptyTitle}>
                {medicines.length === 0
                  ? 'Nenhum medicamento cadastrado'
                  : 'Nenhum resultado encontrado'}
              </Text>

              <Text style={styles.description}>
                {medicines.length === 0
                  ? `Comece adicionando o primeiro medicamento de ${patientName}.`
                  : 'Tente buscar por outro nome.'}
              </Text>

              {medicines.length === 0 && (
                <Pressable
                  style={styles.addButton}
                  onPress={openNewMedicine}
                >
                  <Plus size={18} color="#FFFFFF" />
                  <Text style={styles.addButtonText}>
                    Cadastrar medicamento
                  </Text>
                </Pressable>
              )}
            </View>
          ) : (
            filteredMedicines.map((medicine) => {
              const stock = Number(
                medicine.stockQuantity.replace(',', '.'),
              );

              const minimumStock = Number(
                (medicine.minimumStock ?? '5').replace(',', '.'),
              );

              const hasStock = medicine.stockQuantity.trim() !== '';

              const isLowStock =
                hasStock &&
                Number.isFinite(stock) &&
                Number.isFinite(minimumStock) &&
                stock > 0 &&
                stock <= minimumStock;

              const isOutOfStock =
                hasStock &&
                Number.isFinite(stock) &&
                stock <= 0;

              return (
                <View
                  key={medicine.id}
                  style={styles.medicineCard}
                >
                  <View style={styles.medicineInfo}>
                    <View style={styles.nameRow}>
                      <Text style={styles.medicineName}>
                        {medicine.name}
                      </Text>

                      <View
                        style={[
                          styles.activeBadge,
                          !medicine.active && styles.inactiveBadge,
                        ]}
                      >
                        <Text style={styles.badgeText}>
                          {medicine.active ? 'Ativo' : 'Inativo'}
                        </Text>
                      </View>
                    </View>

                    <Text style={styles.dosage}>
                      {medicine.dosage}
                    </Text>

                    <Text style={styles.description}>
                      Horário: {medicine.firstTime} · Intervalo:{' '}
                      {medicine.intervalHours}h
                    </Text>

                    {!!medicine.instructions && (
                      <Text style={styles.description}>
                        Instruções: {medicine.instructions}
                      </Text>
                    )}

                    <Text style={styles.description}>
                      {medicine.continuous
                        ? 'Uso contínuo'
                        : `Término: ${medicine.endDate}`}
                    </Text>

                    {hasStock && (
                      <View style={styles.stockBox}>
                        <View>
                          <Text style={styles.stockLabel}>
                            Estoque disponível
                          </Text>
                          <Text style={styles.stockValue}>
                            {medicine.stockQuantity}{' '}
                            {medicine.stockUnit}
                          </Text>
                        </View>

                        <View
                          style={[
                            styles.stockBadge,
                            isOutOfStock
                              ? styles.outOfStockBadge
                              : isLowStock
                                ? styles.lowStockBadge
                                : styles.availableBadge,
                          ]}
                        >
                          <Text
                            style={[
                              styles.stockBadgeText,
                              isOutOfStock
                                ? styles.outOfStockText
                                : isLowStock
                                  ? styles.lowStockText
                                  : styles.availableText,
                            ]}
                          >
                            {isOutOfStock
                              ? 'Esgotado'
                              : isLowStock
                                ? 'Estoque baixo'
                                : 'Disponível'}
                          </Text>
                        </View>
                      </View>
                    )}
                  </View>

                  <View style={styles.cardActions}>
                    <View style={styles.inventoryActions}>
                      <Pressable
                        style={styles.inventoryButton}
                        onPress={() => openReplenishment(medicine)}
                      >
                        <PackagePlus size={17} color={COLORS.blue} />
                        <Text style={styles.inventoryButtonText}>
                          Repor estoque
                        </Text>
                      </Pressable>

                      <Pressable
                        style={styles.inventoryButton}
                        onPress={() =>
                          setActivePanel({
                            type: 'history',
                            medicine,
                          })
                        }
                      >
                        <History size={17} color={COLORS.dark} />
                        <Text style={styles.historyButtonText}>
                          Histórico
                        </Text>
                      </Pressable>
                    </View>

                    <Pressable
                      style={[
                        styles.activationButton,
                        !medicine.active && styles.reactivateButton,
                      ]}
                      onPress={() => {
                        void handleToggleMedicine(medicine);
                      }}
                    >
                      <Text
                        style={[
                          styles.activationText,
                          !medicine.active && styles.reactivateText,
                        ]}
                      >
                        {medicine.active
                          ? 'Desativar medicamento'
                          : 'Ativar medicamento'}
                      </Text>
                    </Pressable>

                    <View style={styles.iconActions}>
                      <Pressable
                        accessibilityLabel={`Editar ${medicine.name}`}
                        style={styles.iconButton}
                        onPress={() => openEditMedicine(medicine)}
                      >
                        <Pencil size={18} color={COLORS.blue} />
                        <Text style={styles.iconLabel}>Editar</Text>
                      </Pressable>

                      <Pressable
                        accessibilityLabel={`Excluir ${medicine.name}`}
                        style={styles.iconButton}
                        onPress={() => confirmDelete(medicine)}
                      >
                        <Trash2 size={18} color="#B54A4A" />
                        <Text style={styles.deleteLabel}>
                          Excluir
                        </Text>
                      </Pressable>
                    </View>
                  </View>
                </View>
              );
            })
          )}
        </>
      )}

      {activePanel && (
        <View style={styles.overlay}>
          <View style={styles.panel}>
            <View style={styles.panelHeader}>
              <View style={styles.panelHeading}>
                <Text style={styles.panelTitle}>
                  {activePanel.type === 'replenish'
                    ? 'Reposição de estoque'
                    : 'Histórico de estoque'}
                </Text>

                <Text style={styles.description}>
                  {activePanel.medicine.name}
                </Text>
              </View>

              <Pressable
                style={styles.closeButton}
                onPress={() => setActivePanel(null)}
              >
                <X size={21} color={COLORS.muted} />
              </Pressable>
            </View>

            {activePanel.type === 'replenish' ? (
              <View style={styles.panelContent}>
                <View style={styles.currentStock}>
                  <Text style={styles.stockLabel}>
                    Saldo atual
                  </Text>
                  <Text style={styles.stockValue}>
                    {activePanel.medicine.stockQuantity || '0'}{' '}
                    {activePanel.medicine.stockUnit}
                  </Text>
                </View>

                <Text style={styles.fieldLabel}>
                  Quantidade recebida
                </Text>

                <TextInput
                  value={replenishQuantity}
                  onChangeText={setReplenishQuantity}
                  placeholder="Ex.: 30"
                  placeholderTextColor={COLORS.muted}
                  keyboardType="decimal-pad"
                  style={styles.input}
                />

                <Text style={styles.unitHint}>
                  Unidade: {activePanel.medicine.stockUnit}
                </Text>

                <Text style={styles.fieldLabel}>
                  Observação (opcional)
                </Text>

                <TextInput
                  value={replenishDescription}
                  onChangeText={setReplenishDescription}
                  placeholder="Ex.: Compra realizada em 02/11"
                  placeholderTextColor={COLORS.muted}
                  style={styles.input}
                />

                <Pressable
                  style={[
                    styles.confirmButton,
                    savingReplenishment && styles.disabledButton,
                  ]}
                  disabled={savingReplenishment}
                  onPress={() => {
                    void handleReplenishment();
                  }}
                >
                  <PackagePlus size={18} color="#FFFFFF" />
                  <Text style={styles.confirmButtonText}>
                    {savingReplenishment
                      ? 'Salvando...'
                      : 'Confirmar reposição'}
                  </Text>
                </Pressable>
              </View>
            ) : (
              <ScrollView
                style={styles.historyList}
                contentContainerStyle={styles.historyContent}
              >
                {selectedHistory.length === 0 ? (
                  <View style={styles.emptyHistory}>
                    <History size={30} color={COLORS.blue} />
                    <Text style={styles.emptyTitle}>
                      Nenhuma movimentação registrada
                    </Text>
                    <Text style={styles.description}>
                      As entradas e saídas aparecerão aqui.
                    </Text>
                  </View>
                ) : (
                  selectedHistory.map((movement) => {
                    const isEntry = movement.type === 'entry';
                    const isReversal = movement.type === 'reversal';

                    return (
                      <View
                        key={movement.id}
                        style={styles.movementCard}
                      >
                        <View
                          style={[
                            styles.movementIcon,
                            isEntry
                              ? styles.entryIcon
                              : isReversal
                                ? styles.reversalIcon
                                : styles.exitIcon,
                          ]}
                        >
                          {isEntry ? (
                            <ArrowDownLeft
                              size={18}
                              color="#27845A"
                            />
                          ) : isReversal ? (
                            <RotateCcw
                              size={18}
                              color={COLORS.blue}
                            />
                          ) : (
                            <ArrowUpRight
                              size={18}
                              color="#B54A4A"
                            />
                          )}
                        </View>

                        <View style={styles.movementInfo}>
                          <Text style={styles.movementTitle}>
                            {movementLabel(movement.type)}
                          </Text>

                          <Text style={styles.movementDate}>
                            {formatDate(movement.date)}
                          </Text>

                          {!!movement.description && (
                            <Text style={styles.movementDescription}>
                              {movement.description}
                            </Text>
                          )}
                        </View>

                        <Text
                          style={[
                            styles.movementQuantity,
                            isEntry || isReversal
                              ? styles.positiveQuantity
                              : styles.negativeQuantity,
                          ]}
                        >
                          {isEntry || isReversal ? '+' : '-'}
                          {formatQuantity(movement.quantity)}{' '}
                          {movement.unit}
                        </Text>
                      </View>
                    );
                  })
                )}
              </ScrollView>
            )}
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 20,
  },
  header: {
    gap: 16,
  },
  headerActions: {
    gap: 10,
  },
  heading: {
    gap: 5,
  },
  kicker: {
    color: COLORS.dark,
    fontSize: 12,
  },
  title: {
    color: '#0A293A',
    fontSize: 27,
    fontWeight: '800',
  },
  description: {
    color: COLORS.muted,
    fontSize: 13,
    lineHeight: 20,
  },
  assistantButton: {
    backgroundColor: '#EAF5F8',
    borderWidth: 1,
    borderColor: '#C8E3EB',
    borderRadius: 9,
    padding: 13,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  assistantButtonText: {
    color: COLORS.dark,
    fontWeight: '800',
    fontSize: 14,
  },
  addButton: {
    backgroundColor: COLORS.blue,
    borderRadius: 9,
    padding: 13,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  addButtonText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 14,
  },
  summary: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 10,
    padding: 15,
    justifyContent: 'space-around',
  },
  summaryItem: {
    alignItems: 'center',
    gap: 4,
  },
  summaryNumber: {
    color: COLORS.dark,
    fontSize: 21,
    fontWeight: '800',
  },
  summaryLabel: {
    color: COLORS.muted,
    fontSize: 11,
  },
  search: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    padding: 13,
    color: COLORS.dark,
  },
  emptyCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 10,
    padding: 24,
    alignItems: 'center',
    gap: 13,
  },
  emptyTitle: {
    color: COLORS.dark,
    fontSize: 16,
    fontWeight: '800',
    textAlign: 'center',
  },
  formContainer: {
    gap: 14,
  },
  formHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sectionTitle: {
    color: COLORS.dark,
    fontSize: 17,
    fontWeight: '800',
  },
  closeButton: {
    padding: 8,
  },
  medicineCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 10,
    padding: 16,
    gap: 15,
  },
  medicineInfo: {
    gap: 6,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  medicineName: {
    color: COLORS.dark,
    fontSize: 17,
    fontWeight: '800',
    flex: 1,
  },
  dosage: {
    color: COLORS.dark,
    fontSize: 14,
    fontWeight: '600',
  },
  activeBadge: {
    backgroundColor: '#E5F5EC',
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 20,
  },
  inactiveBadge: {
    backgroundColor: '#EEEEEE',
  },
  badgeText: {
    color: COLORS.dark,
    fontSize: 10,
    fontWeight: '700',
  },
  stockBox: {
    backgroundColor: COLORS.background,
    borderRadius: 9,
    padding: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
    marginTop: 5,
  },
  stockLabel: {
    color: COLORS.muted,
    fontSize: 11,
  },
  stockValue: {
    color: COLORS.dark,
    fontSize: 16,
    fontWeight: '800',
    marginTop: 3,
  },
  stockBadge: {
    borderRadius: 20,
    paddingHorizontal: 9,
    paddingVertical: 6,
  },
  availableBadge: {
    backgroundColor: '#E5F5EC',
  },
  lowStockBadge: {
    backgroundColor: '#FFF1DF',
  },
  outOfStockBadge: {
    backgroundColor: '#FCE9E7',
  },
  stockBadgeText: {
    fontSize: 10,
    fontWeight: '700',
  },
  availableText: {
    color: '#27845A',
  },
  lowStockText: {
    color: '#A66A20',
  },
  outOfStockText: {
    color: '#B54A4A',
  },
  cardActions: {
    gap: 10,
  },
  inventoryActions: {
    flexDirection: 'row',
    gap: 9,
  },
  inventoryButton: {
    flex: 1,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    padding: 11,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
  },
  inventoryButtonText: {
    color: COLORS.blue,
    fontWeight: '800',
    fontSize: 12,
  },
  historyButtonText: {
    color: COLORS.dark,
    fontWeight: '800',
    fontSize: 12,
  },
  activationButton: {
    backgroundColor: '#FCE9E7',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  activationText: {
    color: '#B54A4A',
    fontWeight: '800',
    fontSize: 12,
  },
  reactivateButton: {
    backgroundColor: '#E5F5EC',
  },
  reactivateText: {
    color: '#27845A',
  },
  iconActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 18,
  },
  iconButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    padding: 7,
  },
  iconLabel: {
    color: COLORS.blue,
    fontSize: 12,
    fontWeight: '700',
  },
  deleteLabel: {
    color: '#B54A4A',
    fontSize: 12,
    fontWeight: '700',
  },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(10, 41, 58, 0.35)',
    justifyContent: 'center',
    padding: 12,
    zIndex: 10,
  },
  panel: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 18,
    maxHeight: '90%',
    gap: 18,
  },
  panelHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  panelHeading: {
    flex: 1,
    gap: 4,
  },
  panelTitle: {
    color: COLORS.dark,
    fontSize: 19,
    fontWeight: '800',
  },
  panelContent: {
    gap: 12,
  },
  currentStock: {
    backgroundColor: COLORS.background,
    borderRadius: 9,
    padding: 13,
  },
  fieldLabel: {
    color: COLORS.dark,
    fontSize: 13,
    fontWeight: '700',
    marginTop: 4,
  },
  input: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    padding: 12,
    color: COLORS.dark,
  },
  unitHint: {
    color: COLORS.muted,
    fontSize: 12,
    marginTop: -7,
  },
  confirmButton: {
    backgroundColor: COLORS.blue,
    borderRadius: 9,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 8,
  },
  confirmButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
  },
  disabledButton: {
    opacity: 0.6,
  },
  historyList: {
    maxHeight: 450,
  },
  historyContent: {
    gap: 10,
    paddingBottom: 5,
  },
  emptyHistory: {
    alignItems: 'center',
    gap: 12,
    padding: 20,
  },
  movementCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 9,
  },
  movementIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  entryIcon: {
    backgroundColor: '#E5F5EC',
  },
  exitIcon: {
    backgroundColor: '#FCE9E7',
  },
  reversalIcon: {
    backgroundColor: '#E5F2F7',
  },
  movementInfo: {
    flex: 1,
    gap: 3,
  },
  movementTitle: {
    color: COLORS.dark,
    fontSize: 13,
    fontWeight: '800',
  },
  movementDate: {
    color: COLORS.muted,
    fontSize: 10,
  },
  movementDescription: {
    color: COLORS.muted,
    fontSize: 11,
  },
  movementQuantity: {
    fontSize: 12,
    fontWeight: '800',
    textAlign: 'right',
  },
  positiveQuantity: {
    color: '#27845A',
  },
  negativeQuantity: {
    color: '#B54A4A',
  },
});
