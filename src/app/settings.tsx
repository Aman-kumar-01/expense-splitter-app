import { useEffect, useState } from 'react';
import {
  Alert,
  Modal,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';

type Expense = {
  id: number;
  title: string;
  amount: number;
  paidBy: string;
  category: string;
  date: string;
  createdAt: string;
};

type DeletedExpense = Expense & {
  deletedAt: string;
  deleteReason: 'individual';
};

type StoredData = {
  groupName: string;
  members: string[];
  expenses: Expense[];
  deletedExpenses?: DeletedExpense[];
};

const STORAGE_KEY = '@expense_splitter_data_v2';

const money = (value: number) =>
  `₹${value.toLocaleString('en-IN', {
    maximumFractionDigits: 2,
  })}`;

const formatDateTime = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

export default function SettingsScreen() {
  const [data, setData] = useState<StoredData>({
    groupName: '',
    members: [],
    expenses: [],
    deletedExpenses: [],
  });

  const [showHistory, setShowHistory] = useState(false);
  const [showClear, setShowClear] = useState(false);
  const [confirmation, setConfirmation] = useState('');

  const loadData = async () => {
    try {
      const saved = await AsyncStorage.getItem(STORAGE_KEY);

      if (saved) {
        const parsed: StoredData = JSON.parse(saved);

        setData({
          groupName: parsed.groupName || '',
          members: parsed.members || [],
          expenses: parsed.expenses || [],
          deletedExpenses: parsed.deletedExpenses || [],
        });
      }
    } catch {
      Alert.alert('Error', 'Could not load settings.');
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const shareSummary = async () => {
    const total = data.expenses.reduce(
      (sum, expense) => sum + expense.amount,
      0
    );

    const perPerson = data.members.length
      ? total / data.members.length
      : 0;

    const text = [
      data.groupName || 'Expense Splitter',
      '',
      `Total spent: ${money(total)}`,
      `Members: ${data.members.length}`,
      `Per person: ${money(perPerson)}`,
      '',
      ...data.expenses.map(
        (expense) =>
          `${expense.title} — ${money(expense.amount)} — ${expense.paidBy}`
      ),
    ].join('\n');

    try {
      await Share.share({ message: text });
    } catch {
      // User cancelled sharing.
    }
  };

  const clearAllExpenses = async () => {
    if (confirmation.trim().toUpperCase() !== 'CLEAR') return;

    try {
      const updated = {
        ...data,
        expenses: [],
        deletedExpenses: [],
      };

      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      setData(updated);
      setConfirmation('');
      setShowClear(false);
    } catch {
      Alert.alert('Error', 'Could not clear expenses.');
    }
  };

  const deleteGroup = () => {
    Alert.alert(
      'Delete group?',
      'This will permanently remove the group, members, expenses and History from this device.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete group',
          style: 'destructive',
          onPress: async () => {
            await AsyncStorage.removeItem(STORAGE_KEY);
            router.replace('/');
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.eyebrow}>GROUP SETTINGS</Text>
        <Text style={styles.title}>Manage your group</Text>

        <Pressable
          style={styles.settingItem}
          onPress={() => router.replace('/?setup=1')}
        >
          <View style={styles.settingIcon}>
            <Text>✎</Text>
          </View>

          <View style={styles.settingInfo}>
            <Text style={styles.settingTitle}>Edit group</Text>
            <Text style={styles.settingSubtitle}>
              Rename group or manage members
            </Text>
          </View>

          <Text style={styles.arrow}>›</Text>
        </Pressable>

        <Pressable style={styles.settingItem} onPress={shareSummary}>
          <View style={styles.settingIcon}>
            <Text>↗</Text>
          </View>

          <View style={styles.settingInfo}>
            <Text style={styles.settingTitle}>Share summary</Text>
            <Text style={styles.settingSubtitle}>
              Send expenses and settlement
            </Text>
          </View>

          <Text style={styles.arrow}>›</Text>
        </Pressable>

        <Pressable
          style={styles.settingItem}
          onPress={() => setShowHistory(true)}
        >
          <View style={styles.settingIcon}>
            <Text>◷</Text>
          </View>

          <View style={styles.settingInfo}>
            <Text style={styles.settingTitle}>History</Text>
            <Text style={styles.settingSubtitle}>
              {data.deletedExpenses?.length || 0} deleted expense
              {(data.deletedExpenses?.length || 0) === 1 ? '' : 's'}
            </Text>
          </View>

          <Text style={styles.arrow}>›</Text>
        </Pressable>

        <Pressable
          style={styles.settingItem}
          onPress={() => {
            setConfirmation('');
            setShowClear(true);
          }}
        >
          <View style={styles.settingIcon}>
            <Text>↺</Text>
          </View>

          <View style={styles.settingInfo}>
            <Text style={styles.settingTitle}>Clear All Expenses</Text>
            <Text style={styles.settingSubtitle}>
              Clear active expenses and History together
            </Text>
          </View>

          <Text style={styles.arrow}>›</Text>
        </Pressable>

        <Pressable
          style={[styles.settingItem, styles.dangerItem]}
          onPress={deleteGroup}
        >
          <View style={styles.dangerIcon}>
            <Text>⌫</Text>
          </View>

          <View style={styles.settingInfo}>
            <Text style={styles.dangerTitle}>Delete group</Text>
            <Text style={styles.settingSubtitle}>
              Remove all data from this device
            </Text>
          </View>

          <Text style={styles.dangerArrow}>›</Text>
        </Pressable>
      </ScrollView>

      <Modal
        visible={showHistory}
        transparent
        animationType="slide"
        onRequestClose={() => setShowHistory(false)}
      >
        <View style={styles.overlay}>
          <View style={styles.modal}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.eyebrow}>EXPENSE HISTORY</Text>
                <Text style={styles.modalTitle}>Deleted expenses</Text>
              </View>

              <Pressable onPress={() => setShowHistory(false)}>
                <Text style={styles.close}>×</Text>
              </Pressable>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              {!data.deletedExpenses?.length ? (
                <Text style={styles.empty}>No deleted expenses.</Text>
              ) : (
                data.deletedExpenses.map((expense) => (
                  <View key={`${expense.id}-${expense.deletedAt}`} style={styles.historyCard}>
                    <View style={styles.historyTop}>
                      <Text style={styles.historyTitle}>{expense.title}</Text>
                      <Text style={styles.historyAmount}>
                        {money(expense.amount)}
                      </Text>
                    </View>

                    <Text style={styles.historyMeta}>
                      Paid by {expense.paidBy} • {expense.category}
                    </Text>

                    <Text style={styles.historyDate}>
                      Entry: {formatDateTime(expense.createdAt || expense.date)}
                    </Text>

                    <Text style={styles.deletedDate}>
                      Deleted: {formatDateTime(expense.deletedAt)}
                    </Text>
                  </View>
                ))
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      <Modal
        visible={showClear}
        transparent
        animationType="fade"
        onRequestClose={() => setShowClear(false)}
      >
        <View style={styles.overlay}>
          <View style={styles.confirmCard}>
            <Text style={styles.modalTitle}>
              Clear all expenses and History?
            </Text>

            <Text style={styles.message}>
              This permanently removes all active expenses and the entire
              History. Your group and members stay.
            </Text>

            <Text style={styles.instruction}>
              Type <Text style={styles.keyword}>CLEAR</Text> to continue.
            </Text>

            <TextInput
              value={confirmation}
              onChangeText={setConfirmation}
              placeholder="Type CLEAR"
              placeholderTextColor="#69717E"
              autoCapitalize="characters"
              autoCorrect={false}
              style={styles.input}
            />

            <View style={styles.actions}>
              <Pressable
                style={styles.cancel}
                onPress={() => setShowClear(false)}
              >
                <Text style={styles.cancelText}>Cancel</Text>
              </Pressable>

              <Pressable
                style={[
                  styles.clear,
                  confirmation.trim().toUpperCase() !== 'CLEAR' &&
                    styles.disabled,
                ]}
                disabled={confirmation.trim().toUpperCase() !== 'CLEAR'}
                onPress={clearAllExpenses}
              >
                <Text style={styles.clearText}>Clear All</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#08080C',
  },
  container: {
    padding: 24,
    paddingBottom: 40,
  },
  eyebrow: {
    color: '#A56BFF',
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 2,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 30,
    fontWeight: '800',
    marginTop: 8,
    marginBottom: 28,
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#111318',
    borderWidth: 1,
    borderColor: '#292D35',
    borderRadius: 18,
    padding: 16,
    marginBottom: 12,
  },
  settingInfo: {
    flex: 1,
    marginHorizontal: 14,
  },
  settingIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: '#211735',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dangerIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: '#32191D',
    alignItems: 'center',
    justifyContent: 'center',
  },
  settingTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  dangerTitle: {
    color: '#FF7B86',
    fontSize: 16,
    fontWeight: '700',
  },
  settingSubtitle: {
    color: '#858B98',
    fontSize: 13,
    marginTop: 4,
  },
  arrow: {
    color: '#8E93A0',
    fontSize: 28,
  },
  dangerArrow: {
    color: '#FF7B86',
    fontSize: 28,
  },
  dangerItem: {
    borderColor: '#4A252B',
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.72)',
    justifyContent: 'flex-end',
  },
  modal: {
    backgroundColor: '#101116',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    maxHeight: '85%',
    padding: 22,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 18,
  },
  modalTitle: {
    color: '#FFFFFF',
    fontSize: 23,
    fontWeight: '800',
    marginTop: 6,
  },
  close: {
    color: '#FFFFFF',
    fontSize: 34,
    lineHeight: 34,
  },
  empty: {
    color: '#858B98',
    textAlign: 'center',
    paddingVertical: 40,
  },
  historyCard: {
    backgroundColor: '#181A21',
    borderWidth: 1,
    borderColor: '#292D35',
    borderRadius: 16,
    padding: 15,
    marginBottom: 10,
  },
  historyTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  historyTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    flex: 1,
  },
  historyAmount: {
    color: '#A56BFF',
    fontSize: 16,
    fontWeight: '800',
  },
  historyMeta: {
    color: '#9CA2AE',
    marginTop: 7,
  },
  historyDate: {
    color: '#B8BCCC',
    fontSize: 12,
    marginTop: 10,
  },
  deletedDate: {
    color: '#FF7B86',
    fontSize: 12,
    marginTop: 4,
  },
  confirmCard: {
    backgroundColor: '#101116',
    margin: 20,
    borderRadius: 24,
    padding: 22,
  },
  message: {
    color: '#9CA2AE',
    lineHeight: 21,
    marginTop: 12,
  },
  instruction: {
    color: '#D4D7DE',
    marginTop: 18,
  },
  keyword: {
    color: '#A56BFF',
    fontWeight: '800',
  },
  input: {
    backgroundColor: '#181A21',
    borderWidth: 1,
    borderColor: '#30343D',
    borderRadius: 14,
    color: '#FFFFFF',
    padding: 14,
    marginTop: 12,
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 16,
  },
  cancel: {
    flex: 1,
    backgroundColor: '#20232A',
    borderRadius: 14,
    padding: 15,
    alignItems: 'center',
  },
  cancelText: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  clear: {
    flex: 1,
    backgroundColor: '#A56BFF',
    borderRadius: 14,
    padding: 15,
    alignItems: 'center',
  },
  disabled: {
    opacity: 0.35,
  },
  clearText: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
});
