console.log("🤖 Bot Telegram Kebsos sedang berjalan...");

const TelegramBot = require('node-telegram-bot-api');
const axios = require('axios');
const qs = require('qs');
const fs = require('fs');
const path = './order_data.json';

// Ganti sesuai punyamu
const TELEGRAM_TOKEN = '7635366583:AAFFhuSxrX_i-8lyLzQri_8g04cVIxIAtZo';
const TRYONPEDIA_API_ID = 'TEpwaDQ0RFdaTnhFYWs0dlUwUDE5QT09';
const TRYONPEDIA_API_KEY = '465a31-681bf5-e076df-2271c0-ccd4ae';
const ADMIN_ID = -1001873253225; // ganti dengan chat ID kamu

const bot = new TelegramBot(TELEGRAM_TOKEN, { polling: true });

let orderData = {};
if (fs.existsSync(path)) {
  orderData = JSON.parse(fs.readFileSync(path));
}

function simpanOrder() {
  fs.writeFileSync(path, JSON.stringify(orderData, null, 2));
}

const layananPerHalaman = 5;
let layananData = [];
let penggunaHalaman = {};
ambilSemuaLayanan();

async function ambilSemuaLayanan() {
  try {
    const response = await axios.post('https://tryonpedia.com/api/services', qs.stringify({
      api_id: TRYONPEDIA_API_ID,
      api_key: TRYONPEDIA_API_KEY
    }), {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
    });

    if (response.data.status) layananData = response.data.data;
  } catch (err) {
    console.error('Gagal ambil layanan:', err.message);
  }
}

function formatLayanan(data) {
  return data.map(item => `🆔 *${item.id}*\n📌 ${item.name}\n💰 Rp ${parseInt(item.price * 2.12).toLocaleString('id-ID')} (harga jual)\n`).join('\n');
}

function tampilkanLayanan(chatInfo, halaman = 1) {
  const chatId = typeof chatInfo === 'number' ? chatInfo : chatInfo.id;
  const filter = penggunaFilter[chatId] || null;

  let data = layananData;
  if (filter) {
    data = data.filter(item => item.name.toLowerCase().includes(filter.toLowerCase()));
  }

  const mulai = (halaman - 1) * layananPerHalaman;
  const akhir = mulai + layananPerHalaman;
  const totalHalaman = Math.ceil(data.length / layananPerHalaman);
  const dataHalaman = data.slice(mulai, akhir);

  if (dataHalaman.length === 0) {
    return bot.sendMessage(chatId, `⚠️ Tidak ditemukan layanan untuk filter ini.`);
  }

  const teks = `📋 *Daftar Layanan${filter ? ` (Filter: ${filter})` : ''}* - Halaman ${halaman}/${totalHalaman}:\n\n${formatLayanan(dataHalaman)}`;
  const tombol = [];

  if (halaman > 1) tombol.push({ text: '⬅️ Prev', callback_data: `layanan_prev_${halaman - 1}` });
  if (halaman < totalHalaman) tombol.push({ text: '➡️ Next', callback_data: `layanan_next_${halaman + 1}` });

  const extra = {
    parse_mode: 'Markdown',
    reply_markup: { inline_keyboard: [tombol] }
  };

  if (typeof chatInfo === 'number') {
    bot.sendMessage(chatId, teks, extra);
  } else {
    bot.editMessageText(teks, {
      ...extra,
      chat_id: chatInfo.id,
      message_id: chatInfo.message_id
    });
  }
}

// ========== COMMANDS ==========

bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;
  const teks = `👋 Selamat datang di *Kebsos Bot*!

📌 Perintah yang tersedia:
/kategori — Lihat daftar layanan
/order <layanan_id> <url> <jumlah> — Buat order baru
/cek <order_id> — Cek status order
/riwayat — Lihat riwayat order`;

  bot.sendMessage(chatId, teks, { parse_mode: 'Markdown' });
});

bot.onText(/\/help/, (msg) => {
  bot.sendMessage(msg.chat.id,
`🆘 *Panduan Penggunaan*

1. Ketik /layanan untuk melihat daftar layanan.
2. Ketik:
/order <id_layanan> <url_target> <jumlah>
Contoh:
/order 101 https://tiktok.com/abc 100

3. Bot akan memberi harga dan minta kamu *transfer via QRIS*.
4. Upload bukti transfer di chat.
5. Admin akan memproses pesananmu setelah dicek.

🧾 Untuk cek status, gunakan:
/cek <order_id>

📦 Untuk melihat riwayat:
/riwayat`, { parse_mode: 'Markdown' });
});

// ========= ORDER =========

