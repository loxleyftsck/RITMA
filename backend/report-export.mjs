import { readFileSync } from 'node:fs';
import { create } from 'fontkit';
import { PDFDocument } from 'pdfkit';
import { reportSections } from '../src/report-data.js';

const paper = '#FFF9FB';
const ink = '#29232A';
const muted = '#665761';
const mauve = '#82546F';
const line = '#EADCE4';
const margin = 48;
const rowStep = 14;
const regular = readFileSync(new URL(import.meta.resolve('@fontsource/noto-sans/files/noto-sans-latin-400-normal.woff')));
const bold = readFileSync(new URL(import.meta.resolve('@fontsource/noto-sans/files/noto-sans-latin-700-normal.woff')));
const glyphs = new Set(create(regular).characterSet);

function printable(text) {
  return [...String(text).normalize('NFC').replace(/\r\n?/g, '\n')].map(char => {
    if (char === '\n' || char === '\t') return char;
    return glyphs.has(char.codePointAt(0)) ? char : '?';
  }).join('');
}

function wrap(doc, text, width) {
  const lines = [];
  for (const paragraph of text.replace(/\n{3,}/g, '\n\n').split('\n')) {
    let current = '';
    for (const word of paragraph.trim().split(/\s+/).filter(Boolean)) {
      const next = current ? current + ' ' + word : word;
      if (doc.widthOfString(next) <= width) {
        current = next;
        continue;
      }
      if (current) lines.push(current);
      current = '';
      for (const char of word) {
        if (doc.widthOfString(current + char) > width && current) {
          lines.push(current);
          current = '';
        }
        current += char;
      }
    }
    lines.push(current);
  }
  return lines;
}

