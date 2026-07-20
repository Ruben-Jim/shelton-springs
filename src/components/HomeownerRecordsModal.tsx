/**
 * HomeownerRecordsModal.tsx
 *
 * Full-record bottom-sheet modal for the Fees & Payments tab.
 * Place at:  app/components/HomeownerRecordsModal.tsx
 *
 * ✅ Zero new Convex queries — all data is passed as props from AdminScreen's
 *    already-loaded state. Free-tier cost stays at $0/month.
 *
 * Field names verified against:
 *   convex/fees.ts     → Fee:     { _id, name, description, amount, frequency, dueDate, year,
 *                                    status, isLate, userId, address, createdAt, updatedAt }
 *   convex/payments.ts → Payment: { _id, userId, feeType, amount, paymentDate, status,
 *                                    paymentMethod, transactionId, venmoUsername,
 *                                    venmoTransactionId, checkNumber, receiptImage,
 *                                    verificationStatus, feeId, fineId, notes,
 *                                    adminNotes, createdAt, updatedAt }
 *   convex/fees.ts     → Fine:    { _id, violation, amount, dateIssued, status,
 *                                    description, residentId, createdAt, updatedAt }
 *   app/components/ProfileImage.tsx → props: { source, size, style, initials }
 */

import React, { useRef, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  ScrollView,
  TouchableOpacity,
  Animated,
  Platform,
  Dimensions,
  TextInput,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useMutation } from 'convex/react';
import { api } from '../../convex/_generated/api';
import type { Id } from '../../convex/_generated/dataModel';
import ProfileImage from './ProfileImage';
import CustomAlert from './CustomAlert';
import { useCustomAlert } from '../hooks/useCustomAlert';

// ─── Types (mirroring convex schema exactly) ──────────────────────────────────

interface Fee {
  _id: string;
  name: string;
  description: string;
  amount: number;
  frequency: 'Monthly' | 'Quarterly' | 'Annually' | 'One-time';
  dueDate: string;
  year?: number;
  status?: 'Pending' | 'Partial' | 'Paid' | 'Overdue';
  isLate?: boolean;
  userId?: string;
  address?: string;
  createdAt?: number;
  updatedAt?: number;
}

interface Fine {
  _id: string;
  violation: string;
  amount: number;
  dateIssued: string;
  status: 'Pending' | 'Partial' | 'Paid' | 'Overdue';
  description?: string;
  residentId?: string;
  createdAt?: number;
  updatedAt?: number;
}

interface Payment {
  _id: string;
  userId: string;
  feeType?: string;
  amount: number;
  paymentDate?: string;
  status?: string;
  paymentMethod?: 'Check' | 'Cash' | 'Venmo';
  transactionId?: string;
  venmoUsername?: string;
  venmoTransactionId?: string;
  checkNumber?: string;
  receiptImage?: string | null;
  verificationStatus?: 'Pending' | 'Verified' | 'Rejected';
  feeId?: string;
  fineId?: string;
  notes?: string;
  adminNotes?: string;
  createdAt?: number;
  updatedAt?: number;
}

interface Homeowner {
  _id: string;
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  profileImage?: string | null;
  isResident?: boolean;
  isRenter?: boolean;
  isBoardMember?: boolean;
  isDev?: boolean;
  userType?: string;
  address?: string;
  unitNumber?: string;
  moveInDate?: string;
}

interface AddressGroup {
  addressKey: string;
  address: string;
  unitNumber?: string;
  homeowners: Homeowner[];
  fees: Fee[];
  fines: Fine[];
  payments: Payment[];
  latestPayment: Payment | null;
  allFeesPaid: boolean;
  totalFeeAmount: number;
  totalPaidAmount: number;
  isPartiallyPaid: boolean;
  /** Map<fineId, Payment> — built in AdminScreen's useMemo */
  paymentsByFineId: Map<string, Payment> | Record<string, Payment>;
}

interface HomeownerRecordsModalProps {
  visible: boolean;
  onClose: () => void;
  addressGroup: AddressGroup | null;
}

/** Stored on fee/fine records; editable in admin modal */
type EditLedgerStatus = 'Pending' | 'Partial' | 'Paid' | 'Overdue';

type DeleteTarget =
  | { kind: 'fee'; record: Fee }
  | { kind: 'fine'; record: Fine }
  | { kind: 'payment'; record: Payment };

function formatPaymentSummary(payment: Payment): string {
  const method = payment.paymentMethod ?? 'Payment';
  const amount = `$${payment.amount.toFixed(2)}`;
  const date = payment.paymentDate ? ` on ${payment.paymentDate}` : '';
  const check = payment.checkNumber ? ` (Check #${payment.checkNumber})` : '';
  return `• ${method} ${amount}${date}${check}`;
}

function buildDeleteConfirmMessage(
  target: DeleteTarget,
  linkedPayments: Payment[],
  fees: Fee[],
  fines: Fine[],
): string {
  if (target.kind === 'payment') {
    const payment = target.record;
    const summary = formatPaymentSummary(payment).replace(/^• /, '');
    let message = `Delete this payment?\n\n${summary}\n\nThis payment will be permanently removed from payment history.`;

    if (payment.feeId) {
      const fee = fees.find((entry) => entry._id === payment.feeId);
      message += fee
        ? `\n\nThe linked fee "${fee.name}" balance will be recalculated.`
        : '\n\nThe linked fee balance will be recalculated.';
    }
    if (payment.fineId) {
      const fine = fines.find((entry) => entry._id === payment.fineId);
      message += fine
        ? `\n\nThe linked fine "${fine.violation}" balance will be recalculated.`
        : '\n\nThe linked fine balance will be recalculated.';
    }

    message += '\n\nThis cannot be undone.';
    return message;
  }

  const recordLabel =
    target.kind === 'fee' ? `"${target.record.name}"` : `"${target.record.violation}"`;
  const recordType = target.kind === 'fee' ? 'fee' : 'fine';

  let message = `Delete ${recordLabel}?\n\nThis ${recordType} will be permanently removed.`;

  if (linkedPayments.length > 0) {
    const paymentLines = linkedPayments.map(formatPaymentSummary).join('\n');
    message += `\n\n${linkedPayments.length} linked payment${
      linkedPayments.length === 1 ? '' : 's'
    } will remain in payment history but will no longer count toward this ${recordType}:\n${paymentLines}`;
  }

  message += '\n\nThis cannot be undone.';
  return message;
}