bot.onText(/\/order (\d+) (https?:\/\/\S+) (\d+)/, async (msg, match) => {
  const chatId = msg.chat.id;
  const serviceId = parseInt(match[1]);
  const target = match[2];
  const quantity = parseInt(match[3]);

  console.log("🔍 ID dicari:", serviceId);
  console.log("📦 Total layanan:", layananData.length);
  console.log("📋 Contoh layanan:", layananData[0]);

  if (layananData.length === 0) {
    await ambilSemuaLayanan();
    if (layananData.length === 0) {
      return bot.sendMessage(chatId, "⚠️ Gagal memuat data layanan. Coba lagi nanti.");
    }
  }

  const layanan = layananData.find(l => parseInt(l.id) === serviceId);
  if (!layanan) return bot.sendMessage(chatId, "❌ Layanan tidak ditemukan.");

  const hargaPer1000 = layanan.price * 2.12;
  const hargaJual = Math.round((hargaPer1000 / 1000) * quantity);
  const orderId = 'ORD' + Date.now();

  orderData[orderId] = {
    order_id: orderId,
    user_id: chatId,
    service_id: serviceId,
    service_name: layanan.name,
    target,
    quantity,
    harga: hargaJual,
    status: 'MENUNGGU_BAYAR',
    bukti: null
  };
  simpanOrder();

  await bot.sendMessage(chatId,
`🧾 *Order Tercatat*
🆔 Order ID: *${orderId}*
📌 Layanan: ${layanan.name}
🎯 Target: ${target}
🔢 Jumlah: ${quantity}
💰 Harga: Rp *${hargaJual.toLocaleString('id-ID')}*

Silakan transfer ke QRIS dan upload bukti transfer ke bot ini.`, { parse_mode: 'Markdown' });

  // Kirim gambar QRIS setelah order tercatat
  bot.sendPhoto(chatId, './Qriss AllPay.jpg', {
    caption: '📸 Silakan scan QRIS di atas untuk melakukan pembayaran.\nSetelah itu, kirim bukti transfer ke bot ini.',
  });
});

// ========= UPLOAD BUKTI =========

bot.on('photo', (msg) => {
  const chatId = msg.chat.id;
  const fileId = msg.photo[msg.photo.length - 1].file_id;

  const lastOrder = Object.values(orderData).reverse().find(o => o.user_id === chatId && o.status === 'MENUNGGU_BAYAR');

  if (!lastOrder) {
    bot.sendMessage(chatId, "⚠️ Kamu belum punya order yang menunggu pembayaran. Silakan order dulu sebelum upload bukti transfer.");
    return; // Penting: supaya bot tidak lanjut kirim ke admin
  }

  // Simpan bukti dan update status
  lastOrder.bukti = fileId;
  lastOrder.status = 'MENUNGGU_VERIFIKASI';
  simpanOrder();

  bot.sendMessage(chatId, "📥 Bukti transfer diterima, menunggu verifikasi.");

  // Kirim ke admin
  bot.sendPhoto(ADMIN_ID, fileId, {
    caption:
`📥 *Verifikasi Pembayaran*
🆔 Order ID: ${lastOrder.order_id}
👤 User: ${chatId}
💰 Rp ${lastOrder.harga.toLocaleString('id-ID')}`,
    parse_mode: 'Markdown',
    reply_markup: {
      inline_keyboard: [
        [
          { text: "✅ Verifikasi", callback_data: `verifikasi_${lastOrder.order_id}` },
          { text: "❌ Batal", callback_data: `batal_${lastOrder.order_id}` }
        ]
      ]
    }
  });
});


// ========= VERIFIKASI ADMIN =========

bot.onText(/\/verifikasi (ORD\d+)/, async (msg, match) => {
  if (msg.chat.id !== ADMIN_ID) return;
  const orderId = match[1];
  const order = orderData[orderId];
  if (!order) return bot.sendMessage(msg.chat.id, "❌ Order tidak ditemukan.");

  try {
    const response = await axios.post('https://tryonpedia.com/api/order', qs.stringify({
      api_id: TRYONPEDIA_API_ID,
      api_key: TRYONPEDIA_API_KEY,
      service: order.service_id,
      target: order.target,
      quantity: order.quantity
    }), {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
    });

    if (response.data.status && response.data.data?.id) {
      order.status = 'DIPROSES';
      order.real_order_id = response.data.data.id;
      simpanOrder();
    
      bot.sendMessage(order.user_id,
        `✅ Pembayaran diverifikasi!\nPesanan kamu sedang diproses.\nID: *${response.data.data.id}*`,
        { parse_mode: 'Markdown' }
      );
    
      bot.sendMessage(order.user_id,
    `✅ *Pembayaran Diverifikasi!*
    Pesanan kamu sudah berhasil diproses oleh *Snackin Kebsos*. 🎉
            
    🆔 Order ID: *${order.order_id}*
    📌 Layanan: ${order.service_name}
    🎯 Target: ${order.target}
    🔢 Jumlah: ${order.quantity}
    💰 Harga: Rp *${order.harga.toLocaleString('id-ID')}*
            
    ⏳ Harap tunggu beberapa saat. Proses biasanya memakan waktu beberapa menit.`,
        { parse_mode: 'Markdown' }
      );
    
      bot.sendMessage(ADMIN_ID, "✅ Order berhasil diproses.");
    } else {
      bot.sendMessage(ADMIN_ID, "⚠️ Gagal proses order ke API.");
    }

  } catch (e) {
    bot.sendMessage(ADMIN_ID, `❌ Gagal proses order: ${e.message}`);
  }
});

