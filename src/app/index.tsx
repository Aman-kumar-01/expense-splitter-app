import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';

type Expense = {
  id: number;
  title: string;
  amount: number;
  paidBy: string;
  category: string;
  date: string;
};

type StoredData = {
  groupName: string;
  members: string[];
  expenses: Expense[];
};

type Screen = 'home' | 'setup';

const STORAGE_KEY = '@expense_splitter_data_v2';

const CATEGORIES = ['Food', 'Travel', 'Stay', 'Shopping', 'Bills', 'Other'];

const money = (value: number) =>
  `₹${value.toLocaleString('en-IN', {
    maximumFractionDigits: 2,
  })}`;

export default function HomeScreen() {
  const [groupName, setGroupName] = useState('');
  const [memberName, setMemberName] = useState('');
  const [members, setMembers] = useState<string[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);

  const [expenseTitle, setExpenseTitle] = useState('');
  const [expenseAmount, setExpenseAmount] = useState('');
  const [paidBy, setPaidBy] = useState('');
  const [category, setCategory] = useState('Food');

  const [screen, setScreen] = useState<Screen>('setup');
  const [loaded, setLoaded] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showClearModal, setShowClearModal] = useState(false);
  const [clearConfirmation, setClearConfirmation] = useState('');
  const [showAllExpenses, setShowAllExpenses] = useState(false);
  const [search, setSearch] = useState('');

  useEffect(() => {
    const loadData = async () => {
      try {
        const saved = await AsyncStorage.getItem(STORAGE_KEY);

        if (saved) {
          const data: StoredData = JSON.parse(saved);
          setGroupName(data.groupName || '');
          setMembers(data.members || []);
          setExpenses(data.expenses || []);
          setPaidBy(data.members?.[0] || '');
          setScreen(
            data.groupName && data.members?.length >= 2 ? 'home' : 'setup'
          );
        }
      } catch {
        Alert.alert('Could not load data', 'Starting with a fresh group.');
      } finally {
        setLoaded(true);
      }
    };

    loadData();
  }, []);

  useEffect(() => {
    if (!loaded) return;

    const saveData = async () => {
      try {
        const data: StoredData = {
          groupName,
          members,
          expenses,
        };
        await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(data));
      } catch {
        // Keep the app usable even if storage temporarily fails.
      }
    };

    saveData();
  }, [groupName, members, expenses, loaded]);

  const total = useMemo(
    () => expenses.reduce((sum, item) => sum + item.amount, 0),
    [expenses]
  );

  const perPerson = members.length ? total / members.length : 0;

  const filteredExpenses = useMemo(() => {
    const query = search.trim().toLowerCase();

    const filtered = query
      ? expenses.filter(
          (item) =>
            item.title.toLowerCase().includes(query) ||
            item.paidBy.toLowerCase().includes(query) ||
            item.category.toLowerCase().includes(query)
        )
      : expenses;

    return filtered.slice().reverse();
  }, [expenses, search]);

  const visibleExpenses = showAllExpenses
    ? filteredExpenses
    : filteredExpenses.slice(0, 5);

  const addMember = () => {
    const name = memberName.trim();

    if (!name) return;

    if (members.some((item) => item.toLowerCase() === name.toLowerCase())) {
      Alert.alert('Already added', `${name} is already in the group.`);
      return;
    }

    setMembers((prev) => [...prev, name]);
    if (!paidBy) setPaidBy(name);
    setMemberName('');
  };

  const removeMember = (name: string) => {
    if (members.length <= 2) {
      Alert.alert(
        'Need at least 2 members',
        'An expense group needs at least two members.'
      );
      return;
    }

    const hasExpenses = expenses.some((expense) => expense.paidBy === name);

    if (hasExpenses) {
      Alert.alert(
        'Cannot remove member',
        `${name} has paid expenses. Remove those expenses first.`
      );
      return;
    }

    Alert.alert(
      `Remove ${name}?`,
      'This member will be removed from the group. This action cannot be undone.',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => {
            setMembers((prev) => prev.filter((item) => item !== name));

            if (paidBy === name) {
              const next = members.find((item) => item !== name);
              setPaidBy(next || '');
            }
          },
        },
      ]
    );
  };

  const createGroup = () => {
    const cleanName = groupName.trim();

    if (!cleanName) {
      Alert.alert('Group name required', 'Enter a name for your group.');
      return;
    }

    if (members.length < 2) {
      Alert.alert('Add members', 'Add at least 2 members.');
      return;
    }

    setPaidBy((current) => current || members[0]);
    setScreen('home');
  };

  const addExpense = () => {
    const title = expenseTitle.trim();
    const amount = Number(expenseAmount);

    if (!title || !Number.isFinite(amount) || amount <= 0 || !paidBy) {
      Alert.alert(
        'Missing details',
        'Enter expense, amount and select who paid.'
      );
      return;
    }

    const newExpense: Expense = {
      id: Date.now(),
      title,
      amount,
      paidBy,
      category,
      date: new Date().toISOString(),
    };

    setExpenses((prev) => [...prev, newExpense]);
    setExpenseTitle('');
    setExpenseAmount('');
    setCategory('Food');
  };

  const deleteExpense = (id: number) => {
    Alert.alert('Remove expense?', 'This expense will be deleted.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: () =>
          setExpenses((prev) => prev.filter((item) => item.id !== id)),
      },
    ]);
  };

  const getPaid = (member: string) =>
    expenses
      .filter((expense) => expense.paidBy === member)
      .reduce((sum, expense) => sum + expense.amount, 0);

  const getBalance = (member: string) => getPaid(member) - perPerson;

  const settlements = useMemo(() => {
    const balances = members
      .map((member) => ({
        name: member,
        amount: getBalance(member),
      }))
      .filter((item) => Math.abs(item.amount) > 0.01);

    const creditors = balances
      .filter((item) => item.amount > 0)
      .map((item) => ({ ...item }))
      .sort((a, b) => b.amount - a.amount);

    const debtors = balances
      .filter((item) => item.amount < 0)
      .map((item) => ({ ...item, amount: Math.abs(item.amount) }))
      .sort((a, b) => b.amount - a.amount);

    const result: { from: string; to: string; amount: number }[] = [];

    let i = 0;
    let j = 0;

    while (i < debtors.length && j < creditors.length) {
      const amount = Math.min(debtors[i].amount, creditors[j].amount);

      result.push({
        from: debtors[i].name,
        to: creditors[j].name,
        amount,
      });

      debtors[i].amount -= amount;
      creditors[j].amount -= amount;

      if (debtors[i].amount < 0.01) i++;
      if (creditors[j].amount < 0.01) j++;
    }

    return result;
  }, [members, expenses, perPerson]);

  const shareSummary = async () => {
    if (!members.length) return;

    const lines = [
      `${groupName || 'Expense Splitter'} — Expense Summary`,
      '',
      `Total spent: ${money(total)}`,
      `People: ${members.length}`,
      `Per person: ${money(perPerson)}`,
      '',
      'Expenses:',
      ...expenses.map(
        (expense) =>
          `• ${expense.title} — ${money(expense.amount)} (paid by ${expense.paidBy})`
      ),
      '',
      'Settlement:',
      ...(settlements.length
        ? settlements.map(
            (item) =>
              `• ${item.from} pays ${item.to} ${money(item.amount)}`
          )
        : ['• Everyone is settled up.']),
    ];

    try {
      await Share.share({ message: lines.join('\n') });
    } catch {
      // User cancelled sharing.
    }
  };

  const openClearModal = () => {
    if (expenses.length === 0) {
      Alert.alert('Nothing to clear', 'There are no expenses to remove.');
      return;
    }

    setClearConfirmation('');
    setShowClearModal(true);
  };

  const closeClearModal = () => {
    setClearConfirmation('');
    setShowClearModal(false);
  };

  const confirmClearExpenses = () => {
    if (clearConfirmation.trim().toUpperCase() !== 'CLEAR') {
      Alert.alert(
        'Confirmation required',
        'Type CLEAR exactly to permanently remove all expenses.'
      );
      return;
    }

    setExpenses([]);
    closeClearModal();
  };

  const deleteGroup = () => {
    Alert.alert(
      'Delete group?',
      'This will permanently clear the group, members and expenses from this device.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            await AsyncStorage.removeItem(STORAGE_KEY);
            setGroupName('');
            setMembers([]);
            setExpenses([]);
            setPaidBy('');
            setExpenseTitle('');
            setExpenseAmount('');
            setScreen('setup');
            setShowSettings(false);
          },
        },
      ]
    );
  };

  if (!loaded) {
    return (
      <View style={styles.loading}>
        <StatusBar barStyle="light-content" backgroundColor="#07090D" />
        <Text style={styles.loadingLogo}>EXPENSE SPLITTER</Text>
        <Text style={styles.loadingText}>Loading your group...</Text>
      </View>
    );
  }

  if (screen === 'setup') {
    return (
      <SafeAreaView style={styles.root} edges={['top', 'left', 'right']}>
        <StatusBar barStyle="light-content" backgroundColor="#07090D" />

        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <ScrollView
            contentContainerStyle={styles.setupContainer}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {groupName ? (
              <Pressable
                style={styles.backButton}
                onPress={() => setScreen('home')}
                hitSlop={10}
              >
                <Text style={styles.back}>‹ Back</Text>
              </Pressable>
            ) : null}

            <Text style={styles.setupEyebrow}>EXPENSE SPLITTER</Text>
            <Text style={styles.setupTitle}>
              {groupName ? 'Edit your group' : 'Create your group'}
            </Text>
            <Text style={styles.setupSubtitle}>
              Add your friends and start tracking shared expenses.
            </Text>

            <View style={styles.fieldBlock}>
              <Text style={styles.label}>GROUP NAME</Text>
              <TextInput
                value={groupName}
                onChangeText={setGroupName}
                placeholder="e.g. Goa Trip"
                placeholderTextColor="#6B7280"
                style={styles.input}
                maxLength={40}
              />
            </View>

            <View style={styles.fieldBlock}>
              <Text style={styles.label}>ADD MEMBERS</Text>

              <View style={styles.addMemberRow}>
                <TextInput
                  value={memberName}
                  onChangeText={setMemberName}
                  placeholder="Friend's name"
                  placeholderTextColor="#6B7280"
                  style={[styles.input, styles.memberInput]}
                  onSubmitEditing={addMember}
                  returnKeyType="done"
                  maxLength={30}
                />

                <Pressable
                  style={({ pressed }) => [
                    styles.addButton,
                    pressed && styles.pressed,
                  ]}
                  onPress={addMember}
                >
                  <Text style={styles.addButtonText}>+</Text>
                </Pressable>
              </View>
            </View>

            <View style={styles.memberList}>
              {members.map((member) => (
                <View style={styles.memberChip} key={member}>
                  <View style={styles.avatar}>
                    <Text style={styles.avatarText}>
                      {member.charAt(0).toUpperCase()}
                    </Text>
                  </View>

                  <Text style={styles.memberName}>{member}</Text>

                  <Pressable
                    onPress={() => removeMember(member)}
                    hitSlop={10}
                  >
                    <Text style={styles.remove}>×</Text>
                  </Pressable>
                </View>
              ))}

              {members.length === 0 && (
                <View style={styles.emptyMembers}>
                  <Text style={styles.emptyMembersText}>
                    Add at least 2 people to start
                  </Text>
                </View>
              )}
            </View>

            <Pressable
              style={({ pressed }) => [
                styles.primaryAction,
                pressed && styles.pressed,
              ]}
              onPress={createGroup}
            >
              <Text style={styles.primaryActionText}>
                {groupName ? 'Save Changes' : 'Create Group'}
              </Text>
              <Text style={styles.arrow}>→</Text>
            </Pressable>

            {groupName ? (
              <Pressable onPress={deleteGroup} style={styles.deleteGroupButton}>
                <Text style={styles.deleteGroupText}>Delete this group</Text>
              </Pressable>
            ) : null}
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.root} edges={['top', 'left', 'right']}>
      <StatusBar barStyle="light-content" backgroundColor="#07090D" />

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.container}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* HEADER */}
          <View style={styles.header}>
            <View style={styles.headerText}>
              <Text style={styles.eyebrow}>EXPENSE SPLITTER</Text>
              <Text style={styles.groupTitle} numberOfLines={1}>
                {groupName || 'Your Group'}
              </Text>
            </View>

            <Pressable
              style={({ pressed }) => [
                styles.settingsButton,
                pressed && styles.settingsPressed,
              ]}
              onPress={() => setShowSettings(true)}
              hitSlop={8}
            >
              <Text style={styles.settingsIcon}>⚙</Text>
            </Pressable>
          </View>

          {/* SUMMARY */}
          <View style={styles.heroCard}>
            <Text style={styles.heroLabel}>TOTAL SPENT</Text>
            <Text style={styles.heroAmount}>{money(total)}</Text>

            <View style={styles.heroBottom}>
              <View style={styles.heroBadge}>
                <Text style={styles.heroBadgeText}>
                  {members.length} {members.length === 1 ? 'person' : 'people'}
                </Text>
              </View>

              <Text style={styles.heroSmall}>
                {expenses.length} {expenses.length === 1 ? 'expense' : 'expenses'}
              </Text>
            </View>
          </View>

          <View style={styles.statsRow}>
            <View style={styles.statCard}>
              <Text style={styles.statLabel}>PER PERSON</Text>
              <Text style={styles.statValue}>{money(perPerson)}</Text>
            </View>

            <View style={styles.statCard}>
              <Text style={styles.statLabel}>MEMBERS</Text>
              <Text style={styles.statValue}>{members.length}</Text>
            </View>
          </View>

          {/* ADD EXPENSE */}
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Add expense</Text>
            <Text style={styles.sectionHint}>Split equally</Text>
          </View>

          <View style={styles.expenseForm}>
            <TextInput
              value={expenseTitle}
              onChangeText={setExpenseTitle}
              placeholder="What did you pay for?"
              placeholderTextColor="#667085"
              style={styles.formInput}
              maxLength={50}
              returnKeyType="next"
            />

            <View style={styles.amountRow}>
              <View style={styles.amountInputWrap}>
                <Text style={styles.rupee}>₹</Text>
                <TextInput
                  value={expenseAmount}
                  onChangeText={setExpenseAmount}
                  placeholder="0"
                  placeholderTextColor="#667085"
                  keyboardType="decimal-pad"
                  style={styles.amountInput}
                />
              </View>

              <Pressable
                style={({ pressed }) => [
                  styles.addExpenseButton,
                  pressed && styles.pressed,
                ]}
                onPress={addExpense}
              >
                <Text style={styles.addExpenseText}>Add</Text>
              </Pressable>
            </View>

            <Text style={styles.paidLabel}>CATEGORY</Text>

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.chipScroll}
            >
              {CATEGORIES.map((item) => (
                <Pressable
                  key={item}
                  onPress={() => setCategory(item)}
                  style={[
                    styles.categoryChip,
                    category === item && styles.categoryChipActive,
                  ]}
                >
                  <Text
                    style={[
                      styles.categoryText,
                      category === item && styles.categoryTextActive,
                    ]}
                  >
                    {item}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>

            <Text style={[styles.paidLabel, styles.paidLabelTop]}>PAID BY</Text>

            {members.length ? (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.payerScroll}
              >
                {members.map((member) => {
                  const active = paidBy === member;

                  return (
                    <Pressable
                      key={member}
                      onPress={() => setPaidBy(member)}
                      style={[
                        styles.payer,
                        active && styles.payerActive,
                      ]}
                    >
                      <View
                        style={[
                          styles.payerDot,
                          active && styles.payerDotActive,
                        ]}
                      >
                        <Text style={styles.payerInitial}>
                          {member.charAt(0).toUpperCase()}
                        </Text>
                      </View>

                      <Text
                        style={[
                          styles.payerText,
                          active && styles.payerTextActive,
                        ]}
                      >
                        {member}
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
            ) : (
              <Text style={styles.noMembersText}>
                Add members in Settings first.
              </Text>
            )}
          </View>

          {/* EXPENSES */}
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Expenses</Text>
            <Text style={styles.sectionHint}>{expenses.length} total</Text>
          </View>

          {expenses.length > 0 ? (
            <View style={styles.searchBox}>
              <Text style={styles.searchIcon}>⌕</Text>
              <TextInput
                value={search}
                onChangeText={setSearch}
                placeholder="Search expenses..."
                placeholderTextColor="#667085"
                style={styles.searchInput}
              />
            </View>
          ) : null}

          <View style={styles.listCard}>
            {visibleExpenses.length === 0 ? (
              <View style={styles.emptyState}>
                <Text style={styles.emptyIcon}>₹</Text>
                <Text style={styles.emptyTitle}>
                  {search ? 'No matching expenses' : 'No expenses yet'}
                </Text>
                <Text style={styles.emptyText}>
                  {search
                    ? 'Try another search.'
                    : 'Add your first expense above.'}
                </Text>
              </View>
            ) : (
              visibleExpenses.map((expense, index) => (
                <View
                  style={[
                    styles.expenseItem,
                    index === visibleExpenses.length - 1 &&
                      styles.lastListItem,
                  ]}
                  key={expense.id}
                >
                  <View style={styles.expenseIcon}>
                    <Text style={styles.expenseIconText}>
                      {expense.category === 'Food'
                        ? '🍴'
                        : expense.category === 'Travel'
                          ? '✈'
                          : expense.category === 'Stay'
                            ? '⌂'
                            : expense.category === 'Shopping'
                              ? '◇'
                              : expense.category === 'Bills'
                                ? '▤'
                                : '₹'}
                    </Text>
                  </View>

                  <View style={styles.expenseInfo}>
                    <Text style={styles.expenseName} numberOfLines={1}>
                      {expense.title}
                    </Text>
                    <Text style={styles.expenseMeta} numberOfLines={1}>
                      {expense.paidBy} • {expense.category}
                    </Text>
                  </View>

                  <View style={styles.expenseRight}>
                    <Text style={styles.expenseValue}>
                      {money(expense.amount)}
                    </Text>

                    <Pressable
                      onPress={() => deleteExpense(expense.id)}
                      hitSlop={8}
                      style={styles.removeExpenseButton}
                    >
                      <Text style={styles.deleteText}>Remove</Text>
                    </Pressable>
                  </View>
                </View>
              ))
            )}
          </View>

          {filteredExpenses.length > 5 ? (
            <Pressable
              onPress={() => setShowAllExpenses((prev) => !prev)}
              style={styles.viewAllButton}
            >
              <Text style={styles.viewAllText}>
                {showAllExpenses
                  ? 'Show less'
                  : `View all ${filteredExpenses.length} expenses`}
              </Text>
            </Pressable>
          ) : null}

          {/* BALANCES */}
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Balances</Text>
            <Text style={styles.sectionHint}>Who owes what</Text>
          </View>

          <View style={styles.listCard}>
            {members.map((member, index) => {
              const balance = getBalance(member);
              const positive = balance > 0.01;
              const neutral = Math.abs(balance) <= 0.01;

              return (
                <View
                  style={[
                    styles.balanceItem,
                    index === members.length - 1 && styles.lastListItem,
                  ]}
                  key={member}
                >
                  <View style={styles.balancePerson}>
                    <View style={styles.smallAvatar}>
                      <Text style={styles.smallAvatarText}>
                        {member.charAt(0).toUpperCase()}
                      </Text>
                    </View>

                    <View style={styles.balanceInfo}>
                      <Text style={styles.balanceName}>{member}</Text>
                      <Text style={styles.balancePaid}>
                        Paid {money(getPaid(member))}
                      </Text>
                    </View>
                  </View>

                  <View
                    style={[
                      styles.balanceBadge,
                      neutral
                        ? styles.settledBadge
                        : positive
                          ? styles.receiveBadge
                          : styles.oweBadge,
                    ]}
                  >
                    <Text
                      style={[
                        styles.balanceBadgeText,
                        neutral
                          ? styles.settledText
                          : positive
                            ? styles.receiveText
                            : styles.oweText,
                      ]}
                    >
                      {neutral
                        ? 'Settled'
                        : positive
                          ? `Gets ${money(balance)}`
                          : `Owes ${money(Math.abs(balance))}`}
                    </Text>
                  </View>
                </View>
              );
            })}
          </View>

          {/* SETTLEMENT */}
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Settlement</Text>
            <Text style={styles.sectionHint}>
              {settlements.length
                ? `${settlements.length} payment${settlements.length > 1 ? 's' : ''}`
                : 'All clear'}
            </Text>
          </View>

          <View style={styles.listCard}>
            {settlements.length === 0 ? (
              <View style={styles.settledBox}>
                <Text style={styles.settledCheck}>✓</Text>
                <View>
                  <Text style={styles.settledTitle}>Everyone is settled</Text>
                  <Text style={styles.settledSubtitle}>
                    No payments are needed right now.
                  </Text>
                </View>
              </View>
            ) : (
              settlements.map((item, index) => (
                <View
                  style={[
                    styles.settlementItem,
                    index === settlements.length - 1 && styles.lastListItem,
                  ]}
                  key={`${item.from}-${item.to}-${index}`}
                >
                  <View style={styles.settlementNames}>
                    <Text style={styles.settlementFrom}>{item.from}</Text>
                    <Text style={styles.settlementArrow}>→</Text>
                    <Text style={styles.settlementTo}>{item.to}</Text>
                  </View>

                  <Text style={styles.settlementAmount}>
                    {money(item.amount)}
                  </Text>
                </View>
              ))
            )}
          </View>

          {/* ACTIONS */}
          <View style={styles.actionRow}>
            <Pressable
              style={({ pressed }) => [
                styles.secondaryAction,
                pressed && styles.pressed,
              ]}
              onPress={shareSummary}
            >
              <Text style={styles.secondaryActionIcon}>↗</Text>
              <Text style={styles.secondaryActionText}>Share</Text>
            </Pressable>

            <Pressable
              style={({ pressed }) => [
                styles.secondaryAction,
                pressed && styles.pressed,
              ]}
              onPress={openClearModal}
            >
              <Text style={styles.secondaryActionIcon}>↺</Text>
              <Text style={styles.secondaryActionText}>Clear</Text>
            </Pressable>
          </View>

          <Text style={styles.savedText}>✓ Saved automatically on this device</Text>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* CLEAR EXPENSES VERIFICATION */}
      <Modal
        visible={showClearModal}
        transparent
        animationType="fade"
        onRequestClose={closeClearModal}
      >
        <View style={styles.confirmOverlay}>
          <View style={styles.confirmCard}>
            <View style={styles.dangerCircle}>
              <Text style={styles.dangerCircleText}>!</Text>
            </View>

            <Text style={styles.confirmTitle}>Clear all expenses?</Text>

            <Text style={styles.confirmMessage}>
              This will permanently remove all {expenses.length}{' '}
              {expenses.length === 1 ? 'expense' : 'expenses'}. Your group and
              members will stay.
            </Text>

            <Text style={styles.confirmInstruction}>
              To continue, type <Text style={styles.confirmKeyword}>CLEAR</Text>{' '}
              below.
            </Text>

            <TextInput
              value={clearConfirmation}
              onChangeText={setClearConfirmation}
              placeholder="Type CLEAR"
              placeholderTextColor="#69717E"
              autoCapitalize="characters"
              autoCorrect={false}
              style={styles.confirmInput}
            />

            <View style={styles.confirmActions}>
              <Pressable
                style={styles.confirmCancel}
                onPress={closeClearModal}
              >
                <Text style={styles.confirmCancelText}>Cancel</Text>
              </Pressable>

              <Pressable
                style={[
                  styles.confirmClear,
                  clearConfirmation.trim().toUpperCase() !== 'CLEAR' &&
                    styles.confirmClearDisabled,
                ]}
                onPress={confirmClearExpenses}
                disabled={clearConfirmation.trim().toUpperCase() !== 'CLEAR'}
              >
                <Text style={styles.confirmClearText}>Clear Expenses</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* SETTINGS MODAL */}
      <Modal
        visible={showSettings}
        transparent
        animationType="slide"
        onRequestClose={() => setShowSettings(false)}
      >
        <View style={styles.modalOverlay}>
          <Pressable
            style={styles.modalBackdrop}
            onPress={() => setShowSettings(false)}
          />

          <View style={styles.sheet}>
            <View style={styles.sheetHandle} />

            <View style={styles.sheetHeader}>
              <View>
                <Text style={styles.sheetEyebrow}>GROUP SETTINGS</Text>
                <Text style={styles.sheetTitle}>Manage your group</Text>
              </View>

              <Pressable
                onPress={() => setShowSettings(false)}
                style={styles.closeButton}
                hitSlop={8}
              >
                <Text style={styles.closeText}>×</Text>
              </Pressable>
            </View>

            <Pressable
              style={styles.settingItem}
              onPress={() => {
                setShowSettings(false);
                setScreen('setup');
              }}
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
              <Text style={styles.settingArrow}>›</Text>
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
              <Text style={styles.settingArrow}>›</Text>
            </Pressable>

            <Pressable style={styles.settingItem} onPress={openClearModal}>
              <View style={styles.settingIcon}>
                <Text>↺</Text>
              </View>
              <View style={styles.settingInfo}>
                <Text style={styles.settingTitle}>Clear expenses</Text>
                <Text style={styles.settingSubtitle}>
                  Keep members, remove all expenses
                </Text>
              </View>
              <Text style={styles.settingArrow}>›</Text>
            </Pressable>

            <Pressable
              style={[styles.settingItem, styles.dangerItem]}
              onPress={deleteGroup}
            >
              <View style={styles.settingIconDanger}>
                <Text>⌫</Text>
              </View>
              <View style={styles.settingInfo}>
                <Text style={styles.settingTitleDanger}>Delete group</Text>
                <Text style={styles.settingSubtitle}>
                  Remove all data from this device
                </Text>
              </View>
              <Text style={styles.settingArrowDanger}>›</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },

  root: {
    flex: 1,
    backgroundColor: '#07090D',
  },

  loading: {
    flex: 1,
    backgroundColor: '#07090D',
    alignItems: 'center',
    justifyContent: 'center',
  },

  loadingLogo: {
    color: '#9B6CFF',
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: 2.5,
  },

  loadingText: {
    color: '#69717E',
    fontSize: 13,
    marginTop: 10,
  },

  container: {
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 50,
  },

  setupContainer: {
    flexGrow: 1,
    paddingHorizontal: 22,
    paddingTop: 18,
    paddingBottom: 50,
  },

  backButton: {
    alignSelf: 'flex-start',
    marginBottom: 28,
  },

  back: {
    color: '#9B6CFF',
    fontSize: 17,
    fontWeight: '700',
  },

  eyebrow: {
    color: '#9B6CFF',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1.8,
    marginBottom: 5,
  },

  setupEyebrow: {
    color: '#9B6CFF',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 2,
    marginBottom: 10,
  },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 22,
    paddingTop: 2,
  },

  headerText: {
    flex: 1,
    paddingRight: 12,
  },

  groupTitle: {
    color: '#FFFFFF',
    fontSize: 28,
    fontWeight: '900',
  },

  setupTitle: {
    color: '#FFFFFF',
    fontSize: 34,
    fontWeight: '900',
    lineHeight: 40,
  },

  setupSubtitle: {
    color: '#8E96A3',
    fontSize: 16,
    lineHeight: 24,
    marginTop: 12,
    marginBottom: 38,
  },

  settingsButton: {
    width: 52,
    height: 52,
    borderRadius: 18,
    backgroundColor: '#12151B',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#2A2F39',
    elevation: 4,
    shadowColor: '#000000',
    shadowOpacity: 0.25,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
  },

  settingsPressed: {
    transform: [{ scale: 0.94 }],
    backgroundColor: '#1C2028',
  },

  settingsIcon: {
    color: '#FFFFFF',
    fontSize: 23,
  },

  heroCard: {
    backgroundColor: '#15111F',
    borderRadius: 24,
    padding: 24,
    minHeight: 165,
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#2B2340',
  },

  heroLabel: {
    color: '#8F829F',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1.5,
  },

  heroAmount: {
    color: '#FFFFFF',
    fontSize: 40,
    fontWeight: '900',
    marginTop: 7,
  },

  heroBottom: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 14,
  },

  heroBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#241A38',
    paddingHorizontal: 13,
    paddingVertical: 7,
    borderRadius: 20,
  },

  heroBadgeText: {
    color: '#BBA7FF',
    fontSize: 12,
    fontWeight: '800',
  },

  heroSmall: {
    color: '#777F8D',
    fontSize: 12,
    fontWeight: '600',
  },

  statsRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 12,
    marginBottom: 28,
  },

  statCard: {
    flex: 1,
    backgroundColor: '#101318',
    borderRadius: 17,
    padding: 17,
    borderWidth: 1,
    borderColor: '#20242D',
  },

  statLabel: {
    color: '#69717E',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1,
  },

  statValue: {
    color: '#F8FAFC',
    fontSize: 21,
    fontWeight: '900',
    marginTop: 7,
  },

  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 11,
    marginTop: 5,
  },

  sectionTitle: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '900',
  },

  sectionHint: {
    color: '#69717E',
    fontSize: 12,
    fontWeight: '600',
  },

  expenseForm: {
    backgroundColor: '#101318',
    borderRadius: 20,
    padding: 15,
    borderWidth: 1,
    borderColor: '#20242D',
    marginBottom: 28,
  },

  formInput: {
    height: 50,
    backgroundColor: '#181C22',
    borderRadius: 12,
    paddingHorizontal: 15,
    color: '#FFFFFF',
    fontSize: 15,
    marginBottom: 10,
  },

  amountRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 16,
  },

  amountInputWrap: {
    flex: 1,
    height: 50,
    backgroundColor: '#181C22',
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 15,
  },

  rupee: {
    color: '#9B6CFF',
    fontSize: 19,
    fontWeight: '900',
    marginRight: 7,
  },

  amountInput: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '800',
  },

  addExpenseButton: {
    backgroundColor: '#8B5CF6',
    minWidth: 82,
    paddingHorizontal: 20,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },

  addExpenseText: {
    color: '#FFFFFF',
    fontWeight: '900',
    fontSize: 15,
  },

  paidLabel: {
    color: '#69717E',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.2,
    marginBottom: 9,
  },

  paidLabelTop: {
    marginTop: 16,
  },

  chipScroll: {
    gap: 8,
    paddingRight: 4,
  },

  categoryChip: {
    borderWidth: 1,
    borderColor: '#303642',
    borderRadius: 20,
    paddingHorizontal: 13,
    paddingVertical: 8,
    backgroundColor: '#151920',
  },

  categoryChipActive: {
    backgroundColor: '#241A38',
    borderColor: '#8B5CF6',
  },

  categoryText: {
    color: '#929AA7',
    fontSize: 12,
    fontWeight: '700',
  },

  categoryTextActive: {
    color: '#C7B8FF',
  },

  payerScroll: {
    gap: 8,
    paddingRight: 4,
  },

  payer: {
    borderWidth: 1,
    borderColor: '#303642',
    borderRadius: 22,
    paddingLeft: 7,
    paddingRight: 13,
    paddingVertical: 7,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#151920',
  },

  payerActive: {
    backgroundColor: '#8B5CF6',
    borderColor: '#8B5CF6',
  },

  payerDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#292F39',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 7,
  },

  payerDotActive: {
    backgroundColor: '#7043D4',
  },

  payerInitial: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '900',
  },

  payerText: {
    color: '#AAB1BC',
    fontSize: 13,
    fontWeight: '700',
  },

  payerTextActive: {
    color: '#FFFFFF',
  },

  noMembersText: {
    color: '#69717E',
    fontSize: 12,
  },

  searchBox: {
    height: 48,
    backgroundColor: '#101318',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#20242D',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 13,
    marginBottom: 10,
  },

  searchIcon: {
    color: '#8E96A3',
    fontSize: 22,
    marginRight: 7,
  },

  searchInput: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 14,
  },

  listCard: {
    backgroundColor: '#101318',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#20242D',
    overflow: 'hidden',
    marginBottom: 18,
  },

  emptyState: {
    alignItems: 'center',
    paddingVertical: 35,
    paddingHorizontal: 20,
  },

  emptyIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#1C1628',
    color: '#A78BFA',
    textAlign: 'center',
    textAlignVertical: 'center',
    fontSize: 22,
    fontWeight: '900',
    marginBottom: 12,
  },

  emptyTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
  },

  emptyText: {
    color: '#69717E',
    fontSize: 13,
    marginTop: 5,
  },

  expenseItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#20242D',
  },

  lastListItem: {
    borderBottomWidth: 0,
  },

  expenseIcon: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: '#1C1628',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },

  expenseIconText: {
    color: '#A78BFA',
    fontWeight: '900',
    fontSize: 16,
  },

  expenseInfo: {
    flex: 1,
    paddingRight: 8,
  },

  expenseName: {
    color: '#F8FAFC',
    fontSize: 15,
    fontWeight: '800',
  },

  expenseMeta: {
    color: '#69717E',
    fontSize: 12,
    marginTop: 4,
  },

  expenseRight: {
    alignItems: 'flex-end',
  },

  expenseValue: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '900',
    marginBottom: 5,
  },

  removeExpenseButton: {
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: '#211419',
  },

  deleteText: {
    color: '#EF6672',
    fontSize: 11,
    fontWeight: '800',
  },

  viewAllButton: {
    alignItems: 'center',
    paddingVertical: 5,
    marginBottom: 24,
  },

  viewAllText: {
    color: '#A78BFA',
    fontSize: 13,
    fontWeight: '800',
  },

  balanceItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#20242D',
  },

  balancePerson: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },

  smallAvatar: {
    width: 39,
    height: 39,
    borderRadius: 20,
    backgroundColor: '#241A38',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 11,
  },

  smallAvatarText: {
    color: '#BBA7FF',
    fontWeight: '900',
  },

  balanceInfo: {
    flex: 1,
  },

  balanceName: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },

  balancePaid: {
    color: '#69717E',
    fontSize: 11,
    marginTop: 3,
  },

  balanceBadge: {
    paddingHorizontal: 9,
    paddingVertical: 7,
    borderRadius: 10,
    maxWidth: '48%',
  },

  receiveBadge: {
    backgroundColor: '#10251B',
  },

  oweBadge: {
    backgroundColor: '#29171B',
  },

  settledBadge: {
    backgroundColor: '#171B20',
  },

  balanceBadgeText: {
    fontSize: 11,
    fontWeight: '900',
  },

  receiveText: {
    color: '#4ADE80',
  },

  oweText: {
    color: '#FB7185',
  },

  settledText: {
    color: '#8D96A3',
  },

  settledBox: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 18,
  },

  settledCheck: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#10251B',
    color: '#4ADE80',
    textAlign: 'center',
    textAlignVertical: 'center',
    fontSize: 20,
    fontWeight: '900',
    marginRight: 12,
  },

  settledTitle: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },

  settledSubtitle: {
    color: '#69717E',
    fontSize: 11,
    marginTop: 3,
  },

  settlementItem: {
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: '#20242D',
  },

  settlementNames: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },

  settlementFrom: {
    color: '#FB7185',
    fontSize: 13,
    fontWeight: '800',
    maxWidth: '35%',
  },

  settlementArrow: {
    color: '#69717E',
    marginHorizontal: 8,
    fontSize: 14,
  },

  settlementTo: {
    color: '#4ADE80',
    fontSize: 13,
    fontWeight: '800',
    maxWidth: '35%',
  },

  settlementAmount: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '900',
  },

  actionRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
  },

  secondaryAction: {
    flex: 1,
    height: 50,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#292F39',
    backgroundColor: '#101318',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },

  secondaryActionIcon: {
    color: '#A78BFA',
    fontSize: 18,
    fontWeight: '900',
  },

  secondaryActionText: {
    color: '#D4D8DE',
    fontSize: 13,
    fontWeight: '800',
  },

  savedText: {
    color: '#4F5967',
    textAlign: 'center',
    fontSize: 11,
    marginTop: 18,
  },

  pressed: {
    opacity: 0.78,
    transform: [{ scale: 0.98 }],
  },

  fieldBlock: {
    marginBottom: 25,
  },

  label: {
    color: '#858D9A',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.4,
    marginBottom: 9,
  },

  input: {
    height: 54,
    backgroundColor: '#11151B',
    borderWidth: 1,
    borderColor: '#292F39',
    borderRadius: 14,
    paddingHorizontal: 16,
    color: '#FFFFFF',
    fontSize: 15,
  },

  addMemberRow: {
    flexDirection: 'row',
    gap: 10,
  },

  memberInput: {
    flex: 1,
  },

  addButton: {
    width: 54,
    height: 54,
    borderRadius: 14,
    backgroundColor: '#8B5CF6',
    alignItems: 'center',
    justifyContent: 'center',
  },

  addButtonText: {
    color: '#FFFFFF',
    fontSize: 27,
    fontWeight: '400',
  },

  memberList: {
    marginBottom: 25,
  },

  memberChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#11151B',
    borderWidth: 1,
    borderColor: '#292F39',
    borderRadius: 14,
    padding: 10,
    marginBottom: 8,
  },

  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#241A38',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },

  avatarText: {
    color: '#BBA7FF',
    fontWeight: '900',
  },

  memberName: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },

  remove: {
    color: '#EF6672',
    fontSize: 23,
    paddingHorizontal: 7,
  },

  emptyMembers: {
    padding: 20,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#252A33',
    borderStyle: 'dashed',
    alignItems: 'center',
  },

  emptyMembersText: {
    color: '#626B78',
    fontSize: 13,
  },

  primaryAction: {
    height: 58,
    borderRadius: 16,
    backgroundColor: '#8B5CF6',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },

  primaryActionText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '900',
  },

  arrow: {
    color: '#FFFFFF',
    fontSize: 21,
  },

  deleteGroupButton: {
    alignItems: 'center',
    paddingVertical: 18,
  },

  deleteGroupText: {
    color: '#EF6672',
    fontSize: 13,
    fontWeight: '700',
  },

  confirmOverlay: {
    flex: 1,
    backgroundColor: '#000000',
    opacity: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 22,
  },

  confirmCard: {
    width: '100%',
    backgroundColor: '#11151B',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#3A2025',
    padding: 22,
  },

  dangerCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#29171B',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },

  dangerCircleText: {
    color: '#FB7185',
    fontSize: 22,
    fontWeight: '900',
  },

  confirmTitle: {
    color: '#FFFFFF',
    fontSize: 21,
    fontWeight: '900',
  },

  confirmMessage: {
    color: '#8E96A3',
    fontSize: 13,
    lineHeight: 20,
    marginTop: 8,
  },

  confirmInstruction: {
    color: '#B6BDC8',
    fontSize: 12,
    lineHeight: 18,
    marginTop: 18,
    marginBottom: 8,
  },

  confirmKeyword: {
    color: '#FB7185',
    fontWeight: '900',
  },

  confirmInput: {
    height: 50,
    backgroundColor: '#181C22',
    borderWidth: 1,
    borderColor: '#343B47',
    borderRadius: 12,
    paddingHorizontal: 14,
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },

  confirmActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 14,
  },

  confirmCancel: {
    flex: 1,
    height: 50,
    borderRadius: 12,
    backgroundColor: '#1A1E25',
    borderWidth: 1,
    borderColor: '#303642',
    alignItems: 'center',
    justifyContent: 'center',
  },

  confirmCancelText: {
    color: '#D4D8DE',
    fontSize: 13,
    fontWeight: '800',
  },

  confirmClear: {
    flex: 1.35,
    height: 50,
    borderRadius: 12,
    backgroundColor: '#C94359',
    alignItems: 'center',
    justifyContent: 'center',
  },

  confirmClearDisabled: {
    backgroundColor: '#43222A',
    opacity: 0.65,
  },

  confirmClearText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '900',
  },

  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },

  modalBackdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: '#000000',
    opacity: 0.65,
  },

  sheet: {
    backgroundColor: '#0F1217',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 28,
    borderWidth: 1,
    borderColor: '#252A33',
  },

  sheetHandle: {
    alignSelf: 'center',
    width: 42,
    height: 4,
    borderRadius: 3,
    backgroundColor: '#3A414D',
    marginBottom: 18,
  },

  sheetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },

  sheetEyebrow: {
    color: '#8B5CF6',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.4,
  },

  sheetTitle: {
    color: '#FFFFFF',
    fontSize: 21,
    fontWeight: '900',
    marginTop: 4,
  },

  closeButton: {
    width: 38,
    height: 38,
    borderRadius: 13,
    backgroundColor: '#1A1E25',
    alignItems: 'center',
    justifyContent: 'center',
  },

  closeText: {
    color: '#FFFFFF',
    fontSize: 24,
    lineHeight: 24,
  },

  settingItem: {
    minHeight: 68,
    borderRadius: 16,
    backgroundColor: '#151920',
    borderWidth: 1,
    borderColor: '#242A33',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    marginTop: 9,
  },

  settingInfo: {
    flex: 1,
    paddingHorizontal: 11,
  },

  settingIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: '#241A38',
    alignItems: 'center',
    justifyContent: 'center',
  },

  settingIconDanger: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: '#29171B',
    alignItems: 'center',
    justifyContent: 'center',
  },

  settingTitle: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },

  settingTitleDanger: {
    color: '#FB7185',
    fontSize: 14,
    fontWeight: '800',
  },

  settingSubtitle: {
    color: '#69717E',
    fontSize: 11,
    marginTop: 3,
  },

  settingArrow: {
    color: '#737D8B',
    fontSize: 25,
  },

  settingArrowDanger: {
    color: '#FB7185',
    fontSize: 25,
  },

  dangerItem: {
    borderColor: '#3A2025',
  },
});
