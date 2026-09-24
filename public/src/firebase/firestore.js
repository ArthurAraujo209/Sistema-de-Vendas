import { db, auth } from './config.js';
import {
  collection, doc, getDoc, getDocs, addDoc, updateDoc, deleteDoc, setDoc,
  query, where, orderBy, limit, getCountFromServer, writeBatch
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import {
  createUserWithEmailAndPassword
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import { store } from '../store.js';

const getSellerId = () => store.get('currentUser')?.uid;

// ========== Campanhas ==========
export async function createCampaign(data) {
  const sellerId = getSellerId();
  const docRef = await addDoc(collection(db, 'campaigns'), {
    ...data,
    sellerId,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  });
  return docRef.id;
}

export async function updateCampaign(id, data) {
  const ref = doc(db, 'campaigns', id);
  await updateDoc(ref, {
    ...data,
    updatedAt: new Date().toISOString()
  });
}

export async function getCampaign(id) {
  const snap = await getDoc(doc(db, 'campaigns', id));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() };
}

export async function getCampaigns(filters = {}) {
  const sellerId = getSellerId();
  const conditions = [where('sellerId', '==', sellerId)];
  if (filters.status) conditions.push(where('status', '==', filters.status));
  const q = query(collection(db, 'campaigns'), ...conditions, orderBy('createdAt', 'desc'));
  const snapshot = await getDocs(q);
  return snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function duplicateCampaign(id) {
  const original = await getCampaign(id);
  if (!original) throw new Error('Campanha não encontrada');
  const { id: _, sellerId, createdAt, updatedAt, ...data } = original;
  return await createCampaign({ ...data, title: `${data.title} (cópia)`, status: 'draft' });
}

export async function archiveCampaign(id) {
  await updateDoc(doc(db, 'campaigns', id), { status: 'archived', updatedAt: new Date().toISOString() });
}

export async function deleteCampaign(id) {
  await deleteDoc(doc(db, 'campaigns', id));
}

// ========== Pedidos ==========
export async function createOrder(data) {
  const sellerId = getSellerId();
  const now = new Date().toISOString();

  let clientPhone = '';
  let clientEmail = '';
  if (data.clientId) {
    try {
      const cSnap = await getDoc(doc(db, 'users', data.clientId));
      if (cSnap.exists()) {
        const c = cSnap.data();
        clientPhone = c.phone || '';
        clientEmail = c.email || '';
      }
    } catch (err) {
      console.warn('[createOrder enrich]', err?.code || err?.message);
    }
  }

  const orderData = {
    ...data,
    clientPhone: clientPhone || data.clientPhone || '',
    clientEmail: clientEmail || data.clientEmail || '',
    sellerId,
    status: data.status || 'awaiting_payment',
    createdAt: now,
    updatedAt: now,
    history: [{
      timestamp: now,
      userId: sellerId,
      userName: store.get('currentUser')?.displayName || 'Vendedor',
      action: 'Pedido criado',
      details: `Valor total: ${data.totalAmount}`
    }]
  };
  const docRef = await addDoc(collection(db, 'orders'), orderData);
  return docRef.id;
}

export async function getOrder(id) {
  const snap = await getDoc(doc(db, 'orders', id));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() };
}

export async function getOrders(filters = {}) {
  const sellerId = getSellerId();
  const conditions = [where('sellerId', '==', sellerId)];
  if (filters.status) conditions.push(where('status', '==', filters.status));
  if (filters.campaignId) conditions.push(where('campaignId', '==', filters.campaignId));
  const q = query(collection(db, 'orders'), ...conditions, orderBy('createdAt', 'desc'));
  const snapshot = await getDocs(q);
  return snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function updateOrder(id, data, changeDescription) {
  const sellerId = getSellerId();
  const ref = doc(db, 'orders', id);
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error('Pedido não encontrado');
  const current = snap.data();
  const historyEntry = {
    timestamp: new Date().toISOString(),
    userId: sellerId,
    userName: store.get('currentUser')?.displayName || 'Vendedor',
    action: changeDescription || 'Pedido atualizado'
  };
  await updateDoc(ref, {
    ...data,
    updatedAt: new Date().toISOString(),
    history: [...(current.history || []), historyEntry]
  });

  if (data.status && data.status !== current.status && current.clientId) {
    const statusLabel = {
      awaiting_payment: 'Aguardando pagamento',
      payment_under_review: 'Comprovante em análise',
      partial_payment: 'Pagamento parcial',
      paid: 'Pago',
      sent_to_factory: 'Enviado para fábrica',
      in_production: 'Em produção',
      production_completed: 'Produção concluída',
      in_transit: 'Em transporte',
      available_for_pickup: 'Disponível para retirada',
      delivered: 'Entregue',
      cancelled: 'Cancelado'
    };
    try {
      await createNotification(current.clientId, {
        type: 'status_update',
        title: 'Status do pedido atualizado',
        message: `Seu pedido #${id.substring(0,6)} agora está "${statusLabel[data.status] || data.status}".`,
        link: `/client/orders/${id}`
      });
    } catch (err) {
      console.warn('[notif status_update]', err?.code || err?.message);
    }
  }
}

export async function deleteOrder(orderId) {
  const orderRef = doc(db, 'orders', orderId);
  const paymentsRef = collection(db, `orders/${orderId}/payments`);
  const snapshot = await getDocs(paymentsRef);
  const batch = writeBatch(db);
  snapshot.forEach(doc => batch.delete(doc.ref));
  batch.delete(orderRef);
  await batch.commit();
}

// ========== Pagamentos ==========
export async function addPayment(orderId, paymentData) {
  const orderRef = doc(db, 'orders', orderId);
  const paymentsRef = collection(db, `orders/${orderId}/payments`);

  const existingPayments = await getDocs(paymentsRef);
  let currentPaid = 0;
  existingPayments.forEach(doc => {
    const p = doc.data();
    // Só soma o que está confirmado (verified !== false)
    if (p.verified !== false) currentPaid += p.amount || 0;
  });

  const newAmount = paymentData.amount || 0;
  const isVerified = paymentData.verified !== false;
  const newPaidTotal = currentPaid + (isVerified ? newAmount : 0);

  const orderSnap = await getDoc(orderRef);
  if (!orderSnap.exists()) throw new Error('Pedido não encontrado');
  const order = orderSnap.data();
  const totalAmount = order.totalAmount || 0;
  const newRemaining = Math.max(0, totalAmount - newPaidTotal);

  const batch = writeBatch(db);
  const newPaymentRef = doc(paymentsRef);
  batch.set(newPaymentRef, {
    ...paymentData,
    verified: isVerified,
    createdAt: new Date().toISOString()
  });
  batch.update(orderRef, {
    paidAmount: newPaidTotal,
    remainingAmount: newRemaining,
    updatedAt: new Date().toISOString()
  });
  await batch.commit();

  await updateOrder(orderId, {}, `Pagamento de ${formatCurrency(newAmount)} registrado (${paymentData.method || 'não informado'})`);

  if (order.sellerId) {
    try {
      await createNotification(order.sellerId, {
        type: 'new_payment',
        title: isVerified ? 'Novo pagamento recebido' : 'Novo comprovante em análise',
        message: `Pagamento de ${formatCurrency(newAmount)} no pedido #${orderId.substring(0,6)}.`,
        link: `/seller/orders/${orderId}`
      });
    } catch (err) {
      console.warn('[notif new_payment]', err?.code || err?.message);
    }
  }

  return newPaymentRef.id;
}

export async function confirmPayment(orderId, paymentId) {
  const paymentsRef = collection(db, `orders/${orderId}/payments`);
  const payRef = doc(paymentsRef, paymentId);
  const paySnap = await getDoc(payRef);
  if (!paySnap.exists()) throw new Error('Pagamento não encontrado');
  const payment = paySnap.data();
  if (payment.verified !== false) return;

  // Marca como verificado
  await updateDoc(payRef, { verified: true, verifiedAt: new Date().toISOString() });

  // Recalcula totais
  const all = await getDocs(paymentsRef);
  let totalPaid = 0;
  all.forEach(d => {
    const p = d.data();
    if (d.id === paymentId) {
      // Já consideramos este como confirmado
      totalPaid += p.amount || 0;
    } else if (p.verified !== false) {
      totalPaid += p.amount || 0;
    }
  });

  const orderRef = doc(db, 'orders', orderId);
  const orderSnap = await getDoc(orderRef);
  const order = orderSnap.data();
  const total = order.totalAmount || 0;
  const remaining = Math.max(0, total - totalPaid);

  await updateDoc(orderRef, {
    paidAmount: totalPaid,
    remainingAmount: remaining,
    updatedAt: new Date().toISOString()
  });

  await updateOrder(orderId, {}, `Pagamento de ${formatCurrency(payment.amount)} confirmado`);
}

export async function getPayments(orderId) {
  const paymentsRef = collection(db, `orders/${orderId}/payments`);
  const q = query(paymentsRef, orderBy('createdAt', 'desc'));
  const snapshot = await getDocs(q);
  return snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
}

// ========== Usuários ==========
export async function getUserByEmail(email) {
  const q = query(collection(db, 'users'), where('email', '==', email.toLowerCase().trim()));
  const snap = await getDocs(q);
  if (snap.empty) return null;
  return { id: snap.docs[0].id, ...snap.docs[0].data() };
}

export async function createClientUser(email, displayName, phone = '') {
  const tempPassword = 'temp' + Math.random().toString(36).slice(2, 10);
  const userCred = await createUserWithEmailAndPassword(auth, email, tempPassword);
  await setDoc(doc(db, 'users', userCred.user.uid), {
    uid: userCred.user.uid,
    email,
    displayName,
    phone,
    role: 'client',
    profileCompleted: !!(displayName && phone),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  });
  return { id: userCred.user.uid, email, displayName, phone, role: 'client' };
}

// ========== Cliente ==========
export async function getOpenCampaigns() {
  const q = query(
    collection(db, 'campaigns'),
    where('status', 'in', ['open', 'scheduled', 'voting']),
    orderBy('createdAt', 'desc')
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function createClientOrder(data) {
  const current = store.get('currentUser');
  const clientId = current.uid;
  let profile = store.get('userProfile') || {};

  if (!profile.phone) {
    try {
      const snap = await getDoc(doc(db, 'users', clientId));
      if (snap.exists()) {
        profile = { ...snap.data(), ...profile };
        store.set('userProfile', profile);
      }
    } catch (err) {
      console.warn('[createClientOrder fetch profile]', err?.code || err?.message);
    }
  }

  // Busca telefone e nome do vendedor (para o botão de WhatsApp)
  let sellerPhone = '';
  let sellerName = '';
  if (data.sellerId) {
    try {
      const sSnap = await getDoc(doc(db, 'users', data.sellerId));
      if (sSnap.exists()) {
        const s = sSnap.data();
        sellerPhone = s.phone || '';
        sellerName = s.displayName || '';
      }
    } catch (err) {
      console.warn('[createClientOrder fetch seller]', err?.code || err?.message);
    }
  }

  const now = new Date().toISOString();
  const status = data.status || 'awaiting_payment';

  const orderData = {
    ...data,
    clientId,
    clientPhone: profile.phone || data.clientPhone || '',
    clientEmail: profile.email || current.email || '',
    sellerPhone,
    sellerName,
    status,
    createdAt: now,
    updatedAt: now,
    history: [{
      timestamp: now,
      userId: clientId,
      userName: current.displayName || 'Cliente',
      action: 'Pedido criado pelo cliente'
    }]
  };
  const docRef = await addDoc(collection(db, 'orders'), orderData);

  try {
    await createNotification(data.sellerId, {
      type: 'new_order',
      title: 'Novo pedido recebido',
      message: `Cliente ${data.clientName} fez um pedido na campanha "${data.campaignTitle}".`,
      link: `/seller/orders/${docRef.id}`
    });
  } catch (err) {
    console.warn('[notif new_order]', err?.code || err?.message);
  }

  return docRef.id;
}

export async function getClientOrders() {
  const clientId = store.get('currentUser').uid;
  const q = query(collection(db, 'orders'), where('clientId', '==', clientId), orderBy('createdAt', 'desc'));
  const snapshot = await getDocs(q);
  return snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function getClientOrder(orderId) {
  const snap = await getDoc(doc(db, 'orders', orderId));
  if (!snap.exists()) return null;
  const order = { id: snap.id, ...snap.data() };
  if (order.clientId !== store.get('currentUser').uid) return null;
  return order;
}

export async function cancelClientOrder(orderId) {
  const clientId = store.get('currentUser').uid;
  const ref = doc(db, 'orders', orderId);
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error('Pedido não encontrado');
  const order = snap.data();
  if (order.clientId !== clientId) throw new Error('Acesso negado');
  if (!['awaiting_payment', 'payment_under_review', 'partial_payment', 'paid'].includes(order.status)) {
    throw new Error('Não é possível cancelar este pedido.');
  }
  const historyEntry = {
    timestamp: new Date().toISOString(),
    userId: clientId,
    userName: store.get('currentUser').displayName || 'Cliente',
    action: 'Pedido cancelado pelo cliente'
  };
  await updateDoc(ref, {
    status: 'cancelled',
    updatedAt: new Date().toISOString(),
    history: [...(order.history || []), historyEntry]
  });

  if (order.sellerId) {
    try {
      await createNotification(order.sellerId, {
        type: 'order_cancelled',
        title: 'Pedido cancelado',
        message: `Cliente ${order.clientName} cancelou o pedido #${orderId.substring(0,6)}.`,
        link: `/seller/orders/${orderId}`
      });
    } catch (err) {
      console.warn('[notif order_cancelled]', err?.code || err?.message);
    }
  }
}

// ========== Config do vendedor (PIX + métodos) ==========
export async function getSellerPaymentConfig(sellerId) {
  try {
    const snap = await getDoc(doc(db, 'users', sellerId));
    if (!snap.exists()) return { pixKey: '', paymentMethods: [] };
    const u = snap.data();
    return {
      pixKey: u.pixKey || '',
      paymentMethods: Array.isArray(u.paymentMethods) ? u.paymentMethods : []
    };
  } catch (err) {
    console.warn('[seller payment config]', err?.code || err?.message);
    return { pixKey: '', paymentMethods: [] };
  }
}

// ========== Notificações ==========
export async function createNotification(userId, data) {
  const notifRef = collection(db, 'users', userId, 'notifications');
  await addDoc(notifRef, {
    ...data,
    read: false,
    createdAt: new Date().toISOString()
  });
}

export async function getNotifications(userId) {
  const notifRef = collection(db, 'users', userId, 'notifications');
  const q = query(notifRef, orderBy('createdAt', 'desc'), limit(50));
  const snapshot = await getDocs(q);
  return snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function markNotificationRead(uid, notifId) {
  const ref = doc(db, 'users', uid, 'notifications', notifId);
  await updateDoc(ref, { read: true });
}

export async function getUnreadNotificationCount(userId) {
  const notifRef = collection(db, 'users', userId, 'notifications');
  const q = query(notifRef, where('read', '==', false));
  const snapshot = await getCountFromServer(q);
  return snapshot.data().count;
}

// ========== Exportação ==========
export async function exportOrdersData(filters = {}) {
  const sellerId = getSellerId();
  const conditions = [where('sellerId', '==', sellerId)];
  if (filters.status) conditions.push(where('status', '==', filters.status));
  if (filters.campaignId) conditions.push(where('campaignId', '==', filters.campaignId));
  const q = query(collection(db, 'orders'), ...conditions, orderBy('createdAt', 'desc'));
  const snapshot = await getDocs(q);
  return snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
}

// ========== Marketplace ==========
export async function getActiveSellers() {
  const q = query(
    collection(db, 'users'),
    where('role', '==', 'seller'),
    where('subscriptionStatus', '==', 'active')
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => {
    const u = d.data();
    return {
      id: d.id,
      displayName: u.displayName || 'Loja',
      photoUrl: u.photoUrl || '',
      description: u.description || '',
      instagram: u.instagram || '',
      whatsapp: u.phone || ''
    };
  });
}

export async function getOpenCampaignsBySeller(sellerId) {
  const q = query(
    collection(db, 'campaigns'),
    where('sellerId', '==', sellerId),
    where('status', 'in', ['open', 'scheduled', 'voting']),
    orderBy('createdAt', 'desc')
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function getSellerPublicProfile(sellerId) {
  const snap = await getDoc(doc(db, 'users', sellerId));
  if (!snap.exists()) return null;
  const u = snap.data();
  if (u.role !== 'seller') return null;
  return {
    id: sellerId,
    displayName: u.displayName || 'Loja',
    photoUrl: u.photoUrl || '',
    description: u.description || '',
    instagram: u.instagram || '',
    whatsapp: u.phone || ''
  };
}

// ========== Helper ==========
function formatCurrency(value) {
  return Number(value).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

// ========== Votação ==========
export async function getCampaignVotes(campaignId) {
  const votesRef = collection(db, 'campaigns', campaignId, 'votes');
  const snap = await getDocs(votesRef);
  let yes = 0, no = 0, myVote = null;
  const uid = store.get('currentUser')?.uid;
  snap.forEach(doc => {
    const v = doc.data();
    if (v.vote === 'yes') yes++;
    else if (v.vote === 'no') no++;
    if (doc.id === uid) myVote = v.vote;
  });
  return { yes, no, total: yes + no, myVote };
}

export async function submitVote(campaignId, vote) {
  const uid = store.get('currentUser')?.uid;
  if (!uid) throw new Error('Faça login para votar.');
  if (vote !== 'yes' && vote !== 'no') throw new Error('Voto inválido.');

  await setDoc(doc(db, 'campaigns', campaignId, 'votes', uid), {
    vote,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  });

  // Notifica o vendedor (best-effort)
  try {
    const cSnap = await getDoc(doc(db, 'campaigns', campaignId));
    if (cSnap.exists()) {
      const c = cSnap.data();
      if (c.sellerId) {
        await createNotification(c.sellerId, {
          type: 'new_vote',
          title: 'Novo voto recebido',
          message: `Alguém votou "${vote === 'yes' ? 'Vale a pena' : 'Não vale'}" na campanha "${c.title}".`,
          link: `/seller/campaigns/${campaignId}`
        });
      }
    }
  } catch (err) {
    console.warn('[notif new_vote]', err?.code || err?.message);
  }
}

export async function removeVote(campaignId) {
  const uid = store.get('currentUser')?.uid;
  if (!uid) return;
  const ref = doc(db, 'campaigns', campaignId, 'votes', uid);
  await deleteDoc(ref);
}

// ========== Votos (visão do vendedor) ==========
export async function getCampaignVotesDetailed(campaignId) {
  const votesRef = collection(db, 'campaigns', campaignId, 'votes');
  const snap = await getDocs(votesRef);

  const voters = [];
  let yes = 0, no = 0;

  for (const docSnap of snap.docs) {
    const v = docSnap.data();
    const uid = docSnap.id;
    if (v.vote === 'yes') yes++;
    else if (v.vote === 'no') no++;

    // Busca o nome do usuário
    let name = 'Usuário';
    let email = '';
    let photoUrl = '';
    try {
      const uSnap = await getDoc(doc(db, 'users', uid));
      if (uSnap.exists()) {
        const u = uSnap.data();
        name = u.displayName || 'Sem nome';
        email = u.email || '';
        photoUrl = u.photoUrl || '';
      }
    } catch (err) {
      // ignora
    }

    voters.push({
      uid,
      name,
      email,
      photoUrl,
      vote: v.vote,
      votedAt: v.createdAt || v.updatedAt || null
    });
  }

  // Ordena: mais recentes primeiro
  voters.sort((a, b) => new Date(b.votedAt || 0) - new Date(a.votedAt || 0));

  return { yes, no, total: yes + no, voters };
}