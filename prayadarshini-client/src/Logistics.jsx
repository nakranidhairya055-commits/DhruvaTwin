import React, { useState, useEffect, useRef } from 'react';
import { getApiUrl } from './apiConfig';

const CATEGORY_ICONS = {
  Fuel: '⛽',
  Energy: '⚡',
  Spares: '🔧',
  Food: '🍲',
  Water: '💧',
  Medical: '🏥',
  Safety: '🛡️',
  Personal: '🧥',
  Other: '📦',
};

const CATEGORY_COLORS = {
  Fuel: '#e8b529',
  Energy: '#d4a017',
  Spares: '#7b1fa2',
  Food: '#388e3c',
  Water: '#3b82c9',
  Medical: '#c62828',
  Safety: '#dc3545',
  Personal: '#00d9ff',
  Other: '#888',
};

/* ═══════════════════════════════════════════════════════════
   EXAMPLE STOCK DATA
   ═══════════════════════════════════════════════════════════ */
const buildMockLogistics = (station) => {
  const isMaitri = station === 'maitri';
  const scale = isMaitri ? 1 : 1.15;

  const rawItems = [
    { id: 'diesel_fuel_l',    name: 'Diesel Fuel',        category: 'Fuel',     qty: Math.round(45000 * scale), unit: 'L',    daily_burn: 120, lead_time_days: 45, priority: 'critical' },
    { id: 'aviation_fuel_l',  name: 'Aviation Fuel',      category: 'Fuel',     qty: Math.round(8500 * scale),  unit: 'L',    daily_burn: 22,  lead_time_days: 50, priority: 'critical' },
    { id: 'food_supplies_kg', name: 'Food Supplies',      category: 'Food',     qty: Math.round(8500 * scale),  unit: 'kg',   daily_burn: 42,  lead_time_days: 30, priority: 'high' },
    { id: 'fresh_water_l',    name: 'Fresh Water',        category: 'Water',    qty: Math.round(32000 * scale), unit: 'L',    daily_burn: 180, lead_time_days: 20, priority: 'critical' },
    { id: 'medical_kits',     name: 'Medical Kits',       category: 'Medical',  qty: 35,                        unit: 'kits', daily_burn: 0.3, lead_time_days: 40, priority: 'high' },
    { id: 'co2_scrubbers',    name: 'CO₂ Scrubbers',      category: 'Safety',   qty: 200,                       unit: 'kg',   daily_burn: 3.5, lead_time_days: 55, priority: 'critical' },
    { id: 'spare_generator',  name: 'Generator Spares',   category: 'Spares',   qty: 12,                        unit: 'sets', daily_burn: 0.2, lead_time_days: 60, priority: 'high' },
    { id: 'solar_panels',     name: 'Solar Panels',       category: 'Energy',   qty: 48,                        unit: 'units',daily_burn: 0.1, lead_time_days: 90, priority: 'medium' },
    { id: 'batteries_lead',   name: 'Lead-Acid Batteries',category: 'Energy',   qty: 24,                        unit: 'units',daily_burn: 0.15,lead_time_days: 70, priority: 'high' },
    { id: 'winter_jackets',   name: 'Winter Jackets',     category: 'Personal', qty: 60,                        unit: 'units',daily_burn: 0.1, lead_time_days: 45, priority: 'medium' },
    { id: 'emergency_rations',name: 'Emergency Rations',  category: 'Food',     qty: 1200,                      unit: 'kg',   daily_burn: 8,   lead_time_days: 35, priority: 'critical' },
    { id: 'fire_extinguishers',name:'Fire Extinguishers', category: 'Safety',   qty: 42,                        unit: 'units',daily_burn: 0.05,lead_time_days: 50, priority: 'high' },
  ];

  const items = rawItems.map((it) => {
    const days = Math.round((it.qty / Math.max(it.daily_burn, 0.001)) * 10) / 10;
    const reorder = it.lead_time_days + 15;
    const status =
      days < it.lead_time_days ? 'critical'
      : days < reorder ? 'warning'
      : 'healthy';
    return { ...it, days_until_empty: days, reorder_point: reorder, status };
  }).sort((a, b) => a.days_until_empty - b.days_until_empty);

  const critical = items.filter((i) => i.status === 'critical').length;
  const warning = items.filter((i) => i.status === 'warning').length;
  const healthy = items.length - critical - warning;

  const total_value = 14500000 * scale;

  const forecast = {};
  items.forEach((it) => {
    const arr = [];
    let remaining = it.qty;
    for (let d = 1; d <= 30; d++) {
      remaining = Math.max(0, remaining - it.daily_burn * (0.8 + Math.random() * 0.4));
      arr.push({ day: d, qty: Math.round(remaining) });
    }
    forecast[it.id] = arr;
  });

  return {
    inventory: { station, items, count: items.length },
    summary: {
      station,
      total_items: items.length,
      total_value_inr: Math.round(total_value),
      total_value_display: `₹${(total_value / 100000).toFixed(2)}L`,
      critical_count: critical,
      warning_count: warning,
      healthy_count: healthy,
    },
    resupply: {
      station,
      critical_items: items
        .filter((i) => i.status === 'critical')
        .map((i) => ({
          item: i.name,
          days_until_empty: i.days_until_empty,
          must_order_by_days: Math.round((i.days_until_empty - i.lead_time_days) * 10) / 10,
          priority: i.priority,
        })),
      next_vessel_window: 'Dec 2026 – Mar 2027',
      current_date: new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
    },
    categories: {
      categories: Object.values(
        items.reduce((acc, it) => {
          if (!acc[it.category]) acc[it.category] = { name: it.category, count: 0, critical_items: 0, total_value: 0 };
          acc[it.category].count += 1;
          if (it.status === 'critical') acc[it.category].critical_items += 1;
          acc[it.category].total_value += it.qty * 500;
          return acc;
        }, {})
      ),
    },
    shipments: {
      shipments: [
        { id: 'SHIP-001', vessel: 'MV Polar Star',    cargo: 'Diesel + Food Supplies',  status: 'in_transit', progress: 62, departed: '15 Nov 2026', eta_days: 8  },
        { id: 'SHIP-002', vessel: 'MV Sagar Nidhi',   cargo: 'Medical & Safety Kits',   status: 'in_transit', progress: 34, departed: '22 Nov 2026', eta_days: 14 },
        { id: 'SHIP-003', vessel: 'MV Thule Viking',  cargo: 'Generator Spares',        status: 'loading',    progress: 0,  departed: '—',           eta_days: 22 },
        { id: 'SHIP-004', vessel: 'MV Antarctic Ice', cargo: 'Winter Jackets + Rations',status: 'in_transit', progress: 88, departed: '02 Nov 2026', eta_days: 3  },
      ],
    },
    history: {
      orders: [
        { id: 'ORD-2026-1147', date: '20 Nov 2026', item: 'Diesel Fuel',       qty: 12000, supplier: 'IOCL Marine',        cost: '₹9,36,000',  status: 'delivered' },
        { id: 'ORD-2026-1148', date: '19 Nov 2026', item: 'Food Supplies',     qty: 2500,  supplier: 'NCPOR Logistics',   cost: '₹7,00,000',  status: 'in transit' },
        { id: 'ORD-2026-1149', date: '18 Nov 2026', item: 'Medical Kits',      qty: 20,    supplier: 'HLL Lifecare',      cost: '₹3,00,000',  status: 'delivered' },
        { id: 'ORD-2026-1150', date: '17 Nov 2026', item: 'CO₂ Scrubbers',     qty: 120,   supplier: 'Molecular Products',cost: '₹2,64,000',  status: 'processing' },
        { id: 'ORD-2026-1151', date: '16 Nov 2026', item: 'Generator Spares',  qty: 6,     supplier: 'Cummins India',     cost: '₹4,50,000',  status: 'in transit' },
        { id: 'ORD-2026-1152', date: '14 Nov 2026', item: 'Winter Jackets',    qty: 40,    supplier: 'Wildcraft Gear',    cost: '₹1,20,000',  status: 'delivered' },
      ],
    },
    suppliers: {
      suppliers: [
        { name: 'IOCL Marine',         item_count: 2, categories: ['Fuel', 'Energy'] },
        { name: 'NCPOR Logistics',     item_count: 2, categories: ['Food', 'Water'] },
        { name: 'HLL Lifecare',        item_count: 1, categories: ['Medical'] },
        { name: 'Molecular Products',  item_count: 1, categories: ['Safety'] },
        { name: 'Cummins India',       item_count: 1, categories: ['Spares'] },
        { name: 'Wildcraft Gear',      item_count: 1, categories: ['Personal'] },
        { name: 'Tata Solar',          item_count: 2, categories: ['Energy'] },
      ],
    },
    forecast: { forecast },
  };
};

