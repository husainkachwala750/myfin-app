// MyFin WhatsApp Cash Transaction Logger - Cloudflare Worker
// Receives Twilio WhatsApp webhooks, parses transactions, stores in Supabase

const SUPABASE_URL = 'https://lnivxetuqhyrgefkzmau.supabase.co';

// ── Keyword → Category mapping ──────────────────────────────────────────────
const CATEGORY_MAP = {
  // Food & Dining
  'lunch': 'Food & Dining', 'dinner': 'Food & Dining', 'breakfast': 'Food & Dining',
  'food': 'Food & Dining', 'restaurant': 'Food & Dining', 'hotel': 'Food & Dining',
  'chai': 'Food & Dining', 'tea': 'Food & Dining', 'coffee': 'Food & Dining',
  'snack': 'Food & Dining', 'snacks': 'Food & Dining', 'biryani': 'Food & Dining',
  'pizza': 'Food & Dining', 'burger': 'Food & Dining', 'thali': 'Food & Dining',
  'nashta': 'Food & Dining', 'khana': 'Food & Dining', 'nasta': 'Food & Dining',
  'juice': 'Food & Dining', 'lassi': 'Food & Dining', 'pani': 'Food & Dining',
  'swiggy': 'Food & Dining', 'zomato': 'Food & Dining',

  // Transport
  'petrol': 'Transport', 'diesel': 'Transport', 'fuel': 'Transport',
  'auto': 'Transport', 'rickshaw': 'Transport', 'uber': 'Transport',
  'ola': 'Transport', 'cab': 'Transport', 'taxi': 'Transport',
  'bus': 'Transport', 'train': 'Transport', 'metro': 'Transport',
  'parking': 'Transport', 'toll': 'Transport', 'flight': 'Transport',

  // Groceries
  'grocery': 'Groceries', 'groceries': 'Groceries', 'sabzi': 'Groceries',
  'vegetables': 'Groceries', 'fruits': 'Groceries', 'doodh': 'Groceries',
  'milk': 'Groceries', 'atta': 'Groceries', 'rice': 'Groceries',
  'dal': 'Groceries', 'oil': 'Groceries', 'sugar': 'Groceries',
  'bread': 'Groceries', 'eggs': 'Groceries', 'anda': 'Groceries',
  'kirana': 'Groceries', 'supermarket': 'Groceries', 'bigbasket': 'Groceries',
  'blinkit': 'Groceries', 'zepto': 'Groceries',

  // Rent & Housing
  'rent': 'Rent', 'house': 'Rent', 'flat': 'Rent',
  'maintenance': 'Rent', 'society': 'Rent',

  // Utilities
  'electricity': 'Utilities', 'bijli': 'Utilities', 'light': 'Utilities',
  'water': 'Utilities', 'gas': 'Utilities', 'wifi': 'Utilities',
  'internet': 'Utilities', 'mobile': 'Utilities', 'recharge': 'Utilities',
  'phone': 'Utilities', 'bill': 'Utilities', 'dth': 'Utilities',

  // Shopping
  'shopping': 'Shopping', 'clothes': 'Shopping', 'kapde': 'Shopping',
  'shoes': 'Shopping', 'amazon': 'Shopping', 'flipkart': 'Shopping',
  'myntra': 'Shopping', 'online': 'Shopping',

  // Health
  'medicine': 'Health', 'doctor': 'Health', 'hospital': 'Health',
  'medical': 'Health', 'pharmacy': 'Health', 'dawai': 'Health',
  'gym': 'Health', 'health': 'Health',

  // Education
  'school': 'Education', 'fees': 'Education', 'tuition': 'Education',
  'books': 'Education', 'course': 'Education', 'class': 'Education',
  'coaching': 'Education',

  // Entertainment
  'movie': 'Entertainment', 'cinema': 'Entertainment', 'netflix': 'Entertainment',
  'subscription': 'Entertainment', 'game': 'Entertainment', 'outing': 'Entertainment',
  'trip': 'Entertainment', 'travel': 'Entertainment', 'picnic': 'Entertainment',

  // Income keywords (category)
  'salary': 'Salary', 'freelance': 'Freelance', 'bonus': 'Bonus',
  'interest': 'Interest', 'dividend': 'Dividend', 'cashback': 'Cashback',
  'refund': 'Refund',
};

// Keywords that mark a message as income
const INCOME_KEYWORDS = ['received', 'salary', 'income', 'refund', 'credited', 'earned', 'freelance', 'bonus', 'interest', 'dividend', 'cashback'];