function deleteConfirmTitle(target: DeleteTarget): string {
  switch (target.kind) {
    case 'fee':
      return 'Delete fee?';
    case 'fine':
      return 'Delete fine?';
    case 'payment':
      return 'Delete payment?';
  }
}

// ─── Config & helpers ─────────────────────────────────────────────────────────

const COLORS = {
  paid:    { text: '#065f46', bg: '#d1fae5', border: '#6ee7b7', icon: '#10b981' },
  partial: { text: '#92400e', bg: '#fef3c7', border: '#fcd34d', icon: '#f59e0b' },
  pending: { text: '#7f1d1d', bg: '#fee2e2', border: '#fca5a5', icon: '#dc2626' },
  overdue: { text: '#7f1d1d', bg: '#fee2e2', border: '#fca5a5', icon: '#dc2626' },
  clear:   { text: '#374151', bg: '#f3f4f6', border: '#e5e7eb', icon: '#6b7280' },
};

type StatusKey = 'paid' | 'partial' | 'pending' | 'overdue';

/** Align edit modal status chips with what the list pill shows (derived from payments + DB). */
function displayStatusKeyToLedgerStatus(key: StatusKey): EditLedgerStatus {
  switch (key) {
    case 'paid':
      return 'Paid';
    case 'partial':
      return 'Partial';
    case 'overdue':
      return 'Overdue';
    default:
      return 'Pending';
  }
}

const STATUS_ICONS: Record<StatusKey, keyof typeof Ionicons.glyphMap> = {
  paid:    'checkmark-circle',
  partial: 'hourglass',
  pending: 'time',
  overdue: 'warning',
};

/** Derive display status from verified payments vs fee total; honor DB Partial when set. */
function feeDisplayStatus(fee: Fee, paidTowardsFee: number): StatusKey {
  const remaining = Math.max(0, fee.amount - paidTowardsFee);
  if (remaining < 0.01) return 'paid';
  if (paidTowardsFee > 0) return 'partial';
  if (fee.status === 'Partial') return 'partial';
  if (fee.status === 'Overdue' || fee.isLate) return 'overdue';
  return 'pending';
}

/** Sum verified payments linked to a fine; honor DB Partial when set. */
function fineDisplayStatus(fine: Fine, paidTowardsFine: number): StatusKey {
  const remaining = Math.max(0, fine.amount - paidTowardsFine);
  if (remaining < 0.01) return 'paid';
  if (paidTowardsFine > 0) return 'partial';
  if (fine.status === 'Partial') return 'partial';
  if (fine.status === 'Overdue') return 'overdue';
  return 'pending';
}

function paymentMethodIcon(method?: string): keyof typeof Ionicons.glyphMap {
  if (method === 'Venmo') return 'logo-venmo';
  if (method === 'Check') return 'document-text';
  return 'cash';
}

// ─── Small reusable sub-components ───────────────────────────────────────────

function SectionHeader({ label }: { label: string }) {
  return (
    <View style={styles.sectionHeader}>
      <View style={styles.sectionLine} />
      <Text style={styles.sectionLabel}>{label}</Text>
      <View style={styles.sectionLine} />
    </View>
  );
}

function StatusPill({ statusKey }: { statusKey: StatusKey }) {
  const cfg = COLORS[statusKey];
  const label = statusKey.charAt(0).toUpperCase() + statusKey.slice(1);
  return (
    <View style={[styles.pill, { backgroundColor: cfg.bg }]}>
      <Ionicons name={STATUS_ICONS[statusKey]} size={11} color={cfg.icon} />
      <Text style={[styles.pillText, { color: cfg.text }]}>{label}</Text>
    </View>
  );
}

function DetailRow({
  icon,
  label,
  value,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
}) {
  if (!value) return null;
  return (
    <View style={styles.detailRow}>
      <Ionicons name={icon} size={13} color="#9ca3af" style={styles.detailIcon} />
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue} numberOfLines={2}>
        {value}
      </Text>
    </View>
  );
}

function EmptyRow({ icon, text }: { icon: keyof typeof Ionicons.glyphMap; text: string }) {
  return (
    <View style={styles.emptyRow}>
      <Ionicons name={icon} size={16} color="#d1d5db" />
      <Text style={styles.emptyRowText}>{text}</Text>
    </View>
  );
}

// ─── Main Modal ───────────────────────────────────────────────────────────────

