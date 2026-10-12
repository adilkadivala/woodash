export type Note = { id: string; title: string; body: string; createdAt: string };

const notes = new Map<string, Note>();

export function saveNote(title: string, body: string): Note {
  const id = `note_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const note: Note = { id, title, body, createdAt: new Date().toISOString() };
  notes.set(id, note);
  return note;
}

export function listNotes(limit = 50): Note[] {
  return [...notes.values()]
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, limit);
}

export function getNote(id: string): Note | undefined {
  return notes.get(id);
}
