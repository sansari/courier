import { useState, useRef, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import DeadlineCell, { parseDeadline, calcStatus } from './DeadlineCell';

const isTauri = () => Boolean(window.__TAURI_INTERNALS__);

function saveOverrides(mag, overrides) {
  return invoke('save_magazine_overrides', {
    name: mag.name,
    callName: mag.call_name ?? null,
    wordLength: mag.word_length ?? null,
    fixedDeadline: mag.fixed_deadline ?? null,
    notes: mag.notes ?? null,
    callNotes: mag.call_notes ?? null,
    customName: mag.custom_name ?? null,
    customCallName: mag.custom_call_name ?? null,
    customGuidelines: mag.custom_guidelines ?? null,
    ...overrides,
  });
}

function HoverCard({ children, notes, detailsUrl, onEdit }) {
  const [visible, setVisible] = useState(false);
  const timerRef = useRef(null);

  const show = () => { clearTimeout(timerRef.current); setVisible(true); };
  const hide = () => { timerRef.current = setTimeout(() => setVisible(false), 120); };

  const showEdit = isTauri();

  return (
    <div className="relative inline-block" onMouseEnter={show} onMouseLeave={hide}>
      {children}
      {visible && (
        <div
          className="absolute z-50 left-0 top-full mt-1 bg-[#FFFCF0] shadow-lg rounded-lg border border-[#E6E4D9] p-3 min-w-[200px] max-w-[280px]"
          onMouseEnter={show}
          onMouseLeave={hide}
        >
          {notes && <p className="text-sm text-[#575653] italic mb-2 whitespace-pre-wrap">{notes}</p>}
          <div className="flex gap-2">
            <a
              href={detailsUrl}
              target="_blank"
              rel="noreferrer"
              className="text-xs font-semibold px-2 py-1 bg-[#E6E4D9] rounded hover:bg-[#D0CEC8] text-[#1C1B1A] no-underline"
            >
              DETAILS
            </a>
            {showEdit && (
              <button
                onClick={e => { e.preventDefault(); e.stopPropagation(); setVisible(false); onEdit(); }}
                className="text-xs font-semibold px-2 py-1 bg-[#205EA6] rounded text-[#FFFCF0] hover:bg-[#4385BE]"
              >
                EDIT
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function EditModal({ mag, field, onSave, onClose }) {
  const [displayName, setDisplayName] = useState(
    field === 'name' ? (mag.custom_name ?? '') : (mag.custom_call_name ?? '')
  );
  const [notes, setNotes] = useState(
    field === 'name' ? (mag.notes ?? '') : (mag.call_notes ?? '')
  );
  const [url, setUrl] = useState(
    field === 'call' ? (mag.custom_guidelines ?? '') : ''
  );

  const save = async () => {
    await saveOverrides(mag, {
      notes: field === 'name' ? (notes.trim() || null) : (mag.notes ?? null),
      callNotes: field === 'call' ? (notes.trim() || null) : (mag.call_notes ?? null),
      customName: field === 'name' ? (displayName.trim() || null) : (mag.custom_name ?? null),
      customCallName: field === 'call' ? (displayName.trim() || null) : (mag.custom_call_name ?? null),
      customGuidelines: field === 'call' ? (url.trim() || null) : (mag.custom_guidelines ?? null),
    });
    onSave();
    onClose();
  };

  const label = field === 'name' ? 'Magazine' : 'Call';
  const placeholder = field === 'name' ? mag.name : (mag.call_name ?? '');

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center" onClick={onClose}>
      <div
        className="bg-[#FFFCF0] rounded-xl p-6 shadow-2xl w-full max-w-md mx-4"
        onClick={e => e.stopPropagation()}
      >
        <h2 className="text-base font-semibold text-[#1C1B1A] mb-4">Edit {label}</h2>
        <label className="block text-xs font-medium text-[#575653] uppercase tracking-wider mb-1">
          Custom {label} Name
        </label>
        <input
          autoFocus
          className="w-full border border-[#E6E4D9] rounded-lg px-3 py-2 text-sm mb-4 bg-white text-[#1C1B1A] focus:outline-none focus:border-[#205EA6]"
          placeholder={placeholder}
          value={displayName}
          onChange={e => setDisplayName(e.target.value)}
          onKeyDown={e => e.key === 'Escape' && onClose()}
        />
        {field === 'call' && (
          <>
            <label className="block text-xs font-medium text-[#575653] uppercase tracking-wider mb-1">
              URL
            </label>
            <input
              className="w-full border border-[#E6E4D9] rounded-lg px-3 py-2 text-sm mb-4 bg-white text-[#1C1B1A] focus:outline-none focus:border-[#205EA6]"
              placeholder={mag.guidelines}
              value={url}
              onChange={e => setUrl(e.target.value)}
              onKeyDown={e => e.key === 'Escape' && onClose()}
            />
          </>
        )}
        <label className="block text-xs font-medium text-[#575653] uppercase tracking-wider mb-1">
          Notes
        </label>
        <textarea
          className="w-full border border-[#E6E4D9] rounded-lg px-3 py-2 text-sm mb-5 bg-white text-[#1C1B1A] resize-none focus:outline-none focus:border-[#205EA6]"
          rows={4}
          placeholder="Notes about this magazine…"
          value={notes}
          onChange={e => setNotes(e.target.value)}
          onKeyDown={e => e.key === 'Escape' && onClose()}
        />
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 text-sm text-[#575653] hover:text-[#1C1B1A]">
            Cancel
          </button>
          <button
            onClick={save}
            className="px-4 py-2 text-sm font-medium bg-[#205EA6] text-[#FFFCF0] rounded-lg hover:bg-[#4385BE]"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}

function EditableWordCount({ mag, onSaved }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(mag.word_length ?? '');

  const displayed = mag.word_length ?? 'N/A';

  const save = async () => {
    const newVal = value.trim() || null;
    await saveOverrides(mag, { wordLength: newVal });
    onSaved();
    setEditing(false);
  };

  if (!isTauri()) {
    return <span className="text-[#575653] text-sm">{displayed}</span>;
  }

  if (editing) {
    return (
      <input
        autoFocus
        className="border border-blue-400 rounded px-2 py-0.5 text-sm w-36 bg-[#FFFCF0] text-[#1C1B1A]"
        value={value}
        onChange={e => setValue(e.target.value)}
        onBlur={save}
        onKeyDown={e => { if (e.key === 'Enter') save(); if (e.key === 'Escape') setEditing(false); }}
      />
    );
  }

  return (
    <span
      className="text-[#575653] text-sm cursor-pointer hover:underline"
      onClick={() => { setValue(mag.word_length ?? ''); setEditing(true); }}
      title="Click to edit"
    >
      {displayed}
    </span>
  );
}

function EditableDeadline({ mag, onSaved }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(mag.fixed_deadline ?? '');

  const save = async () => {
    const newVal = value.trim() || null;
    await saveOverrides(mag, { fixedDeadline: newVal });
    onSaved();
    setEditing(false);
  };

  const reviewMark = mag.needs_review ? (
    <span
      className="text-xs ml-1.5 cursor-help"
      title={mag.review_note || 'Models disagreed — verify this deadline manually'}
    >
      ⚠️
    </span>
  ) : null;

  if (!isTauri()) {
    return (
      <DeadlineCell deadline={mag.deadline} reopen={mag.reopen} suffix={reviewMark} />
    );
  }

  if (editing) {
    return (
      <input
        autoFocus
        className="border border-blue-400 rounded px-2 py-0.5 text-sm bg-[#FFFCF0] text-[#1C1B1A]"
        placeholder="e.g. May 15, 2026 or Always Open"
        value={value}
        onChange={e => setValue(e.target.value)}
        onBlur={save}
        onKeyDown={e => { if (e.key === 'Enter') save(); if (e.key === 'Escape') setEditing(false); }}
      />
    );
  }

  return (
    <div
      className="cursor-pointer"
      onClick={() => { setValue(mag.fixed_deadline ?? ''); setEditing(true); }}
      title="Click to edit"
    >
      <DeadlineCell
        deadline={mag.deadline}
        reopen={mag.reopen}
        suffix={<>{mag.fixed_deadline ? <span className="text-xs text-[#4385BE] ml-1.5">✎</span> : null}{reviewMark}</>}
      />
    </div>
  );
}

function StoryPicker({ magazineId, assignedStories, allStories, onChanged }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const assignedIds = new Set(assignedStories.map(s => s.id));

  const toggle = async (storyId) => {
    const next = assignedIds.has(storyId)
      ? [...assignedIds].filter(id => id !== storyId)
      : [...assignedIds, storyId];
    try {
      await onChanged(magazineId, next);
    } catch (e) {
      console.error('[StoryPicker] onChanged failed:', e);
    }
  };

  return (
    <div className="relative" ref={ref}>
      <div className="flex flex-wrap gap-1 min-w-[80px]">
        {assignedStories.length === 0
          ? <span className="text-[#B7B5AC] text-sm cursor-pointer" onClick={() => setOpen(o => !o)}>+</span>
          : assignedStories.map(s => (
              <span
                key={s.id}
                onClick={() => setOpen(o => !o)}
                className={`inline-block text-xs px-2 py-0.5 rounded-full text-[#FFFCF0] whitespace-nowrap cursor-pointer ${
                  s.status === 'Ready'    ? 'bg-[#205EA6]' :
                  s.status === 'Editing' ? 'bg-[#66800B]' :
                                           'bg-[#BC5215]'
                }`}>
                {s.title}
              </span>
            ))
        }
      </div>
      {open && (
        <div className="absolute z-10 top-full left-0 mt-1 bg-[#FFFCF0] border border-[#E6E4D9] rounded shadow-lg min-w-[180px] max-h-64 overflow-y-auto">
          {allStories.length === 0
            ? <div className="px-3 py-2 text-xs text-[#B7B5AC]">No stories yet</div>
            : allStories.map(s => (
                <div
                  key={s.id}
                  onClick={() => toggle(s.id)}
                  className="flex items-center gap-2 px-3 py-1.5 hover:bg-[#F2F0E5] cursor-pointer text-sm select-none"
                >
                  <span className={`w-3.5 h-3.5 rounded border flex-shrink-0 flex items-center justify-center text-[10px] ${assignedIds.has(s.id) ? 'bg-[#205EA6] border-[#205EA6] text-white' : 'border-[#B7B5AC]'}`}>
                    {assignedIds.has(s.id) && '✓'}
                  </span>
                  <span className="text-[#1C1B1A]">{s.title}</span>
                </div>
              ))
          }
        </div>
      )}
    </div>
  );
}

export default function MagazineTable({ magazines, onRefreshNeeded, allStories, storiesByMagazine, onStoriesChanged }) {
  const [modal, setModal] = useState(null); // { mag, field: 'name' | 'call' }

  // Hidden for now while focusing on a single story; was isTauri().
  const showStories = false;

  return (
    <>
      {modal && (
        <EditModal
          mag={modal.mag}
          field={modal.field}
          onSave={onRefreshNeeded}
          onClose={() => setModal(null)}
        />
      )}

      {/* Mobile card list */}
      <div className="md:hidden flex flex-col gap-3">
        {magazines.map((mag, idx) => {
          const effectiveDeadline = mag.deadline;
          const parsed = effectiveDeadline ? parseDeadline(effectiveDeadline) : null;
          const status = calcStatus(parsed);
          const display = parsed?.end
            ? (parsed.start
                ? `${['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][parsed.start.getMonth()]} ${parsed.start.getDate()} – ${['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][parsed.end.getMonth()]} ${parsed.end.getDate()}`
                : `${['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][parsed.end.getMonth()]} ${parsed.end.getDate()}`)
            : effectiveDeadline;
          return (
            <a
              key={idx}
              href={mag.guidelines || '#'}
              target="_blank"
              rel="noreferrer"
              className="bg-[#FAFCFF] px-4 py-3 rounded-lg shadow-sm border border-[#D0CEC8] flex items-center gap-2 active:bg-[#F0F6FF] no-underline"
            >
              <div className="flex-1 min-w-0">
                <span className="text-lg font-light italic text-[#1C1B1A] leading-tight">
                  {mag.custom_name || mag.name}
                </span>
                {mag.call_name && (
                  <span className="block text-sm font-semibold text-[#205EA6] mt-0.5">
                    {mag.custom_call_name || mag.call_name}
                  </span>
                )}
                {(effectiveDeadline === 'Closed to submissions' || status?.text === 'Closed' || (!effectiveDeadline && mag.reopen)) ? (
                  <div className="mt-3">
                    <span className="text-base font-semibold text-[#B7B5AC]">Closed</span>
                    {mag.reopen && <span className="text-sm font-normal text-[#B7B5AC] ml-1">(Reopens {mag.reopen})</span>}
                  </div>
                ) : effectiveDeadline ? (
                  <div className="mt-3 text-base font-semibold text-[#1C1B1A]">
                    {display ?? effectiveDeadline}
                    {status && <span className={`font-normal ml-1 ${status.color}`}>({status.text})</span>}
                    {mag.needs_review && <span className="ml-1" title={mag.review_note || 'Models disagreed — verify manually'}>⚠️</span>}
                  </div>
                ) : null}
                {mag.word_length && (
                  <div className="mt-0.5 text-sm text-[#575653]">{mag.word_length}</div>
                )}
                {mag.notes && (
                  <div className="mt-1 text-sm text-[#575653] italic">{mag.notes}</div>
                )}
                {mag.call_notes && (
                  <div className="mt-0.5 text-sm text-[#575653] italic">{mag.call_notes}</div>
                )}
              </div>
              <svg className="flex-shrink-0 w-4 h-4 text-[#B7B5AC]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </a>
          );
        })}
      </div>

      {/* Desktop table */}
      <div className="hidden md:block bg-[#FFFCF0] rounded-lg shadow overflow-visible">
        <table className="min-w-full divide-y divide-[#E6E4D9]">
          <thead className="bg-[#F2F0E5]">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-[#575653] uppercase tracking-wider">
                Magazine
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-[#575653] uppercase tracking-wider">
                Call
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-[#575653] uppercase tracking-wider">
                Word Count
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-[#575653] uppercase tracking-wider">
                Submission Window
              </th>
              {showStories && (
                <th className="px-4 py-3 text-left text-xs font-medium text-[#575653] uppercase tracking-wider">
                  Stories
                </th>
              )}
            </tr>
          </thead>
          <tbody className="bg-[#FFFCF0] divide-y divide-[#E6E4D9]">
            {magazines.map((mag, idx) => (
              <tr key={idx}>
                <td className="px-4 py-2 whitespace-nowrap">
                  <HoverCard
                    notes={mag.notes}
                    detailsUrl={mag.homepage}
                    onEdit={() => setModal({ mag, field: 'name' })}
                  >
                    <a
                      href={mag.homepage}
                      target="_blank"
                      rel="noreferrer"
                      className="text-[#205EA6] hover:text-[#4385BE] font-medium"
                    >
                      {mag.custom_name || mag.name}
                    </a>
                  </HoverCard>
                </td>
                <td className="px-4 py-2 whitespace-nowrap">
                  <HoverCard
                    notes={mag.call_notes}
                    detailsUrl={mag.custom_guidelines ?? mag.guidelines}
                    onEdit={() => setModal({ mag, field: 'call' })}
                  >
                    <a
                      href={mag.custom_guidelines ?? mag.guidelines}
                      target="_blank"
                      rel="noreferrer"
                      className="text-[#205EA6] hover:text-[#4385BE]"
                    >
                      {mag.custom_call_name || mag.call_name || 'N/A'}
                    </a>
                  </HoverCard>
                </td>
                <td className="px-4 py-2 whitespace-nowrap">
                  <EditableWordCount mag={mag} onSaved={onRefreshNeeded} />
                </td>
                <td className="px-4 py-2 whitespace-nowrap">
                  <EditableDeadline mag={mag} onSaved={onRefreshNeeded} />
                </td>
                {showStories && (
                  <td className="px-4 py-2">
                    <StoryPicker
                      magazineId={mag.id}
                      assignedStories={storiesByMagazine(mag.id)}
                      allStories={allStories}
                      onChanged={onStoriesChanged}
                    />
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
