import { useState } from 'react';
import StoryModal from './StoryModal';

const STATUS_COLORS = {
  Drafting: 'text-[#BC5215] bg-[#FFF1E8]',
  Editing:  'text-[#66800B] bg-[#F2F0E5]',
  Ready:    'text-[#205EA6] bg-[#EEF4FB]',
};

export default function StoriesTable({ stories, onAdd, onEdit, onDelete }) {
  const [modal, setModal] = useState(null); // null | 'add' | story object

  const handleSave = async (title, wordCount, status) => {
    if (modal === 'add') {
      await onAdd(title, wordCount, status);
    } else {
      await onEdit(modal.id, title, wordCount, status);
    }
    setModal(null);
  };

  return (
    <div>
      <div className="flex justify-end mb-4">
        <button
          onClick={() => setModal('add')}
          className="px-4 py-1.5 text-sm bg-[#205EA6] text-[#FFFCF0] rounded hover:bg-[#4385BE]"
        >
          + Add Story
        </button>
      </div>

      <div className="bg-[#FFFCF0] rounded-lg shadow overflow-hidden">
        <table className="min-w-full divide-y divide-[#E6E4D9]">
          <thead className="bg-[#F2F0E5]">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-[#575653] uppercase tracking-wider">Title</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-[#575653] uppercase tracking-wider">Word Count</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-[#575653] uppercase tracking-wider">Status</th>
              <th className="px-6 py-3"></th>
            </tr>
          </thead>
          <tbody className="bg-[#FFFCF0] divide-y divide-[#E6E4D9]">
            {stories.length === 0 && (
              <tr>
                <td colSpan={4} className="px-6 py-8 text-center text-[#B7B5AC] text-sm">
                  No stories yet. Add one to get started.
                </td>
              </tr>
            )}
            {stories.map(story => (
              <tr key={story.id}>
                <td className="px-6 py-2 font-medium text-[#1C1B1A]">{story.title}</td>
                <td className="px-6 py-2 text-[#575653] text-sm">{story.word_count || '—'}</td>
                <td className="px-6 py-2">
                  <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${STATUS_COLORS[story.status] ?? ''}`}>
                    {story.status}
                  </span>
                </td>
                <td className="px-6 py-2 text-right">
                  <button
                    onClick={() => setModal(story)}
                    className="text-xs text-[#575653] hover:text-[#205EA6] mr-3"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => onDelete(story.id)}
                    className="text-xs text-[#575653] hover:text-[#AF3029]"
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {modal && (
        <StoryModal
          story={modal === 'add' ? null : modal}
          onSave={handleSave}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  );
}
