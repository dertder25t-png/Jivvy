import type { Block } from '@/lib/db';

export type SuperLearnLecturePayload = {
  lectureId: string;
  lectureHash: string;
  text: string;
  sources: Array<{ blockId: string; excerpt: string; fullText: string }>;
};

export type SuperLearnConceptHit = {
  concept: string;
  sources: Array<{ blockId: string; excerpt: string }>;
};

export type SuperLearnWorkerResult = {
  lectureId: string;
  lectureHash: string;
  concepts: SuperLearnConceptHit[];
};

export function normalizeConcept(input: string): string {
  return String(input || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/^[^\p{L}\p{N}]+/u, '')
    .replace(/[^\p{L}\p{N}]+$/u, '');
}

export function hashText(text: string): string {
  // FNV-1a 32-bit
  let hash = 0x811c9dc5;
  const s = String(text ?? '');
  for (let i = 0; i < s.length; i++) {
    hash ^= s.charCodeAt(i);
    // hash *= 16777619 (with overflow)
    hash = (hash + ((hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24))) >>> 0;
  }
  return hash.toString(16).padStart(8, '0');
}

export function getLectureSuperLearnHash(block: Block): string | null {
  const meta = (block.metadata ?? {}) as any;
  const v = meta?.superLearn?.hash;
  return typeof v === 'string' && v.length > 0 ? v : null;
}

export function setLectureSuperLearnMeta(prev: Block['metadata'] | undefined, next: { hash: string; updatedAt: number }): Block['metadata'] {
  const base = (prev && typeof prev === 'object') ? { ...(prev as any) } : {};
  base.superLearn = { ...(base.superLearn || {}), hash: next.hash, updatedAt: next.updatedAt };
  return base;
}

export function collectProjectLecturePayloads(blocks: Block[], projectId: string): SuperLearnLecturePayload[] {
  const blockById = new Map<string, Block>();
  const childrenByParent = new Map<string, Block[]>();

  for (const b of blocks) {
    blockById.set(b.id, b);
    const pid = b.parent_id ?? '';
    const arr = childrenByParent.get(pid) ?? [];
    arr.push(b);
    childrenByParent.set(pid, arr);
  }

  const lectures = blocks
    .filter(b => b.type === 'lecture_container')
    .filter(b => b.parent_id === projectId || b.parent_id !== null); // keep nested lectures if present

  const payloads: SuperLearnLecturePayload[] = [];

  const collectDescendants = (rootId: string): Block[] => {
    const out: Block[] = [];
    const stack: string[] = [rootId];

    while (stack.length) {
      const pid = stack.pop() as string;
      const kids = childrenByParent.get(pid) ?? [];
      for (const k of kids) {
        out.push(k);
        stack.push(k.id);
      }
    }
    return out;
  };

  for (const lecture of lectures) {
    const descendants = collectDescendants(lecture.id)
      .filter(b => b.type !== 'lecture_container');

    const parts: string[] = [];
    if ((lecture.content || '').trim()) parts.push(String(lecture.content).trim());

    // Prefer text-like blocks; still include content from others if present.
    for (const d of descendants) {
      const t = String(d.content || '').trim();
      if (!t) continue;
      parts.push(t);
    }

    const fullText = parts.join('\n').trim();
    if (!fullText) continue;

    // Keep worker payload bounded.
    const clippedText = fullText.length > 30_000 ? fullText.slice(0, 30_000) : fullText;

    const sources: Array<{ blockId: string; excerpt: string; fullText: string }> = [];
    for (const d of descendants) {
      const t = String(d.content || '').replace(/\s+/g, ' ').trim();
      if (!t) continue;
      const excerpt = t.length > 240 ? t.slice(0, 240) + '…' : t;
      sources.push({ blockId: d.id, excerpt, fullText: t });
      if (sources.length >= 40) break;
    }

    payloads.push({
      lectureId: lecture.id,
      lectureHash: hashText(clippedText),
      text: clippedText,
      sources,
    });
  }

  return payloads;
}
