const MONTH_ABBR = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const MONTH_IDX = {
  jan:0,feb:1,mar:2,apr:3,may:4,jun:5,jul:6,aug:7,sep:8,oct:9,nov:10,dec:11,
  january:0,february:1,march:2,april:3,june:5,july:6,august:7,september:8,october:9,november:10,december:11,
};

function parseDeadline(str) {
  // Range: "Aug 15 - Nov 15, 2026" or "Feb 15 - May 15th, 2026"
  const rangeMatch = str.match(/^(\w+)\s+(\d{1,2})(?:st|nd|rd|th)?\s*[-–]\s*(\w+)\s+(\d{1,2})(?:st|nd|rd|th)?,\s*(\d{4})$/i);
  if (rangeMatch) {
    const [,m1,d1,m2,d2,yr] = rangeMatch;
    const i1 = MONTH_IDX[m1.toLowerCase()], i2 = MONTH_IDX[m2.toLowerCase()];
    if (i1 == null || i2 == null) return null;
    return {
      start: new Date(+yr, i1, +d1),
      end:   new Date(+yr, i2, +d2),
    };
  }
  // Single with day-of-week: "Fri, May 1st, 2026"
  const dowMatch = str.match(/\w+,\s+(\w+)\s+(\d{1,2})(?:st|nd|rd|th)?,\s+(\d{4})/);
  if (dowMatch) {
    const [,month,day,yr] = dowMatch;
    return { start: null, end: new Date(`${month} ${day}, ${yr}`) };
  }
  // Single plain: "Nov 15, 2026" or "Nov 15th, 2026"
  const plainMatch = str.match(/^(\w+)\s+(\d{1,2})(?:st|nd|rd|th)?,\s+(\d{4})$/i);
  if (plainMatch) {
    const [,month,day,yr] = plainMatch;
    const idx = MONTH_IDX[month.toLowerCase()];
    if (idx == null) return null;
    return { start: null, end: new Date(+yr, idx, +day) };
  }
  return null;
}

function fmtDate(date) {
  return `${MONTH_ABBR[date.getMonth()]} ${date.getDate()}`;
}

function windowDisplay(parsed) {
  if (!parsed?.end) return null;
  return parsed.start ? `${fmtDate(parsed.start)} – ${fmtDate(parsed.end)}` : fmtDate(parsed.end);
}

function calcStatus(parsed) {
  if (!parsed?.end) return null;
  const now = new Date(); now.setHours(0,0,0,0);
  const end = new Date(parsed.end); end.setHours(0,0,0,0);

  if (parsed.start) {
    const start = new Date(parsed.start); start.setHours(0,0,0,0);
    if (now < start) {
      return { text: `Opens ${fmtDate(start)}`, color: 'text-[#575653]', active: false };
    }
  }

  const days = Math.ceil((end - now) / 86400000);
  if (days < 0)  return { text: 'Closed', color: 'text-[#B7B5AC]', active: false };
  if (days === 0) return { text: 'Closes today', color: 'text-[#AF3029] font-semibold', active: true };
  if (days === 1) return { text: 'Closes tomorrow', color: 'text-[#BC5215] font-semibold', active: true };
  if (days <= 7)  return { text: `${days} days left`, color: 'text-[#BC5215]', active: true };
  if (days < 14)  return { text: '1 week left', color: 'text-[#66800B]', active: true };
  if (days < 60)  return { text: `${Math.floor(days/7)} weeks left`, color: 'text-[#66800B]', active: true };
  return { text: `${Math.floor(days/30)} months left`, color: 'text-[#66800B]', active: true };
}

export default function DeadlineCell({ deadline, reopen, suffix }) {
  if (!deadline) return <span className="text-[#B7B5AC]">N/A</span>;

  const closedEl = (
    <div className="flex flex-col">
      <span className="text-[#B7B5AC]">Closed</span>
      {reopen && <span className="text-sm text-[#B7B5AC]">(Reopens {reopen})</span>}
    </div>
  );

  if (deadline === 'Closed to submissions') return closedEl;

  if (deadline === 'Always Open' || deadline === 'Rolling submissions' || deadline === 'Currently open to submissions') {
    return <span className="text-[#66800B]">{deadline === 'Currently open to submissions' ? 'Always Open' : deadline}</span>;
  }

  const parsed = parseDeadline(deadline);
  const status = calcStatus(parsed);
  const display = windowDisplay(parsed);

  if (status?.text === 'Closed') return closedEl;

  return (
    <div className="flex flex-col">
      <span className="text-[#1C1B1A]">{display ?? deadline}{suffix}</span>
      {status && <span className={`text-sm ${status.color}`}>({status.text})</span>}
    </div>
  );
}

// Exported for use in MagazineTable / Dashboard
export { parseDeadline, calcStatus };