bot.onText(/\/batal (ORD\d+)/, (msg, match) => {
  if (msg.chat.id !== ADMIN_ID) return;
  const orderId = match[1];
  const order = orderData[orderId];
  if (!order) return bot.sendMessage(msg.chat.id, "❌ Order tidak ditemukan.");

  order.status = 'DIBATALKAN';
  simpanOrder();

  bot.sendMessage(order.user_id, `❌ Order kamu *dibatalkan* oleh admin.`, { parse_mode: 'Markdown' });
  bot.sendMessage(ADMIN_ID, `✅ Order ${orderId} dibatalkan.`);
});

// ========= CEK STATUS / RIWAYAT =========

bot.onText(/\/cek (ORD\d+)/, async (msg, match) => {
  const chatId = msg.chat.id;
  const orderId = match[1];
  const order = orderData[orderId];
  if (!order) return bot.sendMessage(chatId, "❌ Order tidak ditemukan.");

  if (order.real_order_id) {
    try {
      const response = await axios.post('https://tryonpedia.com/api/status', qs.stringify({
        api_id: TRYONPEDIA_API_ID,
        api_key: TRYONPEDIA_API_KEY,
        id: order.real_order_id
      }), {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
      });

      const d = response.data.data;
      bot.sendMessage(chatId,
`📦 *Status Order*
🆔 ${orderId}
📌 ${order.service_name}
🎯 ${order.target}
📊 Status: ${d.status}
🚀 Start: ${d.start_count || '-'}
📉 Sisa: ${d.remains || '-'}`, { parse_mode: 'Markdown' });

    } catch (err) {
      bot.sendMessage(chatId, "⚠️ Gagal ambil status dari API.");
    }
  } else {
    bot.sendMessage(chatId, `📦 *Status Order*
🆔 ${orderId}
📌 ${order.service_name}
🎯 ${order.target}
⏳ Status: ${order.status}`, { parse_mode: 'Markdown' });
  }
});

