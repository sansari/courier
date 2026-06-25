import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { load } from 'js-yaml';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const root = dirname(dirname(fileURLToPath(import.meta.url)));

function parseFrontmatter(path) {
  const md = readFileSync(path, 'utf8');
  const m = md.match(/^---\n([\s\S]*?)\n---/);
  if (!m) throw new Error(`No YAML frontmatter in ${path}`);
  return load(m[1]);
}

const magsPath = join(root, 'magazines.md');
if (!existsSync(magsPath)) {
  console.error(
    'Error: magazines.md not found.\n' +
    'Copy the example file to get started:\n' +
    '  cp magazines.example.md magazines.md'
  );
  process.exit(1);
}
const magsData = parseFrontmatter(magsPath);
const magazines = magsData.magazines.map((mag, i) => {
  const deadline = mag.fixed_deadline ?? mag.scraped_deadline ?? null;
  return {
    id: i + 1,
    name: mag.name,
    homepage: mag.homepage,
    guidelines: mag.guidelines ?? mag.homepage,
    submit_info: mag.submit_info ?? mag.homepage,
    external_submit_url: mag.external_submit_url ?? null,
    genre: mag.genre ?? null,
    call_name: mag.call_name ?? null,
    word_length: mag.word_length ?? null,
    deadline,
    fixed_deadline: mag.fixed_deadline ?? null,
    scraped_deadline: mag.scraped_deadline ?? null,
    scraped_at: mag.scraped_at ?? null,
    needs_review: mag.needs_review ?? false,
    review_note: mag.review_note ?? null,
    reopen: mag.reopen ?? null,
    notes: mag.notes ?? null,
    call_notes: mag.call_notes ?? null,
    custom_name: mag.custom_name ?? null,
    custom_call_name: mag.custom_call_name ?? null,
    custom_guidelines: mag.custom_guidelines ?? null,
  };
});

mkdirSync(join(root, 'public'), { recursive: true });
writeFileSync(join(root, 'public', 'magazines.json'), JSON.stringify(magazines, null, 2));
console.log(`Wrote ${magazines.length} magazines to public/magazines.json`);

// Stories file is optional — if it doesn't exist yet, skip.
const storiesPath = join(root, 'stories.md');
if (existsSync(storiesPath)) {
  const storiesData = parseFrontmatter(storiesPath);
  writeFileSync(join(root, 'public', 'stories.json'), JSON.stringify(storiesData.stories ?? [], null, 2));
  console.log(`Wrote ${(storiesData.stories ?? []).length} stories to public/stories.json`);
}