/* ═══════════════════════════════════════════════════════════
   MOCK INDIA CHANNEL
   ═══════════════════════════════════════════════════════════ */
const buildMockIndiaStatus = (cycleSeconds = 30) => {
  const elapsed = (Date.now() / 1000) % cycleSeconds;
  const openFor = 10;
  const isOpen = elapsed < openFor;
  return {
    link_up: isOpen,
    seconds_until_window: isOpen ? 0 : Math.ceil(cycleSeconds - elapsed),
    window_duration: openFor,
    window_interval: cycleSeconds,
    last_window: isOpen ? 'live' : '—',
    total_transmitted: 0,
    queue_length: 0,
    sent_count: 0,
    inbox_count: 0,
    telegram_enabled: false,
  };
};

export default function Logistics({ station = 'maitri' }) {
  const [inventory, setInventory] = useState(null);
  const [resupply, setResupply] = useState(null);
  const [shipments, setShipments] = useState(null);
  const [forecast, setForecast] = useState(null);
  const [summary, setSummary] = useState(null);
  const [categories, setCategories] = useState(null);
  const [suppliers, setSuppliers] = useState(null);
  const [history, setHistory] = useState(null);
  const [selectedItem, setSelectedItem] = useState(null);
  const [orderStatus, setOrderStatus] = useState(null);
  const [filter, setFilter] = useState('all');
  const [activeView, setActiveView] = useState('inventory');
  const [usingMock, setUsingMock] = useState(false);

  /* ── India messaging state ── */
  const [indiaStatus, setIndiaStatus] = useState(null);
  const [indiaMessages, setIndiaMessages] = useState({
    outbound_queue: [],
    sent: [],
    inbox: [],
  });
  const [composeText, setComposeText] = useState('');
  const [replyText, setReplyText] = useState('');
  const [indiaToast, setIndiaToast] = useState(null);
  const [localQueue, setLocalQueue] = useState([]);
  const [localSent, setLocalSent] = useState([]);
  const [localInbox, setLocalInbox] = useState([]);

  /* ── Auto-transmit detection refs ── */
  const lastSentCount = useRef(0);
  const lastQueueLen = useRef(0);
  const firstPollDone = useRef(false);

  const toastTimer = useRef(null);

  const isMaitri = station === 'maitri';
  const accent = isMaitri ? '#00d9ff' : '#a855f7';

  /* ═══════════════════════════════════════════════════════════
     FETCH LOGISTICS DATA
     ═══════════════════════════════════════════════════════════ */
  useEffect(() => {
    const fetchAll = async () => {
      const mock = buildMockLogistics(station);

      try {
        const [inv, resup, ships, fore, summ, cats, sup, hist] = await Promise.all([
          fetch(getApiUrl(`/api/logistics/inventory/${station}`)).then((r) => r.json()),
          fetch(getApiUrl(`/api/logistics/resupply/${station}`)).then((r) => r.json()),
          fetch(getApiUrl(`/api/logistics/shipments/${station}`)).then((r) => r.json()).catch(() => null),
          fetch(getApiUrl(`/api/logistics/forecast/${station}`)).then((r) => r.json()).catch(() => null),
          fetch(getApiUrl(`/api/logistics/summary/${station}`)).then((r) => r.json()),
          fetch(getApiUrl(`/api/logistics/categories/${station}`)).then((r) => r.json()).catch(() => null),
          fetch(getApiUrl(`/api/logistics/suppliers/${station}`)).then((r) => r.json()).catch(() => null),
          fetch(getApiUrl(`/api/logistics/history/${station}`)).then((r) => r.json()).catch(() => null),
        ]);

        setInventory(inv?.items ? inv : mock.inventory);
        setResupply(resup?.critical_items ? resup : mock.resupply);
        setShipments(ships?.shipments ? ships : mock.shipments);
        setForecast(fore?.forecast ? fore : mock.forecast);
        setSummary(summ?.total_items ? summ : mock.summary);
        setCategories(cats?.categories ? cats : mock.categories);
        setSuppliers(sup?.suppliers ? sup : mock.suppliers);
        setHistory(hist?.orders ? hist : mock.history);
        setUsingMock(false);
      } catch (e) {
        console.warn('[Logistics] API unreachable — using example stock data.', e);
        setInventory(mock.inventory);
        setResupply(mock.resupply);
        setShipments(mock.shipments);
        setForecast(mock.forecast);
        setSummary(mock.summary);
        setCategories(mock.categories);
        setSuppliers(mock.suppliers);
        setHistory(mock.history);
        setUsingMock(true);
      }
    };
    fetchAll();
    const i = setInterval(fetchAll, 15000);
    return () => clearInterval(i);
  }, [station]);

  /* ═══════════════════════════════════════════════════════════
     FETCH INDIA STATUS — polls every 2s
     ═══════════════════════════════════════════════════════════ */
  useEffect(() => {
    const fetchIndia = async () => {
      try {
        const [statusR, msgR] = await Promise.all([
          fetch(getApiUrl('/api/india/status')).then((r) => r.json()),
          fetch(getApiUrl('/api/india/messages')).then((r) => r.json()),
        ]);
        setIndiaStatus(statusR);
        setIndiaMessages(msgR);
      } catch (e) {
        setIndiaStatus(buildMockIndiaStatus(30));
        setIndiaMessages({
          outbound_queue: localQueue,
          sent: localSent,
          inbox: localInbox,
        });
      }
    };
    fetchIndia();
    const i = setInterval(fetchIndia, 2000);
    return () => clearInterval(i);
  }, [localQueue, localSent, localInbox]);

  /* ═══════════════════════════════════════════════════════════
     AUTO-DETECT: When satellite window opens and flushes queue
     ═══════════════════════════════════════════════════════════ */
  useEffect(() => {
    const queueNow = indiaMessages.outbound_queue?.length ?? 0;
    const sentNow = indiaMessages.sent?.length ?? 0;

    // Skip the very first poll to avoid a false "flush" toast
    if (!firstPollDone.current) {
      lastQueueLen.current = queueNow;
      lastSentCount.current = sentNow;
      firstPollDone.current = true;
      return;
    }

    // Detect auto-transmit: queue shrank AND sent grew
    const queueShrank = queueNow < lastQueueLen.current;
    const sentGrew = sentNow > lastSentCount.current;

    if (queueShrank && sentGrew) {
      const flushed = sentNow - lastSentCount.current;
      showIndiaToast(
        `🛰 Auto-transmitted ${flushed} message${flushed > 1 ? 's' : ''} to India`,
        5000
      );
    }

    lastQueueLen.current = queueNow;
    lastSentCount.current = sentNow;
  }, [indiaMessages.outbound_queue, indiaMessages.sent]);

  /* ═══════════════════════════════════════════════════════════
     SHOW TOAST
     ═══════════════════════════════════════════════════════════ */
  const showIndiaToast = (msg, duration = 3500) => {
    setIndiaToast(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setIndiaToast(null), duration);
  };

  /* ═══════════════════════════════════════════════════════════
     SEND ORDER TO INDIA
     ═══════════════════════════════════════════════════════════ */
  const sendOrderToIndia = async (item, qty) => {
    const payload = {
      station,
      item: item.name,
      qty,
      priority: item.priority,
    };

    try {
      const r = await fetch(getApiUrl('/api/india/send-order'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await r.json();

      if (data.delivered) {
        showIndiaToast(`🇮🇳 Delivered to India — ${item.name}`);
      } else if (data.reason === 'offline_queued') {
        showIndiaToast(
          `📡 Queued — auto-transmits in ${data.next_window_in}s`,
          4000
        );
      } else {
        showIndiaToast(`⚠️ Send failed — will retry`);
      }
    } catch (e) {
      const msg = {
        id: `ORD-${Date.now()}`,
        ts: new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
        station,
        item: item.name,
        qty,
        priority: item.priority,
        status: 'queued',
        reply: null,
      };
      setLocalQueue((prev) => [...prev, msg]);
      showIndiaToast(`📡 Queued locally — ${item.name}`, 4000);
    }
  };

  /* ═══════════════════════════════════════════════════════════
     PLACE ORDER
     ═══════════════════════════════════════════════════════════ */
  const placeOrder = async (item) => {
    const qty = Math.round(item.daily_burn * item.lead_time_days * 1.5);

    // 1. Blockchain log
    try {
      const r = await fetch(getApiUrl('/api/logistics/order'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ station, item: item.name, qty, priority: item.priority }),
      });
      const data = await r.json();
      setOrderStatus(data);
      setTimeout(() => setOrderStatus(null), 5000);
    } catch (e) {
      setOrderStatus({
        success: true,
        order_id: `ORD-${Date.now()}`,
        station,
        item: item.name,
        qty,
        priority: item.priority,
        status: 'submitted (offline)',
      });
      setTimeout(() => setOrderStatus(null), 5000);
    }

    // 2. Route through Antarctica → India channel
    sendOrderToIndia(item, qty);
  };

  const statusColor = (s) => {
    if (s === 'critical') return '#dc2626';
    if (s === 'warning') return '#f59e0b';
    return '#22c55e';
  };

  const statusLabel = (s) => {
    if (s === 'critical') return 'CRITICAL';
    if (s === 'warning') return 'WARNING';
    return 'HEALTHY';
  };

  const safeItems = Array.isArray(inventory?.items) ? inventory.items : [];
  const filtered = filter === 'all' ? safeItems : safeItems.filter((i) => i.status === filter);

  /* ═══════════════════════════════════════════════════════════
     COMPOSE MESSAGE
     ═══════════════════════════════════════════════════════════ */
  const handleComposeSend = async () => {
    if (!composeText.trim()) return;
    const syntheticItem = {
      name: composeText,
      priority: 'manual',
      daily_burn: 1,
      lead_time_days: 1,
    };
    await sendOrderToIndia(syntheticItem, 1);
    setComposeText('');
  };

  /* ═══════════════════════════════════════════════════════════
     FORCE SYNC
     ═══════════════════════════════════════════════════════════ */
  const handleForceSync = async () => {
    try {
      await fetch(getApiUrl('/api/india/force-sync'), { method: 'POST' });
      showIndiaToast('📡 Force sync triggered');
    } catch (e) {
      const moved = localQueue.map((m) => ({ ...m, status: 'delivered' }));
      setLocalSent((prev) => [...prev, ...moved]);
      setLocalQueue([]);
      showIndiaToast(`📡 Flushed ${moved.length} message(s) locally`);
    }
  };

  /* ═══════════════════════════════════════════════════════════
     RECEIVE REPLY
     ═══════════════════════════════════════════════════════════ */
  const handleReceiveReply = async () => {
    if (!replyText.trim()) return;
    try {
      await fetch(getApiUrl('/api/india/receive-reply'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: replyText }),
      });
      showIndiaToast('📥 Reply received from India');
    } catch (e) {
      setLocalInbox((prev) => [
        ...prev,
        {
          id: `REPLY-${Date.now()}`,
          ts: new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
          from: 'INDIA',
          text: replyText,
        },
      ]);
      showIndiaToast('📥 Reply logged locally');
    }
    setReplyText('');
  };

  /* ═══════════════════════════════════════════════════════════
     CLEAR
     ═══════════════════════════════════════════════════════════ */
  const handleClearAll = async () => {
    try {
      await fetch(getApiUrl('/api/india/clear'), { method: 'POST' });
    } catch (e) { /* silent */ }
    setLocalQueue([]);
    setLocalSent([]);
    setLocalInbox([]);
    showIndiaToast('🗑 Cleared all India messages');
  };

  /* Computed values */
  const outbound = indiaMessages.outbound_queue?.length
    ? indiaMessages.outbound_queue
    : localQueue;
  const sent = indiaMessages.sent?.length ? indiaMessages.sent : localSent;
  const inbox = indiaMessages.inbox?.length ? indiaMessages.inbox : localInbox;

  return (
    <div style={{ padding: 6 }}>
      {/* Header */}
      <div className="dsv-card" style={{ marginBottom: 16 }}>
        <div className="dsv-card-head">
          <div className="dsv-card-label">🚢 PREDICTIVE LOGISTICS · {station.toUpperCase()}</div>
          <div className="dsv-section-meta">
            {safeItems.length} ITEMS TRACKED {usingMock && '· EXAMPLE DATA'}
          </div>
        </div>
        <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.65)', marginTop: 0, lineHeight: 1.6 }}>
          Forecasts consumption, predicts stockout dates against Antarctic resupply windows,
          and recommends prioritized orders. Orders route to India over the satellite channel
          and auto-transmit when the uplink window opens.
        </p>
      </div>

      {/* KPI Row */}
      {summary && (
        <div className="dsv-kpi-grid" style={{ marginBottom: 16, gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))' }}>
          <div className="dsv-kpi">
            <div className="dsv-kpi-label">TOTAL ITEMS</div>
            <div className="dsv-kpi-value accent">{summary.total_items}</div>
          </div>
          <div className="dsv-kpi">
            <div className="dsv-kpi-label">💰 INVENTORY VALUE</div>
            <div className="dsv-kpi-value green" style={{ fontSize: 20 }}>{summary.total_value_display}</div>
          </div>
          <div className="dsv-kpi">
            <div className="dsv-kpi-label">🔴 CRITICAL</div>
            <div className="dsv-kpi-value red">{summary.critical_count}</div>
          </div>
          <div className="dsv-kpi">
            <div className="dsv-kpi-label">🟡 WARNING</div>
            <div className="dsv-kpi-value amber">{summary.warning_count}</div>
          </div>
          <div className="dsv-kpi">
            <div className="dsv-kpi-label">🟢 HEALTHY</div>
            <div className="dsv-kpi-value green">{summary.healthy_count}</div>
          </div>
        </div>
      )}

      {/* View Tabs */}
      <div className="dsv-seg" style={{ marginBottom: 16 }}>
        {[
          ['inventory', '📋 INVENTORY'],
          ['india', `🇮🇳 INDIA CHANNEL${outbound.length > 0 ? ` (${outbound.length})` : ''}`],
          ['categories', '📊 CATEGORIES'],
          ['shipments', '🚢 SHIPMENTS'],
          ['history', '📜 ORDER HISTORY'],
          ['suppliers', '🏭 SUPPLIERS'],
        ].map(([id, label]) => (
          <button
            key={id}
            className={`dsv-seg-btn ${activeView === id ? 'active' : ''}`}
            onClick={() => setActiveView(id)}
            style={activeView === id ? { background: `linear-gradient(135deg, ${accent}, ${accent}cc)`, color: '#000' } : {}}
          >
            {label}
          </button>
        ))}
      </div>

      {/* ═══════════════════════════════════════════════════════════
          INVENTORY VIEW
          ═══════════════════════════════════════════════════════════ */}
      {activeView === 'inventory' && (
        <>
          <div className="dsv-seg" style={{ marginBottom: 14 }}>
            {[
              ['all', `ALL (${safeItems.length})`],
              ['critical', `🔴 CRITICAL (${safeItems.filter(i => i.status === 'critical').length})`],
              ['warning', `🟡 WARNING (${safeItems.filter(i => i.status === 'warning').length})`],
              ['healthy', `🟢 HEALTHY (${safeItems.filter(i => i.status === 'healthy').length})`],
            ].map(([id, label]) => (
              <button
                key={id}
                className={`dsv-seg-btn ${filter === id ? 'active' : ''}`}
                onClick={() => setFilter(id)}
                style={filter === id ? { background: `linear-gradient(135deg, ${accent}, ${accent}cc)`, color: '#000' } : {}}
              >
                {label}
              </button>
            ))}
          </div>

          {resupply?.critical_items?.length > 0 && (
            <div className="dsv-card warn" style={{ marginBottom: 16 }}>
              <div className="dsv-card-head">
                <div className="dsv-card-label">⚠️ URGENT RESUPPLY REQUIRED</div>
                <div className="dsv-section-meta">{resupply.critical_items.length} ITEMS</div>
              </div>
              {resupply.critical_items.map((item, i) => (
                <div key={i} className="dsv-row">
                  <span className="dsv-row-key">📦 {item.item}</span>
                  <span className="dsv-row-val bad">
                    Stockout in {item.days_until_empty}d · Order within {Math.max(0, item.must_order_by_days)}d
                  </span>
                </div>
              ))}
            </div>
          )}

          <div className="dsv-card">
            <div className="dsv-card-head">
              <div className="dsv-card-label">📋 INVENTORY SNAPSHOT</div>
              <div className="dsv-section-meta">LIVE FORECAST</div>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse', fontFamily: 'Inter, sans-serif' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                    {['ITEM', 'CATEGORY', 'STOCK', 'BURN/DAY', 'DAYS LEFT', 'STATUS', 'ACTION'].map((h) => (
                      <th key={h} style={{
                        textAlign: 'left', padding: '10px 8px',
                        color: 'rgba(255,255,255,0.5)', fontSize: 10,
                        letterSpacing: 1.2, fontWeight: 700,
                      }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0 ? (
                    <tr><td colSpan="7" style={{ padding: 20, textAlign: 'center', color: 'rgba(255,255,255,0.4)' }}>No items match this filter.</td></tr>
                  ) : filtered.map((item) => (
                    <tr key={item.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}
                        onClick={() => setSelectedItem(selectedItem?.id === item.id ? null : item)}
                        onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(0,217,255,0.04)'}
                        onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                    >
                      <td style={{ padding: '10px 8px', fontWeight: 700 }}>{item.name}</td>
                      <td style={{ padding: '10px 8px' }}>
                        <span style={{
                          fontSize: 9, padding: '2px 8px', borderRadius: 999,
                          background: (CATEGORY_COLORS[item.category] || '#888') + '22',
                          color: CATEGORY_COLORS[item.category] || '#888',
                          fontWeight: 800, letterSpacing: 0.5,
                        }}>
                          {CATEGORY_ICONS[item.category] || '📦'} {item.category || 'Other'}
                        </span>
                      </td>
                      <td style={{ padding: '10px 8px', fontFamily: 'JetBrains Mono', color: '#7ec8ff' }}>{item.qty} {item.unit}</td>
                      <td style={{ padding: '10px 8px', fontFamily: 'JetBrains Mono', color: 'rgba(255,255,255,0.65)' }}>{item.daily_burn} {item.unit}</td>
                      <td style={{ padding: '10px 8px', fontFamily: 'JetBrains Mono', fontWeight: 800, color: statusColor(item.status) }}>
                        {item.days_until_empty}d
                      </td>
                      <td style={{ padding: '10px 8px' }}>
                        <span style={{
                          padding: '3px 10px', borderRadius: 999, fontSize: 10, fontWeight: 800,
                          background: statusColor(item.status) + '22', color: statusColor(item.status),
                        }}>{statusLabel(item.status)}</span>
                      </td>
                      <td style={{ padding: '10px 8px' }}>
                        <button onClick={(e) => { e.stopPropagation(); placeOrder(item); }}
                          style={{
                            padding: '5px 12px', borderRadius: 6, border: 'none',
                            background: `linear-gradient(135deg, ${accent}, ${accent}cc)`,
                            color: '#000', fontSize: 10, fontWeight: 800, cursor: 'pointer',
                            letterSpacing: 0.5, fontFamily: 'inherit',
                          }}>
                          ORDER
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {selectedItem && forecast?.forecast?.[selectedItem.id] && (
            <div className="dsv-card" style={{ marginTop: 16 }}>
              <div className="dsv-card-head">
                <div className="dsv-card-label">📈 30-DAY FORECAST · {selectedItem.name}</div>
                <div className="dsv-section-meta" onClick={() => setSelectedItem(null)} style={{ cursor: 'pointer' }}>CLOSE ✕</div>
              </div>
              <div style={{ padding: '12px 0' }}>
                <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: 120 }}>
                  {forecast.forecast[selectedItem.id].map((point, i) => {
                    const pct = (point.qty / (selectedItem.qty || 1)) * 100;
                    return (
                      <div key={i} style={{
                        flex: 1, height: `${Math.max(pct, 2)}%`,
                        background: pct < 20 ? '#dc2626' : pct < 40 ? '#f59e0b' : `linear-gradient(180deg, ${accent}, #22c55e)`,
                        borderRadius: '2px 2px 0 0',
                        transition: 'all 0.3s',
                        minWidth: 4,
                      }} title={`Day ${point.day}: ${point.qty} ${selectedItem.unit}`} />
                    );
                  })}
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8, fontSize: 10, color: 'rgba(255,255,255,0.4)' }}>
                  <span>Day 1</span><span>Day 15</span><span>Day 30</span>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* ═══════════════════════════════════════════════════════════
          INDIA CHANNEL VIEW
          ═══════════════════════════════════════════════════════════ */}
      {activeView === 'india' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Live uplink banner */}
          <div className="dsv-card" style={{
            borderLeft: `4px solid ${indiaStatus?.link_up ? '#22c55e' : '#f59e0b'}`,
            background: indiaStatus?.link_up
              ? 'linear-gradient(135deg, rgba(34,197,94,0.08), transparent 60%)'
              : 'linear-gradient(135deg, rgba(245,158,11,0.08), transparent 60%)',
          }}>
            <div className="dsv-card-head">
              <div className="dsv-card-label">📡 SATELLITE UPLINK · ANTARCTICA → INDIA</div>
              <div className="dsv-section-meta" style={{
                color: indiaStatus?.link_up ? '#22c55e' : '#f59e0b',
                fontWeight: 800,
              }}>
                {indiaStatus?.link_up
                  ? `● WINDOW OPEN · ${indiaStatus.window_duration}s remaining`
                  : `○ WINDOW CLOSED · opens in ${indiaStatus?.seconds_until_window ?? '—'}s`}
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 12, marginTop: 12 }}>
              <div className="dsv-kpi">
                <div className="dsv-kpi-label">IN QUEUE</div>
                <div className="dsv-kpi-value amber">{outbound.length}</div>
              </div>
              <div className="dsv-kpi">
                <div className="dsv-kpi-label">DELIVERED</div>
                <div className="dsv-kpi-value green">{sent.length}</div>
              </div>
              <div className="dsv-kpi">
                <div className="dsv-kpi-label">INBOX</div>
                <div className="dsv-kpi-value accent">{inbox.length}</div>
              </div>
              <div className="dsv-kpi">
                <div className="dsv-kpi-label">CHANNEL</div>
                <div className="dsv-kpi-value" style={{ fontSize: 14 }}>
                  {indiaStatus?.telegram_enabled ? 'TELEGRAM' : 'SIMULATED'}
                </div>
              </div>
            </div>

            {/* Progress bar */}
            {!indiaStatus?.link_up && indiaStatus?.seconds_until_window > 0 && (
              <div style={{ marginTop: 14 }}>
                <div style={{
                  height: 6, borderRadius: 3,
                  background: 'rgba(0,0,0,0.3)', overflow: 'hidden',
                }}>
                  <div style={{
                    height: '100%',
                    width: `${100 - ((indiaStatus.seconds_until_window / indiaStatus.window_interval) * 100)}%`,
                    background: 'linear-gradient(90deg, #f59e0b, #22c55e)',
                    transition: 'width 1s linear',
                  }} />
                </div>
                <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)', marginTop: 6, fontFamily: 'JetBrains Mono' }}>
                  Next satellite pass in {indiaStatus.seconds_until_window}s · {outbound.length} message(s) waiting · <b style={{ color: '#22c55e' }}>AUTO-SEND ON OPEN</b>
                </div>
              </div>
            )}

            {/* Window open warning */}
            {indiaStatus?.link_up && outbound.length > 0 && (
              <div style={{
                marginTop: 12, padding: '8px 12px',
                background: 'rgba(34,197,94,0.15)',
                borderRadius: 6,
                borderLeft: '3px solid #22c55e',
                fontSize: 11,
                color: '#22c55e',
                fontWeight: 700,
                letterSpacing: 0.5,
              }}>
                🛰 TRANSMITTING NOW — {outbound.length} message(s) in flight
              </div>
            )}

            <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
              <button
                onClick={handleForceSync}
                style={{
                  padding: '8px 18px', borderRadius: 8,
                  background: 'linear-gradient(135deg, #22c55e, #16a34a)',
                  border: 'none', color: '#000', fontWeight: 800,
                  fontSize: 11, cursor: 'pointer', letterSpacing: 0.5,
                }}
              >
                ⚡ FORCE SYNC NOW
              </button>
              <button
                onClick={handleClearAll}
                style={{
                  padding: '8px 18px', borderRadius: 8,
                  background: 'transparent',
                  border: '1px solid rgba(255,255,255,0.15)',
                  color: '#fff', fontWeight: 700, fontSize: 11, cursor: 'pointer',
                }}
              >
                CLEAR ALL
              </button>
            </div>
          </div>

          {/* Compose message */}
          <div className="dsv-card">
            <div className="dsv-card-head">
              <div className="dsv-card-label">✉️ COMPOSE MESSAGE TO INDIA</div>
              <div className="dsv-section-meta">MANUAL DISPATCH</div>
            </div>
            <p style={{ fontSize: 11.5, color: 'rgba(255,255,255,0.5)', marginTop: 0, marginBottom: 10 }}>
              Type a message for NCPOR. If the satellite link is down, the message enters the queue and auto-transmits when the window opens.
            </p>
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                value={composeText}
                onChange={(e) => setComposeText(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleComposeSend()}
                placeholder="e.g. Requesting emergency medical supplies by next vessel…"
                style={{
                  flex: 1, padding: '10px 14px', borderRadius: 8,
                  background: 'rgba(0,0,0,0.3)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  color: '#fff', fontFamily: 'JetBrains Mono, monospace',
                  fontSize: 12, outline: 'none',
                }}
              />
              <button
                onClick={handleComposeSend}
                disabled={!composeText.trim()}
                style={{
                  padding: '10px 22px', borderRadius: 8, border: 'none',
                  background: composeText.trim()
                    ? 'linear-gradient(135deg, #00d9ff, #3b82f6)'
                    : 'rgba(255,255,255,0.05)',
                  color: composeText.trim() ? '#000' : 'rgba(255,255,255,0.3)',
                  fontWeight: 800, fontSize: 12,
                  cursor: composeText.trim() ? 'pointer' : 'not-allowed',
                  letterSpacing: 0.5,
                }}
              >
                SEND ➤
              </button>
            </div>
          </div>

          {/* Outbound Queue */}
          <div className="dsv-card">
            <div className="dsv-card-head">
              <div className="dsv-card-label">📤 OUTBOUND QUEUE</div>
              <div className="dsv-section-meta">{outbound.length} WAITING</div>
            </div>
            {outbound.length === 0 ? (
              <div style={{ padding: 24, textAlign: 'center', color: 'rgba(255,255,255,0.4)', fontSize: 12 }}>
                Queue is empty. All messages delivered.
              </div>
            ) : (
              outbound.map((m, i) => (
                <div key={i} style={{
                  padding: 12, marginBottom: 8, borderRadius: 8,
                  background: 'rgba(245,158,11,0.06)',
                  borderLeft: '3px solid #f59e0b',
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 4 }}>
                    <span style={{ color: '#f59e0b', fontFamily: 'JetBrains Mono', fontWeight: 700 }}>
                      {m.id}
                    </span>
                    <span style={{ color: 'rgba(255,255,255,0.4)', fontFamily: 'JetBrains Mono' }}>
                      {m.ts}
                    </span>
                  </div>
                  <div style={{ fontSize: 13, color: '#fff', fontWeight: 700 }}>
                    {m.item} × {m.qty} · {m.priority}
                  </div>
                  <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', marginTop: 4 }}>
                    {m.status === 'retry'
                      ? `Retry pending · ${m.last_error || ''}`
                      : 'Waiting for satellite window — will auto-transmit'}
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Delivered */}
          <div className="dsv-card">
            <div className="dsv-card-head">
              <div className="dsv-card-label">✅ DELIVERED TO INDIA</div>
              <div className="dsv-section-meta">{sent.length} MESSAGES</div>
            </div>
            {sent.length === 0 ? (
              <div style={{ padding: 24, textAlign: 'center', color: 'rgba(255,255,255,0.4)', fontSize: 12 }}>
                No messages delivered yet.
              </div>
            ) : (
              [...sent].reverse().slice(0, 20).map((m, i) => (
                <div key={i} style={{
                  padding: 12, marginBottom: 8, borderRadius: 8,
                  background: 'rgba(34,197,94,0.06)',
                  borderLeft: '3px solid #22c55e',
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 4 }}>
                    <span style={{ color: '#22c55e', fontFamily: 'JetBrains Mono', fontWeight: 700 }}>
                      {m.id}
                    </span>
                    <span style={{ color: 'rgba(255,255,255,0.4)', fontFamily: 'JetBrains Mono' }}>
                      {m.delivered_at || m.ts}
                    </span>
                  </div>
                  <div style={{ fontSize: 13, color: '#fff', fontWeight: 700 }}>
                    {m.item} × {m.qty}
                  </div>
                  {m.reply && (
                    <div style={{
                      marginTop: 8, padding: '6px 10px', borderRadius: 6,
                      background: 'rgba(0,217,255,0.1)',
                      borderLeft: '3px solid #00d9ff',
                      fontSize: 12, color: '#7ec8ff',
                    }}>
                      🇮🇳 India replied: <b>{m.reply}</b>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>

          {/* Inbox */}
          <div className="dsv-card">
            <div className="dsv-card-head">
              <div className="dsv-card-label">📥 INBOX · FROM INDIA</div>
              <div className="dsv-section-meta">{inbox.length} REPLIES</div>
            </div>
            {inbox.length === 0 ? (
              <div style={{ padding: 24, textAlign: 'center', color: 'rgba(255,255,255,0.4)', fontSize: 12 }}>
                No replies from India yet.
              </div>
            ) : (
              [...inbox].reverse().map((r, i) => (
                <div key={i} style={{
                  padding: 12, marginBottom: 8, borderRadius: 8,
                  background: 'rgba(0,217,255,0.06)',
                  borderLeft: '3px solid #00d9ff',
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 4 }}>
                    <span style={{ color: '#00d9ff', fontFamily: 'JetBrains Mono', fontWeight: 700 }}>
                      🇮🇳 NCPOR INDIA
                    </span>
                    <span style={{ color: 'rgba(255,255,255,0.4)', fontFamily: 'JetBrains Mono' }}>
                      {r.ts}
                    </span>
                  </div>
                  <div style={{ fontSize: 13, color: '#fff' }}>{r.text}</div>
                </div>
              ))
            )}

            <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
              <input
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleReceiveReply()}
                placeholder="Simulate a reply from India (e.g. 'Approved, ship by next vessel')"
                style={{
                  flex: 1, padding: '10px 14px', borderRadius: 8,
                  background: 'rgba(0,0,0,0.3)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  color: '#fff', fontFamily: 'JetBrains Mono, monospace',
                  fontSize: 12, outline: 'none',
                }}
              />
              <button
                onClick={handleReceiveReply}
                disabled={!replyText.trim()}
                style={{
                  padding: '10px 18px', borderRadius: 8, border: 'none',
                  background: replyText.trim()
                    ? 'linear-gradient(135deg, #00d9ff, #3b82f6)'
                    : 'rgba(255,255,255,0.05)',
                  color: replyText.trim() ? '#000' : 'rgba(255,255,255,0.3)',
                  fontWeight: 800, fontSize: 11,
                  cursor: replyText.trim() ? 'pointer' : 'not-allowed',
                }}
              >
                RECEIVE 🇮🇳
              </button>
            </div>
          </div>

        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════
          CATEGORIES VIEW
          ═══════════════════════════════════════════════════════════ */}
      {activeView === 'categories' && categories?.categories && (
        <div className="dsv-kpi-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
          {categories.categories.map((cat, i) => (
            <div key={i} className="dsv-kpi" style={{ borderLeft: `3px solid ${CATEGORY_COLORS[cat.name] || '#888'}` }}>
              <div className="dsv-kpi-label">
                {CATEGORY_ICONS[cat.name] || '📦'} {cat.name}
              </div>
              <div style={{ marginTop: 8, fontSize: 12, fontFamily: 'JetBrains Mono' }}>
                <div><span style={{ color: 'rgba(255,255,255,0.5)' }}>Items:</span> <b style={{ color: '#fff' }}>{cat.count}</b></div>
                <div><span style={{ color: 'rgba(255,255,255,0.5)' }}>Critical:</span> <b style={{ color: cat.critical_items > 0 ? '#ff6b76' : '#6ee7a0' }}>{cat.critical_items}</b></div>
                <div><span style={{ color: 'rgba(255,255,255,0.5)' }}>Value:</span> <b style={{ color: '#6ee7a0' }}>₹{(cat.total_value/100000).toFixed(1)}L</b></div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Shipments */}
      {activeView === 'shipments' && shipments?.shipments && (
        <div className="dsv-card">
          <div className="dsv-card-head">
            <div className="dsv-card-label">🚢 ACTIVE SHIPMENTS</div>
            <div className="dsv-section-meta">{shipments.shipments.length} TRACKED</div>
          </div>
          {shipments.shipments.map((ship) => (
            <div key={ship.id} style={{
              padding: 14, marginBottom: 10, borderRadius: 10,
              background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 800 }}>{ship.vessel}</div>
                  <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', marginTop: 2 }}>{ship.cargo}</div>
                </div>
                <span style={{
                  padding: '3px 10px', borderRadius: 999, fontSize: 10, fontWeight: 800,
                  background: ship.status === 'in_transit' ? 'rgba(0,217,255,0.2)' : ship.status === 'loading' ? 'rgba(245,158,11,0.2)' : 'rgba(255,255,255,0.08)',
                  color: ship.status === 'in_transit' ? accent : ship.status === 'loading' ? '#fbbf24' : 'rgba(255,255,255,0.6)',
                  textTransform: 'uppercase', letterSpacing: 0.8,
                }}>{ship.status.replace('_', ' ')}</span>
              </div>
              {ship.progress > 0 && (
                <>
                  <div style={{ height: 6, borderRadius: 3, background: 'rgba(0,0,0,0.3)', overflow: 'hidden' }}>
                    <div style={{
                      height: '100%', width: `${ship.progress}%`,
                      background: `linear-gradient(90deg, ${accent}, #22c55e)`,
                      transition: 'width 0.4s',
                    }} />
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6, fontSize: 10, color: 'rgba(255,255,255,0.5)', fontFamily: 'JetBrains Mono' }}>
                    <span>Departed: {ship.departed}</span>
                    <span>{ship.progress}% · ETA {ship.eta_days}d</span>
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      )}

      {/* History */}
      {activeView === 'history' && history?.orders && (
        <div className="dsv-card">
          <div className="dsv-card-head">
            <div className="dsv-card-label">📜 ORDER HISTORY</div>
            <div className="dsv-section-meta">{history.orders.length} RECENT</div>
          </div>
          <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                {['ID', 'DATE', 'ITEM', 'QTY', 'SUPPLIER', 'COST', 'STATUS'].map((h) => (
                  <th key={h} style={{ textAlign: 'left', padding: '10px 8px', color: 'rgba(255,255,255,0.5)', fontSize: 10, letterSpacing: 1.2, fontWeight: 700 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {history.orders.map((ord) => (
                <tr key={ord.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                  <td style={{ padding: '10px 8px', fontFamily: 'JetBrains Mono', color: accent }}>{ord.id}</td>
                  <td style={{ padding: '10px 8px', color: 'rgba(255,255,255,0.6)' }}>{ord.date}</td>
                  <td style={{ padding: '10px 8px', fontWeight: 700 }}>{ord.item}</td>
                  <td style={{ padding: '10px 8px', fontFamily: 'JetBrains Mono' }}>{ord.qty}</td>
                  <td style={{ padding: '10px 8px', color: 'rgba(255,255,255,0.6)' }}>{ord.supplier}</td>
                  <td style={{ padding: '10px 8px', fontFamily: 'JetBrains Mono', color: '#6ee7a0' }}>{ord.cost}</td>
                  <td style={{ padding: '10px 8px' }}>
                    <span style={{ padding: '3px 10px', borderRadius: 999, fontSize: 10, fontWeight: 800, background: 'rgba(34,197,94,0.2)', color: '#6ee7a0' }}>
                      ● {ord.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Suppliers */}
      {activeView === 'suppliers' && suppliers?.suppliers && (
        <div className="dsv-kpi-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
          {suppliers.suppliers.map((sup, i) => (
            <div key={i} className="dsv-kpi">
              <div className="dsv-kpi-label">🏭 {sup.name}</div>
              <div className="dsv-kpi-value accent" style={{ fontSize: 22, marginTop: 6 }}>{sup.item_count}</div>
              <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)', marginTop: 4, fontFamily: 'JetBrains Mono' }}>
                items supplied
              </div>
              <div style={{ marginTop: 8, display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                {sup.categories.map((c, j) => (
                  <span key={j} style={{
                    fontSize: 9, padding: '2px 8px', borderRadius: 999,
                    background: (CATEGORY_COLORS[c] || '#888') + '22',
                    color: CATEGORY_COLORS[c] || '#888',
                    fontWeight: 800,
                  }}>{c}</span>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Order confirmation toast */}
      {orderStatus && (
        <div style={{
          position: 'fixed', bottom: 24, right: 24, zIndex: 9999,
          padding: 16, borderRadius: 12,
          background: 'linear-gradient(135deg, rgba(34,197,94,0.95), rgba(16,185,129,0.9))',
          color: '#fff', fontWeight: 700, minWidth: 280,
          boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
        }}>
          <div style={{ fontSize: 16, marginBottom: 6 }}>✅ Order Submitted</div>
          <div style={{ fontSize: 12, opacity: 0.95 }}>{orderStatus.item} × {orderStatus.qty}</div>
          <div style={{ fontSize: 11, opacity: 0.85, marginTop: 4, fontFamily: 'JetBrains Mono' }}>
            {orderStatus.order_id} · logged to blockchain
          </div>
        </div>
      )}

      {/* India channel toast */}
      {indiaToast && (
        <div style={{
          position: 'fixed', bottom: 100, right: 24, zIndex: 9999,
          padding: 14, borderRadius: 12,
          background: 'linear-gradient(135deg, rgba(0,217,255,0.95), rgba(59,130,246,0.9))',
          color: '#fff', fontWeight: 700, minWidth: 280,
          boxShadow: '0 20px 60px rgba(0,0,0,0.5)', fontSize: 13,
        }}>
          {indiaToast}
        </div>
      )}
    </div>
  );
}