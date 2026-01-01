/**
 * Citation formatting utilities for APA, MLA, and Chicago styles
 */

import Cite from 'citation-js';

export interface Citation {
  id: string;
  title: string;
  author: string;
  type: "book" | "article" | "website" | "pdf";
  url?: string;
  page?: string;
  year?: string;
  publisher?: string;
  journal?: string;
  volume?: string;
  issue?: string;
  doi?: string;
}

export type CitationStyle = 'APA' | 'MLA' | 'Chicago' | 'Turabian';

type CslName = { family?: string; given?: string };

function toCslName(author: string): CslName {
  const trimmed = author.trim();
  if (!trimmed) return {};
  if (trimmed.includes(',')) {
    const [familyRaw, givenRaw] = trimmed.split(',');
    const family = familyRaw?.trim();
    const given = givenRaw?.trim();
    return {
      ...(family ? { family } : {}),
      ...(given ? { given } : {}),
    };
  }
  const parts = trimmed.split(/\s+/).filter(Boolean);
  if (parts.length === 1) return { family: parts[0] };
  const family = parts[parts.length - 1];
  const given = parts.slice(0, -1).join(' ');
  return { family, given };
}

function toIssuedYear(year?: string): { 'date-parts': number[][] } | undefined {
  if (!year) return undefined;
  const match = year.match(/\d{4}/);
  if (!match) return undefined;
  const asNumber = Number(match[0]);
  if (!Number.isFinite(asNumber)) return undefined;
  return { 'date-parts': [[asNumber]] };
}

function citationTypeToCsl(type: Citation['type']): string {
  switch (type) {
    case 'book':
      return 'book';
    case 'article':
      return 'article-journal';
    case 'website':
      return 'webpage';
    case 'pdf':
      return 'article';
    default:
      return 'article';
  }
}

function toCslItem(citation: Citation): Record<string, unknown> {
  const issued = toIssuedYear(citation.year);

  const item: Record<string, unknown> = {
    id: citation.id,
    type: citationTypeToCsl(citation.type),
    title: citation.title,
  };

  const authorName = toCslName(citation.author);
  if (authorName.family || authorName.given) {
    item.author = [authorName];
  }

  if (issued) item.issued = issued;
  if (citation.url) item.URL = citation.url;
  if (citation.publisher) item.publisher = citation.publisher;
  if (citation.journal) item['container-title'] = citation.journal;
  if (citation.volume) item.volume = citation.volume;
  if (citation.issue) item.issue = citation.issue;
  if (citation.page) item.page = citation.page;
  if (citation.doi) item.DOI = citation.doi;

  return item;
}

function styleToCslTemplate(style: CitationStyle): string {
  switch (style) {
    case 'APA':
      return 'apa';
    case 'MLA':
      return 'modern-language-association';
    case 'Chicago':
      return 'chicago-author-date';
    case 'Turabian':
      return 'turabian-fullnote-bibliography';
    default:
      return 'apa';
  }
}

function templatesToTry(style: CitationStyle): string[] {
  switch (style) {
    case 'APA':
      return ['apa'];
    case 'MLA':
      return ['mla', 'modern-language-association'];
    case 'Chicago':
      return ['chicago-author-date', 'chicago'];
    case 'Turabian':
      return ['turabian-fullnote-bibliography', 'turabian'];
    default:
      return ['apa'];
  }
}

function toTurabianName(author: string): { firstLast: string; lastFirst: string } {
  // Best-effort: author is currently stored as a single string.
  // If it already looks like "Last, First", preserve it.
  if (author.includes(',')) {
    const [last, rest] = author.split(',').map(s => s.trim());
    const firstLast = `${rest} ${last}`.trim();
    return { firstLast, lastFirst: `${last}, ${rest}`.trim() };
  }
  const parts = author.trim().split(/\s+/);
  if (parts.length <= 1) return { firstLast: author.trim(), lastFirst: author.trim() };
  const last = parts[parts.length - 1];
  const first = parts.slice(0, -1).join(' ');
  return { firstLast: `${first} ${last}`.trim(), lastFirst: `${last}, ${first}`.trim() };
}

/**
 * Turabian (Notes-Bibliography) footnote formatting (best-effort).
 * This is intentionally conservative and may not cover every edge case.
 */
