import { useState, useEffect } from 'react';
import { useMagazines } from '../hooks/useMagazines';

const isTauri = () => Boolean(window.__TAURI_INTERNALS__);
import { useStories } from '../hooks/useStories';
import { parseDeadline as parseDl } from './DeadlineCell';
import MagazineTable from './MagazineTable';
import StoriesTable from './StoriesTable';
import RefreshButton from './RefreshButton';
import LoadingSpinner from './LoadingSpinner';

function parseWordCountRange(wordLength) {
  if (!wordLength) return null;
  const wl = wordLength.toLowerCase().replace(/,/g, '');
  if (wl.includes('any') || wl.includes('no limit') || wl === 'tbd') return { min: 0, max: Infinity };
  // Page-based limits ("up to 30 manuscript pages") aren't word counts.
  if (wl.includes('page')) return null;
  const upTo = wl.match(/up to (\d+)/);
  if (upTo) return { min: 0, max: parseInt(upTo[1]) };
  const range = wl.match(/(\d+)\s*[-–]\s*(\d+)/);
  if (range) return { min: parseInt(range[1]), max: parseInt(range[2]) };
  return null;
}

// Flash = pieces under 1K; Short Stories = 1-5K. A call belongs to every
// category its accepted range overlaps, so e.g. "500-2,000 words" shows
// under both. Unparseable limits show everywhere.
const CATEGORIES = [
  { value: 'Short Story', label: 'Short Stories' },
  { value: 'Flash', label: 'Flash' },
  { value: 'All', label: 'All' },
];

function inCategory(mag, category) {
  if (category === 'All') return true;
  const range = parseWordCountRange(mag.word_length);
  if (!range) return true;
  if (category === 'Flash') return range.min < 2000;
  return range.max > 2000 && range.min <= 5000;
}

