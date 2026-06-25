export default function RefreshButton({ onClick, loading }) {
  return (
    <button
      onClick={onClick}
      disabled={loading}
      className="px-4 py-2 bg-[#205EA6] text-[#FFFCF0] rounded-lg hover:bg-[#4385BE] disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
    >
      <svg
        className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      >
        <path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0118.8-4.3M22 12.5a10 10 0 01-18.8 4.2" />
      </svg>
      {loading ? 'Refreshing...' : 'Refresh'}
    </button>
  );
}