export function formatTurabianFootnote(citation: Citation): string {
  const { title, publisher, year, url, journal, volume, issue, page, doi } = citation;
  const { firstLast } = toTurabianName(citation.author);

  // Articles / PDFs
  if (citation.type === 'article' || citation.type === 'pdf') {
    let out = `${firstLast}, "${title}."`;
    if (journal) {
      out += ` ${journal}`;
      if (volume) out += ` ${volume}`;
      if (issue) out += `, no. ${issue}`;
      if (year) out += ` (${year})`;
      if (page) out += `: ${page}`;
      out += '.';
    } else {
      if (publisher) out += ` ${publisher}`;
      if (year) out += ` (${year})`;
      out += '.';
    }
    if (doi) out += ` https://doi.org/${doi}.`;
    else if (url) out += ` ${url}.`;
    return out;
  }

  // Books
  if (citation.type === 'book') {
    let out = `${firstLast}, *${title}*`;
    if (publisher || year) {
      out += ` (${[publisher, year].filter(Boolean).join(', ')})`;
    }
    out += '.';
    if (page) out += ` ${page}.`;
    return out;
  }

  // Websites (fallback)
  let out = `${firstLast}, "${title}."`;
  if (publisher) out += ` ${publisher}.`;
  if (year) out += ` ${year}.`;
  if (url) out += ` ${url}.`;
  return out;
}

/**
 * Turabian (Notes-Bibliography) bibliography formatting (best-effort).
 */
export function formatTurabianBibliography(citation: Citation): string {
  const { title, publisher, year, url, journal, volume, issue, page, doi } = citation;
  const { lastFirst } = toTurabianName(citation.author);

  if (citation.type === 'article' || citation.type === 'pdf') {
    let out = `${lastFirst}. "${title}."`;
    if (journal) {
      out += ` ${journal}`;
      if (volume) out += ` ${volume}`;
      if (issue) out += `, no. ${issue}`;
      if (year) out += ` (${year})`;
      if (page) out += `: ${page}`;
      out += '.';
    } else {
      if (publisher) out += ` ${publisher}.`;
      if (year) out += ` ${year}.`;
    }
    if (doi) out += ` https://doi.org/${doi}.`;
    else if (url) out += ` ${url}.`;
    return out;
  }

  if (citation.type === 'book') {
    let out = `${lastFirst}. *${title}*.`;
    if (publisher) out += ` ${publisher}.`;
    if (year) out += ` ${year}.`;
    return out;
  }

  let out = `${lastFirst}. "${title}."`;
  if (publisher) out += ` ${publisher}.`;
  if (year) out += ` ${year}.`;
  if (url) out += ` ${url}.`;
  return out;
}

/**
 * Format a citation in APA style (7th edition)
 */
export function formatAPA(citation: Citation): string {
  const { author, year, title, url, publisher, journal, volume, issue, page, doi } = citation;
  
  let formatted = '';
  
  // Author (Last, F. M.)
  formatted += author;
  
  // Year
  if (year) {
    formatted += ` (${year}).`;
  } else {
    formatted += ' (n.d.).';
  }
  
  // Title (articles in regular text, books italicized)
  if (citation.type === 'article' || citation.type === 'pdf') {
    formatted += ` ${title}.`;
  } else {
    formatted += ` *${title}*.`;
  }
  
  // Journal/Publisher info
  if (journal) {
    formatted += ` *${journal}*`;
    if (volume) formatted += `, ${volume}`;
    if (issue) formatted += `(${issue})`;
    if (page) formatted += `, ${page}`;
    formatted += '.';
  } else if (publisher) {
    formatted += ` ${publisher}.`;
  }
  
  // DOI or URL
  if (doi) {
    formatted += ` https://doi.org/${doi}`;
  } else if (url) {
    formatted += ` ${url}`;
  }
  
  return formatted;
}

/**
 * Format a citation in MLA style (9th edition)
 */
export function formatMLA(citation: Citation): string {
  const { author, title, publisher, year, url, journal, volume, issue, page } = citation;
  
  let formatted = '';
  
  // Author (Last, First)
  formatted += `${author}.`;
  
  // Title
  if (citation.type === 'article' || citation.type === 'pdf') {
    formatted += ` "${title}."`;
  } else {
    formatted += ` *${title}*.`;
  }
  
  // Journal/Publisher info
  if (journal) {
    formatted += ` *${journal}*`;
    if (volume) formatted += `, vol. ${volume}`;
    if (issue) formatted += `, no. ${issue}`;
    if (year) formatted += `, ${year}`;
    if (page) formatted += `, pp. ${page}`;
    formatted += '.';
  } else if (publisher) {
    formatted += ` ${publisher}`;
    if (year) formatted += `, ${year}`;
    formatted += '.';
  }
  
  // URL
  if (url) {
    formatted += ` ${url}`;
  }
  
  return formatted;
}

