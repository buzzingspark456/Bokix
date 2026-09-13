import { applySecurityHeaders } from '../_security.js';
import { requireAuthedUser } from '../_auth.js';
import { checkRateLimit } from '../_rateLimit.js';
import { parseJsonBody } from '../stripe/_parseBody.js';
import { createClient } from '@supabase/supabase-js';

// ── Internt admin-API (/internal på klienten) ───────────────────────────
// EN enda fil för HELA admin-panelen, inte en fil per delsystem —
// samma medvetna konsolidering som company-access.js redan förklarar
// (dess egen kommentar: "Vercels 12-funktionsgräns"). Den här filen
// lägger till den TOLFTE och sista funktionen inom Hobby-taket; nästa
// admin-delsystem (betalningsöversikt, säkerhetslogg, användarlista)
// MÅSTE läggas till som en ny `resource`-gren HÄR, aldrig som en egen
// fil, annars går deployen sönder.
//
// SÄKERHET — detta är den enda riktiga behörighetsgränsen, allt i
// klienten (InternalAuth.jsx, den dolda /internal-routen) är bara UI:
// varje anrop hit verifierar för det första att Authorization-headern
// hör till en INLOGGAD Supabase-användare (requireAuthedUser, samma
// hjälpfunktion som alla andra känsliga endpoints redan använder), och
// för det andra att den inloggade personens e-post finns i ADMIN_EMAILS
// nedan. Ingen rad i user_data eller en separat "roller"-tabell — en kort
// hårdkodad lista, samma avvägning som FREE_ACCOUNT_EMAILS i App.jsx
// redan gör för en handfull kända e-postadresser. Lägg till fler admins
// genom att lägga till fler adresser i BÅDA den här listan OCH
// supabase-setup.sql:s blogimages-policyer (de kan inte läsa en delad
// konstant, olika körtider).
//
// Kundönskemål ("riktigt admin, inte softwaren själva"): en EGEN,
// dedikerad Supabase-användare (abbealwaki08@gmail.com) med admin-
// åtkomst, UTÖVER (inte i stället för) kontot som faktiskt bokför i
// Bokix (alwakiabdullah1@gmail.com, samma e-postadress som
// FREE_ACCOUNT_EMAILS i App.jsx) — kunden vill kunna logga in på
// /internal med endera. Samma Supabase-projekt/auth-system för båda
// (ingen anledning att bygga ett andra), bara två separata identiteter
// tillåtna, ingen av dem beroende av den andra.
const ADMIN_EMAILS = ['alwakiabdullah1@gmail.com', 'abbealwaki08@gmail.com'];

function isAdminEmail(email) {
  return ADMIN_EMAILS.includes(String(email || '').trim().toLowerCase());
}

function getAdminClient() {
  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) return null;
  return createClient(supabaseUrl, serviceRoleKey);
}

// Samma slugifiering oavsett om admin skrivit in en egen slug eller lämnat
// fältet tomt (då genereras den ur titeln) — aldrig mellanslag/versaler/
// åäö rakt in i en URL.
function slugify(text) {
  return String(text || '')
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '') // é → e, ö → o osv.
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'inlagg';
}

async function handleListPosts(admin, res) {
  const { data, error } = await admin
    .from('blog_posts')
    .select('id, slug, title, excerpt, cover_image_url, status, published_at, updated_at, created_at, tags')
    .order('updated_at', { ascending: false });
  if (error) { res.status(500).json({ error: error.message }); return; }
  res.status(200).json({ posts: data || [] });
}

async function handleGetPost(admin, res, id) {
  const { data, error } = await admin.from('blog_posts').select('*').eq('id', id).maybeSingle();
  if (error) { res.status(500).json({ error: error.message }); return; }
  if (!data) { res.status(404).json({ error: 'Inlägget hittades inte.' }); return; }
  res.status(200).json({ post: data });
}

