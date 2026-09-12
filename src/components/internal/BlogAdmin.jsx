import React, { useEffect, useRef, useState } from 'react';
import { Plus, Pencil, Trash2, Eye, ExternalLink, Upload, ArrowLeft, Save, Globe2 } from 'lucide-react';
import { supabase } from '../../supabaseClient';
import { adminGet, adminPost } from './adminApi';
import { markdownToHtml, estimateReadingMinutes } from '../../utils/markdown';

const inputStyle = {
  width: '100%', padding: '10px 12px', fontSize: '14px', color: '#e8ece9',
  background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)',
  borderRadius: '9px', fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box',
};
const labelStyle = { display: 'block', fontSize: '12px', fontWeight: 600, color: 'rgba(232,236,233,0.6)', marginBottom: '6px' };
const cardStyle = { background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '14px', padding: '20px' };

function formatDateSv(iso) {
  if (!iso) return '—';
  return new Intl.DateTimeFormat('sv-SE', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(iso));
}

// Omslagsbildens uppladdning — samma bucket/mönster som Settings.jsx:s
// ImageUploadField (profile/companylogo), fast mot "blogimages" och en
// egen, liten kopia i stället för att importera från Settings.jsx (den
// filen exporterar inte komponenten, och att göra det bara för det här
// hade dragit in en stor, orelaterad fil i admin-bunten).
function CoverImageField({ value, onChange, postId }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const inputRef = useRef(null);

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) { setError('Filen måste vara JPG, PNG eller WEBP.'); return; }
    if (file.size > 5 * 1024 * 1024) { setError('Bilden får vara max 5 MB.'); return; }
    setBusy(true); setError('');
    try {
      const ext = (file.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg';
      const path = `${postId || 'ny'}-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from('blogimages').upload(path, file, { upsert: true, cacheControl: '3600' });
      if (upErr) throw upErr;
      const { data } = supabase.storage.from('blogimages').getPublicUrl(path);
      onChange(`${data.publicUrl}?v=${Date.now()}`);
    } catch (err) {
      const msg = err.message || '';
      setError(/bucket not found/i.test(msg) ? 'Bildlagring är inte konfigurerad (kör blogimages-delen av supabase-setup.sql).' : (msg || 'Uppladdningen misslyckades.'));
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  return (
    <div>
      <label style={labelStyle}>Omslagsbild</label>
      {value && <img src={value} alt="" style={{ width: '100%', maxHeight: 180, objectFit: 'cover', borderRadius: '10px', marginBottom: '10px', display: 'block' }} />}
      <div style={{ display: 'flex', gap: '8px' }}>
        <label style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '9px 14px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '9px', fontSize: '12.5px', fontWeight: 600, color: '#e8ece9', cursor: busy ? 'not-allowed' : 'pointer' }}>
          <Upload size={13} /> {busy ? 'Laddar upp...' : value ? 'Byt bild' : 'Ladda upp'}
          <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp" onChange={handleFile} disabled={busy} style={{ display: 'none' }} />
        </label>
        {value && <button type="button" onClick={() => onChange('')} style={{ background: 'none', border: '1px solid rgba(255,255,255,0.12)', color: 'rgba(232,236,233,0.6)', borderRadius: '9px', padding: '9px 14px', fontSize: '12.5px', cursor: 'pointer', fontFamily: 'inherit' }}>Ta bort</button>}
      </div>
      {error && <div style={{ fontSize: '12px', color: '#f87171', marginTop: '8px' }}>{error}</div>}
    </div>
  );
}

const emptyDraft = { id: null, title: '', slug: '', excerpt: '', content: '', coverImageUrl: '', authorName: '', seoDescription: '', tags: [], status: 'draft' };

function Editor({ post, onBack, onSaved }) {
  const [draft, setDraft] = useState(() => post ? {
    id: post.id, title: post.title, slug: post.slug, excerpt: post.excerpt || '',
    content: post.content || '', coverImageUrl: post.cover_image_url || '',
    authorName: post.author_name || '', seoDescription: post.seo_description || '',
    tags: post.tags || [], status: post.status,
  } : emptyDraft);
  const [tagsInput, setTagsInput] = useState((post?.tags || []).join(', '));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [savedAt, setSavedAt] = useState(null);
  const [preview, setPreview] = useState(false);

  const set = (patch) => setDraft(d => ({ ...d, ...patch }));

  const save = async () => {
    if (!draft.title.trim()) { setError('Titel krävs.'); return; }
    setSaving(true); setError('');
    const tags = tagsInput.split(',').map(t => t.trim()).filter(Boolean);
    try {
      const payload = { resource: 'blog', ...draft, tags };
      const result = draft.id
        ? await adminPost({ ...payload, action: 'update' })
        : await adminPost({ ...payload, action: 'create' });
      setDraft(d => ({ ...d, id: result.post.id, slug: result.post.slug }));
      setSavedAt(new Date());
      onSaved?.();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const togglePublish = async () => {
    if (!draft.id) { setError('Spara inlägget innan du publicerar det.'); return; }
    setSaving(true); setError('');
    try {
      const result = await adminPost({ resource: 'blog', id: draft.id, action: draft.status === 'published' ? 'unpublish' : 'publish' });
      set({ status: result.post.status });
      onSaved?.();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ padding: '28px 32px', maxWidth: '920px' }}>
      <button onClick={onBack} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: 'none', border: 'none', color: 'rgba(232,236,233,0.6)', fontSize: '13px', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', marginBottom: '20px', padding: 0 }}>
        <ArrowLeft size={14} /> Alla inlägg
      </button>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', marginBottom: '24px', flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontSize: '20px', fontWeight: 700 }}>{draft.id ? 'Redigera inlägg' : 'Nytt inlägg'}</div>
          <div style={{ fontSize: '12px', color: 'rgba(232,236,233,0.45)', marginTop: '4px' }}>
            {draft.status === 'published' ? <span style={{ color: '#84cc16' }}>● Publicerad</span> : <span>○ Utkast</span>}
            {savedAt && ` · Sparat ${formatDateSv(savedAt.toISOString())}`}
          </div>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          {draft.id && draft.status === 'published' && (
            <a href={`/blogg/${draft.slug}`} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '9px 14px', background: 'none', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '9px', color: 'rgba(232,236,233,0.8)', fontSize: '13px', fontWeight: 600, textDecoration: 'none' }}>
              <ExternalLink size={13} /> Visa live
            </a>
          )}
          {draft.id && (
            <button onClick={togglePublish} disabled={saving} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '9px 14px', background: draft.status === 'published' ? 'rgba(248,113,113,0.12)' : 'rgba(132,204,22,0.15)', border: `1px solid ${draft.status === 'published' ? 'rgba(248,113,113,0.3)' : 'rgba(132,204,22,0.3)'}`, borderRadius: '9px', color: draft.status === 'published' ? '#f87171' : '#84cc16', fontSize: '13px', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
              <Globe2 size={13} /> {draft.status === 'published' ? 'Avpublicera' : 'Publicera'}
            </button>
          )}
          <button onClick={save} disabled={saving} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '9px 16px', background: '#0b6329', border: 'none', borderRadius: '9px', color: 'white', fontSize: '13px', fontWeight: 700, cursor: saving ? 'wait' : 'pointer', fontFamily: 'inherit', opacity: saving ? 0.7 : 1 }}>
            <Save size={13} /> {saving ? 'Sparar...' : 'Spara'}
          </button>
        </div>
      </div>

      {error && <div style={{ fontSize: '13px', color: '#f87171', marginBottom: '18px', padding: '10px 14px', background: 'rgba(248,113,113,0.1)', borderRadius: '9px' }}>{error}</div>}

      <div style={{ display: 'grid', gap: '16px' }}>
        <div style={{ ...cardStyle, display: 'grid', gap: '14px' }}>
          <div>
            <label style={labelStyle}>Titel</label>
            <input style={inputStyle} value={draft.title} onChange={e => set({ title: e.target.value })} placeholder="Ex. 5 saker att tänka på inför bokslutet" />
          </div>
          <div>
            <label style={labelStyle}>URL-slug <span style={{ fontWeight: 400 }}>(lämna tomt = genereras från titeln)</span></label>
            <input style={inputStyle} value={draft.slug} onChange={e => set({ slug: e.target.value })} placeholder="5-saker-infor-bokslutet" />
          </div>
          <div>
            <label style={labelStyle}>Ingress</label>
            <textarea style={{ ...inputStyle, minHeight: 60, resize: 'vertical' }} value={draft.excerpt} onChange={e => set({ excerpt: e.target.value })} placeholder="En eller två meningar som visas i bloggkortet och i sökresultat." />
          </div>
          <CoverImageField value={draft.coverImageUrl} onChange={v => set({ coverImageUrl: v })} postId={draft.id} />
          <div className="form-row-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
            <div>
              <label style={labelStyle}>Författare</label>
              <input style={inputStyle} value={draft.authorName} onChange={e => set({ authorName: e.target.value })} placeholder="Bokix-teamet" />
            </div>
            <div>
              <label style={labelStyle}>Taggar <span style={{ fontWeight: 400 }}>(kommaseparerade)</span></label>
              <input style={inputStyle} value={tagsInput} onChange={e => setTagsInput(e.target.value)} placeholder="bokslut, moms" />
            </div>
          </div>
          <div>
            <label style={labelStyle}>SEO-beskrivning <span style={{ fontWeight: 400 }}>(valfritt, annars används ingressen)</span></label>
            <input style={inputStyle} value={draft.seoDescription} onChange={e => set({ seoDescription: e.target.value })} />
          </div>
        </div>

        <div style={cardStyle}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
            <label style={{ ...labelStyle, marginBottom: 0 }}>Innehåll (Markdown)</label>
            <button type="button" onClick={() => setPreview(p => !p)} style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', background: 'none', border: '1px solid rgba(255,255,255,0.12)', color: 'rgba(232,236,233,0.7)', borderRadius: '7px', padding: '5px 10px', fontSize: '11.5px', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
              {preview ? <><Pencil size={11} /> Redigera</> : <><Eye size={11} /> Förhandsgranska</>}
            </button>
          </div>
          {preview ? (
            <div style={{ minHeight: 320, fontSize: '14px', color: '#c9d0cb', lineHeight: 1.7 }} dangerouslySetInnerHTML={{ __html: markdownToHtml(draft.content) }} />
          ) : (
            <textarea
              style={{ ...inputStyle, minHeight: 320, resize: 'vertical', fontFamily: 'ui-monospace, Menlo, monospace', fontSize: '13px', lineHeight: 1.6 }}
              value={draft.content}
              onChange={e => set({ content: e.target.value })}
              placeholder={'# Rubrik\n\nSkriv ditt inlägg här. **Fet text**, *kursiv*, [länkar](https://bokix.se), listor och bilder stöds.'}
            />
          )}
          <div style={{ fontSize: '11.5px', color: 'rgba(232,236,233,0.4)', marginTop: '10px' }}>
            ~{estimateReadingMinutes(draft.content)} min läsning
          </div>
        </div>
      </div>
    </div>
  );
}

export default function BlogAdmin() {
  const [posts, setPosts] = useState(null);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState(undefined); // undefined = list, null = new, {..} = existing

  const load = async () => {
    try {
      const { posts: list } = await adminGet({ resource: 'blog' });
      setPosts(list);
    } catch (err) {
      setError(err.message);
    }
  };

  useEffect(() => { load(); }, []);

  const handleDelete = async (post) => {
    if (!window.confirm(`Ta bort "${post.title}" permanent? Går inte att ångra.`)) return;
    try {
      await adminPost({ resource: 'blog', action: 'delete', id: post.id });
      load();
    } catch (err) {
      setError(err.message);
    }
  };

  const openEditor = async (post) => {
    if (!post) { setEditing(null); return; }
    try {
      const { post: full } = await adminGet({ resource: 'blog', id: post.id });
      setEditing(full);
    } catch (err) {
      setError(err.message);
    }
  };

  if (editing !== undefined) {
    return <Editor post={editing} onBack={() => { setEditing(undefined); load(); }} onSaved={load} />;
  }

  return (
    <div style={{ padding: '28px 32px', maxWidth: '1000px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
        <div>
          <div style={{ fontSize: '20px', fontWeight: 700 }}>Blogg</div>
          <div style={{ fontSize: '12.5px', color: 'rgba(232,236,233,0.45)', marginTop: '4px' }}>{posts?.length || 0} inlägg</div>
        </div>
        <button onClick={() => openEditor(null)} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '10px 16px', background: '#0b6329', border: 'none', borderRadius: '9px', color: 'white', fontSize: '13.5px', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
          <Plus size={14} /> Nytt inlägg
        </button>
      </div>

      {error && <div style={{ fontSize: '13px', color: '#f87171', marginBottom: '18px' }}>{error}</div>}

      {posts === null && !error && <div style={{ color: 'rgba(232,236,233,0.5)', fontSize: '13.5px' }}>Laddar…</div>}

      {posts?.length === 0 && (
        <div style={{ ...cardStyle, textAlign: 'center', padding: '50px 24px', color: 'rgba(232,236,233,0.5)' }}>
          Inga inlägg än — klicka "Nytt inlägg" för att skriva det första.
        </div>
      )}

      <div style={{ display: 'grid', gap: '10px' }}>
        {posts?.map(post => (
          <div key={post.id} style={{ ...cardStyle, display: 'flex', alignItems: 'center', gap: '16px', padding: '14px 18px' }}>
            {post.cover_image_url ? (
              <img src={post.cover_image_url} alt="" style={{ width: 56, height: 56, borderRadius: '8px', objectFit: 'cover', flexShrink: 0 }} />
            ) : (
              <div style={{ width: 56, height: 56, borderRadius: '8px', background: 'rgba(255,255,255,0.06)', flexShrink: 0 }} />
            )}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: '14.5px', fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{post.title}</div>
              <div style={{ fontSize: '11.5px', color: 'rgba(232,236,233,0.45)', marginTop: '3px', display: 'flex', gap: '10px', alignItems: 'center' }}>
                {post.status === 'published'
                  ? <span style={{ color: '#84cc16', fontWeight: 700 }}>● Publicerad {formatDateSv(post.published_at)}</span>
                  : <span style={{ fontWeight: 700 }}>○ Utkast</span>}
                <span>Uppdaterad {formatDateSv(post.updated_at)}</span>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
              {post.status === 'published' && (
                <a href={`/blogg/${post.slug}`} target="_blank" rel="noopener noreferrer" title="Visa live" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 32, height: 32, borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(232,236,233,0.6)' }}>
                  <ExternalLink size={14} />
                </a>
              )}
              <button onClick={() => openEditor(post)} title="Redigera" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 32, height: 32, borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)', background: 'none', color: 'rgba(232,236,233,0.7)', cursor: 'pointer' }}>
                <Pencil size={14} />
              </button>
              <button onClick={() => handleDelete(post)} title="Ta bort" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 32, height: 32, borderRadius: '8px', border: '1px solid rgba(248,113,113,0.2)', background: 'none', color: '#f87171', cursor: 'pointer' }}>
                <Trash2 size={14} />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
