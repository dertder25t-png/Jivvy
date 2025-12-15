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
  accessDate?: string;
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
  
  // Title
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
  
  switch (style) {
    case 'APA':
      return `(${author}, ${year || 'n.d.'}${page ? `, p. ${page}` : ''})`;
    case 'MLA':
      return `(${author}${page ? ` ${page}` : ''})`;
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
 * Copy text to clipboard
 */
export async function copyToClipboard(text: string): Promise<boolean> {
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
  const blob = new Blob([content], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
