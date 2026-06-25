# Magazine Parsing Guide

## Core Principle

**COURIER must ALWAYS extract and display actual deadlines.** Every magazine entry should show real deadline dates, never fallback messages like "Check website for details" or "N/A".

The scraper's job is to find deadline information from:
1. The magazine's submit_info page (primary source)
2. The external_submit_url platform (Submittable, Moksha, etc.) if needed
3. The guidelines page as last resort

If a magazine truly has rolling/perpetual submissions, that should be explicitly stated (e.g., "Rolling submissions - always open"). If deadlines aren't found, the scraper needs improvement, not a fallback message.

## Magazine Structure

Literary magazines have a complex submission structure with THREE distinct entities:

### 1. Submission Guidelines Page
- **What it contains:** Editorial preferences, what kind of stories they accept, themes, restrictions
- **Example:** https://plotthoundmag.com/submission-guidelines/
- **Purpose:** Helps writers understand if their work fits the magazine

### 2. Submit Page (Calls/Deadlines)
- **What it contains:** Active submission calls with open/close dates
- **Example:** https://plotthoundmag.com/submit/
- **Important:** NOT rolling/always open - magazines have specific reading periods
- **Purpose:** Shows when submissions are actually being accepted

### 3. Third-Party Submission Platform
- **What it contains:** Actual submission form, often repeats deadline info
- **Examples:** Submittable, Moksha, Duotrope
- **Purpose:** Where you actually upload and submit your work

## Multiple Calls Per Magazine

- Each magazine can have **multiple simultaneous calls**
- Different calls for different genres (fiction, poetry, nonfiction, etc.)
- Each call has:
  - Genre/category
  - Word length requirements (e.g., "up to 5,000 words")
  - Specific deadline
  - Separate submission link

## Data Model Requirements

For each **submission call**, we need to track:

```yaml
- magazine_name: "Plott Hound Magazine"
  magazine_homepage: "https://plotthoundmag.com"

  # The call details
  call_name: "Fiction - Spring 2026"  # Or just "Fiction" if no season
  genre: "Fiction"
  word_length: "up to 5,000 words"

  # The three links
  guidelines_url: "https://plotthoundmag.com/submission-guidelines/"
  submit_page_url: "https://plotthoundmag.com/submit/"
  submission_platform_url: "https://plotthound.moksha.io/publication/plott-hound-magazine/guidelines"

  # Deadline info
  opens: "2026-01-01"
  closes: "2026-03-31"
  deadline_text: "March 31, 2026"  # Human-readable
  status: "open" | "closed" | "rolling"
```

## Scraping Strategy

### Pages to Scrape (in order of priority):

1. **Submit page** (`/submit/`)
   - Primary source for deadlines
   - Often has all active calls listed
   - Look for dates, "opens", "closes", reading periods

2. **Third-party platform** (Moksha, Submittable)
   - Secondary source for deadlines
   - Often has structured deadline data
   - May have guidelines + deadlines together

3. **Guidelines page** (`/submission-guidelines/`)
   - Usually doesn't have deadlines
   - Has word counts and editorial preferences
   - Look for word length requirements

### What to Look For:

**Deadlines:**
- Date formats: "March 31, 2026", "3/31/2026", "2026-03-31"
- Keywords: "deadline", "closes", "reading period ends", "submissions close"
- Periods: "January 1 - March 31", "Open until"
- Status: "currently open", "closed", "rolling"

**Word Lengths:**
- Patterns: "up to X words", "X-Y words", "maximum X words", "under X words"
- Common ranges: 500, 1000, 2500, 5000, 7500, 10000 words
- May be listed per genre

**Genre/Call Type:**
- Fiction, Poetry, Nonfiction, Flash Fiction, Essays
- Themed calls: "Summer Issue", "Halloween Special"
- Contests vs regular submissions

## Edge Cases

1. **Combined pages:** Some magazines have guidelines + deadlines + submit link on ONE page
2. **Multiple platforms:** Some use Submittable for fiction, Moksha for poetry
3. **Rolling submissions:** Some genuinely are always open (rare)
4. **Contests:** Special calls with entry fees and prizes
5. **Themed issues:** Special calls with specific themes beyond just genre

## Display Strategy

In the app table, each **row = one submission call**, not one magazine.

| Magazine | Call | Guidelines | Word Count | Deadline | Submit |
|----------|------|-----------|------------|----------|---------|
| Plott Hound | Fiction | [link] | up to 5,000 | Mar 31, 2026 | [Submit →] |
| Plott Hound | Poetry | [link] | up to 3 poems | Mar 31, 2026 | [Submit →] |

This allows tracking multiple calls from the same magazine.

## Future Enhancements

- Parse Submittable category pages (they list all open calls)
- Detect reading fees vs free submissions
- Track response times
- Notify before deadlines
- Filter by genre
- Filter by word count (show only calls that match your story length)