export default function Dashboard() {
  const { magazines, loading, error, refresh, load } = useMagazines();
  const { stories, loadAll: loadStories, addStory, editStory, removeStory, setMagazineStories, storiesByMagazine } = useStories();
  const [tab, setTab] = useState('magazines');
  const [category, setCategory] = useState('Short Story');
  const [showClosed, setShowClosed] = useState(false);

  const isAlwaysOpen = (mag) => {
    const dl = mag.deadline || '';
    return dl === 'Always Open' || dl === 'Rolling submissions' || dl === 'Currently open to submissions';
  };

  const getGroup = (mag) => {
    if (isAlwaysOpen(mag)) return 2;
    if (mag.deadline === 'Closed to submissions') return 3;
    const parsed = parseDl(mag.deadline || '');
    if (!parsed?.end) return 3;
    const now = new Date(); now.setHours(0,0,0,0);
    const end = new Date(parsed.end); end.setHours(0,0,0,0);
    if (end < now) return 3;
    if (parsed.start) {
      const start = new Date(parsed.start); start.setHours(0,0,0,0);
      if (now < start) return 1;
    }
    return 0;
  };

  const getSortDate = (mag) => {
    const parsed = parseDl(mag.deadline || '');
    if (!parsed) return new Date('9999-12-31');
    const group = getGroup(mag);
    return group === 1 ? (parsed.start ?? parsed.end) : parsed.end;
  };

  const reopenOrder = (mag) => {
    if (!mag.reopen || mag.reopen === 'TBD') return 9999;
    const months = ['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'];
    const idx = months.findIndex(mo => mag.reopen.toLowerCase().startsWith(mo));
    return idx === -1 ? 9998 : idx;
  };

  const isClosedNoReopen = (mag) =>
    getGroup(mag) === 3 && (!mag.reopen || mag.reopen === 'TBD');

  const sortedMagazines = magazines
    .filter(mag => mag.genre === 'Fiction')
    .sort((a, b) => {
      const ga = getGroup(a), gb = getGroup(b);
      if (ga !== gb) return ga - gb;
      if (ga === 3) return reopenOrder(a) - reopenOrder(b);
      return getSortDate(a) - getSortDate(b);
    });

  const categoryFiltered = sortedMagazines.filter(mag => inCategory(mag, category));
  const displayedMagazines = categoryFiltered.filter(mag => showClosed || !isClosedNoReopen(mag));
  const hasHiddenClosed = categoryFiltered.some(isClosedNoReopen);

  useEffect(() => {
    if (sortedMagazines.length > 0) {
      console.log('[Courier Dashboard] Displaying', sortedMagazines.length, 'magazines:');
      sortedMagazines.forEach((mag, idx) => {
        console.log(`[${idx + 1}]`, {
          name: mag.name, genre: mag.genre, call_name: mag.call_name,
          word_length: mag.word_length, deadline: mag.deadline,
          homepage: mag.homepage, guidelines: mag.guidelines,
          submit_info: mag.submit_info, external_submit_url: mag.external_submit_url
        });
      });
    }
  }, [sortedMagazines]);


  return (
    <div className="min-h-screen bg-[#F8F7F4] p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-6 min-h-[40px]">
          {/* Left: title (web) or story filter (Tauri) */}
          <div className="flex items-center gap-2">
            {!isTauri() && (
              <h1
                className="text-2xl md:text-3xl font-bold text-[#100F0F] cursor-pointer select-none"
                onClick={() => window.location.reload()}
              >COURIER</h1>
            )}
            {isTauri() && tab === 'magazines' && (
              <>
                <label className="text-sm text-[#575653]">Category:</label>
                <select
                  value={category}
                  onChange={e => setCategory(e.target.value)}
                  className="text-sm border border-[#E6E4D9] rounded px-2 py-1 bg-[#FFFCF0] text-[#1C1B1A] focus:outline-none focus:border-[#205EA6]"
                >
                  {CATEGORIES.map(c => (
                    <option key={c.value} value={c.value}>{c.label}</option>
                  ))}
                </select>
              </>
            )}
          </div>

          {/* Right: Refresh (Tauri only) */}
          {isTauri() && tab === 'magazines' && (
            <RefreshButton onClick={() => refresh(true)} loading={loading} />
          )}
        </div>

        {/* Tabs — only shown in Tauri where Stories tab exists */}
        {isTauri() && (
          <div className="flex gap-1 mb-6 border-b border-[#E6E4D9]">
            {['magazines', 'stories'].map(t => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`px-4 py-2 text-sm font-medium capitalize -mb-px border-b-2 transition-colors ${
                  tab === t
                    ? 'border-[#205EA6] text-[#205EA6]'
                    : 'border-transparent text-[#575653] hover:text-[#1C1B1A]'
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        )}

        {tab === 'magazines' && (
          <>
            {error && (
              <div className="bg-[#FFFCF0] border border-[#AF3029] rounded-lg p-4 mb-6">
                <p className="text-[#AF3029]">{error}</p>
              </div>
            )}
            {loading && magazines.length === 0 ? (
              <LoadingSpinner />
            ) : (
              <>
                <MagazineTable
                  magazines={displayedMagazines}
                  onRefreshNeeded={load}
                  allStories={stories}
                  storiesByMagazine={storiesByMagazine}
                  onStoriesChanged={async (magazineId, storyIds) => {
                    await setMagazineStories(magazineId, storyIds);
                  }}
                />
                {hasHiddenClosed && (
                  <div className="mt-4 text-center">
                    <button
                      onClick={() => setShowClosed(c => !c)}
                      className="text-sm text-[#878580] hover:text-[#575653] underline underline-offset-2"
                    >
                      {showClosed ? 'Hide Closed Calls' : 'Show Closed Calls'}
                    </button>
                  </div>
                )}
              </>
            )}
          </>
        )}

        {tab === 'stories' && (
          <StoriesTable
            stories={stories}
            onAdd={addStory}
            onEdit={editStory}
            onDelete={removeStory}
          />
        )}
      </div>
    </div>
  );
}