export default function HomeownerRecordsModal({
  visible,
  onClose,
  addressGroup,
}: HomeownerRecordsModalProps) {
  const updateFeeMutation = useMutation(api.fees.update);
  const updateFineMutation = useMutation(api.fines.update);
  const removeFeeMutation = useMutation(api.fees.remove);
  const removeFineMutation = useMutation(api.fines.remove);
  const removePaymentMutation = useMutation(api.payments.remove);
  const reconcileFeePaidMutation = useMutation(api.payments.adminReconcileVerifiedPaidForFee);
  const reconcileFinePaidMutation = useMutation(api.payments.adminReconcileVerifiedPaidForFine);
  const createAnnualFeeForAddressMutation = useMutation(api.fees.createAnnualFeeForAddress);
  const { alertState, showAlert, hideAlert } = useCustomAlert();

  const [editTarget, setEditTarget] = useState<
    null | { kind: 'fee'; fee: Fee } | { kind: 'fine'; fine: Fine }
  >(null);
  const [editAmount, setEditAmount] = useState('');
  const [editAmountPaid, setEditAmountPaid] = useState('');
  const [editStatus, setEditStatus] = useState<EditLedgerStatus>('Pending');
  const [savingEdit, setSavingEdit] = useState(false);
  const [deletingRecordId, setDeletingRecordId] = useState<string | null>(null);

  const [showAddAnnualModal, setShowAddAnnualModal] = useState(false);
  const [savingAnnual, setSavingAnnual] = useState(false);
  const [annualYear, setAnnualYear] = useState('');
  const [annualAmount, setAnnualAmount] = useState('');
  const [annualDesc, setAnnualDesc] = useState('');

  const screenH = Dimensions.get('window').height;
  const slideY   = useRef(new Animated.Value(screenH)).current;
  const overlayO = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!visible) {
      setEditTarget(null);
      setEditAmountPaid('');
      setShowAddAnnualModal(false);
      setDeletingRecordId(null);
    }
  }, [visible]);

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(overlayO, {
          toValue: 1,
          duration: 200,
          useNativeDriver: Platform.OS !== 'web',
        }),
        Animated.spring(slideY, {
          toValue: 0,
          tension: 85,
          friction: 11,
          useNativeDriver: Platform.OS !== 'web',
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(overlayO, {
          toValue: 0,
          duration: 180,
          useNativeDriver: Platform.OS !== 'web',
        }),
        Animated.timing(slideY, {
          toValue: screenH,
          duration: 210,
          useNativeDriver: Platform.OS !== 'web',
        }),
      ]).start();
    }
  }, [visible]);

  if (!addressGroup) return null;

  const {
    addressKey,
    address,
    unitNumber,
    homeowners,
    fees,
    fines,
    payments,
  } = addressGroup;

  const getLinkedPayments = (target: DeleteTarget) => {
    if (target.kind === 'payment') return [];
    return payments.filter((payment) =>
      target.kind === 'fee'
        ? payment.feeId === target.record._id
        : payment.fineId === target.record._id,
    );
  };

  const requestDeleteRecord = (target: DeleteTarget) => {
    const linkedPayments = getLinkedPayments(target);
    showAlert({
      title: deleteConfirmTitle(target),
      message: buildDeleteConfirmMessage(target, linkedPayments, fees, fines),
      type: 'warning',
      buttons: [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => handleDeleteRecord(target),
        },
      ],
    });
  };

  const handleDeleteRecord = async (target: DeleteTarget) => {
    const recordId = target.record._id;
    setDeletingRecordId(recordId);
    try {
      if (target.kind === 'fee') {
        await removeFeeMutation({ id: recordId as Id<'fees'> });
      } else if (target.kind === 'fine') {
        await removeFineMutation({ id: recordId as Id<'fines'> });
      } else {
        await removePaymentMutation({ paymentId: recordId as Id<'payments'> });
      }

      if (
        editTarget &&
        ((editTarget.kind === 'fee' && editTarget.fee._id === recordId) ||
          (editTarget.kind === 'fine' && editTarget.fine._id === recordId))
      ) {
        setEditTarget(null);
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Delete failed';
      showAlert({
        title: `Could not delete ${target.kind}`,
        message: msg,
        type: 'error',
        buttons: [{ text: 'OK', style: 'default' }],
      });
    } finally {
      setDeletingRecordId(null);
    }
  };

  const isDeletingRecord = (target: DeleteTarget) => deletingRecordId === target.record._id;

  const paymentUserIdForFee = (fee: Fee) => {
    if (fee.userId) return String(fee.userId);
    if (homeowners[0]?._id) return String(homeowners[0]._id);
    throw new Error('No user id for fee payment');
  };

  const paymentUserIdForFine = (fine: Fine) => {
    if (fine.residentId) return String(fine.residentId);
    if (homeowners[0]?._id) return String(homeowners[0]._id);
    throw new Error('No user id for fine payment');
  };

  const handleSaveEdit = async () => {
    if (!editTarget) return;
    const amt = parseFloat(editAmount.replace(/,/g, ''));
    const paidIn = parseFloat(editAmountPaid.replace(/,/g, ''));
    if (Number.isNaN(amt) || amt < 0) {
      Alert.alert('Invalid amount', 'Enter a valid amount due.');
      return;
    }
    if (Number.isNaN(paidIn) || paidIn < 0) {
      Alert.alert('Invalid amount paid', 'Enter a valid verified amount paid (0 or more).');
      return;
    }
    if (paidIn > amt + 0.01) {
      Alert.alert('Invalid amounts', 'Amount paid cannot exceed amount due.');
      return;
    }
    setSavingEdit(true);
    try {
      if (editTarget.kind === 'fee') {
        await updateFeeMutation({
          id: editTarget.fee._id as Id<'fees'>,
          amount: amt,
          status: editStatus,
        });
        await reconcileFeePaidMutation({
          feeId: editTarget.fee._id as Id<'fees'>,
          userId: paymentUserIdForFee(editTarget.fee),
          targetVerifiedTotal: Math.min(paidIn, amt),
        });
      } else {
        await updateFineMutation({
          id: editTarget.fine._id as Id<'fines'>,
          amount: amt,
          status: editStatus,
        });
        await reconcileFinePaidMutation({
          fineId: editTarget.fine._id as Id<'fines'>,
          userId: paymentUserIdForFine(editTarget.fine),
          targetVerifiedTotal: Math.min(paidIn, amt),
        });
      }
      setEditTarget(null);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Update failed';
      Alert.alert('Could not save', msg);
    } finally {
      setSavingEdit(false);
    }
  };

  const openEditFee = (fee: Fee) => {
    const paidTowards = payments
      .filter(p => p.feeId === fee._id && p.verificationStatus === 'Verified')
      .reduce((s, p) => s + p.amount, 0);
    const displayKey = feeDisplayStatus(fee, paidTowards);
    setEditTarget({ kind: 'fee', fee });
    setEditAmount(String(fee.amount));
    setEditAmountPaid(paidTowards.toFixed(2));
    setEditStatus(displayStatusKeyToLedgerStatus(displayKey));
  };

  const openEditFine = (fine: Fine) => {
    const paidTowards = payments
      .filter(p => p.fineId === fine._id && p.verificationStatus === 'Verified')
      .reduce((s, p) => s + p.amount, 0);
    const displayKey = fineDisplayStatus(fine, paidTowards);
    setEditTarget({ kind: 'fine', fine });
    setEditAmount(String(fine.amount));
    setEditAmountPaid(paidTowards.toFixed(2));
    setEditStatus(displayStatusKeyToLedgerStatus(displayKey));
  };

  const openAddAnnualFee = () => {
    const y = new Date().getFullYear();
    setAnnualYear(String(y));
    setAnnualAmount('300');
    setAnnualDesc('Annual HOA Fee');
    setShowAddAnnualModal(true);
  };

  const handleSubmitAddAnnual = async () => {
    const primary =
      homeowners.find((h) => !h.isRenter) ?? homeowners[0];
    if (!primary) {
      Alert.alert('No resident', 'This address has no resident to attach the fee to.');
      return;
    }
    const year = parseInt(annualYear.trim(), 10);
    const amount = parseFloat(annualAmount.replace(/,/g, ''));
    const description = annualDesc.trim() || 'Annual HOA Fee';
    if (Number.isNaN(year) || year < 2000 || year > 2100) {
      Alert.alert('Invalid year', 'Enter a calendar year between 2000 and 2100.');
      return;
    }
    if (Number.isNaN(amount) || amount <= 0) {
      Alert.alert('Invalid amount', 'Enter a positive dollar amount.');
      return;
    }
    setSavingAnnual(true);
    try {
      await createAnnualFeeForAddressMutation({
        year,
        amount,
        description,
        addressKey,
        primaryResidentId: primary._id as Id<'residents'>,
      });
      setShowAddAnnualModal(false);
      Alert.alert('Annual fee added', `HOA dues for ${year} were added for this address.`);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Could not add annual fee';
      Alert.alert('Could not add fee', msg);
    } finally {
      setSavingAnnual(false);
    }
  };

  // Household balance from verified payments vs each fee/fine (same logic as cards — not DB status alone)
  const sumVerifiedTowardFee = (feeId: string) =>
    payments
      .filter(p => p.feeId === feeId && p.verificationStatus === 'Verified')
      .reduce((s, p) => s + p.amount, 0);
  const sumVerifiedTowardFine = (fineId: string) =>
    payments
      .filter(p => p.fineId === fineId && p.verificationStatus === 'Verified')
      .reduce((s, p) => s + p.amount, 0);

  const feesOutstanding = fees.reduce(
    (s, fee) => s + Math.max(0, fee.amount - sumVerifiedTowardFee(fee._id)),
    0,
  );
  const finesOutstanding = fines.reduce(
    (s, fine) => s + Math.max(0, fine.amount - sumVerifiedTowardFine(fine._id)),
    0,
  );
  const totalOutstanding = feesOutstanding + finesOutstanding;

  const hasVerifiedTowardHousehold = payments.some(
    p =>
      p.verificationStatus === 'Verified' &&
      ((p.feeId && fees.some(f => f._id === p.feeId)) ||
        (p.fineId && fines.some(f => f._id === p.fineId))),
  );

  let overallStatus: StatusKey;
  if (fees.length === 0 && fines.length === 0) {
    overallStatus = 'paid';
  } else if (totalOutstanding < 0.01) {
    overallStatus = 'paid';
  } else if (hasVerifiedTowardHousehold) {
    overallStatus = 'partial';
  } else {
    overallStatus = 'pending';
  }

  const bannerCfg = COLORS[overallStatus];

  // Only show verified payments in payment history
  const verifiedPayments = [...payments]
    .filter(p => p.verificationStatus === 'Verified')
    .sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0));

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      {/* Dimmed backdrop */}
      <Animated.View
        style={[styles.backdrop, { opacity: overlayO }]}
        pointerEvents="none"
      />
      {/* Tap-outside-to-close */}
      <TouchableOpacity
        style={StyleSheet.absoluteFillObject}
        activeOpacity={1}
        onPress={onClose}
      />

      {/* Sheet */}
      <Animated.View
        style={[styles.sheet, { transform: [{ translateY: slideY }] }]}
        pointerEvents="box-none"
      >
        {/* Drag handle */}
        <View style={styles.dragHandle} />

        {/* ── Header ───────────────────────────────────── */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <View style={styles.headerIconCircle}>
              <Ionicons name="home" size={18} color="#2563eb" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.headerAddress} numberOfLines={1}>
                {address}
                {unitNumber ? ` Unit ${unitNumber}` : ''}
              </Text>
              <Text style={styles.headerMeta}>
                {homeowners.length === 1
                  ? `${homeowners[0].firstName} ${homeowners[0].lastName} · Homeowner`
                  : `${homeowners.length} Residents`}
              </Text>
            </View>
          </View>
          <TouchableOpacity
            style={styles.closeBtn}
            onPress={onClose}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="close" size={20} color="#6b7280" />
          </TouchableOpacity>
        </View>

        {/* ── Status banner ────────────────────────────── */}
        <View
          style={[
            styles.banner,
            { backgroundColor: bannerCfg.bg, borderColor: bannerCfg.border },
          ]}
        >
          <Ionicons name={STATUS_ICONS[overallStatus]} size={15} color={bannerCfg.icon} />
          <Text style={[styles.bannerText, { color: bannerCfg.text }]}>
            {overallStatus === 'paid'
              ? 'All dues settled — no outstanding balance'
              : overallStatus === 'partial'
              ? `Outstanding balance: $${totalOutstanding.toFixed(2)} (partially paid)`
              : `Outstanding balance: $${totalOutstanding.toFixed(2)}`}
          </Text>
        </View>

        {/* ── Scrollable body ───────────────────────────── */}
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >

          {/* ═══════════ RESIDENTS ═══════════ */}
          <SectionHeader label={`RESIDENTS  (${homeowners.length})`} />
          {homeowners.map((hw) => (
            <View key={hw._id} style={styles.residentCard}>
              <ProfileImage
                source={hw.profileImage}
                size={46}
                initials={`${hw.firstName.charAt(0)}${hw.lastName.charAt(0)}`}
                style={styles.avatarStyle}
              />
              <View style={styles.residentBody}>
                {/* Name + role badges */}
                <View style={styles.residentNameRow}>
                  <Text style={styles.residentName}>
                    {hw.firstName} {hw.lastName}
                  </Text>
                  <View style={styles.badgeRow}>
                    {hw.isBoardMember && (
                      <View style={[styles.badge, { backgroundColor: '#eff6ff' }]}>
                        <Text style={[styles.badgeText, { color: '#2563eb' }]}>Board</Text>
                      </View>
                    )}
                    {hw.isDev && (
                      <View style={[styles.badge, { backgroundColor: '#faf5ff' }]}>
                        <Text style={[styles.badgeText, { color: '#7c3aed' }]}>Dev</Text>
                      </View>
                    )}
                    {hw.isRenter ? (
                      <View style={[styles.badge, { backgroundColor: '#fefce8' }]}>
                        <Text style={[styles.badgeText, { color: '#854d0e' }]}>Renter</Text>
                      </View>
                    ) : (
                      <View style={[styles.badge, { backgroundColor: '#f0fdf4' }]}>
                        <Text style={[styles.badgeText, { color: '#15803d' }]}>Homeowner</Text>
                      </View>
                    )}
                  </View>
                </View>
                {/* Contact & meta */}
                <DetailRow icon="mail-outline"     label="Email"   value={hw.email ?? ''} />
                <DetailRow icon="call-outline"     label="Phone"   value={hw.phone ?? ''} />
                <DetailRow icon="calendar-outline" label="Move-in" value={hw.moveInDate ?? ''} />
              </View>
            </View>
          ))}

          {/* ═══════════ FEES ═══════════ */}
          <SectionHeader label={`FEES  (${fees.length})`} />
          <TouchableOpacity
            style={styles.addAnnualRow}
            onPress={openAddAnnualFee}
            activeOpacity={0.85}
          >
            <Ionicons name="add-circle-outline" size={18} color="#2563eb" />
            <Text style={styles.addAnnualText}>Add annual HOA fee</Text>
          </TouchableOpacity>
          <Text style={styles.tapHint}>Tap a fee to edit amount or status. Balance reflects verified payments.</Text>
          {fees.length === 0 ? (
            <EmptyRow icon="checkmark-circle-outline" text="No fees assigned to this address" />
          ) : (
            fees.map((fee) => {
              // Sum all verified payments that link to this fee
              const feePayments = payments.filter(
                p => p.feeId === fee._id && p.verificationStatus === 'Verified',
              );
              const paidTowardsFee = feePayments.reduce((s, p) => s + p.amount, 0);
              const st = feeDisplayStatus(fee, paidTowardsFee);
              const pct = fee.amount > 0
                ? Math.min(100, (paidTowardsFee / fee.amount) * 100)
                : 0;
              const isDeletingFee = isDeletingRecord({ kind: 'fee', record: fee });

              return (
                <View key={fee._id} style={styles.recordCard}>
                  <View style={styles.recordRow}>
                    <TouchableOpacity
                      style={styles.recordLeftTap}
                      activeOpacity={0.85}
                      onPress={() => openEditFee(fee)}
                      disabled={isDeletingFee}
                    >
                      <Text style={styles.recordTitle}>{fee.name}</Text>
                      <View style={styles.recordMeta}>
                        <Text style={styles.recordMetaText}>{fee.frequency}</Text>
                        {fee.year != null && (
                          <Text style={styles.recordMetaText}> · {fee.year}</Text>
                        )}
                        {fee.dueDate ? (
                          <Text style={styles.recordMetaText}> · Due {fee.dueDate}</Text>
                        ) : null}
                        {fee.isLate && (
                          <Text style={[styles.recordMetaText, { color: '#dc2626', fontWeight: '600' }]}>
                            {' · LATE'}
                          </Text>
                        )}
                      </View>
                      {fee.description ? (
                        <Text style={styles.recordNote}>{fee.description}</Text>
                      ) : null}
                    </TouchableOpacity>
                    <View style={styles.recordRight}>
                      <Text style={styles.recordAmount}>${fee.amount.toFixed(2)}</Text>
                      <StatusPill statusKey={st} />
                      <View style={styles.recordActions}>
                        <TouchableOpacity
                          style={styles.recordActionBtn}
                          onPress={() => openEditFee(fee)}
                          disabled={isDeletingFee}
                          hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                          accessibilityRole="button"
                          accessibilityLabel={`Edit ${fee.name}`}
                        >
                          <Ionicons name="create-outline" size={16} color="#6b7280" />
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[styles.recordActionBtn, styles.recordActionBtnDanger]}
                          onPress={() => requestDeleteRecord({ kind: 'fee', record: fee })}
                          disabled={isDeletingFee}
                          hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                          accessibilityRole="button"
                          accessibilityLabel={`Delete ${fee.name}`}
                        >
                          {isDeletingFee ? (
                            <ActivityIndicator size="small" color="#dc2626" />
                          ) : (
                            <Ionicons name="trash-outline" size={16} color="#dc2626" />
                          )}
                        </TouchableOpacity>
                      </View>
                    </View>
                  </View>

                  {paidTowardsFee > 0 && paidTowardsFee < fee.amount && (
                    <View style={styles.progressSection}>
                      <Text style={styles.progressLabel}>
                        Paid ${paidTowardsFee.toFixed(2)} of ${fee.amount.toFixed(2)}
                      </Text>
                      <View style={styles.progressTrack}>
                        <View
                          style={[styles.progressFill, { width: `${pct}%` as any }]}
                        />
                      </View>
                    </View>
                  )}
                </View>
              );
            })
          )}

          {/* ═══════════ FINES ═══════════ */}
          <SectionHeader label={`FINES  (${fines.length})`} />
          <Text style={styles.tapHint}>Tap a fine to edit amount or status.</Text>
          {fines.length === 0 ? (
            <EmptyRow icon="checkmark-circle-outline" text="No fines on record" />
          ) : (
            fines.map((fine) => {
              const finePayments = payments.filter(
                p => p.fineId === fine._id && p.verificationStatus === 'Verified',
              );
              const paidTowardsFine = finePayments.reduce((s, p) => s + p.amount, 0);
              const st = fineDisplayStatus(fine, paidTowardsFine);
              const isDeletingFine = isDeletingRecord({ kind: 'fine', record: fine });

              return (
                <View key={fine._id} style={[styles.recordCard, styles.fineAccent]}>
                  <View style={styles.recordRow}>
                    <TouchableOpacity
                      style={styles.recordLeftTap}
                      activeOpacity={0.85}
                      onPress={() => openEditFine(fine)}
                      disabled={isDeletingFine}
                    >
                      <View style={styles.fineViolationRow}>
                        <Ionicons
                          name="warning-outline"
                          size={13}
                          color="#dc2626"
                          style={{ marginRight: 5, marginTop: 1 }}
                        />
                        <Text style={[styles.recordTitle, { color: '#dc2626' }]}>
                          {fine.violation}
                        </Text>
                      </View>
                      <Text style={styles.recordMetaText}>Issued: {fine.dateIssued}</Text>
                      {fine.description ? (
                        <Text style={styles.recordNote}>{fine.description}</Text>
                      ) : null}
                    </TouchableOpacity>
                    <View style={styles.recordRight}>
                      <Text style={[styles.recordAmount, { color: '#dc2626' }]}>
                        ${fine.amount.toFixed(2)}
                      </Text>
                      <StatusPill statusKey={st} />
                      <View style={styles.recordActions}>
                        <TouchableOpacity
                          style={styles.recordActionBtn}
                          onPress={() => openEditFine(fine)}
                          disabled={isDeletingFine}
                          hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                          accessibilityRole="button"
                          accessibilityLabel={`Edit ${fine.violation}`}
                        >
                          <Ionicons name="create-outline" size={16} color="#6b7280" />
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[styles.recordActionBtn, styles.recordActionBtnDanger]}
                          onPress={() => requestDeleteRecord({ kind: 'fine', record: fine })}
                          disabled={isDeletingFine}
                          hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                          accessibilityRole="button"
                          accessibilityLabel={`Delete ${fine.violation}`}
                        >
                          {isDeletingFine ? (
                            <ActivityIndicator size="small" color="#dc2626" />
                          ) : (
                            <Ionicons name="trash-outline" size={16} color="#dc2626" />
                          )}
                        </TouchableOpacity>
                      </View>
                    </View>
                  </View>

                  {paidTowardsFine > 0 && paidTowardsFine < fine.amount && (
                    <View style={styles.progressSection}>
                      <Text style={styles.progressLabel}>
                        Paid ${paidTowardsFine.toFixed(2)} of ${fine.amount.toFixed(2)}
                      </Text>
                      <View style={styles.progressTrack}>
                        <View
                          style={[
                            styles.progressFill,
                            { width: `${Math.min(100, (paidTowardsFine / fine.amount) * 100)}%` as any },
                          ]}
                        />
                      </View>
                    </View>
                  )}
                </View>
              );
            })
          )}

          {/* ═══════════ PAYMENT HISTORY ═══════════ */}
          <SectionHeader label={`PAYMENT HISTORY  (${verifiedPayments.length})`} />
          {verifiedPayments.length === 0 ? (
            <EmptyRow icon="receipt-outline" text="No verified payments yet" />
          ) : (
            verifiedPayments.map((pmt) => {
              const isDeletingPayment = isDeletingRecord({ kind: 'payment', record: pmt });

              return (
              <View key={pmt._id} style={styles.paymentCard}>
                <View style={styles.paymentRow}>
                  <View style={styles.pmtIconCircle}>
                    <Ionicons
                      name={paymentMethodIcon(pmt.paymentMethod)}
                      size={15}
                      color="#2563eb"
                    />
                  </View>

                  <View style={styles.pmtDetails}>
                    <Text style={styles.pmtMethod}>
                      {pmt.paymentMethod ?? 'Payment'}
                      {pmt.checkNumber
                        ? ` — Check #${pmt.checkNumber}`
                        : pmt.venmoUsername
                        ? ` — @${pmt.venmoUsername}`
                        : ''}
                    </Text>
                    {pmt.feeType ? (
                      <Text style={styles.pmtFeeType}>{pmt.feeType}</Text>
                    ) : null}
                    {pmt.paymentDate ? (
                      <Text style={styles.pmtDate}>{pmt.paymentDate}</Text>
                    ) : null}
                    {(pmt.transactionId || pmt.venmoTransactionId) && (
                      <Text style={styles.pmtTxId} numberOfLines={1}>
                        ID: {pmt.transactionId ?? pmt.venmoTransactionId}
                      </Text>
                    )}
                  </View>

                  <View style={styles.pmtRight}>
                    <Text style={styles.pmtAmount}>${pmt.amount.toFixed(2)}</Text>
                    <TouchableOpacity
                      style={[styles.recordActionBtn, styles.recordActionBtnDanger]}
                      onPress={() => requestDeleteRecord({ kind: 'payment', record: pmt })}
                      disabled={isDeletingPayment}
                      hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                      accessibilityRole="button"
                      accessibilityLabel="Delete payment"
                    >
                      {isDeletingPayment ? (
                        <ActivityIndicator size="small" color="#dc2626" />
                      ) : (
                        <Ionicons name="trash-outline" size={16} color="#dc2626" />
                      )}
                    </TouchableOpacity>
                  </View>
                </View>

                {(pmt.notes || pmt.adminNotes) ? (
                  <Text style={styles.pmtNotes}>
                    {pmt.notes ?? pmt.adminNotes}
                  </Text>
                ) : null}
              </View>
            );
            })
          )}

          <View style={{ height: 40 }} />
        </ScrollView>
      </Animated.View>

      <Modal
        visible={editTarget !== null}
        transparent
        animationType="fade"
        onRequestClose={() => {
          if (!savingEdit) setEditTarget(null);
        }}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.editOverlay}
        >
          <TouchableOpacity
            style={styles.editBackdrop}
            activeOpacity={1}
            onPress={() => {
              if (!savingEdit) setEditTarget(null);
            }}
          />
          <View style={styles.editCard}>
            <Text style={styles.editTitle}>
              {editTarget?.kind === 'fee'
                ? 'Edit fee'
                : editTarget?.kind === 'fine'
                  ? 'Edit fine'
                  : 'Edit'}
            </Text>
            {editTarget?.kind === 'fee' ? (
              <Text style={styles.editSubtitle} numberOfLines={2}>
                {editTarget.fee.name}
              </Text>
            ) : editTarget?.kind === 'fine' ? (
              <Text style={styles.editSubtitle} numberOfLines={2}>
                {editTarget.fine.violation}
              </Text>
            ) : null}

            <Text style={styles.editLabel}>Amount due ($)</Text>
            <TextInput
              style={styles.editInput}
              value={editAmount}
              onChangeText={setEditAmount}
              keyboardType="decimal-pad"
              placeholder="0.00"
              editable={!savingEdit}
            />

            <Text style={styles.editLabel}>Amount paid (verified) ($)</Text>
            <Text style={styles.editHint}>
              Total verified payments for this {editTarget?.kind === 'fee' ? 'fee' : 'fine'}. Saving replaces
              them with this amount (capped at amount due).
            </Text>
            <TextInput
              style={styles.editInput}
              value={editAmountPaid}
              onChangeText={setEditAmountPaid}
              keyboardType="decimal-pad"
              placeholder="0.00"
              editable={!savingEdit}
            />

            <Text style={styles.editLabel}>Status</Text>
            <View style={styles.statusRow}>
              {(['Pending', 'Partial', 'Paid', 'Overdue'] as const).map((s) => (
                <TouchableOpacity
                  key={s}
                  style={[
                    styles.statusChip,
                    editStatus === s && styles.statusChipActive,
                  ]}
                  onPress={() => setEditStatus(s)}
                  disabled={savingEdit}
                >
                  <Text
                    style={[
                      styles.statusChipText,
                      editStatus === s && styles.statusChipTextActive,
                    ]}
                  >
                    {s}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.editActions}>
              {editTarget ? (
                <TouchableOpacity
                  style={styles.editDeleteBtn}
                  onPress={() => {
                    if (!savingEdit && editTarget) {
                      requestDeleteRecord(
                        editTarget.kind === 'fee'
                          ? { kind: 'fee', record: editTarget.fee }
                          : { kind: 'fine', record: editTarget.fine },
                      );
                    }
                  }}
                  disabled={
                    savingEdit ||
                    (editTarget.kind === 'fee'
                      ? isDeletingRecord({ kind: 'fee', record: editTarget.fee })
                      : isDeletingRecord({ kind: 'fine', record: editTarget.fine }))
                  }
                >
                  {(editTarget.kind === 'fee'
                    ? isDeletingRecord({ kind: 'fee', record: editTarget.fee })
                    : isDeletingRecord({ kind: 'fine', record: editTarget.fine })) ? (
                    <ActivityIndicator color="#dc2626" size="small" />
                  ) : (
                    <Text style={styles.editDeleteText}>Delete</Text>
                  )}
                </TouchableOpacity>
              ) : (
                <View style={styles.editDeleteBtnSpacer} />
              )}
              <View style={styles.editPrimaryActions}>
                <TouchableOpacity
                  style={styles.editCancelBtn}
                  onPress={() => !savingEdit && setEditTarget(null)}
                  disabled={savingEdit}
                >
                  <Text style={styles.editCancelText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.editSaveBtn}
                  onPress={handleSaveEdit}
                  disabled={savingEdit}
                >
                  {savingEdit ? (
                    <ActivityIndicator color="#fff" size="small" />
                  ) : (
                    <Text style={styles.editSaveText}>Save</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <Modal
        visible={showAddAnnualModal}
        transparent
        animationType="fade"
        onRequestClose={() => {
          if (!savingAnnual) setShowAddAnnualModal(false);
        }}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.editOverlay}
        >
          <TouchableOpacity
            style={styles.editBackdrop}
            activeOpacity={1}
            onPress={() => {
              if (!savingAnnual) setShowAddAnnualModal(false);
            }}
          />
          <View style={styles.editCard}>
            <Text style={styles.editTitle}>Add annual HOA fee</Text>
            <Text style={styles.editSubtitle} numberOfLines={2}>
              One annual dues row for this property ({addressKey}). Skipped if that year already exists for this
              address.
            </Text>

            <Text style={styles.editLabel}>Calendar year</Text>
            <TextInput
              style={styles.editInput}
              value={annualYear}
              onChangeText={setAnnualYear}
              keyboardType="number-pad"
              placeholder="2026"
              editable={!savingAnnual}
            />

            <Text style={styles.editLabel}>Amount ($)</Text>
            <TextInput
              style={styles.editInput}
              value={annualAmount}
              onChangeText={setAnnualAmount}
              keyboardType="decimal-pad"
              placeholder="300.00"
              editable={!savingAnnual}
            />

            <Text style={styles.editLabel}>Description</Text>
            <TextInput
              style={styles.editInput}
              value={annualDesc}
              onChangeText={setAnnualDesc}
              placeholder="Annual HOA Fee"
              editable={!savingAnnual}
            />

            <View style={styles.editActions}>
              <TouchableOpacity
                style={styles.editCancelBtn}
                onPress={() => !savingAnnual && setShowAddAnnualModal(false)}
                disabled={savingAnnual}
              >
                <Text style={styles.editCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.editSaveBtn}
                onPress={handleSubmitAddAnnual}
                disabled={savingAnnual}
              >
                {savingAnnual ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={styles.editSaveText}>Add fee</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <CustomAlert
        visible={alertState.visible}
        title={alertState.title}
        message={alertState.message}
        buttons={alertState.buttons}
        type={alertState.type}
        onClose={hideAlert}
      />
    </Modal>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  // Backdrop
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  // Bottom sheet
  sheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    // On web, cap height at 88% of viewport; on native cap at 90% of screen
    maxHeight: Platform.OS === 'web' ? ('88vh' as any) : '90%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -5 },
    shadowOpacity: 0.18,
    shadowRadius: 18,
    elevation: 28,
  },
  dragHandle: {
    width: 38,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#d1d5db',
    alignSelf: 'center',
    marginTop: 10,
    marginBottom: 6,
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 6,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 12,
    gap: 12,
  },
  headerIconCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#eff6ff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerAddress: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1f2937',
    lineHeight: 20,
  },
  headerMeta: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 2,
  },
  closeBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Status banner
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  bannerText: {
    fontSize: 13,
    fontWeight: '600',
    flex: 1,
    lineHeight: 18,
  },

  // ScrollView
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 4,
  },

  // Section header
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 10,
    gap: 8,
  },
  sectionLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#e5e7eb',
  },
  sectionLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#9ca3af',
    letterSpacing: 0.8,
  },

  // Resident card
  residentCard: {
    flexDirection: 'row',
    backgroundColor: '#f9fafb',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    gap: 12,
  },
  avatarStyle: {
    // No extra style needed; ProfileImage handles radius
  },
  residentBody: {
    flex: 1,
  },
  residentNameRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  residentName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1f2937',
  },
  badgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
  },
  badge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 7,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '600',
  },

  // Detail rows inside resident card
  detailRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginTop: 3,
    gap: 4,
  },
  detailIcon: {
    marginTop: 1,
  },
  detailLabel: {
    fontSize: 11,
    color: '#9ca3af',
    minWidth: 42,
    lineHeight: 16,
  },
  detailValue: {
    fontSize: 12,
    color: '#374151',
    fontWeight: '500',
    flex: 1,
    lineHeight: 16,
  },

  // Record card (shared by fee and fine)
  recordCard: {
    backgroundColor: '#ffffff',
    borderRadius: 10,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 2,
    elevation: 1,
  },
  recordLeftTap: {
    flex: 1,
    marginRight: 12,
  },
  recordActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 6,
  },
  recordActionBtn: {
    width: 30,
    height: 30,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f3f4f6',
  },
  recordActionBtnDanger: {
    backgroundColor: '#fef2f2',
  },
  // Fine gets a red left accent
  fineAccent: {
    borderLeftWidth: 3,
    borderLeftColor: '#dc2626',
  },
  recordRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  recordLeft: {
    flex: 1,
    marginRight: 12,
  },
  recordRight: {
    alignItems: 'flex-end',
    gap: 5,
  },
  recordTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 3,
    lineHeight: 18,
  },
  recordMeta: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 2,
  },
  recordMetaText: {
    fontSize: 11,
    color: '#9ca3af',
    lineHeight: 16,
  },
  recordNote: {
    fontSize: 11,
    color: '#6b7280',
    marginTop: 3,
    fontStyle: 'italic',
    lineHeight: 15,
  },
  recordAmount: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1f2937',
  },
  fineViolationRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 3,
  },

  // Status pill
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  pillText: {
    fontSize: 11,
    fontWeight: '600',
  },

  // Partial payment progress
  progressSection: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
  },
  progressLabel: {
    fontSize: 11,
    color: '#f59e0b',
    fontWeight: '600',
    marginBottom: 5,
  },
  progressTrack: {
    height: 4,
    backgroundColor: '#fde68a',
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: 4,
    backgroundColor: '#f59e0b',
    borderRadius: 2,
  },

  // Payment card
  paymentCard: {
    backgroundColor: '#ffffff',
    borderRadius: 10,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  paymentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  pmtIconCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#eff6ff',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  pmtDetails: {
    flex: 1,
  },
  pmtMethod: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 1,
    lineHeight: 17,
  },
  pmtFeeType: {
    fontSize: 11,
    color: '#6b7280',
    lineHeight: 15,
  },
  pmtDate: {
    fontSize: 11,
    color: '#9ca3af',
    lineHeight: 15,
  },
  pmtTxId: {
    fontSize: 10,
    color: '#9ca3af',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    marginTop: 1,
  },
  pmtAmount: {
    fontSize: 16,
    fontWeight: '700',
    color: '#10b981',
    flexShrink: 0,
  },
  pmtRight: {
    alignItems: 'flex-end',
    gap: 8,
    flexShrink: 0,
    minWidth: 72,
  },
  pmtNotes: {
    fontSize: 11,
    color: '#6b7280',
    fontStyle: 'italic',
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
    lineHeight: 16,
  },

  // Empty state row
  emptyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 4,
  },
  emptyRowText: {
    fontSize: 13,
    color: '#9ca3af',
  },

  tapHint: {
    fontSize: 11,
    color: '#9ca3af',
    marginBottom: 10,
    marginTop: -4,
    lineHeight: 15,
  },
  addAnnualRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
    paddingHorizontal: 2,
    marginBottom: 4,
  },
  addAnnualText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#2563eb',
  },

  editOverlay: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  editBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  editCard: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 18,
    maxWidth: 400,
    width: '100%',
    alignSelf: 'center',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 8,
    zIndex: 2,
  },
  editTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 4,
  },
  editSubtitle: {
    fontSize: 13,
    color: '#6b7280',
    marginBottom: 14,
    lineHeight: 18,
  },
  editHint: {
    fontSize: 11,
    color: '#9ca3af',
    marginBottom: 6,
    lineHeight: 15,
  },
  editLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 6,
  },
  editInput: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    color: '#111827',
    marginBottom: 14,
    backgroundColor: '#f9fafb',
  },
  statusRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 18,
  },
  statusChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    backgroundColor: '#f9fafb',
  },
  statusChipActive: {
    borderColor: '#2563eb',
    backgroundColor: '#eff6ff',
  },
  statusChipText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6b7280',
  },
  statusChipTextActive: {
    color: '#1d4ed8',
  },
  editActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    marginTop: 4,
  },
  editDeleteBtn: {
    paddingVertical: 10,
    paddingHorizontal: 4,
    minWidth: 56,
    alignItems: 'flex-start',
  },
  editDeleteBtnSpacer: {
    minWidth: 56,
  },
  editDeleteText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#dc2626',
  },
  editPrimaryActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginLeft: 'auto',
  },
  editCancelBtn: {
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  editCancelText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#6b7280',
  },
  editSaveBtn: {
    backgroundColor: '#2563eb',
    paddingVertical: 10,
    paddingHorizontal: 22,
    borderRadius: 10,
    minWidth: 88,
    alignItems: 'center',
    justifyContent: 'center',
  },
  editSaveText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#ffffff',
  },
});