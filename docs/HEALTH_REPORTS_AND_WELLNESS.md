# Phase 08 Health Report and Wellness Library

## Health Report

Choose an inclusive date range of up to 366 days. The report includes saved period intervals and days, mood with energy and stress, the symptom timeline, and sleep. It clips completed period ranges to the displayed dates. A saved start with an open end contributes its start day. Period interval rows require both saved starts to fall within the date range. The report contains recorded or derived historical observations only.

Personal journal notes require explicit selection and are excluded by default. LUNARA builds the preview from the signed-in user’s snapshot. Each download recalculates from the same account’s database records, using the selected dates and journal option. No user identifier, sign-in email, AI Care transcript or estimated dates are exported.

The PDF uses printable A4 pages and selectable embedded Latin text. Characters outside the font subset display as a question mark with a note in the PDF. For those characters or spreadsheet analysis, download the UTF-8 CSV. Spreadsheet formula-like cells receive a protective apostrophe. The application creates downloads in memory and returns them as attachments. Its API response instructs browsers and proxies to skip caching. Downloaded files remain private data.

The feature uses PDFKit, fontkit and Noto Sans with versions locked in `package-lock.json`. Install the pinned libraries with `npm ci` before running the application.

## Wellness Library

The library has nine articles with filterable categories, keyword search and direct article links. It covers cycle literacy, hormones, nutrition, movement, sleep, reproductive health and self-care. The app serves illustrations from the existing local asset catalog. External references open only when a reader selects them.

Each article includes its source links. They include the [Office on Women’s Health](https://womenshealth.gov/menstrual-cycle/your-menstrual-cycle), [NHLBI](https://www.nhlbi.nih.gov/health/sleep-deprivation/healthy-sleep-habits), [Kementerian Kesehatan RI](https://ayosehat.kemkes.go.id/isi-piringku-kebutuhan-gizi-harian-seimbang), [CDC](https://www.cdc.gov/physical-activity-basics/guidelines/adults.html), and the [NHS](https://www.nhs.uk/mental-health/self-help/guides-tools-and-activities/breathing-exercises-for-stress/). The articles are general education and have no clinical review claim.