export async function createReportPdf(report) {
  const doc = new PDFDocument({ size:'A4', margin, bufferPages:true, info:{ Title:'LUNARA personal health report', Author:'LUNARA' } });
  const chunks = [];
  const bytes = new Promise((resolve, reject) => {
    doc.on('data', chunk => chunks.push(chunk));
    doc.once('end', () => resolve(Buffer.concat(chunks)));
    doc.once('error', reject);
  });
  doc.registerFont('Body', regular);
  doc.registerFont('Bold', bold);
  const width = doc.page.width - 2 * margin;
  const limit = doc.page.height - 80;
  const range = `${report.from} to ${report.to}`;
  const sections = reportSections(report);
  const unsupported = sections.some(section => section.rows.some(row => row.some(cell =>
    printable(cell) !== cell.normalize('NFC').replace(/\r\n?/g, '\n'))));
  let y;

  function textAt(text, x, at, { size = 10, weight = 'Body', color = ink, measure = width } = {}) {
    doc.font(weight).fontSize(size).fillColor(color).text(text, x, at, { width:measure, lineBreak:false });
  }

  function top(first) {
    doc.rect(margin, margin, width, first ? 125 : 46).fill(paper);
    textAt('LUNARA', margin + 16, margin + 12, { weight:'Bold', color:mauve });
    textAt(first ? 'Personal health report' : 'Personal health report / continued', margin + 16, margin + 29, { size:first ? 26 : 10, weight:'Bold' });
    if (first) {
      textAt(range, margin + 16, margin + 67, { size:11, color:muted });
      textAt('Saved tracking entries for personal reference or a care visit.', margin + 16, margin + 93, { color:muted });
    } else {
      textAt(range, margin + 273, margin + 18, { color:muted });
    }
    y = margin + (first ? 147 : 63);
  }

  function nextPage() {
    doc.addPage();
    top(false);
  }

  function rule(at) {
    doc.moveTo(margin, at).lineTo(margin + width, at).strokeColor(line).lineWidth(.7).stroke();
  }

  function paragraph(value, size = 9, color = muted) {
    doc.font('Body').fontSize(size);
    for (const piece of wrap(doc, value, width)) {
      if (y + rowStep > limit) nextPage();
      textAt(piece, margin, y, { size, color });
      y += rowStep;
    }
  }

  function titleAndHeader(section, continued = false) {
    textAt(section.title + (continued ? ' / continued' : ''), margin, y, { size:13, weight:'Bold' });
    y += 22;
    doc.rect(margin, y, width, 23).fill(paper);
    let x = margin;
    section.headers.forEach((header, i) => {
      textAt(header, x + 7, y + 5, { size:9, weight:'Bold', color:mauve, measure:width * section.widths[i] - 14 });
      x += width * section.widths[i];
    });
    y += 23;
  }

  function table(section) {
    if (!section.rows.length) return;
    if (y + 77 > limit) nextPage();
    titleAndHeader(section);
    for (const row of section.rows) {
      doc.font('Body').fontSize(9);
      const cells = row.map((cell, i) => wrap(doc, printable(cell), width * section.widths[i] - 14));
      const lines = Math.max(...cells.map(cell => cell.length));
      let offset = 0;
      while (offset < lines) {
        const remaining = Math.floor((limit - y - 11) / rowStep);
        if (remaining <= 0) {
          nextPage();
          titleAndHeader(section, true);
          continue;
        }
        const piece = Math.min(remaining, lines - offset);
        let x = margin;
        cells.forEach((cell, i) => {
          const measure = width * section.widths[i] - 14;
          for (let pos = 0; pos < piece; pos++) {
            const value = cell[offset + pos] ?? (i === 0 && !pos && offset ? cell[0] + ' (cont.)' : '');
            if (value) textAt(value, x + 7, y + 5 + pos * rowStep, { size:9, measure });
          }
          x += width * section.widths[i];
        });
        y += piece * rowStep + 9;
        rule(y);
        offset += piece;
      }
    }
    y += 17;
  }

  top(true);
  textAt('Within the selected dates', margin, y, { size:14, weight:'Bold' });
  y += 23;
  const totals = [
    [report.summary.recordedDays,'Recorded period days'], [report.moods.length,'Mood check-ins'],
    [report.symptoms.length,'Symptom entries'], [report.sleep.length,'Sleep entries'],
  ];
  totals.forEach(([value,label], i) => {
    const x = margin + i * width / totals.length;
    textAt(String(value), x, y, { size:18, weight:'Bold', color:mauve, measure:width / totals.length });
    textAt(label, x, y + 25, { size:8.5, color:muted, measure:width / totals.length });
  });
  y += 54;
  const summary = report.summary;
  const basics = [
    summary.averageEnergy !== null ? `Energy ${summary.averageEnergy}/5 (${summary.energyCount} logged)` : '',
    summary.averageStress !== null ? `Stress ${summary.averageStress}/5 (${summary.stressCount} logged)` : '',
    summary.averageSleepHours !== null ? `Sleep ${summary.averageSleepHours} h average` : '',
  ].filter(Boolean);
  if (basics.length) paragraph('Averages: ' + basics.join('  |  '));
  if (summary.moodCounts.length) paragraph('Mood entries: ' + summary.moodCounts.map(([name,count]) => `${name} ${count}`).join(', '));
  if (report.includeNotes) paragraph(report.notes.length ? 'Personal journal notes are included.' : 'No journal notes were recorded in this date range.');
  else paragraph('Personal journal notes are excluded.');
  paragraph('This report contains user-entered observations. Period ranges are clipped to the selected dates.');
  if (unsupported) paragraph('Some characters could not be shown in this PDF. The UTF-8 CSV preserves the original text.');
  y += 12;
  if (!sections.some(section => section.rows.length)) paragraph('No saved records fall within the selected dates.');
  for (const section of sections) table(section);
  const rangeOfPages = doc.bufferedPageRange();
  for (let i = 0; i < rangeOfPages.count; i++) {
    doc.switchToPage(rangeOfPages.start + i);
    const footerY = doc.page.height - 64;
    rule(footerY - 10);
    textAt('Private health information', margin, footerY, { size:8, color:muted });
    textAt(`Page ${i + 1} of ${rangeOfPages.count}`, doc.page.width - margin - 72, footerY, { size:8, color:muted, measure:72 });
  }
  doc.end();
  return bytes;
}

const csvValue = value => {
  let text = String(value ?? '');
  if (/^[\s\p{Cf}]*[=+@\-＝＋＠－]/u.test(text) || /^[\t\r\n]/.test(text)) text = "'" + text;
  return '"' + text.replace(/"/g, '""') + '"';
};

export function createReportCsv(report) {
  const records = [
    ['Type','Date','End date','Recorded days','Status','Mood','Energy (1-5)','Stress (1-5)','Time','Symptom','Severity','Sleep minutes','Sleep quality','Note','Interval days'],
    ...report.periods.map(row => ['Period',row.start,row.end,row.recordedDays,row.status]),
    ...report.intervals.map(row => ['Observed interval',row.from,row.to,'','','','','','','','','','','',row.days]),
    ...report.moods.map(row => ['Mood',row.date,'','','',row.mood,row.energy,row.stress]),
    ...report.symptoms.map(row => ['Symptom',row.date,'','','','','','',row.time,row.name,row.severity]),
    ...report.sleep.map(row => ['Sleep',row.date,'','','','','','','','','',row.minutes,row.quality]),
    ...report.notes.map(row => ['Journal',row.date,'','','','','','','','','','','',row.note]),
  ];
  return Buffer.from('\uFEFF' + records.map(row => Array.from({ length:records[0].length }, (_,i) => csvValue(row[i])).join(',')).join('\r\n') + '\r\n', 'utf8');
}
