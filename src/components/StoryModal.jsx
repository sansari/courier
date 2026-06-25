import { useState, useEffect } from 'react';

const STATUSES = ['Drafting', 'Editing', 'Ready'];

export default function StoryModal({ story, onSave, onClose }) {
  const [title, setTitle] = useState(story?.title ?? '');
  const [wordCount, setWordCount] = useState(story?.word_count ?? '');
  const [status, setStatus] = useState(story?.status ?? 'Drafting');

  useEffect(() => {
    const handleKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!title.trim()) return;
    onSave(title.trim(), wordCount.trim(), status);
  };

  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50" onClick={onClose}>
      <div
        className="bg-[#FFFCF0] rounded-lg shadow-lg p-6 w-96"
        onClick={e => e.stopPropagation()}
      >
        <h2 className="text-lg font-semibold text-[#100F0F] mb-4">
          {story ? 'Edit Story' : 'Add Story'}
        </h2>
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <div>
            <label className="block text-xs font-medium text-[#575653] uppercase tracking-wider mb-1">Title</label>
            <input
              autoFocus
              className="w-full border border-[#E6E4D9] rounded px-3 py-1.5 text-sm bg-[#FFFCF0] text-[#1C1B1A] focus:outline-none focus:border-[#4385BE]"
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="Story title"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-[#575653] uppercase tracking-wider mb-1">Word Count</label>
            <input
              className="w-full border border-[#E6E4D9] rounded px-3 py-1.5 text-sm bg-[#FFFCF0] text-[#1C1B1A] focus:outline-none focus:border-[#4385BE]"
              value={wordCount}
              onChange={e => setWordCount(e.target.value)}
              placeholder="e.g. 3,200"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-[#575653] uppercase tracking-wider mb-1">Status</label>
            <div className="flex gap-2">
              {STATUSES.map(s => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setStatus(s)}
                  className={`flex-1 py-1.5 text-sm rounded border transition-colors ${
                    status === s
                      ? 'bg-[#205EA6] text-[#FFFCF0] border-[#205EA6]'
                      : 'bg-[#FFFCF0] text-[#575653] border-[#E6E4D9] hover:border-[#4385BE]'
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
          <div className="flex justify-end gap-2 mt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-1.5 text-sm text-[#575653] hover:text-[#1C1B1A]"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!title.trim()}
              className="px-4 py-1.5 text-sm bg-[#205EA6] text-[#FFFCF0] rounded hover:bg-[#4385BE] disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {story ? 'Save' : 'Add'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