async function handleCreatePost(admin, res, body, adminEmail) {
  const title = String(body.title || '').trim();
  if (!title) { res.status(400).json({ error: 'Titel krävs.' }); return; }
  const requestedSlug = slugify(body.slug || title);

  // En slug som redan finns får ett numeriskt suffix i stället för att
  // krascha på ett unikt-index-fel — samma "gissa inte, kontrollera"-
  // princip som resten av kodbasen, fast här handlar det bara om att hitta
  // en ledig URL, inte om pengar/juridik.
  let slug = requestedSlug;
  for (let i = 2; i < 50; i++) {
    const { data: existing } = await admin.from('blog_posts').select('id').eq('slug', slug).maybeSingle();
    if (!existing) break;
    slug = `${requestedSlug}-${i}`;
  }

  const { data, error } = await admin.from('blog_posts').insert({
    slug,
    title,
    excerpt: body.excerpt || null,
    content: body.content || '',
    cover_image_url: body.coverImageUrl || null,
    author_name: body.authorName || null,
    seo_description: body.seoDescription || null,
    tags: Array.isArray(body.tags) ? body.tags : [],
    status: 'draft',
  }).select('*').single();
  if (error) { res.status(500).json({ error: error.message }); return; }
  console.log(`[admin/blog] ${adminEmail} skapade inlägg "${title}" (${data.id})`);
  res.status(200).json({ post: data });
}

async function handleUpdatePost(admin, res, body, adminEmail) {
  const { id } = body;
  if (!id) { res.status(400).json({ error: 'id krävs.' }); return; }

  const patch = {};
  if (body.title != null) patch.title = String(body.title).trim();
  if (body.slug != null) patch.slug = slugify(body.slug);
  if (body.excerpt !== undefined) patch.excerpt = body.excerpt || null;
  if (body.content !== undefined) patch.content = body.content || '';
  if (body.coverImageUrl !== undefined) patch.cover_image_url = body.coverImageUrl || null;
  if (body.authorName !== undefined) patch.author_name = body.authorName || null;
  if (body.seoDescription !== undefined) patch.seo_description = body.seoDescription || null;
  if (body.tags !== undefined) patch.tags = Array.isArray(body.tags) ? body.tags : [];
  patch.updated_at = new Date().toISOString();

  const { data, error } = await admin.from('blog_posts').update(patch).eq('id', id).select('*').single();
  if (error) { res.status(500).json({ error: error.message }); return; }
  console.log(`[admin/blog] ${adminEmail} uppdaterade inlägg "${data.title}" (${id})`);
  res.status(200).json({ post: data });
}

async function handleSetStatus(admin, res, body, adminEmail, publish) {
  const { id } = body;
  if (!id) { res.status(400).json({ error: 'id krävs.' }); return; }
  const patch = publish
    ? { status: 'published', published_at: new Date().toISOString() }
    : { status: 'draft' };
  patch.updated_at = new Date().toISOString();
  const { data, error } = await admin.from('blog_posts').update(patch).eq('id', id).select('*').single();
  if (error) { res.status(500).json({ error: error.message }); return; }
  console.log(`[admin/blog] ${adminEmail} ${publish ? 'publicerade' : 'avpublicerade'} "${data.title}" (${id})`);
  res.status(200).json({ post: data });
}

async function handleDeletePost(admin, res, body, adminEmail) {
  const { id } = body;
  if (!id) { res.status(400).json({ error: 'id krävs.' }); return; }
  const { error } = await admin.from('blog_posts').delete().eq('id', id);
  if (error) { res.status(500).json({ error: error.message }); return; }
  console.log(`[admin/blog] ${adminEmail} tog bort inlägg ${id}`);
  res.status(200).json({ ok: true });
}

