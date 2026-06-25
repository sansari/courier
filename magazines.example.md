---
magazines:
  # Always-open market — fixed_deadline prevents the scraper from touching it.
  - name: "Fractured Lit"
    homepage: "https://fracturedlit.com"
    guidelines: "https://fracturedlit.submittable.com/submit"
    submit_info: "https://fracturedlit.submittable.com/submit"
    external_submit_url: "https://fracturedlit.submittable.com/submit"
    genre: "Fiction"
    call_name: "Flash Fiction"
    word_length: "401-1,000 words"
    fixed_deadline: "Always Open"
    call_notes: "Flash fiction with emotional resonance. Year-round, no fee, pays $75."

  # Seasonal window — scraped_deadline is filled in by the refresh command.
  - name: "Baltimore Review"
    homepage: "https://baltimorereview.org"
    guidelines: "https://baltimorereview.org/submit"
    submit_info: "https://baltimorereview.org/submit"
    external_submit_url: "https://baltimorereview.submittable.com/submit"
    genre: "Fiction"
    call_name: "Fiction Submissions"
    word_length: "up to 5,000 words"
    reopen: "August"
    call_notes: "Literary short stories, selected on merit. No fee, pays $50 + print copy."
    scraped_deadline: "Aug 01, 2026"
    scraped_at: "2026-06-18T16:41:55.264510+00:00"

  # Closed call kept for historical reference — paired with its successor below.
  - name: "Ecotone"
    homepage: "https://ecotonemagazine.org"
    guidelines: "https://ecotonemagazine.org/submissions/"
    submit_info: "https://ecotonemagazine.org/submissions/"
    external_submit_url: "https://ecotone.submittable.com/submit"
    genre: "Fiction"
    call_name: "Spring 2026"
    word_length: "2,000-10,000 words"
    fixed_deadline: "Closed to submissions"
    call_notes: "Spring 2026 reading period ended. See General Submissions for the next window."

  - name: "Ecotone"
    homepage: "https://ecotonemagazine.org"
    guidelines: "https://ecotonemagazine.org/submissions/"
    submit_info: "https://ecotonemagazine.org/submissions/"
    external_submit_url: "https://ecotone.submittable.com/submit"
    genre: "Fiction"
    call_name: "General Submissions"
    word_length: "2,000-10,000 words"
    reopen: "September"
    call_notes: "Fiction deeply rooted in place — ecology, natural history, climate. Next window Jan/Feb 2027."
    scraped_deadline: "Sep 30, 2026"
    scraped_at: "2026-06-18T16:41:55.264510+00:00"

  # Custom display name example (magazine name is long / awkward).
  - name: "Southern Humanities Review"
    homepage: "https://www.southernhumanitiesreview.com"
    guidelines: "https://www.southernhumanitiesreview.com/submit.html"
    submit_info: "https://www.southernhumanitiesreview.com/submit.html"
    external_submit_url: "https://southernhumanitiesreview.submittable.com/submit"
    genre: "Fiction"
    call_name: "Fall 2026"
    word_length: "up to 8,000 words"
    reopen: "August"
    custom_name: "SHR"
    call_notes: "One story per submission, $3 fee (first 100 free), $50 honorarium."
    scraped_deadline: "Aug 15 - Nov 15, 2026"
    scraped_at: "2026-06-18T16:41:55.264510+00:00"

  # Contest with a hard fixed deadline.
  - name: "Terrain.org"
    homepage: "https://www.terrain.org"
    guidelines: "https://www.terrain.org/submit/"
    submit_info: "https://terrainorg.submittable.com/submit"
    external_submit_url: "https://terrainorg.submittable.com/submit"
    genre: "Fiction"
    call_name: "Annual Contest in Fiction"
    word_length: "up to 5,000 words (or 2 flash up to 1,000 each)"
    fixed_deadline: "May 1 - Sep 1, 2026"
    call_notes: "$20 fee; $1,000 grand prize + $200 for finalists."
---
# Literary Magazines

This file contains your submission call database.
Copy this file to `magazines.md` and edit it freely — add, remove, or update entries.

**Key concepts:**
- Each entry is a *call*, not a magazine. One magazine can have many entries.
- The composite key is `(name, call_name)` — never dedupe by name alone.
- Set `fixed_deadline` when you know the deadline and don't want the scraper to change it.
- Leave `fixed_deadline` unset and the refresh command will fill in `scraped_deadline`.
- Add `custom_name` or `custom_call_name` to override what's shown in the table.
