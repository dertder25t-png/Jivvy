/**
 * Citation formatting utilities for APA, MLA, and Chicago styles
 */

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

export type CitationStyle = 'APA' | 'MLA' | 'Chicago';

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
  const formatted = citations
    .map(citation => formatCitation(citation, style))
    .join('\n\n');
  
  return header + formatted;
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