// ── Analys (resource: 'analytics') ──────────────────────────────────────
// HONEST scope: det här är kontostatistik Bokix redan äger (Supabase
// auth.users + public.subscriptions) — VEM registrerar sig, UF eller inte,
// vem betalar. Det är INTE besökarstatistik (sidvisningar, varifrån
// trafiken kommer) — det kräver Google Analytics Data API, en egen
// service-account-nyckel i Google Cloud och en explicit "ge den här
// tjänsten Viewer-åtkomst till din GA4-egendom"-koppling, inget av det är
// på plats än (se minnesfilen om Google Cloud-projektet: kunden äger inte
// själva Cloud-projektet fullt ut). Byggs som ett eget, senare steg den
// dagen den kopplingen faktiskt finns — den här funktionen låtsas inte
// ha data den inte har.
//
// auth.admin.listUsers() sidindelas (Supabase-gräns, inte en egen
// optimering) — går igenom alla sidor så totalen/dagsfördelningen är
// exakt, inte bara första sidan. Ofarligt idag (litet konto-antal); om
// kontobasen växer mycket är nästa steg att cacha resultatet i stället
// för att räkna om från scratch varje sidladdning.
async function handleAnalytics(admin, res) {
  let allUsers = [];
  let page = 1;
  for (;;) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) { res.status(500).json({ error: error.message }); return; }
    allUsers = allUsers.concat(data.users);
    if (data.users.length < 1000) break;
    page++;
  }

  const ufUsers = allUsers.filter(u => u.user_metadata?.uf).length;

  // 30 dagar bakåt, en post per dag (även dagar med 0 signups) — så
  // grafen aldrig hoppar över tomma dagar och feltolkar avståndet mellan
  // två punkter.
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const days = Array.from({ length: 30 }, (_, i) => {
    const d = new Date(today); d.setDate(d.getDate() - (29 - i));
    return d.toISOString().slice(0, 10);
  });
  const countsByDay = Object.fromEntries(days.map(d => [d, 0]));
  allUsers.forEach(u => {
    const day = u.created_at?.slice(0, 10);
    if (day in countsByDay) countsByDay[day] += 1;
  });

  const { data: subs, error: subsError } = await admin.from('subscriptions').select('status, plan');
  if (subsError) { res.status(500).json({ error: subsError.message }); return; }
  const statusCounts = {};
  (subs || []).forEach(s => { statusCounts[s.status] = (statusCounts[s.status] || 0) + 1; });

  res.status(200).json({
    totalUsers: allUsers.length,
    ufUsers,
    regularUsers: allUsers.length - ufUsers,
    signupsLast30Days: allUsers.filter(u => u.created_at >= days[0]).length,
    signupsByDay: days.map(d => ({ date: d, count: countsByDay[d] })),
    subscriptions: { total: (subs || []).length, byStatus: statusCounts },
  });
}

export default async function handler(req, res) {
  applySecurityHeaders(res);
  if (!checkRateLimit(req, res, { key: 'admin', max: 120 })) return;

  const user = await requireAuthedUser(req, res);
  if (!user) return;
  if (!isAdminEmail(user.email)) {
    // Samma svar oavsett ANLEDNING (fel e-post vs. inget konto alls) —
    // "403 saknar behörighet" avslöjar inte att just den här e-posten är
    // inloggad men inte admin, ingen anledning att vara mer specifik mot
    // en icke-admin än nödvändigt.
    res.status(403).json({ error: 'Du har inte behörighet till admin-panelen.' });
    return;
  }

  const admin = getAdminClient();
  if (!admin) {
    res.status(503).json({ error: 'SUPABASE_SERVICE_ROLE_KEY saknas.' });
    return;
  }

  try {
    if (req.method === 'GET') {
      const resource = req.query?.resource;
      if (resource === 'analytics') { await handleAnalytics(admin, res); return; }
      if (resource !== 'blog') { res.status(400).json({ error: 'Okänd resurs.' }); return; }
      if (req.query?.id) await handleGetPost(admin, res, req.query.id);
      else await handleListPosts(admin, res);
      return;
    }

    if (req.method === 'POST') {
      const body = await parseJsonBody(req);
      if (body.resource !== 'blog') { res.status(400).json({ error: 'Okänd resurs.' }); return; }
      switch (body.action) {
        case 'create': await handleCreatePost(admin, res, body, user.email); return;
        case 'update': await handleUpdatePost(admin, res, body, user.email); return;
        case 'publish': await handleSetStatus(admin, res, body, user.email, true); return;
        case 'unpublish': await handleSetStatus(admin, res, body, user.email, false); return;
        case 'delete': await handleDeletePost(admin, res, body, user.email); return;
        default: res.status(400).json({ error: 'Okänd action.' }); return;
      }
    }

    res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error('admin/index error:', err);
    if (!res.headersSent) res.status(500).json({ error: err.message || 'Något gick fel.' });
  }
}
