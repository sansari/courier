import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';

const isTauri = () => Boolean(window.__TAURI_INTERNALS__);

export function useStories() {
  const [stories, setStories] = useState([]);
  const [links, setLinks] = useState([]); // MagazineStoryLink[]

  const loadAll = async () => {
    if (!isTauri()) return;
    const [s, l] = await Promise.all([
      invoke('load_stories'),
      invoke('load_magazine_story_links'),
    ]);
    setStories(s);
    setLinks(l);
  };

  useEffect(() => { loadAll(); }, []);

  const addStory = async (title, wordCount, status) => {
    if (!isTauri()) return;
    await invoke('add_story', { title, wordCount: wordCount || null, status });
    await loadAll();
  };

  const editStory = async (id, title, wordCount, status) => {
    if (!isTauri()) return;
    await invoke('update_story', { id, title, wordCount: wordCount || null, status });
    await loadAll();
  };

  const removeStory = async (id) => {
    if (!isTauri()) return;
    await invoke('delete_story', { id });
    await loadAll();
  };

  const setMagazineStories = async (magazineId, storyIds) => {
    if (!isTauri()) return;
    await invoke('set_magazine_stories', { magazineId, storyIds });
    await loadAll();
  };

  // magazine_id -> Story[]
  const storiesByMagazine = (magazineId) => {
    const ids = new Set(links.filter(l => l.magazine_id === magazineId).map(l => l.story_id));
    return stories.filter(s => ids.has(s.id));
  };

  return { stories, links, loadAll, addStory, editStory, removeStory, setMagazineStories, storiesByMagazine };
}