/**
 * Format a citation in Chicago style (17th edition, Author-Date)
 */
export function formatChicago(citation: Citation): string {
  const { author, year, title, publisher, url, journal, volume, issue, page, doi } = citation;
  
  let formatted = '';
  
  // Author (Last, First)
  formatted += `${author}.`;
  
  // Year
  if (year) {
    formatted += ` ${year}.`;
  }
  
  // Title
  if (citation.type === 'article' || citation.type === 'pdf') {
    formatted += ` "${title}."`;
  } else {
    formatted += ` *${title}*.`;
  }
  
  // Journal/Publisher info
  if (journal) {
    formatted += ` *${journal}*`;
    if (volume) formatted += ` ${volume}`;
    if (issue) formatted += `, no. ${issue}`;
    if (page) formatted += `: ${page}`;
    formatted += '.';
  } else if (publisher) {
    formatted += ` ${publisher}.`;
  }
  
  // DOI or URL
  if (doi) {
    formatted += ` https://doi.org/${doi}.`;
  } else if (url) {
    formatted += ` ${url}.`;
  }
  
  return formatted;
}

/**
 * Format a citation based on the specified style
 */
export function formatCitation(citation: Citation, style: CitationStyle): string {
  switch (style) {
    case 'APA':
      return formatAPA(citation);
    case 'MLA':
      return formatMLA(citation);
    case 'Chicago':
      return formatChicago(citation);
    case 'Turabian':
      return formatTurabianBibliography(citation);
    default:
      return formatAPA(citation);
  }
}

/**
 * Format an inline citation for drag-and-drop
 */
export function formatInlineCitation(citation: Citation, style: CitationStyle): string {
  const { author, year, page } = citation;
  // Extract last name for MLA (assumes "Last, First" format)
  const lastName = author.split(',')[0].trim();
  
  switch (style) {
    case 'APA':
      return `(${author}, ${year || 'n.d.'}${page ? `, p. ${page}` : ''})`;
    case 'MLA':
      // MLA uses last name only and page without 'p.' prefix
      return `(${lastName}${page ? ` ${page}` : ''})`;
    case 'Chicago':
      return `(${author} ${year || 'n.d.'}${page ? `, ${page}` : ''})`;
    case 'Turabian':
      // Turabian notes-bibliography uses footnote numbers; emit a stable placeholder token.
      // Editors can render/replace this with an actual superscript number.
      return `[^cite:${citation.id}]`;
    default:
      return `(${author}, ${year || 'n.d.'}${page ? `, p. ${page}` : ''})`;
  }
}

/**
 * Export all citations as a formatted bibliography
 */
export function exportBibliography(citations: Citation[], style: CitationStyle): string {
  if (citations.length === 0) {
    return 'No citations to export.';
  }
  
  const header = `Bibliography (${style} Format)\n${'='.repeat(50)}\n\n`;

  try {
    const cslItems = citations.map(toCslItem);
    const cite = new Cite(cslItems);

    let formatted = '';
    for (const template of templatesToTry(style)) {
      try {
        formatted = cite
          .format('bibliography', {
            format: 'text',
            template,
            lang: 'en-US',
          })
          .trim();
        if (formatted) break;
      } catch {
        // Try next template id
      }
    }

    if (!formatted) {
      const fallback = citations.map(c => formatCitation(c, style)).join('\n\n');
      return header + fallback;
    }

    return header + formatted;
  } catch {
    const fallback = citations.map(citation => formatCitation(citation, style)).join('\n\n');
    return header + fallback;
  }
}

/**
 * Copy text to clipboard with fallback for unsupported environments
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  // Check if clipboard API is available
  if (!navigator.clipboard) {
    console.warn('Clipboard API not available');
    return false;
  }
  
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch (error) {
    console.error('Failed to copy to clipboard:', error);
    return false;
  }
}

/**
 * Download text as a file
 */
export function downloadAsFile(content: string, filename: string): void {
  // Sanitize filename to prevent XSS
  const sanitizedFilename = filename.replace(/[^a-z0-9.-]/gi, '_');
  
  const blob = new Blob([content], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = sanitizedFilename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