// ── Message Parser ──────────────────────────────────────────────────────────
function parseTransaction(message) {
  const text = message.trim().toLowerCase();

  // Extract amount - find any number in the message
  const amountMatch = text.match(/[\d,]+\.?\d*/);
  if (!amountMatch) {
    return { parsed: false, description: message };
  }
  const amount = parseFloat(amountMatch[0].replace(/,/g, ''));
  if (isNaN(amount) || amount <= 0) {
    return { parsed: false, description: message };
  }

  // Detect income vs expense
  const isIncome = INCOME_KEYWORDS.some(kw => text.includes(kw));
  const type = isIncome ? 'credit' : 'debit';

  // Auto-categorize based on keywords
  let category = isIncome ? 'Income' : 'General';
  const words = text.replace(/[^a-z0-9\s]/g, '').split(/\s+/);

  for (const word of words) {
    if (CATEGORY_MAP[word]) {
      category = CATEGORY_MAP[word];
      break;
    }
  }

  // Build description from the original text, excluding just the number
  const description = message.trim();

  return {
    parsed: true,
    amount,
    type,
    category,
    description,
  };
}

// ── TwiML Response Helper ───────────────────────────────────────────────────
function twimlResponse(text) {
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Message>${escapeXml(text)}</Message>
</Response>`;
  return new Response(xml, {
    status: 200,
    headers: { 'Content-Type': 'text/xml' },
  });
}

function escapeXml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

// ── CORS Headers ────────────────────────────────────────────────────────────
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': 'https://husainkachwala750.github.io',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

// ── Supabase Insert ─────────────────────────────────────────────────────────
async function insertTransaction(env, record) {
  const url = `${env.SUPABASE_URL || SUPABASE_URL}/rest/v1/whatsapp_transactions`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': env.SUPABASE_KEY,
      'Authorization': `Bearer ${env.SUPABASE_KEY}`,
      'Prefer': 'return=representation',
    },
    body: JSON.stringify(record),
  });
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Supabase insert failed (${res.status}): ${errText}`);
  }
  return res.json();
}

// ── Main Worker ─────────────────────────────────────────────────────────────
export default {
  async fetch(request, env, ctx) {
    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }

    // Only accept POST for the webhook
    if (request.method !== 'POST') {
      return new Response('Method not allowed', { status: 405, headers: CORS_HEADERS });
    }

    try {
      // Parse Twilio form-urlencoded body
      const formData = await request.formData();
      const body = formData.get('Body') || '';
      const from = formData.get('From') || '';
      const to = formData.get('To') || '';

      // Clean phone number (Twilio sends "whatsapp:+91XXXXXXXXXX")
      const phone = from.replace('whatsapp:', '').trim();
      const messageText = body.trim();
      const messageLower = messageText.toLowerCase();

      // ── Handle special commands ─────────────────────────────────────
      if (messageLower === 'help') {
        return twimlResponse(
          `MyFin WhatsApp Logger\n\n` +
          `Send messages like:\n` +
          `- "lunch 500"\n` +
          `- "petrol 2000"\n` +
          `- "grocery 1500 cash"\n` +
          `- "received 5000 from amit"\n` +
          `- "salary 150000"\n` +
          `- "chai 20"\n` +
          `- "auto 150"\n\n` +
          `I'll log your expense/income automatically!\n\n` +
          `Commands:\n` +
          `- "help" - Show this message\n` +
          `- "balance" - Check balance in MyFin app`
        );
      }

      if (messageLower === 'balance') {
        return twimlResponse('Open MyFin app to check balance\nhttps://husainkachwala750.github.io/myfin-app/');
      }

      // ── Parse the transaction ───────────────────────────────────────
      const parsed = parseTransaction(messageText);

      const record = {
        phone,
        message: messageText,
        amount: parsed.amount || 0,
        type: parsed.type || 'debit',
        category: parsed.category || '',
        description: parsed.description || messageText,
        parsed: parsed.parsed,
        status: 'pending',
      };

      // Insert into Supabase
      await insertTransaction(env, record);

      // ── Build reply ─────────────────────────────────────────────────
      if (parsed.parsed) {
        const typeLabel = parsed.type === 'credit' ? 'income' : 'expense';
        return twimlResponse(
          `\u2705 \u20B9${parsed.amount} ${typeLabel} logged!\n` +
          `\uD83D\uDCC1 ${parsed.category}\n` +
          `\uD83D\uDCDD ${parsed.description}\n\n` +
          `Open MyFin to review.`
        );
      } else {
        return twimlResponse('Could not parse. Saved for review in MyFin.');
      }

    } catch (err) {
      console.error('Worker error:', err);
      return twimlResponse('Something went wrong. Please try again.');
    }
  },
};