const escapeMarkdown = (text) => {
  return text?.toString().replace(/([_*\[\]()~`>#+=|{}.!\\\-])/g, '\\$1');
};

bot.onText(/\/riwayat/, (msg) => {
  const chatId = msg.chat.id;

  console.log("👤 Cek riwayat untuk:", chatId);

  const riwayat = Object.values(orderData)
    .filter(o => o.user_id == chatId)
    .slice(-5)
    .map(o => `🆔 ${escapeMarkdown(o.order_id)} \\- ${escapeMarkdown(o.service_name)} \\- ${escapeMarkdown(o.status)}`)
    .join('\n');

  const message = `🕓 *Riwayat Order Terbaru*\n\n${riwayat || 'Belum ada order.'}`;
  
  bot.sendMessage(chatId, message, { parse_mode: 'MarkdownV2' });
});

bot.on("polling_error", (err) => {
  console.error("Polling Error:", err);
});




// ========= LAYANAN =========

// Kalau user kirim "/layanan" aja, langsung tampilkan halaman 1
bot.onText(/^\/layanan$/, (msg) => {
  const chatId = msg.chat.id;
  const page = 1;
  tampilkanLayanan(chatId, page);
});

// Kalau user kirim "/layanan 2" misalnya
bot.onText(/^\/layanan (\d+)$/, (msg, match) => {
  const chatId = msg.chat.id;
  const page = parseInt(match[1]);
  tampilkanLayanan(chatId, page);
});

bot.on('callback_query', (query) => {
  const data = query.data;
  const chatInfo = {
    id: query.message.chat.id,
    message_id: query.message.message_id
  };

  if (data.startsWith('layanan_prev_') || data.startsWith('layanan_next_')) {
    const halamanBaru = parseInt(data.split('_')[2]);
    tampilkanLayanan(chatInfo, halamanBaru); // chatInfo sekarang objek
    bot.answerCallbackQuery(query.id);
  }
  if (data.startsWith('filter_')) {
    const chatId = query.message.chat.id;
    const messageId = query.message.message_id;
    const kategori = data.replace('filter_', '');
  
    if (kategori === 'reset') {
      delete penggunaFilter[chatId];
    } else {
      penggunaFilter[chatId] = kategori;
    }
  
    tampilkanLayanan({ id: chatId, message_id: messageId }, 1);
    bot.answerCallbackQuery(query.id);
  }
  
});

bot.onText(/^\/kategori$/, (msg) => {
  const chatId = msg.chat.id;

  const kategori = [
    [{ text: '🎵 TikTok', callback_data: 'filter_TikTok' }],
    [{ text: '📸 Instagram', callback_data: 'filter_Instagram' }],
    [{ text: '▶️ YouTube', callback_data: 'filter_YouTube' }],
    [{ text: '🧹 Hapus Filter', callback_data: 'filter_reset' }]
  ];

  bot.sendMessage(chatId, '📂 Pilih kategori layanan:', {
    reply_markup: { inline_keyboard: kategori }
  });
});
let penggunaFilter = {}; // untuk simpan filter berdasarkan chatId

bot.onText(/\/cek_harga (\d+)\s+(\d+)/, async (msg, match) => {
  const chatId = msg.chat.id;
  const serviceId = parseInt(match[1]);
  const quantity = parseInt(match[2]);

  if (layananData.length === 0) {
    await ambilSemuaLayanan();
  }

  const layanan = layananData.find(item => parseInt(item.id) === serviceId);
  if (!layanan) return bot.sendMessage(chatId, '❌ ID layanan tidak ditemukan.');

  const hargaPer1000 = Math.round(layanan.price * 2.12);
  const harga = Math.round((hargaPer1000 / 1000) * quantity);

bot.sendMessage(chatId,
    `💰 Harga untuk layanan *${layanan.name}* (ID: ${serviceId}) sebanyak ${quantity}:\n\n➡️ *Rp ${harga.toLocaleString('id-ID')}*`, {
    parse_mode: 'Markdown'
  });
});

bot.on('callback_query', async (query) => {
  const chatId = query.message.chat.id;
  const messageId = query.message.message_id;
  const data = query.data;

  if (data.startsWith('verifikasi_')) {
    const orderId = data.split('_')[1];
    const order = orderData[orderId];
    if (!order) return bot.answerCallbackQuery(query.id, { text: 'Order tidak ditemukan!' });

    order.status = 'LUNAS';
    simpanOrder();

    await bot.editMessageCaption(
      `✅ *Pembayaran Diverifikasi*\n🆔 Order ID: ${order.order_id}\n👤 User: ${order.user_id}\n💰 Rp ${order.harga.toLocaleString('id-ID')}`,
      {
        chat_id: chatId,
        message_id: messageId,
        parse_mode: 'Markdown'
      }
    );

    bot.sendMessage(chatId, '⏳ Sedang memproses order ke server...');

    try {
      const response = await axios.post('https://tryonpedia.com/api/order', qs.stringify({
        api_id: TRYONPEDIA_API_ID,
        api_key: TRYONPEDIA_API_KEY,
        service: order.service_id,
        target: order.target,
        quantity: order.quantity
      }), {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
      });

      if (response.data.status && response.data.data?.id) {
        order.status = 'DIPROSES';
        order.real_order_id = response.data.data.id;
        simpanOrder();

        bot.sendMessage(order.user_id,
`✅ *Pembayaran Diverifikasi!*
Pesanan kamu sudah berhasil diproses oleh *Snackin Kebsos*. 🎉

🆔 Order ID: *${order.order_id}*
📌 Layanan: ${order.service_name}
🎯 Target: ${order.target}
🔢 Jumlah: ${order.quantity}
💰 Harga: Rp *${order.harga.toLocaleString('id-ID')}*

⏳ Harap tunggu beberapa saat. Proses biasanya memakan waktu beberapa menit.`, { parse_mode: 'Markdown' });

        bot.sendMessage(chatId, '✅ Order berhasil diproses ke API.');
      } else {
        bot.sendMessage(chatId, '⚠️ Gagal proses order ke API.');
      }
    } catch (error) {
      bot.sendMessage(chatId, `❌ Error saat menghubungi API: ${error.message}`);
    }

    bot.answerCallbackQuery(query.id);
  }

  // Tambahkan aksi batal jika belum ditangani
  else if (data.startsWith('batal_')) {
    const orderId = data.split('_')[1];
    const order = orderData[orderId];
    if (!order) return bot.answerCallbackQuery(query.id, { text: 'Order tidak ditemukan!' });

    order.status = 'DIBATALKAN';
    simpanOrder();

    await bot.editMessageCaption(`❌ *Order Dibatalkan*\n🆔 Order ID: ${order.order_id}`, {
      chat_id: chatId,
      message_id: messageId,
      parse_mode: 'Markdown'
    });

    bot.sendMessage(order.user_id, `❌ Order kamu *dibatalkan* oleh admin.`, { parse_mode: 'Markdown' });
    bot.answerCallbackQuery(query.id, { text: 'Order dibatalkan.' });
  }
});

